# Infra — Design

## Layout
```
infra/
  modules/
    static-site/   # S3 (site) + CloudFront distribution + OAC + default behavior
    photos/        # S3 (photos) + bucket policy (approved/* read) + lifecycle
    api/            # ECR repo, Lambda (container image), API GW HTTP API,
                    # IAM role/policy, CW log group, /api/* CF behavior
    data/            # DynamoDB tables (on-demand)
    dns/             # optional ACM (us-east-1) + Route53 (var.domain_name != "")
  envs/
    dev/            # backend.tf (state key: env/dev), terraform.tfvars, main.tf
    prod/           # backend.tf (state key: env/prod), terraform.tfvars, main.tf
  README.md          # state bootstrap, plan/apply instructions
```

Each `envs/<name>/main.tf` is the actual root module: it instantiates
`data`, `photos`, `api` (passing in `data`'s table ARNs + `photos`'s bucket
ARN), `static-site` (passing in `api`'s API Gateway domain + `photos`'s
bucket regional domain so `static-site`'s CloudFront distribution can attach
all three behaviors), and conditionally `dns`.

## Why one CloudFront distribution lives in `static-site`
`static-site` module owns the CloudFront distribution resource itself (not a
separate `cdn` module) because the distribution's *default* behavior is
inherently tied to the site bucket, and Terraform's module boundaries here
are about ownership of the distribution resource, not this-service-only
in isolation. `api` and `photos` modules expose outputs (origin domain name,
origin access identity requirements) that `static-site` consumes to add the
extra ordered cache behaviors (`/api/*`, `/approved/*`).

## `modules/api` details
- `aws_ecr_repository` — image repo for the FastAPI container.
- `aws_lambda_function` — `package_type = "Image"`, `image_uri` referencing
  `${ecr_repo_url}:latest` (Terraform doesn't build/push images; CI does —
  see root `.github/workflows/deploy-backend.yml`. Terraform's initial apply
  needs *some* image to exist first — document a one-time manual
  `docker build && push` of a placeholder in `infra/README.md` before first
  apply).
- `aws_apigatewayv2_api` (HTTP API) + `aws_apigatewayv2_integration`
  (Lambda proxy) + `aws_apigatewayv2_route` (`ANY /{proxy+}`) +
  `aws_apigatewayv2_stage` (auto-deploy).
- `aws_iam_role` for the Lambda execution role with an inline/attached
  policy scoped to: `dynamodb:GetItem/PutItem/UpdateItem/Query` on the
  specific table ARNs from `modules.data` outputs (plus their GSIs), and
  `s3:GetObject/PutObject/CopyObject` scoped to the photos bucket ARN with
  `pending/*` and `approved/*` prefixes only — never bucket-wide `*`.
- Env vars on the Lambda: table names, bucket name, `GOOGLE_CLIENT_ID`,
  `FACEBOOK_APP_ID`, `ADMIN_EMAILS`, and secret refs (`SESSION_SECRET`,
  `FACEBOOK_APP_SECRET`, `GOOGLE_CLIENT_SECRET` if needed) pulled from SSM
  Parameter Store `SecureString` — not plaintext in `.tfvars` committed to
  git.

## `modules/photos` details
Bucket policy statement:
```json
{
  "Effect": "Allow",
  "Principal": { "Service": "cloudfront.amazonaws.com" },
  "Action": "s3:GetObject",
  "Resource": "arn:aws:s3:::<bucket>/approved/*",
  "Condition": { "StringEquals": { "AWS:SourceArn": "<distribution arn>" } }
}
```
Lifecycle rule: `filter { prefix = "pending/" }`, `expiration { days = 30 }`.

## `modules/dns` details
Only created when `var.domain_name != ""`. ACM cert must be requested in
`us-east-1` regardless of the main deployment region (CloudFront
requirement) — use a `provider "aws" { alias = "us_east_1" }` passed into
this module. Route53 hosted zone is looked up by data source if it already
exists (assume the user manages the zone), or optionally created if the
user wants Terraform to own it (flag via `var.create_hosted_zone`, default
`false`).

## State & environments
Remote state: one S3 bucket (versioned, encrypted) + one DynamoDB lock
table, both bootstrapped manually once (documented, not part of the
Terraform this repo manages, to avoid the chicken/egg of state-for-state).
`envs/dev` and `envs/prod` use the same bucket with different state keys
(`env/dev/terraform.tfstate`, `env/prod/terraform.tfstate`) and entirely
separate resources (different table/bucket names, e.g. suffixed `-dev`/`-prod`).
