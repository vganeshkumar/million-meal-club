# Million Meal Club — Infrastructure

Terraform for the whole AWS footprint. See `../specs/infra/` for
requirements/design and `../specs/01-architecture.md` for the system
diagram this implements. **Nobody — including an AI agent — should run
`terraform apply` without you explicitly asking for that specific apply in
the moment** (see `../specs/00-constitution.md` §8); this repo only
generates/validates the IaC.

## Layout

```
infra/
  modules/
    data/          DynamoDB tables (on-demand)
    photos/        S3 photos bucket + lifecycle + OAC
    static-site/   S3 site bucket + the one CloudFront distribution (3 behaviors)
    api/           ECR repo, Lambda (container image), API Gateway HTTP API, IAM
    dns/           optional ACM cert (only instantiated when domain_name is set)
  envs/
    dev/
    prod/
```

## One-time setup, in order

### 1. Remote state backend (manual, not managed by this Terraform)

```bash
aws s3api create-bucket --bucket mmc-terraform-state --region us-east-1
aws s3api put-bucket-versioning --bucket mmc-terraform-state \
  --versioning-configuration Status=Enabled
aws dynamodb create-table --table-name mmc-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

Then uncomment and fill in the `backend "s3" {}` block in
`envs/<env>/versions.tf` (bucket/table names above, key
`env/<env>/terraform.tfstate`), and run `terraform init` again in that env
directory.

### 2. A placeholder Lambda container image

`aws_lambda_function.api` (in `modules/api`) references
`"${ecr_repository_url}:latest"`, which must exist **before the first
apply** — Terraform doesn't build/push Docker images. After the first
`terraform apply` creates the ECR repo (and every apply fails before that —
chicken/egg, apply once to get the repo, push an image, then the function
resource can be created on a second apply):

```bash
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

cd ../backend
docker build -t mmc-dev-api .
docker tag mmc-dev-api:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/mmc-dev-api:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/mmc-dev-api:latest
```

After that, `.github/workflows/deploy-backend.yml` owns pushing new images
and updating the running function on every merge to main.

### 3. Secrets

Never commit a real value for `session_secret`. Put it in a gitignored
`secrets.auto.tfvars` file in the env directory (or wire up SSM Parameter
Store / Secrets Manager references later — the variable is already marked
`sensitive = true` and ready for that upgrade).

```bash
cd envs/dev
cp terraform.tfvars.example terraform.tfvars   # non-secret config
cat > secrets.auto.tfvars <<'EOF'
session_secret = "$(openssl rand -hex 32)"
EOF
```

## Day-to-day

```bash
cd envs/dev   # or envs/prod
terraform init
terraform plan
terraform apply   # only when you (the human) decide to
```

## Notes

- No custom domain by default — `domain_name = ""` uses CloudFront's own
  `*.cloudfront.net` domain. Set `domain_name` (and `create_hosted_zone` if
  Route53 doesn't already have the zone) to add one later; see
  `specs/01-architecture.md`.
- Bucket policies for both S3 buckets are defined at the env root
  (`envs/<env>/main.tf`), not inside `modules/static-site` or
  `modules/photos` — they need the CloudFront distribution's ARN, which
  only exists after the distribution is created, and putting them in the
  same module as the distribution or the buckets would create a circular
  module dependency. See the comments in `envs/dev/main.tf`.
- `modules/dns` only creates the ACM certificate (+ DNS validation) — the
  Route53 alias record pointing your domain at CloudFront is created at the
  env root for the same circular-dependency reason (cert must exist before
  the distribution; the alias record needs the distribution to exist
  first).
