# Backend — Design

## Runtime
FastAPI app wrapped by `Mangum(app)` as the Lambda handler
(`app.main.handler`). Packaged as a container image
(`public.ecr.aws/lambda/python:3.13` base) so pydantic/boto3 and friends
aren't constrained by zip package size limits. Pushed to ECR; the Lambda
function in Terraform references the image URI (see [[../infra/design]]).

## Structure
```
backend/
  pyproject.toml         # uv-managed
  Dockerfile
  app/
    main.py               # FastAPI() + CORS (dev) + Mangum handler
    deps.py               # get_current_user(), require_admin()
    routers/
      auth.py
      content.py
      donors.py
      signups.py
      uploads.py
      submissions.py
      admin.py
    models/
      user.py donor.py donation.py submission.py event.py signup.py config.py
    services/
      dynamo.py            # one function per table op, typed in/out
      s3.py                # presign_put(), presign_get(), copy_object()
      oauth.py              # verify_google_token(), verify_facebook_token()
      jwt_session.py        # issue_session(), verify_session()
```

## Auth mechanics
- `POST /api/auth/google` body: `{ id_token }`. Verify via
  `google.oauth2.id_token.verify_oauth2_token` against Google's public keys
  and this app's OAuth Client ID (env var `GOOGLE_CLIENT_ID`). Extract
  `sub`, `email`, `name`.
- `POST /api/auth/facebook` body: `{ access_token }`. Call Facebook's
  `debug_token` Graph API endpoint with the app token
  (`FACEBOOK_APP_ID`/`FACEBOOK_APP_SECRET` env vars) to validate, then
  `GET /me?fields=id,name,email` to fetch profile.
- Either path upserts a `Users` row keyed by `provider:sub`, then issues an
  app-signed JWT (`jwt_session.py`, HS256, `SESSION_SECRET` env var from
  Secrets Manager/SSM) containing `{ user_id, email, name }`, set as an
  `HttpOnly; Secure; SameSite=Lax` cookie, ~30 day expiry.
- `deps.get_current_user()` reads and verifies that cookie; raises 401 if
  missing/invalid. `deps.require_admin()` additionally checks `email` against
  the `ADMIN_EMAILS` env var (comma-separated allowlist).

## Submission → approval flow (the core write path)
1. `POST /api/uploads/presign` — validates `content_type` is an image
   MIME type and `size` is under a max (e.g. 10 MB), generates a
   `submission_id` (uuid4), returns a presigned PUT for
   `pending/{submission_id}/{filename}` plus the `key`.
2. Browser PUTs the file directly to S3.
3. `POST /api/submissions` — creates a `Submissions` item: `{ submission_id,
   user_id, donor_id (looked up/created from user), location, meals,
   photo_key, receipt_key?, caption?, status: 'pending', created_at }`.
4. `GET /api/admin/submissions?status=pending` — admin lists them, each with
   a short-TTL presigned GET for the photo so the founder can actually view it.
5. `POST /api/admin/submissions/{id}/approve` — in one logical operation:
   - `s3.copy_object(pending_key, approved_key)`
   - create a `Donations` item under the donor with `status: 'approved'`
   - increment `Donors.total_meals`/`donation_count`
   - increment `Config.total_meals`
   - mark `Submissions.status = 'approved'`
   (DynamoDB doesn't give free multi-table ACID transactions across this
   many writes cheaply at on-demand scale for this use case — use
   `TransactWriteItems` where feasible for the counter increments to avoid
   double-approval races; the S3 copy happens outside the transaction since
   S3 isn't transactional, but is idempotent to retry.)
6. `POST /api/admin/submissions/{id}/reject` — marks `status: 'rejected'`,
   leaves the `pending/*` object for the lifecycle rule to eventually expire.

## Partner charities
`GET /api/content`'s `partnerCharities` field is a straight read of the
`PartnerCharities` table (see [[../features/006-partner-charities/design]])
— no approval workflow, no admin endpoint yet, same as `Events`. The
founder edits entries directly in the table for now.

## Config editing
`POST /api/admin/config` lets the founder update `total_meals`,
`milestone_2027`, `goal_2030`, `founder_name`, `charity_name`,
`accent_palette` directly — this is how the founder tweaks these values
without a redeploy (see the design README's "Props exposed as easy top-level
config" section).

## Local dev
`uvicorn app.main:app --reload --port 8000`. Env vars point at a dev-stage
set of DynamoDB tables/S3 bucket (created by `infra/envs/dev`) or, for pure
offline work, `amazon/dynamodb-local` via Docker. CORS middleware allows
`http://localhost:3000` with credentials in dev only (`ENV=dev` env var
gates whether the CORS middleware is even mounted — production doesn't need
it since CloudFront makes everything same-origin).
