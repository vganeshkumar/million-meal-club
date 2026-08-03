---
name: run-million-meal-club
description: Runs, starts, launches, or stops the Million Meal Club app locally for development — starts the FastAPI backend and Next.js frontend dev servers, each in its own macOS Terminal window. Use when asked to run, start, launch, preview, or stop the app locally.
---

# Running Million Meal Club locally

Two dev servers, no AWS required: the FastAPI backend (`backend/`) on port
8001, running against an in-memory local data store by default, and the
Next.js frontend (`frontend/`) on port 3000. See `backend/README.md` and
the root `README.md` for details.

## Start

```bash
bash .claude/skills/run-million-meal-club/start.sh
```

This opens **two real Terminal.app windows** — one running the backend,
one running the frontend — so you can watch live `--reload`/HMR output and
`Ctrl+C` either server directly. It waits for both to respond before
reporting the URLs back. Safe to re-run: it checks each port first and
skips starting a server that's already listening rather than opening a
duplicate.

The first time this runs, macOS will prompt for permission to let Terminal
automation happen (a system dialog asking to allow control of
"Terminal.app") — approve it.

If either server fails to come up within ~30s, check its Terminal window
directly for the error — most commonly `uv sync` or `npm install` hasn't
been run yet in that directory.

## Stop

```bash
bash .claude/skills/run-million-meal-club/stop.sh
```

Finds whatever is listening on 8001/3000 and kills it. Leaves the Terminal
windows open (harmless) — just ends the dev servers running in them.

## Notes

- `ADMIN_EMAILS` defaults to the founder's email so `/api/admin/*` routes
  are testable locally out of the box; override by exporting `ADMIN_EMAILS`
  before running `start.sh` if needed.
- Real Google/Facebook sign-in still needs OAuth app credentials that
  haven't been provisioned yet — see
  `specs/features/001-oauth-login/requirements.md`. Everything else
  (progress counter, events, Join In form, public gallery, donor spotlight,
  FAQ) works fully without it.
- `start.sh` sets `ENABLE_DUMMY_LOGIN=true` on the backend, and
  `frontend/.env.local` should have `NEXT_PUBLIC_ENABLE_DUMMY_LOGIN=true` —
  together these unlock a `dummy`/`dummy` admin login on `#admin`, so the
  donor-application approval flow is testable without real OAuth. See
  `specs/features/007-donor-application-approval/design.md`. **Never**
  enabled outside local dev — see `specs/00-constitution.md` §4.
