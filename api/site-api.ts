import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import { neon } from "@neondatabase/serverless";

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

export type SiteRecord = {
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

export type SiteInput = {
  url?: string;
  title?: string;
  description?: string;
  syncMetadata?: boolean;
};

type ApiOptions = {
  databaseUrl?: string;
  adminSecret?: string;
};

function json(body: unknown, status = 200, headers: HeadersInit = {}) {
  return Response.json(body, {
    status,
    headers: {
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "referrer-policy": "no-referrer",
      ...headers,
    },
  });
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

class PublicUrlError extends Error {}

const BLOCKED_V4: [number, number][] = [
  [0x00000000, 8], // 0.0.0.0/8
  [0x0a000000, 8], // 10.0.0.0/8
  [0x64400000, 10], // 100.64.0.0/10 CGNAT
  [0x7f000000, 8], // 127.0.0.0/8
  [0xa9fe0000, 16], // 169.254.0.0/16 link-local
  [0xac100000, 12], // 172.16.0.0/12
  [0xc0000000, 24], // 192.0.0.0/24
  [0xc0000200, 24], // 192.0.2.0/24 TEST-NET
  [0xc0a80000, 16], // 192.168.0.0/16
  [0xc6120000, 15], // 198.18.0.0/15 benchmarking
  [0xc6336400, 24], // 198.51.100.0/24 TEST-NET
  [0xcb007100, 24], // 203.0.113.0/24 TEST-NET
  [0xe0000000, 4], // 224.0.0.0/4 multicast
  [0xf0000000, 4], // 240.0.0.0/4 reserved
  [0xffffffff, 32], // 255.255.255.255/32
];

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) {
    return null;
  }

  let value = 0;
  for (const part of parts) {
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) {
      return null;
    }
    value = value * 256 + octet;
  }

  return value;
}

function ipv6ToGroups(ip: string): number[] | null {
  const doubleColon = ip.indexOf("::");
  const head = doubleColon === -1 ? ip : ip.slice(0, doubleColon);
  const tail = doubleColon === -1 ? "" : ip.slice(doubleColon + 2);
  const headParts = head ? head.split(":") : [];
  const tailParts = tail ? tail.split(":") : [];
  if (headParts.length + tailParts.length > 8) {
    return null;
  }

  const groups: number[] = [];
  for (let i = 0; i < headParts.length + tailParts.length; i++) {
    const part = i < headParts.length ? headParts[i] : tailParts[i - headParts.length];
    if (part.includes(".")) {
      if (i !== headParts.length + tailParts.length - 1) {
        return null; // dotted-quad form only valid as the final group
      }
      const v4 = ipv4ToInt(part);
      if (v4 === null) {
        return null;
      }
      groups.push(v4 >> 16, v4 & 0xffff);
    } else if (/^[0-9a-fA-F]{1,4}$/.test(part)) {
      groups.push(parseInt(part, 16));
    } else {
      return null;
    }
  }
  if (groups.length > 8) {
    return null;
  }

  const headGroups = groups.slice(0, headParts.length);
  const tailGroups = groups.slice(headParts.length);
  return [...headGroups, ...Array(8 - groups.length).fill(0), ...tailGroups];
}

export function isBlockedAddress(address: string): boolean {
  const v4 = ipv4ToInt(address);
  if (v4 !== null) {
    return BLOCKED_V4.some(([base, prefix]) => v4 >= base && v4 < base + 2 ** (32 - prefix));
  }

  const groups = ipv6ToGroups(address);
  if (!groups) {
    return false;
  }

  if (groups.every((g) => g === 0) || (groups[7] === 1 && groups.slice(0, 7).every((g) => g === 0))) {
    return true; // :: and ::1
  }
  if ((groups[0] & 0xfe00) === 0xfc00) {
    return true; // fc00::/7 unique local
  }
  if ((groups[0] & 0xffc0) === 0xfe80) {
    return true; // fe80::/10 link-local
  }
  if ((groups[0] & 0xff00) === 0xff00) {
    return true; // ff00::/8 multicast
  }
  if (groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff) {
    return isBlockedAddress(`${groups[6] >> 8}.${groups[6] & 0xff}.${groups[7] >> 8}.${groups[7] & 0xff}`);
  }

  return false;
}

