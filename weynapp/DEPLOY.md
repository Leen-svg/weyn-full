# Deploying this to goweyn.com

This project is the whole site now: the marketing landing page **and** the beta app in one
Vercel project.

- `goweyn.com` serves the static marketing site from `public/` (index, about, roadmap,
  contact, privacy, terms). The rewrites that do that live in `next.config.mjs`.
- `goweyn.com/app` is the beta. So are `/find`, `/groups`, `/friends`, `/wishlist`,
  `/rewards`, `/profile`, `/submit`, `/rate`, `/creators`, `/admin`, and the shareable
  poll links at `/p/[code]`.

Deploy it to the **existing `weyn-web` project**, because that is where goweyn.com is
already attached. Do not make a new project or you will have to move the domain.

## Step 1: add the two secrets

Vercel -> weyn-web -> Settings -> Environment Variables. Add these to Production,
Preview and Development:

| Name | Value |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard -> Project Settings -> API keys -> `service_role` |
| `ADMIN_PASSWORD` | anything strong, this guards `/admin` |

Everything else has a safe default baked in, so you only need these two.

The build succeeds without them, but `/app` will return a 500 until they are set, because
it cannot reach the database. Set them before you deploy and you will never see it.

Vercel Analytics is already wired in (`@vercel/analytics`, mounted in `app/layout.js`), so
page views start collecting the moment this deploys. Nothing else to do.

## Step 2: ship it

Either route works. Pick one.

### Route A: the Vercel CLI, fastest

```bash
cd weynapp
npx vercel link      # pick your account, then the existing project "weyn-web"
npx vercel --prod
```

### Route B: GitHub, better long term

```bash
cd weynapp
git init && git add . && git commit -m "weyn beta + landing page in one project"
gh repo create weyn --private --source=. --push
```

Then Vercel -> weyn-web -> Settings -> Git -> Connect Git Repository, and pick that
repo. From then on every push deploys itself.

## Step 3: check these four things

1. `goweyn.com` shows the landing page, headline "Deciding is the worst part of going out. So we handled it."
2. `goweyn.com/app` shows Discover, not a 404.
3. `goweyn.com/about` and `/roadmap` load.
4. On a phone, the bottom tab bar appears on app pages and the top pill does not cover the page heading.
5. `goweyn.com/robots.txt`, `/sitemap.xml` and `/llms.txt` all load.
6. Paste `goweyn.com` into a WhatsApp or Slack message and check the preview card shows the pink Weyn image.

## After it is live: Google Search Console

1. Go to search.google.com/search-console and add `goweyn.com` as a **Domain** property.
2. It gives you a TXT record. Add it in Vercel under Domains, or wherever your DNS lives.
3. Once verified, go to Sitemaps and submit `https://goweyn.com/sitemap.xml`.

The sitemap, `robots.txt` and canonical tags are already in place, so that is the only manual
step left.

## Running locally

```bash
cp .env.local.example .env.local   # fill in the two secrets
npm install
npm run dev
```
