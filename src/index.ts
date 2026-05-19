import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { serve } from "bun";
import { neon } from "@neondatabase/serverless";
import index from "./index.html";

type SiteRow = {
  id: string;
  url: string;
  title: string;
  description: string;
  image: string | null;
  favicon: string | null;
  hostname: string;
  created_at: string | Date;
  updated_at: string | Date;
};

type SiteRecord = {
  id: string;
  url: string;
  title: string;
  description: string;
  image?: string;
  favicon?: string;
  hostname: string;
  createdAt: string;
  updatedAt: string;
};

type SiteInput = {
  url?: string;
  title?: string;
  description?: string;
  syncMetadata?: boolean;
};

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required.");
}

const ADMIN_SECRET = process.env.ADMIN_PORTAL_PASSCODE ?? "";
const ENV_PORT = Number(process.env.PORT ?? 3000);
const PORT = Number.isFinite(ENV_PORT) && ENV_PORT > 0 ? ENV_PORT : 3000;
const ADMIN_COOKIE = "iiith_admin_session";
const ADMIN_TTL_MS = 1000 * 60 * 60 * 12;
const sql = neon(DATABASE_URL);

function json(body: unknown, status = 200, headers: HeadersInit = {}) {
  return Response.json(body, { status, headers });
}

function normalizeText(value: string | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function siteLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function normalizeUrl(input: string) {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Site URL is required.");
  }

  try {
    return new URL(trimmed).href;
  } catch {
    return new URL(`https://${trimmed}`).href;
  }
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function readTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return match ? decodeHtml(normalizeText(match)) : "";
}

function readMeta(html: string, keys: string[]) {
  if (!html) {
    return "";
  }

  for (const key of keys) {
    const escaped = escapeRegex(key);
    const patterns = [
      new RegExp(
        `<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']+)["']`,
        "i",
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escaped}["']`,
        "i",
      ),
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern)?.[1];
      if (match) {
        return decodeHtml(match);
      }
    }
  }

  return "";
}

function readLinkHref(html: string, relValues: string[]) {
  if (!html) {
    return "";
  }

  for (const value of relValues) {
    const escaped = escapeRegex(value);
    const patterns = [
      new RegExp(
        `<link[^>]+rel=["'][^"']*${escaped}[^"']*["'][^>]+href=["']([^"']+)["']`,
        "i",
      ),
      new RegExp(
        `<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*${escaped}[^"']*["']`,
        "i",
      ),
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern)?.[1];
      if (match) {
        return decodeHtml(match);
      }
    }
  }

  return "";
}

function resolveUrl(value: string, base: string) {
  if (!value) {
    return "";
  }

  try {
    return new URL(value, base).href;
  } catch {
    return "";
  }
}

function toIso(value: string | Date) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapSite(row: SiteRow): SiteRecord {
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    description: row.description,
    image: row.image ?? undefined,
    favicon: row.favicon ?? undefined,
    hostname: row.hostname,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

async function ensureSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS sites (
      id text PRIMARY KEY,
      url text NOT NULL UNIQUE,
      title text NOT NULL,
      description text NOT NULL,
      image text,
      favicon text,
      hostname text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
}

async function listSites() {
  const rows = (await sql`
    SELECT id, url, title, description, image, favicon, hostname, created_at, updated_at
    FROM sites
    ORDER BY created_at DESC
  `) as SiteRow[];

  return rows.map(mapSite);
}

async function getSiteById(id: string) {
  const rows = (await sql`
    SELECT id, url, title, description, image, favicon, hostname, created_at, updated_at
    FROM sites
    WHERE id = ${id}
    LIMIT 1
  `) as SiteRow[];

  return rows[0] ? mapSite(rows[0]) : null;
}

async function fetchSiteMetadata(inputUrl: string) {
  const url = normalizeUrl(inputUrl);
  const parsed = new URL(url);
  let html = "";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(parsed.href, {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "user-agent": "IIIT-H-Online/1.0",
          accept: "text/html,application/xhtml+xml",
        },
      });
      html = await response.text();
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    html = "";
  }

  const hostname = parsed.hostname.replace(/^www\./, "");
  const title = normalizeText(
    readMeta(html, ["og:title", "twitter:title"]) || readTitle(html) || hostname,
  );
  const description = normalizeText(
    readMeta(html, ["og:description", "twitter:description", "description"]) ||
      `Community site at ${hostname}`,
  );
  const image = resolveUrl(readMeta(html, ["og:image", "twitter:image", "twitter:image:src"]), parsed.href);
  const favicon = resolveUrl(readLinkHref(html, ["icon", "shortcut icon", "apple-touch-icon"]), parsed.href);

  return {
    url: parsed.href,
    title,
    description,
    image: image || undefined,
    favicon: favicon || undefined,
    hostname,
  };
}

async function buildSite(input: SiteInput, existing?: SiteRecord) {
  const url = normalizeUrl(input.url ?? existing?.url ?? "");
  const shouldSync = input.syncMetadata ?? !existing;
  const metadata = shouldSync ? await fetchSiteMetadata(url) : null;
  const hostname = metadata?.hostname ?? siteLabel(url);
  const title = normalizeText(input.title) || metadata?.title || existing?.title || hostname;
  const description =
    normalizeText(input.description) ||
    metadata?.description ||
    existing?.description ||
    `Community site at ${hostname}`;

  return {
    url,
    title,
    description,
    image: metadata?.image ?? existing?.image ?? null,
    favicon: metadata?.favicon ?? existing?.favicon ?? null,
    hostname,
  };
}

