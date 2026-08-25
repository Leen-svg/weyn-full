# Weyn (weynapp) — Base44 dev notes

## What this is
A single Next.js 16 (Turbopack) app that serves **both** the static marketing
site (from `weynapp/public/*.html` via `next.config.mjs` rewrites) **and** the
beta app at `/app`, `/find`, `/groups`, etc. Backend is **hosted Supabase**
(`itnonbrlfoafqhknncit.supabase.co`) — there is no local database to run.

## Running it
```
docker compose -f docker-compose.base44.yml up -d
```
- The `web` service is `node:22-bookworm-slim` with `weynapp/` bind-mounted at
  `/app`, running `npx next dev -H 0.0.0.0 -p 3000`. Edits hot-reload.
- `npm install` runs at container start (node_modules is an anonymous volume).
- Preview entry point is host port 3000.

## Secrets (external, user-supplied)
The Supabase URL + anon key are PUBLIC and baked into `weynapp/lib/supabase/public.js`
(env vars override if set). Two real secrets are needed and live only in
`/run/base44/app.env` (wired as the LAST `env_file` in compose, overriding the
placeholders in `.env.base44-defaults`):

- `SUPABASE_SERVICE_ROLE_KEY` — used by `weynapp/lib/db.js` for server-side DB
  access. The app **boots without it** (landing page renders), but `/app`
  returns **500** until it is set. Get it from Supabase Dashboard → Project
  Settings → API keys → `service_role`.
- `ADMIN_PASSWORD` — guards the `/admin` page.

## Verifying it works
- `curl -H "Host: 3000-$BASE44_PUBLIC_HOST_SUFFIX" http://localhost:3000/` →
  the static landing page (`Weyn | Find Places...`).
- `curl ... /app` → 200 (after the service-role key is set); 500 before.
- `proxy.js` is an edge-style middleware but is **not** wired as
  `middleware.js`, so it does not run in this repo as-is — do not rely on it.

## Notes / quirks
- `next.config.mjs` has `allowedDevOrigins` derived from
  `BASE44_PUBLIC_HOST_SUFFIX` so the preview origin isn't blocked by Next's
  dev-origin check (a bare `*` does not match the preview hostname).
- `WATCHPACK_POLLING=true` is set because bind mounts often miss file events.
- No `middleware.js` exists; `proxy.js` exports a `proxy`/`config` pair that is
  not currently mounted by Next.