async function fetchPublic(url: URL, signal: AbortSignal, redirectsLeft = 5): Promise<Response> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new PublicUrlError("Only http(s) URLs are allowed.");
  }

  const addresses = await lookup(url.hostname, { all: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isBlockedAddress(address))) {
    throw new PublicUrlError("Private network addresses are not allowed.");
  }

  // https fetches the checked IP directly (TLS servername keeps SNI/certs correct), closing the
  // DNS-rebinding window; http stays hostname-based since raw-IP http breaks on hostname-routed proxies.
  let target = url;
  const headers: Record<string, string> = {
    "user-agent": "IIIT-H-Online/1.0",
    accept: "text/html,application/xhtml+xml",
  };
  if (url.protocol === "https:") {
    const address = addresses.find((a) => a.family === 4) ?? addresses[0];
    target = new URL(url.href);
    target.hostname = address.address;
    headers.host = url.host;
  }

  const response = await fetch(target, {
    redirect: "manual",
    signal,
    headers,
    ...(target !== url ? { tls: { servername: url.hostname } } : {}),
  });

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (!location || redirectsLeft <= 0) {
      throw new PublicUrlError("Too many redirects.");
    }

    let next: URL;
    try {
      next = new URL(location, url);
    } catch {
      throw new PublicUrlError("Invalid redirect target.");
    }
    return fetchPublic(next, signal, redirectsLeft - 1);
  }

  return response;
}


