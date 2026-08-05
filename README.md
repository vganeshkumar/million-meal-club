# The Million Meal Club

A progress-tracking website for a fully volunteer-run charity that funds and
hand-delivers meals. The site tracks progress toward 1,000,000 meals
delivered, lets people sign up to fund or deliver meals, gates photo
proof-of-delivery submissions behind real Google sign-in, and
requires the founder to manually approve a submission before it counts
toward the public total. No money is ever collected through the site.

Built spec-first — **[`specs/`](./specs/) is the source of truth** for why
things are built the way they are. Start with
[`specs/00-constitution.md`](./specs/00-constitution.md) (non-negotiable
guardrails) and [`specs/01-architecture.md`](./specs/01-architecture.md)
(the system diagram and every major decision). The original visual design
handoff is in
[`design_artifacts/design_handoff_charity_website/README.md`](./design_artifacts/design_handoff_charity_website/README.md).

## Architecture

Fully serverless and cost-conscious — nothing runs (or bills) when nobody's
visiting:

- **`frontend/`** — Next.js static export (no server at runtime), Tailwind
  v4, deployed to a private S3 bucket served by CloudFront.
- **`backend/`** — FastAPI, packaged as a container image, running as a
  single AWS Lambda behind API Gateway HTTP API. Zero idle cost.
- **`infra/`** — Terraform for the whole footprint: DynamoDB (on-demand
  billing), S3 (site + photos), CloudFront, Lambda, API Gateway, IAM.
- One CloudFront distribution fronts everything — `/api/*` routes to the
  backend, `/photos/*` routes to approved proof-of-delivery photos, and
  everything else serves the static site. Same origin end to end, so auth
  cookies just work with no CORS complexity.
- Auth is Google OAuth only — no password database. The founder's
  own admin access is the same login, checked against an email allowlist.

See [`specs/01-architecture.md`](./specs/01-architecture.md) for the full
diagram and the reasoning behind every choice.

## Project layout

```
frontend/           Next.js (static export)         — frontend/README.md, specs/frontend/
backend/             FastAPI + Mangum on Lambda        — backend/README.md, specs/backend/
infra/               Terraform for the AWS footprint    — infra/README.md, specs/infra/
specs/               spec-driven source of truth
design_artifacts/    original design handoff (reference only, not production code)
.github/workflows/   CI/CD (deploy-frontend, deploy-backend, terraform plan/apply)
.claude/skills/       run-million-meal-club — start/stop both dev servers locally
```

## Run it locally

No AWS account is required for local development — the backend runs against
an in-memory data store by default.

**Prerequisites:** Node.js 22+, Python 3.13+ with [`uv`](https://docs.astral.sh/uv/), and (only if you want to test against real AWS) the AWS CLI, Terraform, and Docker.

### Fastest way: the `run-million-meal-club` Claude Code skill

If you're working in Claude Code, just ask it to **"run the app locally"**
(or run `/run-million-meal-club`). It launches both dev servers for you —
see [`.claude/skills/run-million-meal-club/SKILL.md`](./.claude/skills/run-million-meal-club/SKILL.md).
Equivalently, run the scripts directly from a terminal:

```bash
bash .claude/skills/run-million-meal-club/start.sh   # opens two Terminal.app windows
                                                       # (backend :8001, frontend :3000),
                                                       # waits for both to respond, prints the URLs
bash .claude/skills/run-million-meal-club/stop.sh     # stops both when you're done
```

`start.sh` is idempotent (safe to re-run — it skips a server whose port is
already listening) and macOS-only (it opens real `Terminal.app` windows via
`osascript`, so you get live `--reload`/HMR output and can `Ctrl+C` either
server directly). On another OS, or if you'd rather run them yourself, see
the manual steps below.

### Manual steps

**1. Backend** (in one terminal):

```bash
cd backend
uv sync
ENV=dev DATA_BACKEND=local API_PUBLIC_BASE_URL=http://localhost:8001/api \
  ADMIN_EMAILS=you@example.com \
  uv run uvicorn app.main:app --reload --port 8001
```

This seeds a few demo donors/events so the site is browsable immediately
(FAQ copy is static frontend content, not backend-seeded). Interactive API
docs: http://localhost:8001/docs. See
[`backend/README.md`](./backend/README.md) for the full environment
variable list and how to exercise the submit → approve flow without real
OAuth credentials.

**2. Frontend** (in another terminal):

```bash
cd frontend
npm install
cp .env.example .env.local   # NEXT_PUBLIC_API_BASE_URL=http://localhost:8001/api
npm run dev
```

Then open http://localhost:3000.

**Note on sign-in:** real Google sign-in requires OAuth app
credentials that haven't been provisioned yet (see
[`specs/features/001-oauth-login/requirements.md`](./specs/features/001-oauth-login/requirements.md)
for exactly what to set up). Until then, the Sign In modal shows a clear
"not configured" message rather than faking it — everything else (progress
counter, events, Join In form, donor spotlight, FAQ) works
fully without it.

