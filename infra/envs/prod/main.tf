locals {
  common_tags = {
    Project     = "million-meal-club"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
  name_prefix       = "${var.project_name}-${var.environment}"
  has_custom_domain = var.domain_name != ""
}

module "data" {
  source = "../../modules/data"

  project_name = var.project_name
  environment  = var.environment
  tags         = local.common_tags
}

module "photos" {
  source = "../../modules/photos"

  bucket_name = "${local.name_prefix}-photos"
  tags        = local.common_tags
}

# Certificate only (no dependency on the distribution) — see
# modules/dns/main.tf for why the alias record is created below instead of
# inside that module.
module "dns" {
  count  = local.has_custom_domain ? 1 : 0
  source = "../../modules/dns"

  providers = {
    aws.us_east_1 = aws.us_east_1
  }

  domain_name        = var.domain_name
  create_hosted_zone = var.create_hosted_zone
  tags               = local.common_tags
}

# Donor-onboarding email — only created when ses_from_email is set (same
# optional-resource pattern as modules/dns). AWS emails a confirmation link
# to this address; it must be clicked before SES will actually send from
# it. See specs/features/007-donor-application-approval/design.md.
resource "aws_ses_email_identity" "from" {
  count = var.ses_from_email != "" ? 1 : 0
  email = var.ses_from_email
}

module "api" {
  source = "../../modules/api"

  project_name        = var.project_name
  environment         = var.environment
  table_names         = module.data.table_names
  table_arns          = module.data.table_arns
  photos_bucket_name  = module.photos.bucket_id
  photos_bucket_arn   = module.photos.bucket_arn
  admin_emails        = var.admin_emails
  google_client_id    = var.google_client_id
  facebook_app_id     = var.facebook_app_id
  facebook_app_secret = var.facebook_app_secret
  session_secret      = var.session_secret
  ses_from_email      = var.ses_from_email
  ses_identity_arn    = var.ses_from_email != "" ? aws_ses_email_identity.from[0].arn : ""
  tags                = local.common_tags
}

module "static_site" {
  source = "../../modules/static-site"

  bucket_name                        = "${local.name_prefix}-site"
  photos_bucket_regional_domain_name = module.photos.bucket_regional_domain_name
  photos_origin_access_control_id    = module.photos.origin_access_control_id
  api_domain_name                    = module.api.api_domain_name
  domain_name                        = var.domain_name
  acm_certificate_arn                = local.has_custom_domain ? module.dns[0].certificate_arn : ""
  tags                               = local.common_tags
}

# The alias record depends on the distribution's domain name (only known
# after static_site is created) and module.dns's zone_id — created here,
# not inside either module, to avoid the circular dependency described in
# modules/dns/main.tf.
resource "aws_route53_record" "site" {
  count   = local.has_custom_domain ? 1 : 0
  zone_id = module.dns[0].zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = module.static_site.distribution_domain_name
    zone_id                = "Z2FDTNDATAQYW2" # CloudFront's fixed hosted zone ID for alias records
    evaluate_target_health = false
  }
}

# Bucket policies live at the root (not inside modules/static-site or
# modules/photos) because they need the CloudFront distribution's ARN,
# which only exists after static_site is created — see
# specs/infra/design.md.

data "aws_iam_policy_document" "site_bucket_policy" {
  statement {
    sid       = "AllowCloudFrontRead"
    actions   = ["s3:GetObject"]
    resources = ["${module.static_site.site_bucket_arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [module.static_site.distribution_arn]
    }
  }
}

resource "aws_s3_bucket_policy" "site" {
  bucket = module.static_site.site_bucket_id
  policy = data.aws_iam_policy_document.site_bucket_policy.json
}

data "aws_iam_policy_document" "photos_bucket_policy" {
  statement {
    sid       = "AllowCloudFrontReadApproved"
    actions   = ["s3:GetObject"]
    resources = ["${module.photos.bucket_arn}/approved/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [module.static_site.distribution_arn]
    }
  }
}

resource "aws_s3_bucket_policy" "photos" {
  bucket = module.photos.bucket_id
  policy = data.aws_iam_policy_document.photos_bucket_policy.json
}
