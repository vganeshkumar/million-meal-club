# Million Meal Club

A donation/volunteer-tracking charity site. **`specs/` is the source of
truth** — start there, not here:

- `specs/00-constitution.md` — non-negotiable guardrails (static-first,
  serverless-only, on-demand data, OAuth-only auth, manual approval, no
  console click-ops, least-privilege IAM, human-only `terraform apply`).
- `specs/01-architecture.md` — the system diagram and why each piece was
  chosen.
- `specs/{frontend,backend,infra}/` — per-area requirements/design/tasks.
- `specs/features/` — cross-cutting features (OAuth login, Join In signup,
  photo proof submission, admin review/approval, donor spotlight), each
  touching more than one of the three folders below.

`design_artifacts/design_handoff_charity_website/README.md` is the original
visual/behavioral design spec this implements — read it for exact copy,
layout, and interaction details.

## Layout

```
frontend/   Next.js (static export) — see frontend/README.md if present, specs/frontend/
backend/    FastAPI + Mangum, deployed as a Lambda container image — backend/README.md, specs/backend/
infra/      Terraform for the whole AWS footprint — infra/README.md, specs/infra/
specs/      spec-driven source of truth (see above)
design_artifacts/   original design handoff — reference only, not production code
```

## Local development

```bash
# backend (in-memory local store, no AWS needed — see backend/README.md)
cd backend && uv sync
ENV=dev DATA_BACKEND=local API_PUBLIC_BASE_URL=http://localhost:8001/api \
  ADMIN_EMAILS=you@example.com uv run uvicorn app.main:app --reload --port 8001

# frontend (separate terminal)
cd frontend && npm install
echo "NEXT_PUBLIC_API_BASE_URL=http://localhost:8001/api" > .env.local
npm run dev
```

Real Google sign-in requires OAuth app credentials the founder hasn't
provisioned yet (see `specs/features/001-oauth-login/requirements.md`);
until then the Sign In modal shows a clear "not configured" message rather
than faking it.

## Working on this project

- Cross-cutting changes (touching more than one of frontend/backend/infra):
  add or update a spec under `specs/features/` first.
- Run `terraform fmt`/`validate`/`plan` freely; never run `terraform apply`
  without the user explicitly asking for that specific apply (real,
  billed AWS resources).
- Use the `verify` skill after implementing a feature — exercise it end to
  end (both dev servers running, real HTTP calls), not just typecheck/lint.
- When the user asks to commit a change, after making the commit
  automatically invoke the `create-pull-request` skill to draft the PR
  (description, files changed, quality summary covering test coverage/
  code quality/security posture) and present it for review — do not run
  `gh pr create` yet at this point. Only submit the PR once the user has
  reviewed the draft and explicitly approves it.
