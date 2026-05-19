import { createSitesApi } from "../../site-api";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required.");
}

const api = createSitesApi({
  databaseUrl: DATABASE_URL,
  adminSecret: process.env.ADMIN_PORTAL_PASSCODE ?? "",
});

async function handle(request: Request) {
  await api.ready();
  return api.handleRequest(request);
}

export async function PUT(request: Request) {
  return handle(request);
}

export async function DELETE(request: Request) {
  return handle(request);
}
