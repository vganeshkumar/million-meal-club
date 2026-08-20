# Lambda (container image) + API Gateway HTTP API running the FastAPI
# backend. See specs/backend/design.md and specs/01-architecture.md.
#
# IMPORTANT: aws_lambda_function.api references "${repo_url}:latest", which
# must already exist in ECR before the first `terraform apply` — Terraform
# doesn't build/push images. Push a placeholder image once, then let CI
# (.github/workflows/deploy-backend.yml) own subsequent updates. See
# infra/README.md.

locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

resource "aws_ecr_repository" "api" {
  name                 = "${local.name_prefix}-api"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = var.tags
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/lambda/${local.name_prefix}-api"
  retention_in_days = 14
  tags              = var.tags
}

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda_exec" {
  name               = "${local.name_prefix}-api-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
  tags               = var.tags
}

resource "aws_iam_role_policy_attachment" "basic_logs" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Least-privilege: exact table/GSI ARNs and exact bucket prefixes only — no
# dynamodb:* or bucket-wide s3:* wildcards. See specs/00-constitution.md §7.
data "aws_iam_policy_document" "lambda_permissions" {
  statement {
    sid = "DynamoDbAccess"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:Query",
      "dynamodb:Scan",
    ]
    resources = var.table_arns
  }

  statement {
    sid     = "PhotosBucketAccess"
    actions = ["s3:GetObject", "s3:PutObject", "s3:CopyObject"]
    resources = [
      "${var.photos_bucket_arn}/pending/*",
      "${var.photos_bucket_arn}/approved/*",
    ]
  }

  # Only when an SES identity exists (var.ses_from_email set) — see
  # specs/features/007-donor-application-approval/design.md.
  dynamic "statement" {
    for_each = var.ses_identity_arn != "" ? [1] : []
    content {
      sid       = "SesSendDonorOnboardingEmail"
      actions   = ["ses:SendEmail", "ses:SendRawEmail"]
      resources = [var.ses_identity_arn]
    }
  }
}

resource "aws_iam_role_policy" "lambda_permissions" {
  name   = "${local.name_prefix}-api-permissions"
  role   = aws_iam_role.lambda_exec.id
  policy = data.aws_iam_policy_document.lambda_permissions.json
}

resource "aws_lambda_function" "api" {
  function_name = "${local.name_prefix}-api"
  role          = aws_iam_role.lambda_exec.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.api.repository_url}:latest"
  timeout       = 15
  memory_size   = 512

  environment {
    variables = merge(
      {
        ENV                     = var.environment == "prod" ? "prod" : "dev"
        DATA_BACKEND            = "dynamodb"
        USERS_TABLE             = var.table_names["users"]
        DONORS_TABLE            = var.table_names["donors"]
        DONATIONS_TABLE         = var.table_names["donations"]
        SUBMISSIONS_TABLE       = var.table_names["submissions"]
        EVENTS_TABLE            = var.table_names["events"]
        SIGNUPS_TABLE           = var.table_names["signups"]
        VOLUNTEERS_TABLE        = var.table_names["volunteers"]
        EVENT_SIGNUPS_TABLE     = var.table_names["event_signups"]
        DONATION_EVENTS_TABLE   = var.table_names["donation_events"]
        PARTNER_CHARITIES_TABLE = var.table_names["partner_charities"]
        CONFIG_TABLE            = var.table_names["config"]
        PHOTOS_BUCKET_NAME      = var.photos_bucket_name
        PHOTOS_PUBLIC_BASE_URL  = var.photos_public_base_url
        ADMIN_EMAILS            = var.admin_emails
        GOOGLE_CLIENT_ID        = var.google_client_id
      },
      var.session_secret != "" ? { SESSION_SECRET = var.session_secret } : {},
      var.ses_from_email != "" ? { SES_FROM_EMAIL = var.ses_from_email } : {},
      var.site_base_url != "" ? { SITE_BASE_URL = var.site_base_url } : {},
      var.geoapify_api_key != "" ? { GEOAPIFY_API_KEY = var.geoapify_api_key } : {},
      var.instagram_access_token != "" ? { INSTAGRAM_ACCESS_TOKEN = var.instagram_access_token } : {},
      var.instagram_business_account_id != "" ? { INSTAGRAM_BUSINESS_ACCOUNT_ID = var.instagram_business_account_id } : {},
      # ENABLE_DUMMY_LOGIN is deliberately never set here — it must only
      # ever be exported by hand for local `uvicorn`, never by Terraform.
      # See specs/00-constitution.md §4.
    )
  }

  depends_on = [aws_cloudwatch_log_group.api, aws_iam_role_policy_attachment.basic_logs]

  tags = var.tags

  lifecycle {
    # CI (.github/workflows/deploy-backend.yml) updates the running image
    # directly after each build; Terraform shouldn't fight that back to a
    # stale :latest tag reference on every plan.
    ignore_changes = [image_uri]
  }
}

resource "aws_apigatewayv2_api" "this" {
  name          = "${local.name_prefix}-api"
  protocol_type = "HTTP"
  tags          = var.tags
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.this.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "proxy" {
  api_id    = aws_apigatewayv2_api.this.id
  route_key = "ANY /{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.this.id
  name        = "$default"
  auto_deploy = true
  tags        = var.tags
}

resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.this.execution_arn}/*/*"
}
