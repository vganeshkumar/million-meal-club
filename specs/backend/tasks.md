# Backend — Tasks

- [x] `uv init`, `pyproject.toml` with fastapi/mangum/boto3/pydantic/
      google-auth/httpx/PyJWT dependencies.
- [x] `app/main.py` — FastAPI app, CORS middleware (dev only), Mangum handler.
- [x] `app/deps.py` — session-cookie auth dependency, admin-allowlist dependency.
- [x] `app/models/` — pydantic schemas for all entities + request/response bodies.
- [x] `app/services/dynamo_store.py` / `local_store.py` — table access,
      selected via `DATA_BACKEND` env var (local in-memory store for dev
      without AWS; real DynamoDB store for deployed envs).
- [x] `app/services/s3_blob.py` / `local_blob.py` — presign PUT/GET,
      CopyObject helper (same local/dynamodb split as the data store).
- [x] `app/services/oauth.py` — Google token verification (`google-auth`),
      Facebook token verification (Graph `debug_token`).
- [x] `app/routers/content.py`, `donors.py` — `GET /api/content`,
      `GET /api/donors/{id}`.
- [x] `app/routers/auth.py` — google/facebook/me/logout.
- [x] `app/routers/signups.py` — `POST /api/signups`.
- [x] `app/routers/uploads.py` — `POST /api/uploads/presign`.
- [x] `app/routers/submissions.py` — `POST /api/submissions`.
- [x] `app/routers/admin.py` — list/approve/reject/config.
- [x] `Dockerfile` (base `public.ecr.aws/lambda/python:3.13`).
- [x] `backend/README.md` — local dev instructions (uvicorn + local/dev
      DynamoDB table names via env vars).
- [ ] Wire real Google OAuth Client ID / Facebook App ID + App Secret once
      the user provisions them (see [[001-oauth-login]] open questions).
- [ ] Adopt the newer authoritative design (see [[../01-architecture]]
      "Source design", decided with user 2026-08-03): `PartnerCharity`
      model + `partner_charities` in `ContentResponse`; extend
      `SignupRequest` with `partner_charity`/`donor_story`/
      `commit_50k_4yr`/`agree_publish_story` (see
      [[../features/002-join-in-signup/design]] and
      [[../features/006-partner-charities/design]]).
- [x] Local end-to-end test: signup → presign → upload → submit → admin
      approve → content reflects new total. (Verified via curl against the
      local in-memory store; real DynamoDB path is untested until infra is
      applied.)