## Deploy to AWS

Everything below is Terraform-driven and documented in detail in
[`infra/README.md`](./infra/README.md) — this is the short version.
**`terraform apply` provisions real, billed AWS resources; only run it
yourself, deliberately.**

**Prerequisites:** an AWS account with credentials configured (`aws
configure` or an SSO profile), Terraform, and Docker.

**1. Bootstrap remote state** (one-time, manual — not managed by this
Terraform, to avoid a chicken-and-egg with the state that would lock it):

```bash
aws s3api create-bucket --bucket mmc-terraform-state --region us-east-1
aws s3api put-bucket-versioning --bucket mmc-terraform-state \
  --versioning-configuration Status=Enabled
aws dynamodb create-table --table-name mmc-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

Uncomment and fill in the `backend "s3" {}` block in
`infra/envs/dev/versions.tf` (and `envs/prod/versions.tf`) with those
names, then `terraform init` in that env directory.

**2. Configure config and secrets:**

```bash
cd infra/envs/dev
cp terraform.tfvars.example terraform.tfvars   # admin email, region, etc.
cat > secrets.auto.tfvars <<EOF
session_secret = "$(openssl rand -hex 32)"
EOF
```

Both files are gitignored — never commit real secret values.

**3. First apply, then push a placeholder backend image, then apply again**
(Terraform can't build/push Docker images, and the Lambda function can't be
created until an image exists in ECR — see `infra/README.md` for the full
explanation):

```bash
terraform init
terraform apply   # creates the ECR repo, among everything else — this first apply
                   # will fail to create the Lambda function itself; that's expected

aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com
cd ../../../backend
docker build -t mmc-dev-api .
docker tag mmc-dev-api:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/mmc-dev-api:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/mmc-dev-api:latest

cd ../infra/envs/dev
terraform apply   # now succeeds — the Lambda function can be created
```

**4. Deploy the frontend**, pointed at the API Gateway origin now fronted
by CloudFront:

```bash
cd ../../../frontend
NEXT_PUBLIC_API_BASE_URL="$(terraform -chdir=../infra/envs/dev output -raw site_url)/api" \
  npm run build

aws s3 sync ./out "s3://$(terraform -chdir=../infra/envs/dev output -raw site_bucket_name)" --delete
aws cloudfront create-invalidation \
  --distribution-id "$(terraform -chdir=../infra/envs/dev output -raw cloudfront_distribution_id)" \
  --paths "/*"
```

Visit the URL from `terraform output site_url`.

**5. Repeat for `infra/envs/prod`** once `dev` is verified end to end.

**Custom domain (optional):** leave `domain_name = ""` to use CloudFront's
own `*.cloudfront.net` domain (the default). To add a real domain later,
set `domain_name` (and `create_hosted_zone` if Route53 doesn't already have
the zone) in `terraform.tfvars` and re-apply — see
[`specs/01-architecture.md`](./specs/01-architecture.md).

**CI/CD:** `.github/workflows/` has unwired GitHub Actions for frontend
deploys, backend deploys, and `terraform plan`/`apply`. Each one documents
the repo secrets/variables it needs (from the `terraform output` values
above) as comments at the top of the file — set those once infra is
applied, and pushes to `main` deploy automatically.

## Cost

Every piece scales to (near) zero when nobody's using the site: Lambda, API
Gateway HTTP API, and DynamoDB on-demand all bill per-request with generous
always-free tiers; S3 and CloudFront bill per-GB at low traffic. There's no
fixed monthly floor beyond negligible storage for the site bundle and a
handful of database items. See
[`specs/01-architecture.md`](./specs/01-architecture.md#cost-shape).

## Working on this project

- Cross-cutting changes (touching more than one of frontend/backend/infra)
  get a spec under `specs/features/` first — see
  [`CLAUDE.md`](./CLAUDE.md).
- `terraform fmt`/`validate`/`plan` are safe to run anytime; `terraform
  apply` is always a deliberate human action.
