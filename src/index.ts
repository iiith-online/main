import { serve } from "bun";
import index from "./index.html";
import { createSitesApi } from "../api/site-api";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required.");
}

const ADMIN_SECRET = process.env.ADMIN_PORTAL_PASSCODE ?? "";
const ENV_PORT = Number(process.env.PORT ?? 3000);
const PORT = Number.isFinite(ENV_PORT) && ENV_PORT > 0 ? ENV_PORT : 3000;

const api = createSitesApi({
  databaseUrl: DATABASE_URL,
  adminSecret: ADMIN_SECRET,
});

await api.ready();

const server = serve({
  port: PORT,
  routes: {
    "/api/sites": {
      async GET(req) {
        return api.handleRequest(req);
      },
    },

    "/api/admin/status": {
      async GET(req) {
        return api.handleRequest(req);
      },
    },

    "/api/admin/login": {
      async POST(req, server) {
        return api.handleRequest(req, server.requestIP(req)?.address);
      },
    },

    "/api/admin/logout": {
      async POST(req) {
        return api.handleRequest(req);
      },
    },

    "/api/admin/sites": {
      async POST(req) {
        return api.handleRequest(req);
      },
    },

    "/api/admin/sites/:id": {
      async PUT(req) {
        return api.handleRequest(req);
      },

      async DELETE(req) {
        return api.handleRequest(req);
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
