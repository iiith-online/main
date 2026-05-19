# IIIT-H Online

Minimal site directory with a public listing page and a passcode-locked admin page.

## Setup

```bash
bun install
```

Set these environment variables before starting the app:

```bash
DATABASE_URL=your-neon-connection-string
ADMIN_PORTAL_PASSCODE=your-passcode
```

## Commands

```bash
bun dev
```

Starts the app in development mode with hot reload.

```bash
bun start
```

Runs the production server.

```bash
bun run build
```

Builds the browser bundle.

## Database

The server auto-creates a single `sites` table in Neon Postgres on startup. Public data is read from that table, and the admin page uses it to add, update, or remove sites.