function parseCookies(header: string | null) {
  const cookies = new Map<string, string>();

  if (!header) {
    return cookies;
  }

  for (const part of header.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (!rawKey) {
      continue;
    }

    cookies.set(rawKey, decodeURIComponent(rawValue.join("=")));
  }

  return cookies;
}

function isAuthenticated(req: Request) {
  if (!ADMIN_SECRET) {
    return false;
  }

  const token = parseCookies(req.headers.get("cookie")).get(ADMIN_COOKIE);
  if (!token) {
    return false;
  }

  const [expires, signature] = token.split(".");
  if (!expires || !signature || Number(expires) <= Date.now()) {
    return false;
  }

  const expected = createHmac("sha256", ADMIN_SECRET).update(expires).digest("base64url");
  if (expected.length !== signature.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

function mintSessionCookie() {
  const expires = String(Date.now() + ADMIN_TTL_MS);
  const signature = createHmac("sha256", ADMIN_SECRET).update(expires).digest("base64url");

  return `${ADMIN_COOKIE}=${expires}.${signature}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${
    ADMIN_TTL_MS / 1000
  }`;
}

function clearSessionCookie() {
  return `${ADMIN_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;
}

await ensureSchema();

const server = serve({
  port: PORT,
  routes: {
    "/api/sites": {
      async GET() {
        return json({ sites: await listSites() });
      },
    },

    "/api/admin/status": {
      async GET(req) {
        return json({
          authenticated: isAuthenticated(req),
          configured: Boolean(ADMIN_SECRET),
        });
      },
    },

    "/api/admin/login": {
      async POST(req) {
        if (!ADMIN_SECRET) {
          return json({ error: "ADMIN_PORTAL_PASSCODE is not configured." }, 503);
        }

        const body = (await req.json().catch(() => null)) as { passcode?: string } | null;
        const passcode = body?.passcode ?? "";
        const secret = ADMIN_SECRET;

        if (passcode.length !== secret.length) {
          return json({ error: "Invalid passcode." }, 401);
        }

        if (!timingSafeEqual(Buffer.from(passcode), Buffer.from(secret))) {
          return json({ error: "Invalid passcode." }, 401);
        }

        return json(
          { ok: true },
          200,
          {
            "Set-Cookie": mintSessionCookie(),
          },
        );
      },
    },

    "/api/admin/logout": {
      async POST() {
        return json(
          { ok: true },
          200,
          {
            "Set-Cookie": clearSessionCookie(),
          },
        );
      },
    },

    "/api/admin/sites": {
      async POST(req) {
        if (!isAuthenticated(req)) {
          return json({ error: "Unauthorized." }, 401);
        }

        const body = (await req.json().catch(() => null)) as SiteInput | null;
        const input = body ?? {};

        try {
          const site = await buildSite({ ...input, syncMetadata: true });
          const id = randomUUID();
          const rows = (await sql`
            INSERT INTO sites (id, url, title, description, image, favicon, hostname, created_at, updated_at)
            VALUES (
              ${id},
              ${site.url},
              ${site.title},
              ${site.description},
              ${site.image},
              ${site.favicon},
              ${site.hostname},
              now(),
              now()
            )
            ON CONFLICT (url) DO NOTHING
            RETURNING id, url, title, description, image, favicon, hostname, created_at, updated_at
          `) as SiteRow[];

          if (!rows.length) {
            return json({ error: "A site with that URL already exists." }, 409);
          }

          return json({
            site: mapSite(rows[0]),
            sites: await listSites(),
          });
        } catch (error) {
          return json(
            {
              error: error instanceof Error ? error.message : "Unable to add site.",
            },
            400,
          );
        }
      },
    },

    "/api/admin/sites/:id": {
      async PUT(req) {
        if (!isAuthenticated(req)) {
          return json({ error: "Unauthorized." }, 401);
        }

        const id = req.params.id;
        const existing = await getSiteById(id);
        if (!existing) {
          return json({ error: "Site not found." }, 404);
        }

        const body = (await req.json().catch(() => null)) as SiteInput | null;
        const input = body ?? {};
        const nextUrl = normalizeUrl(input.url ?? existing.url);
        const nextInput = {
          ...input,
          url: nextUrl,
          syncMetadata:
            input.syncMetadata ?? nextUrl !== existing.url,
        };

        try {
          const site = await buildSite(nextInput, existing);
          const rows = (await sql`
            UPDATE sites
            SET
              url = ${site.url},
              title = ${site.title},
              description = ${site.description},
              image = ${site.image},
              favicon = ${site.favicon},
              hostname = ${site.hostname},
              updated_at = now()
            WHERE id = ${id}
            RETURNING id, url, title, description, image, favicon, hostname, created_at, updated_at
          `) as SiteRow[];

          return json({
            site: mapSite(rows[0]),
            sites: await listSites(),
          });
        } catch (error) {
          return json(
            {
              error: error instanceof Error ? error.message : "Unable to update site.",
            },
            400,
          );
        }
      },

      async DELETE(req) {
        if (!isAuthenticated(req)) {
          return json({ error: "Unauthorized." }, 401);
        }

        const id = req.params.id;
        const rows = (await sql`
          DELETE FROM sites
          WHERE id = ${id}
          RETURNING id
        `) as { id: string }[];

        if (!rows.length) {
          return json({ error: "Site not found." }, 404);
        }

        return json({ ok: true, sites: await listSites() });
      },
    },

    "/*": index,
  },

  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);
