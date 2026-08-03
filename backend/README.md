# Million Meal Club — Backend

FastAPI app deployed as a single AWS Lambda (container image) behind API
Gateway HTTP API. See `../specs/backend/` for the requirements/design and
`../specs/01-architecture.md` for how this fits into the full system.

## Local development

No AWS account or Docker is required for local development. By default the
app runs against an **in-memory local data/blob store**
(`DATA_BACKEND=local`, the default), seeded with a few demo donors/events so
the site is browsable immediately (FAQ copy is static frontend content, not
part of this store — see `../specs/frontend/design.md`). This is dev-only — deployed
environments always set `DATA_BACKEND=dynamodb` (wired by
`infra/modules/api`), which uses the real DynamoDB/S3-backed implementations
in `app/services/dynamo_store.py` / `app/services/s3_blob.py`.

```bash
uv sync
ENV=dev DATA_BACKEND=local API_PUBLIC_BASE_URL=http://localhost:8001/api \
  ADMIN_EMAILS=you@example.com \
  uv run uvicorn app.main:app --reload --port 8001
```

Then point the frontend at it — in `frontend/.env.local`:
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8001/api
```

Interactive API docs: http://localhost:8001/docs

### Testing the submit → approve flow locally without real OAuth

Real sign-in requires Google/Facebook OAuth app credentials (see
`../specs/features/001-oauth-login/requirements.md`), which you may not have
provisioned yet. To exercise the rest of the backend (presign upload →
submit proof → admin approve → totals update) without them, mint a session
token directly and use it as a cookie:

```bash
uv run python -c "
from app.services.jwt_session import issue_session_token
print(issue_session_token('test-user-1', 'Test User', 'you@example.com', 'google'))
"
# then: curl -H "Cookie: mmc_session=<token>" ...
```

Set `ADMIN_EMAILS` to include whatever email you mint the token with to
also test the `/api/admin/*` routes.

## Environment variables

| Var | Purpose | Default |
|---|---|---|
| `ENV` | `dev` enables permissive CORS for the Next dev server | `dev` |
| `DATA_BACKEND` | `local` or `dynamodb` | `local` |
| `SESSION_SECRET` | HMAC key for session JWTs — set a real secret (SSM SecureString) in deployed envs | insecure dev default |
| `ADMIN_EMAILS` | comma-separated allowlist for `/api/admin/*` | empty |
| `ENABLE_DUMMY_LOGIN` | **local dev only** — set `true` to enable `POST /api/auth/dummy` (hardcoded `dummy_user`/`dummy_password` login with an `admin`/`donor`/`volunteer` role choice — admin logs in as the first `ADMIN_EMAILS` entry, donor/volunteer provision an idempotent local test persona). Never set this in a deployed env — see `specs/00-constitution.md` §4 and `specs/features/008-persona-dashboards-and-roles/design.md`. | unset (disabled) |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | empty |
| `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` | Facebook app credentials | empty |
| `API_PUBLIC_BASE_URL` | local-dev-only, base URL for the fake local blob upload/get routes | `http://localhost:8000/api` |
| `PHOTOS_BUCKET_NAME` / `PHOTOS_PUBLIC_BASE_URL` | S3 photos bucket, set in deployed envs | empty |
| `SES_FROM_EMAIL` | verified SES sending address for donor-onboarding emails; unset means the local email sender just logs instead of sending | empty (local logs only) |
| `USERS_TABLE`, `DONORS_TABLE`, `DONATIONS_TABLE`, `SUBMISSIONS_TABLE`, `EVENTS_TABLE`, `SIGNUPS_TABLE`, `PARTNER_CHARITIES_TABLE`, `CONFIG_TABLE` | DynamoDB table names, set in deployed envs | — |

## Deploying

Packaged as a container image (see `Dockerfile`) and pushed to ECR; Terraform
(`infra/modules/api`) provisions the Lambda function, API Gateway HTTP API,
and IAM role. See `../infra/README.md`.
