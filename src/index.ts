import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { serve } from "bun";
import index from "./index.html";

type SiteRecord = {
  id: string;
  url: string;
  title: string;
  description: string;
  image?: string;
  favicon?: string;
  hostname: string;
  createdAt: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "sites.json");
const ADMIN_COOKIE = "iiith_admin_session";
const ADMIN_TTL_MS = 1000 * 60 * 60 * 12;
const ADMIN_SECRET = process.env.ADMIN_PORTAL_PASSCODE ?? "";
const ENV_PORT = Number(process.env.PORT ?? 3000);
const PORT = Number.isFinite(ENV_PORT) && ENV_PORT > 0 ? ENV_PORT : 3000;

const seedSites: SiteRecord[] = [
  {
    id: "seed-days-since-disaster",
    url: "https://disaster.iiith.online/",
    title: "IIIT-H Days Since Disaster",
    description: "Tracking the days since the last major disaster at IIIT-H.",
    hostname: "disaster.iiith.online",
    createdAt: "2026-05-19T00:00:00.000Z",
  },
];

function json(body: unknown, status = 200, headers: HeadersInit = {}) {
  return Response.json(body, { status, headers });
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

function normalizeText(value: string | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function readTag(html: string, tag: "meta" | "title" | "link", attribute: string, values: string[]) {
  if (!html) {
    return "";
  }

  for (const value of values) {
    const escaped = escapeRegex(value);
    const patterns = [
      new RegExp(
        `<${tag}[^>]*${attribute}=["']${escaped}["'][^>]*content=["']([^"']+)["']`,
        "i",
      ),
      new RegExp(
        `<${tag}[^>]*content=["']([^"']+)["'][^>]*${attribute}=["']${escaped}["']`,
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
        `<link[^>]*rel=["'][^"']*${escaped}[^"']*["'][^>]*href=["']([^"']+)["']`,
        "i",
      ),
      new RegExp(
        `<link[^>]*href=["']([^"']+)["'][^>]*rel=["'][^"']*${escaped}[^"']*["']`,
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

function readTitle(html: string) {
  return decodeHtml(normalizeText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]));
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

function getFavicon(html: string, baseUrl: string) {
  const iconHref = readLinkHref(html, ["icon", "shortcut icon", "apple-touch-icon"]);
  return resolveUrl(iconHref, baseUrl);
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
  if (!expires || !signature) {
    return false;
  }

  if (Number(expires) <= Date.now()) {
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

async function ensureDataFile() {
  await mkdir(DATA_DIR, { recursive: true });

  try {
    await readFile(DATA_FILE, "utf8");
  } catch {
    await writeFile(DATA_FILE, JSON.stringify(seedSites, null, 2), "utf8");
  }
}

async function readSites() {
  await ensureDataFile();

  try {
    const raw = await readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [...seedSites];
    }

    const sites: SiteRecord[] = [];

    for (const entry of parsed) {
      if (!entry || typeof entry.url !== "string" || typeof entry.title !== "string") {
        continue;
      }

      let hostname = "";
      try {
        hostname = typeof entry.hostname === "string" && entry.hostname ? entry.hostname : new URL(entry.url).hostname;
      } catch {
        hostname = "";
      }

      sites.push({
        id: typeof entry.id === "string" && entry.id ? entry.id : randomUUID(),
        url: entry.url,
        title: entry.title,
        description:
          typeof entry.description === "string" && entry.description
            ? entry.description
            : `Community site at ${hostname || "unknown host"}`,
        image: typeof entry.image === "string" && entry.image ? entry.image : undefined,
        favicon: typeof entry.favicon === "string" && entry.favicon ? entry.favicon : undefined,
        hostname,
        createdAt: typeof entry.createdAt === "string" && entry.createdAt ? entry.createdAt : new Date().toISOString(),
      });
    }

    return sites.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [...seedSites];
  }
}

async function saveSites(sites: SiteRecord[]) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(sites, null, 2), "utf8");
}

async function fetchSiteMetadata(inputUrl: string): Promise<SiteRecord> {
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
          "user-agent": "IIITH-Online/1.0",
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

  const title = normalizeText(
    readTag(html, "meta", "property", ["og:title", "twitter:title"]) ||
      readTitle(html) ||
      parsed.hostname.replace(/^www\./, ""),
  );

  const description = normalizeText(
    readTag(html, "meta", "property", ["og:description", "twitter:description"]) ||
      readTag(html, "meta", "name", ["description"]) ||
      `Community site at ${parsed.hostname.replace(/^www\./, "")}`,
  );

  const image = resolveUrl(
    readTag(html, "meta", "property", ["og:image", "twitter:image", "twitter:image:src"]),
    parsed.href,
  );

  const favicon = getFavicon(html, parsed.href);

  return {
    id: randomUUID(),
    url: parsed.href,
    title,
    description,
    image: image || undefined,
    favicon: favicon || undefined,
    hostname: parsed.hostname,
    createdAt: new Date().toISOString(),
  };
}

await ensureDataFile();

if (process.env.DISABLE_SERVER !== "1") {
  const server = serve({
    port: PORT,
    routes: {
      "/api/sites": {
        async GET() {
          const sites = await readSites();
          return json({ sites });
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

          return json({ ok: true }, 200, {
            "Set-Cookie": mintSessionCookie(),
          });
        },
      },

      "/api/admin/logout": {
        async POST() {
          return json({ ok: true }, 200, {
            "Set-Cookie": clearSessionCookie(),
          });
        },
      },

      "/api/admin/sites": {
        async POST(req) {
          if (!isAuthenticated(req)) {
            return json({ error: "Unauthorized." }, 401);
          }

          const body = (await req.json().catch(() => null)) as { url?: string } | null;
          const rawUrl = body?.url ?? "";

          let site: SiteRecord;
          try {
            site = await fetchSiteMetadata(rawUrl);
          } catch (error) {
            return json(
              {
                error: error instanceof Error ? error.message : "Unable to add site.",
              },
              400,
            );
          }

          const sites = await readSites();
          const withoutDuplicate = sites.filter((entry) => entry.url !== site.url);
          const nextSites = [site, ...withoutDuplicate].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          await saveSites(nextSites);

          return json({ site, sites: nextSites });
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
}
