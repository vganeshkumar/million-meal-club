# Infra — Requirements

## Purpose
Stand up the architecture in [[01-architecture]] via Terraform, so every
resource is reproducible, reviewable, and destroyable — never console
click-ops. See [[00-constitution]] §6, §7, §8.

## Functional requirements
- One Terraform-managed CloudFront distribution with three behaviors
  (default → static site, `/api/*` → API Gateway, `/photos/*` → photos
  bucket), fronting everything under one domain.
- S3 site bucket: private, OAC-only read access, versioning optional,
  lifecycle not needed (small static bundle, overwritten on each deploy).
- S3 photos bucket: private, SSE-S3, bucket policy scoping CloudFront's
  `s3:GetObject` to `approved/*` only, lifecycle rule expiring `pending/*`
  after 30 days.
- Lambda function (container image from ECR) + API Gateway HTTP API +
  execution role scoped to exactly the DynamoDB tables and S3 bucket/prefixes
  it needs.
- DynamoDB tables per [[01-architecture]]'s table list, on-demand billing.
- Two environments, `dev` and `prod`, isolated by separate Terraform state
  (and separate AWS resources — separate table names, bucket names, etc.)
  so changes can be tested before touching the live site.
- `var.domain_name` (default `""`) — when set, provisions ACM (us-east-1)
  + Route53 records; when empty, CloudFront's default domain is used.
- `var.ses_from_email` (default `""`) — when set, provisions an
  `aws_ses_email_identity` for donor-onboarding emails and grants the
  Lambda role `ses:SendEmail` scoped to it; when empty, that resource is
  skipped (same optional-resource pattern as `domain_name`/`dns`). See
  [[features/007-donor-application-approval]].

## Non-functional requirements
- Remote state: S3 backend + DynamoDB lock table (bootstrapped once,
  documented, not itself managed by the Terraform it locks — chicken/egg).
- No resource anywhere with a permanent hourly cost (no NAT gateways, no
  provisioned-capacity anything, no idle compute).
- `terraform fmt` and `terraform validate` clean at all times. `terraform
  plan` is safe to run freely; `terraform apply` requires explicit user
  sign-off every time (see [[00-constitution]] §8) — never run
  automatically by an agent, including in CI, without a manual approval gate.
- Module boundaries mirror the architecture diagram's components
  (`static-site`, `photos`, `api`, `data`, `dns`) so each can be reasoned
  about/tested independently.

## Out of scope (for now)
- Multi-region / DR — a charity site doesn't need it at this stage.
- WAF / rate limiting — add later if abuse becomes an issue.
- A separate "staging" env beyond dev/prod.
