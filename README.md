# Lover's Code

A relationship-focused web app: AI companion chat (Google Gemini), real-time multiplayer sessions (Socket.IO), solo activities, and history. Frontend is a React + TypeScript SPA; the API is Node (Express) with optional Supabase and PostgreSQL or local SQLite.

## Stack

| Layer | Technologies |
|--------|----------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query |
| Backend | Node.js, Express, Socket.IO, JWT auth |
| Data | PostgreSQL (`DATABASE_URL`) or SQLite on disk; optional Supabase for users / multiplayer sync |
| AI | Google Gemini (see `backend/gemini-client.js`) |
| Deploy | Self-hosted VM (see below): Node API + static SPA, optional nginx reverse proxy |

## Prerequisites

- Node.js 18+
- npm

## Install and run (frontend)

```sh
npm install
npm run dev
```

Vite dev server port defaults via `vite.config.ts` (often `http://localhost:5729`). The app uses `src/config/site.ts`: in **development** the API defaults to `http://localhost:4000`; in **production builds** the API defaults to **same origin** as the page unless you set `VITE_API_BASE_URL`. Set `VITE_PUBLIC_APP_URL` if invite links must point at a fixed public URL. See root `.env.example`.

## Backend

Install dependencies for the API (from repo root or `backend/`):

```sh
cd backend
npm install
cp .env.example .env
# Edit .env — at minimum JWT_SECRET, GEMINI_API_KEY, and optionally DATABASE_URL / Supabase
node server.js
```

Or from repository root:

```sh
npm run dev:backend
```

### Required environment variables

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | Signing key for user JWTs |
| `GEMINI_API_KEY` | Gemini API (aliases supported — see `backend/env-validator.js`) |

### Common optional variables

| Variable | Purpose |
|----------|---------|
| `PORT` | Listen port (default `4000`) |
| `CORS_ORIGIN` | **Production:** HTTPS (or HTTP) origin of the SPA, e.g. `https://your-vm.example.com` — required for browser API access |
| `TRUST_PROXY` | Set to `0` if Node listens directly (no reverse proxy); default trusts one proxy hop for correct client IPs |
| `DATABASE_URL` | If set, uses PostgreSQL; otherwise SQLite under `backend/data/` |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Supabase-backed auth and multiplayer when configured |
| `MAINTENANCE_SECRET` | **Production:** required for `/api/maintenance/*`; send header `X-Maintenance-Key` with the same value. Without it, those routes return **503**. In development, unset = maintenance routes allowed (see warning in logs). |

Never commit real `.env` files.

## Self-hosted VM (production)

Step-by-step (Oracle Cloud / any Linux VM, `loverscode.duckdns.org`, nginx, PM2): **`SERVER_DEPLOY.md`** (includes a **round-up checklist** at the bottom).

Typical setup: **nginx** (or Caddy) terminates TLS and proxies `/` to static files from `npm run build`, `/api` and `/socket.io` to `node backend/server.js` on port **4000** so the browser uses **one origin**. Then leave `VITE_API_BASE_URL` unset in the built SPA; set backend **`CORS_ORIGIN`** to that same origin (e.g. `https://lovers.example.com`). If the API is on another host, set **`VITE_API_BASE_URL`** and **`CORS_ORIGIN`** to the SPA origin, **`VITE_SOCKET_URL`** to the API WebSocket base if needed, and **`VITE_PUBLIC_APP_URL`** for invite links.

### Production checklist

| Status | Item |
|--------|------|
| Done | **JWT** required for AI companion, conversations, multiplayer REST, stats, and in-memory **session inspect** (`/api/sessions/*`); **`Authorization: Bearer`** sent from `jsonAuthHeaders` / `apiClient` |
| Done | **Removed** legacy Mongoose/Vercel `api/` routes, **`ai_conversation.js`**, obsolete deploy/fix markdown, `render.yaml`, `vercel.json` |
| Done | **`GET /health`** minimal in production; **`GET /`** never exposes session IDs; **`/api/test`** and **`/api/auth/test`** removed |
| Open | **Test coverage**: only maintenance + sanitize; add API tests when you prioritize |
| Open | **Socket.IO** join is still session-code based (consider JWT socket middleware later) |

Log in (or register) **before** using AI companion, multiplayer session list/create, and history pages — unauthenticated requests return **401**.

## Security notes

- **AI, conversations, multiplayer HTTP API, stats, monitor `/api/stats`**: require a valid **JWT** (`authenticateToken`).
- Maintenance endpoints (`/api/maintenance/cleanup`, `/api/maintenance/size`) are gated by `MAINTENANCE_SECRET` + `X-Maintenance-Key` in production.
- `GET /api/debug/routes` is **development only** (not registered when `NODE_ENV=production`).
- **Registration / login** stay public; do not commit `.env` or real secrets.

## Testing

```sh
npm install
npm test
npm run test:watch
npm run test:coverage
```

Tests live next to source (`*.test.ts`, `backend/**/*.test.js`) and run under Vitest.

## API overview

- **Auth:** `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `GET /api/auth/profile`, …
- **AI companion:** `POST /api/ai-companion/initialize`, `POST /api/ai-companion/chat`
- **Multiplayer:** REST under `/api/multiplayer/…` plus Socket.IO events (see `MultiplayerPage` / backend `server.js`)
- **Health:** `GET /health` (minimal JSON in production)

More detail: `backend/README.md`, `backend/API_SETUP.md`, `SUPABASE_QUICK_SETUP.md`.

## Contributing

1. Fork the repository  
2. Create a feature branch  
3. Run `npm run lint` and `npm test` before opening a PR  

## License

MIT License.

## Support

Open an issue on GitHub or contact the maintainers.
