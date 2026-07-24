# Deploying Vision Academy to Vercel

This guide covers deploying the **frontend (Vite)** and **API (Express as a Vercel Serverless Function)** from this pnpm monorepo, with **Neon PostgreSQL** as the database.

The API no longer uses legacy `builds` / `routes` or a bundled `dist/index.mjs` on Vercel. Instead, Vercel runs `api/index.ts`, which exports the Express app from `artifacts/api-server/src/app.ts`.

---

## Prerequisites

- [Vercel account](https://vercel.com)
- [Neon](https://neon.tech) database with connection string ready
- Repository pushed to GitHub (or GitLab / Bitbucket)
- [pnpm](https://pnpm.io) (Vercel detects it via `pnpm-lock.yaml`)

---

## Recommended: Single Vercel project (frontend + API)

One project serves the Vite static site and routes `/api/*` to a serverless Express function. Same origin — no CORS configuration needed.

### 1. Import the repository

1. Go to [vercel.com/new](https://vercel.com/new) and import your repo.
2. **Root Directory:** leave as `.` (repository root).
3. **Framework Preset:** Other (settings come from root `vercel.json`).

### 2. Build settings (auto from `vercel.json`)

| Setting | Value |
|---|---|
| Install Command | `pnpm install` |
| Build Command | `pnpm --filter @workspace/vision-prep run build` |
| Output Directory | `artifacts/vision-prep/dist/public` |

The root `vercel.json` also defines rewrites so `/api/*` hits the serverless function and all other paths serve the SPA.

### 3. Environment variables

In **Project → Settings → Environment Variables**, add:

| Key | Value | Environments |
|---|---|---|
| `NEON_DATABASE_URL` | `postgresql://...` from Neon | Production, Preview |
| `JWT_SECRET` | Long random secret (32+ chars) | Production, Preview |
| `BASE_PATH` | `/` | Production, Preview |
| `PORT` | `8080` | Production, Preview (required for Vite build) |
| `NODE_ENV` | `production` | Production |
| `LOG_LEVEL` | `info` | Production (optional) |

`VITE_API_URL` can stay **empty** — the browser calls `/api/...` on the same domain.

### 4. Deploy

Deploy from the dashboard or:

```bash
pnpm install
npx vercel
```

### 5. Verify the API

After deploy, check:

```bash
curl https://YOUR-PROJECT.vercel.app/api/healthz
```

Expected: `{"status":"ok"}`

---

## Alternative: API-only Vercel project

Use this if you want the API on its own subdomain (e.g. `api.example.com`).

### Settings

| Setting | Value |
|---|---|
| Root Directory | `artifacts/api-server` |
| Framework Preset | Other |
| Install Command | *(from `artifacts/api-server/vercel.json`)* `cd ../.. && pnpm install` |
| Build Command | *(leave empty — no build step required)* |
| Output Directory | *(leave empty — do not set to `dist`)* |

**Important:** Do **not** set Output Directory to `dist`. That caused the error *"Build output contains no functions or static directory"* because `dist/index.mjs` is neither a static site nor a Vercel Function entry.

### Environment variables

Same as above (`NEON_DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`). `PORT` and `BASE_PATH` are not required for API-only deploys.

### Verify

```bash
curl https://YOUR-API-PROJECT.vercel.app/api/healthz
```

---

## Alternative: Separate frontend project

If the API is deployed separately, create a **second** Vercel project:

| Setting | Value |
|---|---|
| Root Directory | `artifacts/vision-prep` |
| Framework Preset | Vite |

Set `VITE_API_URL` to your API origin **including** `/api`, e.g.:

```
https://your-api-project.vercel.app/api
```

---

## Push database schema to Neon

Run once locally (or in CI) after provisioning Neon:

```bash
NEON_DATABASE_URL="postgresql://..." pnpm --filter @workspace/db run push
```

Seed data if you use the project seed script:

```bash
NEON_DATABASE_URL="postgresql://..." JWT_SECRET="..." pnpm --filter @workspace/scripts run seed
```

---

## Local development (unchanged)

Local dev still uses a long-running Express server via `app.listen()` — not serverless.

**Terminal 1 — API**

```bash
cd artifacts/api-server
# Windows PowerShell:
$env:PORT="8080"; $env:NEON_DATABASE_URL="postgresql://..."; $env:JWT_SECRET="dev-secret"; pnpm run build; pnpm run start

# macOS / Linux:
PORT=8080 NEON_DATABASE_URL="postgresql://..." JWT_SECRET="dev-secret" pnpm run build && pnpm run start
```

**Terminal 2 — Frontend**

```bash
cd artifacts/vision-prep
# Windows PowerShell:
$env:PORT="5173"; $env:BASE_PATH="/"; pnpm run dev

# macOS / Linux:
PORT=5173 BASE_PATH=/ pnpm run dev
```

Vite proxies `/api` → `http://localhost:8080` (see `artifacts/vision-prep/vite.config.ts`).

Copy `.env.example` to `.env` at the repo root and fill in values for convenience.

---

## How the Vercel serverless setup works

```
Request: GET /api/healthz
    ↓
vercel.json rewrite → /api (serverless function)
    ↓
api/index.ts → export default app
    ↓
artifacts/api-server/src/app.ts → app.use("/api", router)
    ↓
routes/health.ts → GET /healthz
```

| File | Role |
|---|---|
| `api/index.ts` (root) | Serverless entry when Root Directory is repo root |
| `artifacts/api-server/api/index.ts` | Serverless entry when Root Directory is `artifacts/api-server` |
| `artifacts/api-server/src/app.ts` | Express app (middleware, `/api` router) — exported for Vercel |
| `artifacts/api-server/src/index.ts` | Local dev only: calls `app.listen()` when `VERCEL` is unset |
| `vercel.json` | Modern config: install/build/output + rewrites (no `builds` / `routes`) |

---

## Limitations on Vercel

| Feature | Notes |
|---|---|
| File uploads (`/api/uploads`) | Serverless filesystem is ephemeral. Uploaded logos/files are lost between invocations. Use [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) or S3 for production uploads. |
| Cold starts | First request after idle may be slower. Neon connection pooling helps. |
| Function timeout | Default 10s (Hobby); increase in `vercel.json` `functions` if needed. |

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `404 NOT_FOUND` on `/api/*` | Ensure Root Directory matches where `api/index.ts` lives; clear Output Directory on API-only projects |
| *Build output contains no functions or static directory* | Remove Output Directory `dist` from API project; use `api/index.ts`, not `dist/index.mjs` |
| No function logs | Function was never invoked — usually a routing/404 issue, not runtime crash |
| API 500 on first request | Check `NEON_DATABASE_URL` and `JWT_SECRET` in Vercel env vars |
| Frontend blank / failed build | Set `PORT` and `BASE_PATH` for the Vite build |
| CORS errors | Use the **single-project** deploy, or configure `cors()` in `app.ts` for your frontend origin |
| Schema / table errors | Run `pnpm --filter @workspace/db run push` against Neon |

---

## Files changed for Vercel serverless

- `api/index.ts` — root serverless entry (unified deploy)
- `artifacts/api-server/api/index.ts` — API-only serverless entry
- `artifacts/api-server/src/index.ts` — `app.listen()` only when not on Vercel
- `vercel.json` — root unified deploy config
- `artifacts/api-server/vercel.json` — removed legacy `builds`/`routes`
- `artifacts/vision-prep/vercel.json` — added monorepo install/build paths
- `.env.example` — documented environment variables
