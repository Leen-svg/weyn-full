# Weyn mobile — rules for any agent working in this directory

Read `README.md` first. It explains what this app owns and what it must not
touch.

Expo has changed. Check the versioned docs at
https://docs.expo.dev/versions/v57.0.0/ before writing code against an Expo
API you have not used recently.

## Hard rules

1. **Do not rewrite the backend.** Supabase schema, RLS policies, RPCs, the
   points ledger, the taxonomy and every `/api/*` route in `../weynapp` are
   authoritative and stay as they are. If a screen needs something the API
   does not return, say so and propose the smallest possible route change —
   do not reimplement the logic here.
2. **No direct table access.** `lib/supabase.ts` is for auth only. Everything
   else goes through `lib/api.ts` so validation, rate limits and point awards
   still run.
3. **No raw colours, radii or font names in a screen.** Import from
   `@/theme`. If a value is missing there, add it to `theme/tokens.ts`.
4. **No `elevation`, no `shadowOffset`.** Use `<Pop>` from `@/theme`. See the
   README for why.
5. **Never set `fontWeight`.** Pick the family that already carries the weight
   (`fonts.display`, `fonts.bodyBold`, …).
6. **The web app stays live.** Nothing here may assume a user has the app
   installed. Guest voting and vote links are browser-first by design.

## Before you commit

```sh
npm run typecheck
npx expo export --platform ios   # catches bundler-only breakage tsc misses
```

## Style

Match the surrounding code. Comments explain *why* a non-obvious choice was
made (the Pop shadow, the SecureStore chunking, the per-weight font families),
not what a line does.
