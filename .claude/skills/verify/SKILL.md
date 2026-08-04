---
name: verify
description: Project-specific recipe for driving Million Meal Club end to end (backend API + rendered frontend) during verification. Use alongside the general verify skill.
---

# Verifying Million Meal Club end to end

## Launch

Use `run-million-meal-club`'s `start.sh`/`stop.sh` when just running the
app. For verification sessions needing custom env vars (e.g. a real
`GEOAPIFY_API_KEY`), launch manually instead so you control env:

```bash
cd backend && (ENV=dev DATA_BACKEND=local API_PUBLIC_BASE_URL=http://localhost:8001/api \
  ADMIN_EMAILS=<founder-email> ENABLE_DUMMY_LOGIN=true \
  GEOAPIFY_API_KEY=<key> SITE_BASE_URL=http://localhost:3000 \
  uv run uvicorn app.main:app --port 8001 > /tmp/backend.log 2>&1 &)

cd frontend && (npm run dev > /tmp/frontend.log 2>&1 &)
```

Frontend env (`NEXT_PUBLIC_*`) comes from `frontend/.env.local`
(gitignored) — edit it directly rather than exporting shell vars, since
`next dev` reads that file itself.

Stop with `bash .claude/skills/run-million-meal-club/stop.sh` (kills
whatever's listening on 8001/3000, regardless of how it was started).

## Seed data via the real API (no UI needed)

Local dev backend has `ENABLE_DUMMY_LOGIN=true`. Full donor flow via curl
with a cookie jar:

```bash
curl -s -c cookies.txt -b cookies.txt -X POST http://localhost:8001/api/auth/dummy \
  -H "Content-Type: application/json" \
  -d '{"username":"dummy_user","password":"dummy_password"}'   # admin login

curl -s -X POST http://localhost:8001/api/signups -H "Content-Type: application/json" \
  -d '{"mode":"donor","name":"X","email":"x@example.com","location":"Austin, TX","country":"United States","packet_count":60,"delivery_role":"self","donor_story":"...","commit_50k_4yr":true,"agree_publish_story":true}'
# -> signup_id

curl -s -c cookies.txt -b cookies.txt -X POST http://localhost:8001/api/admin/signups/<id>/approve

# local-dev username is the donor name, lowercased/slugified (spaces -> _, strip punctuation)
curl -s -c donor_cookies.txt -b donor_cookies.txt -X POST http://localhost:8001/api/auth/dummy \
  -H "Content-Type: application/json" -d '{"username":"x","password":"dummy_password"}'
```

## Rendered-page verification when the Chrome extension isn't connected

`mcp__claude-in-chrome__*` tools need the Chrome extension connected —
not always available. Fallback: the frontend already depends on
`playwright` (`frontend/playwright.config.ts` exists) — write a one-off
`.mjs` script **inside `frontend/`** (Node ESM resolves `node_modules`
from the importing file's own directory, not `cwd`, so a script under
`/tmp` or the scratchpad can't `import "playwright"` even after `cd`),
run it with plain `node`, then delete it:

```js
import { chromium } from "playwright";
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 1400 },
  permissions: ["clipboard-read", "clipboard-write"], // only if testing copy-link
});
const page = await context.newPage();
await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await page.screenshot({ path: "<scratchpad>/whatever.png" });
await browser.close();
```

Useful patterns proven out on the 023 location/time/sharing feature:
- `page.getByTestId("schedule-donation-form")` /
  `page.getByLabel("Exact Address", { exact: true })` etc. for the
  donor dashboard's scheduling form (dummy-login first).
- `Promise.all([page.waitForEvent("download"), button.click()])` +
  `download.saveAs(path)` to capture a client-generated (canvas) image
  download.
- `page.evaluate(() => navigator.clipboard.readText())` to check a
  copy-to-clipboard action (needs the `clipboard-read` permission above).

## Gotchas hit during 023 (location/time/sharing)

- `staticmap.openstreetmap.de` (a commonly-referenced "free keyless
  static map" service) is dead — DNS doesn't resolve, confirmed against
  public resolvers, not just this sandbox. Don't assume a "well-known
  free API" still exists; hit it with `curl` before building on it.
- Nominatim (`nominatim.openstreetmap.org`) and Geoapify's static maps
  API both work from this environment; test third-party URLs with a
  real `curl` before trusting them in a design doc.
- pytest tests that reach code calling a real third-party API (e.g.
  geocoding) will silently make real network calls unless stubbed —
  compare suite runtime before/after adding a stub fixture as a sanity
  check (11.8s -> 0.35s here confirmed the calls were real).
