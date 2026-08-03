# Optional custom domain: ACM cert (must be requested in us-east-1 for
# CloudFront, regardless of the main deployment region — see
# specs/infra/design.md) + Route53 alias record. Only instantiated when
# var.domain_name is set at the env root (see envs/dev/main.tf).

terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      configuration_aliases = [aws.us_east_1]
    }
  }
}

data "aws_route53_zone" "existing" {
  count        = var.create_hosted_zone ? 0 : 1
  name         = var.domain_name
  private_zone = false
}

resource "aws_route53_zone" "created" {
  count = var.create_hosted_zone ? 1 : 0
  name  = var.domain_name
  tags  = var.tags
}

locals {
  zone_id = var.create_hosted_zone ? aws_route53_zone.created[0].zone_id : data.aws_route53_zone.existing[0].zone_id
}

resource "aws_acm_certificate" "this" {
  provider          = aws.us_east_1
  domain_name       = var.domain_name
  validation_method = "DNS"
  tags              = var.tags

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.this.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      type   = dvo.resource_record_type
      record = dvo.resource_record_value
    }
  }

  zone_id = local.zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = 300
  records = [each.value.record]
}

resource "aws_acm_certificate_validation" "this" {
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.this.arn
  validation_record_fqdns = [for r in aws_route53_record.cert_validation : r.fqdn]
}

# Note: the A/ALIAS record pointing the domain at the CloudFront
# distribution is NOT created here — it depends on the distribution's
# domain name, which only exists after modules/static-site runs, and
# static-site needs this module's certificate_arn *before* it can be
# created. Creating the alias record here would be circular. Instead it's
# created at the env root (see envs/dev/main.tf), after both this module
# and modules/static-site have run. This module only owns the
# certificate + its DNS validation records.
