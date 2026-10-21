# Infra — Tasks

- [ ] Bootstrap remote state: S3 bucket + DynamoDB lock table (manual,
      one-time, documented in `infra/README.md` — chicken/egg, not managed
      by the Terraform it locks). Not run this session (needs the user's
      AWS credentials).
- [x] `modules/static-site` — S3 bucket, CloudFront distribution (3
      behaviors: default/`/api/*`/`/approved/*`), OAC.
- [x] `modules/photos` — S3 bucket, lifecycle rule, OAC (bucket policy
      lives at the env root — see design.md for why).
- [x] `modules/data` — DynamoDB tables (on-demand), outputs of table
      names/ARNs for the api module's IAM policy.
- [ ] `modules/data` — add `partner_charities` table (see
      [[../features/006-partner-charities/design]], decided with user
      2026-08-03 as part of adopting the newer authoritative design).
- [x] `modules/api` — ECR repo, Lambda (container image, placeholder image
      required before first apply), API Gateway HTTP API, IAM role scoped
      to `modules.data` table ARNs + photos bucket prefixes, CloudWatch log
      group.
- [x] `modules/dns` — conditional ACM (us-east-1 provider alias) + Route53
      cert validation, gated on `var.domain_name != ""`. (Alias record for
      the domain itself lives at the env root, not in this module — see
      design.md for the circular-dependency reasoning.)
- [x] `envs/dev` and `envs/prod` — root modules wiring the above, each with
      its own `backend.tf` (state key, commented out until bootstrap) and
      `terraform.tfvars.example`.
- [x] `terraform fmt -recursive` and `terraform validate` clean in every
      module and env (verified both with `domain_name = ""` and with a test
      domain to exercise the dns module's code path).
- [ ] `terraform plan` reviewed against a real AWS account (requires the
      user's AWS credentials) before any apply. A `plan` against dummy/no
      credentials succeeded structurally (35 resources, no errors) but
      wasn't reviewed against real account state/quotas.
- [ ] User applies `envs/dev` manually; validate end-to-end; then `envs/prod`.
