« Weyn — mobile app

An Expo (React Native) client for Weyn. **This is a UI rewrite, not a rewrite.**

## What this app does not own

Nothing on the server. The Supabase project, RLS policies, `get_shortlist` /
`get_shortlist_nearby`, the points ledger and its anti-farming caps, the
four-M taxonomy, moderation queues and every `/api/*` route handler stay in
`../weynapp` and stay authoritative. This app is a second client for them.

Concretely:

- Reads and writes go through `lib/api.ts`, which calls the deployed Next.js
  routes at `EXPO_PUBLIC_WEYN_API_URL` with the Supabase access token in an
  `Authorization: Bearer` header. `weynapp/lib/supabase/server.js` already
  accepts that header and builds an RLS-scoped client from it.
- `lib/supabase.ts` exists for **auth only** — sign in, sign up, refresh,
  password reset. Do not query tables through it. Validation, rate limiting
  and point awards live in the route handlers, and a direct table read skips
  all three.

## What is genuinely rewritten

Every screen. CSS becomes `StyleSheet`: no cascade, no pseudo-selectors, no
media queries. Focus states are component state (`components/Field.tsx`).
Hover does not exist.

## The web app stays live

Forever. Guest voting, vote links and public boards must keep working in a
browser with no download — a vote link that demands an install kills the
mechanic. Mobile is additive.

## App icons

There are none yet. `app.json` deliberately declares no `icon`, `splash`,
`adaptiveIcon` or `favicon`, so Expo falls back to its defaults and the project
runs on a fresh clone. Add the real Weyn assets to `assets/` and point the
matching keys at them before any store build.

## Running it

```sh
cp .env.example .env.local     # nothing secret in here; EXPO_PUBLIC_* ships in the bundle
npm install                    # writes package-lock.json on first run
npm start                      # then scan the QR with Expo Go, or press i / a
```

There is no committed `package-lock.json`: this project was pushed through the
GitHub file API, which is text-only, and the lockfile was too large to send
that way. `npm install` regenerates it from the pinned versions in
`package.json`. Commit the result so CI is reproducible.

`npm run typecheck` before every commit.

## Layout

```
app/            Expo Router routes. (auth) and (tabs) are the two groups.
components/     The neo-brutalist kit: Button, Card, Chip, Field, VenueCard…
theme/          Design tokens ported 1:1 from weynapp/app/design-system.css.
lib/            Supabase client, API client, auth context, shared types.
```

## Three things that will bite you

**The hard shadow.** `box-shadow: 6px 6px 0 var(--ink)` has no native
equivalent. Android `elevation` is always a blurred Material shadow with an
offset you cannot set, and iOS `shadowOffset` does nothing on Android. So
`theme/Pop.tsx` draws the shadow as a solid ink rectangle behind the element.
Identical on both platforms. Use `<Pop>`, never `elevation`.

**Font weights.** Android does not reliably synthesise a weight from one
registered family, so `fontWeight: '800'` silently renders as regular on a lot
of devices. Every weight is registered as its own family name
(`BricolageGrotesque_800ExtraBold`) and nothing in this app sets `fontWeight`.
Check Kufam at 800 on a real Android device early — that is the one most
likely to surprise you.

**Session storage.** `expo-secure-store` rejects values over 2048 bytes and a
Supabase session is bigger than that, so storing it whole fails silently and
logs the user out on every cold start. `lib/secureStorage.ts` chunks it.

## Porting order

1. ~~Auth + deep links~~ — done. Email confirmation and password reset return
   through `weyn://auth/callback`.
2. ~~Find, end to end~~ — done. It exercises the whole stack: taxonomy,
   filters, `get_shortlist`, results, venue card.
3. Plan — boards, polls, the group vote.
4. Discover — editorial lists, community collections, creators.
5. Profile — points, saves, friends, account settings.
6. Map. `mapbox-gl` does not run in React Native; use `@rnmapbox/maps`, which
   needs a config plugin and a development build (it will not run in Expo Go).

Get to TestFlight with steps 1 and 2 only. Everything after that is repetition.

## Two small changes the web app needs

Neither is a backend rewrite; both are one-liners, and the app degrades
gracefully without them.

1. `GET /api/taxonomy` returns `{ groups }` but not `zones`, because the web
   `/find` page reads zones server-side through `getTaxonomy()`. Until it
   returns `{ groups, zones }`, the area filter stays hidden on mobile.
2. Fourteen route handlers call `createClient()` without passing `req`, so
   they only read the session from a cookie and ignore a `Bearer` token:
   `friends/[id]`, `friends/activity`, `friends/respond`, `friends/search`,
   `groups/[id]/members`, `groups/[id]/polls`, `groups/[id]/polls/[pollId]/more`,
   `groups/[id]/polls/[pollId]/vote`, `import-place`, `notifications`,
   `planner/optimize`, `profile/username`, `reports`, `venues/[id]/view`.
   Passing `req` through makes each of them work from the app. Find does not
   touch any of them, which is why step 2 above lands without it.