export function createSitesApi({ databaseUrl, adminSecret = "" }: ApiOptions) {
  const sql = databaseUrl ? neon(databaseUrl) : null;
  const adminCookie = "iiith_admin_session";
  const adminTtlMs = 1000 * 60 * 60 * 12;
  const loginLimit = 10;
  const loginWindowMs = 5 * 60 * 1000;
  const loginAttempts = new Map<string, { count: number; resetAt: number }>();

  function loginRateLimited(ip: string) {
    const now = Date.now();
    const entry = loginAttempts.get(ip);
    if (!entry || entry.resetAt <= now) {
      loginAttempts.set(ip, { count: 1, resetAt: now + loginWindowMs });
      return false;
    }

    entry.count += 1;
    if (loginAttempts.size > 1000) {
      for (const [key, value] of loginAttempts) {
        if (value.resetAt <= now) {
          loginAttempts.delete(key);
        }
      }
    }
    return entry.count > loginLimit;
  }

  async function ensureSchema() {
    if (!sql) {
      return;
    }

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

    // existing databases predate the UNIQUE clause; CREATE TABLE IF NOT EXISTS does not retrofit it
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS sites_url_key ON sites (url)`;
  }

  async function listSites() {
    if (!sql) {
      return [];
    }

    const rows = (await sql`
      SELECT id, url, title, description, image, favicon, hostname, created_at, updated_at
      FROM sites
      ORDER BY created_at DESC
    `) as SiteRow[];

    return rows.map(mapSite);
  }

  async function getSiteById(id: string) {
    if (!sql) {
      return null;
    }

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
        const response = await fetchPublic(parsed, controller.signal);
        html = await response.text();
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      if (error instanceof PublicUrlError) {
        throw error;
      }
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

  function isAuthenticated(request: Request) {
    if (!adminSecret) {
      return false;
    }

    const token = parseCookies(request.headers.get("cookie")).get(adminCookie);
    if (!token) {
      return false;
    }

    const [expires, signature] = token.split(".");
    if (!expires || !signature || Number(expires) <= Date.now()) {
      return false;
    }

    const expected = createHmac("sha256", adminSecret).update(expires).digest("base64url");
    if (expected.length !== signature.length) {
      return false;
    }

    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }

  function log(action: string, clientIp: string) {
    console.log(`[admin] ${new Date().toISOString()} ${clientIp} ${action}`);
  }

  function mintSessionCookie() {
    const expires = String(Date.now() + adminTtlMs);
    const signature = createHmac("sha256", adminSecret).update(expires).digest("base64url");

    return `${adminCookie}=${expires}.${signature}; HttpOnly; Path=/; SameSite=Lax; Secure; Max-Age=${
      adminTtlMs / 1000
    }`;
  }

  function clearSessionCookie() {
    return `${adminCookie}=; HttpOnly; Path=/; SameSite=Lax; Secure; Max-Age=0`;
  }

  let readyPromise: Promise<void> | null = null;

  function ready() {
    if (!readyPromise) {
      readyPromise = ensureSchema();
    }

    return readyPromise;
  }

  async function handleRequest(request: Request, clientIp = "unknown") {
    if (!sql) {
      return json({ error: "DATABASE_URL is not configured." }, 503);
    }

    try {
      await ready();
    } catch (error) {
      return json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Database initialization failed.",
        },
        503,
      );
    }

    try {
      const { pathname } = new URL(request.url);
      const segments = pathname.split("/").filter(Boolean);
      const method = request.method.toUpperCase();

      if (pathname === "/api/sites" && method === "GET") {
        return json({ sites: await listSites() });
      }

      if (pathname === "/api/admin/status" && method === "GET") {
        return json({
          authenticated: isAuthenticated(request),
          configured: Boolean(adminSecret),
        });
      }

      if (pathname === "/api/admin/login" && method === "POST") {
        if (!adminSecret) {
          return json({ error: "ADMIN_PORTAL_PASSCODE is not configured." }, 503);
        }

        if (loginRateLimited(clientIp)) {
          return json({ error: "Too many attempts. Try again later." }, 429);
        }

        const body = (await request.json().catch(() => null)) as { passcode?: string } | null;
        const passcode = body?.passcode ?? "";

        const passcodeHash = createHash("sha256").update(passcode).digest();
        const secretHash = createHash("sha256").update(adminSecret).digest();
        if (!timingSafeEqual(passcodeHash, secretHash)) {
          log("login failed", clientIp);
          return json({ error: "Invalid passcode." }, 401);
        }

        log("login ok", clientIp);
        return json(
          { ok: true },
          200,
          {
            "Set-Cookie": mintSessionCookie(),
          },
        );
      }

      if (pathname === "/api/admin/logout" && method === "POST") {
        return json(
          { ok: true },
          200,
          {
            "Set-Cookie": clearSessionCookie(),
          },
        );
      }

      if (segments[0] === "api" && segments[1] === "admin" && segments[2] === "sites" && segments.length === 3) {
        if (method === "POST") {
          if (!isAuthenticated(request)) {
            log(`unauthorized ${method} ${pathname}`, clientIp);
            return json({ error: "Unauthorized." }, 401);
          }

          const body = (await request.json().catch(() => null)) as SiteInput | null;
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

            const created = rows[0];
            if (!created) {
              return json({ error: "Unable to add site." }, 500);
            }

            log(`create ${site.url}`, clientIp);
            return json({
              site: mapSite(created),
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
        }
      }

      if (segments[0] === "api" && segments[1] === "admin" && segments[2] === "sites" && segments.length === 4) {
        const id = decodeURIComponent(segments[3] ?? "");
        if (!id) {
          return json({ error: "Site not found." }, 404);
        }

        if (method === "PUT") {
          if (!isAuthenticated(request)) {
            log(`unauthorized ${method} ${pathname}`, clientIp);
            return json({ error: "Unauthorized." }, 401);
          }

          const existing = await getSiteById(id);
          if (!existing) {
            return json({ error: "Site not found." }, 404);
          }

          const body = (await request.json().catch(() => null)) as SiteInput | null;
          const input = body ?? {};
          const nextUrl = normalizeUrl(input.url ?? existing.url);
          const nextInput = {
            ...input,
            url: nextUrl,
            syncMetadata: input.syncMetadata ?? nextUrl !== existing.url,
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

            const updated = rows[0];
            if (!updated) {
              return json({ error: "Unable to update site." }, 500);
            }

            log(`update ${id}`, clientIp);
            return json({
              site: mapSite(updated),
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
        }

        if (method === "DELETE") {
          if (!isAuthenticated(request)) {
            log(`unauthorized ${method} ${pathname}`, clientIp);
            return json({ error: "Unauthorized." }, 401);
          }

          const rows = (await sql`
            DELETE FROM sites
            WHERE id = ${id}
            RETURNING id
          `) as { id: string }[];

          if (!rows.length) {
            return json({ error: "Site not found." }, 404);
          }

          log(`delete ${id}`, clientIp);
          return json({ ok: true, sites: await listSites() });
        }
      }

      return json({ error: "Not found." }, 404);
    } catch {
      return json({ error: "Unexpected server error." }, 500);
    }
  }

  return {
    ready,
    handleRequest,
  };
}
