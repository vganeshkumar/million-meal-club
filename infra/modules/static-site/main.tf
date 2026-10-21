# S3 site bucket + the single CloudFront distribution for the whole app.
# Three behaviors: default -> this bucket (the Next.js static export),
# /api/* -> API Gateway (modules/api), /photos/* -> the photos bucket
# (modules/photos). See specs/01-architecture.md for why everything lives
# behind one distribution (same-origin auth cookies, no CORS).

locals {
  has_custom_domain = var.domain_name != ""
  site_origin_id    = "site-bucket"
  api_origin_id     = "api-gateway"
  photos_origin_id  = "photos-bucket"
  # AWS managed cache/origin-request policies (fixed IDs, no need to create our own).
  caching_disabled_policy_id       = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
  caching_optimized_policy_id      = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  all_viewer_except_host_policy_id = "b689b0a8-53d0-40ab-baf2-68738e2966ac"
}

resource "aws_s3_bucket" "site" {
  bucket = var.bucket_name
  tags   = var.tags
}

resource "aws_s3_bucket_public_access_block" "site" {
  bucket = aws_s3_bucket.site.id

  block_public_acls       = true
  block_public_policy     = false # a bucket policy scoped to CloudFront's OAC is applied at the root
  ignore_public_acls      = true
  restrict_public_buckets = false
}

resource "aws_cloudfront_origin_access_control" "site" {
  name                              = "${var.bucket_name}-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# The photos bucket stores objects under "approved/<id>/<file>" (no
# "photos/" prefix — see infra/README.md's bucket policy scoped to
# "approved/*"), but CloudFront forwards the full matched request path
# (including the "/photos" the path_pattern matched on) to the origin
# unchanged. Without stripping it first, every request 403s against a
# key that doesn't exist (e.g. "/photos/approved/x/y" looks up S3 key
# "photos/approved/x/y", not "approved/x/y") — this was silently
# breaking every approved donation photo. See
# specs/infra/design.md "modules/photos details".
resource "aws_cloudfront_function" "strip_photos_prefix" {
  name    = "${var.bucket_name}-strip-photos-prefix"
  runtime = "cloudfront-js-2.0"
  comment = "Strips the /photos prefix before forwarding to the photos S3 origin."
  publish = true
  code    = <<-EOT
    function handler(event) {
      var request = event.request;
      request.uri = request.uri.replace(/^\/photos/, "");
      return request;
    }
  EOT
}

resource "aws_cloudfront_distribution" "this" {
  enabled             = true
  default_root_object = "index.html"
  price_class         = "PriceClass_100" # cheapest tier (US/Canada/Europe) — see specs/00-constitution.md

  origin {
    domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
    origin_id                = local.site_origin_id
    origin_access_control_id = aws_cloudfront_origin_access_control.site.id
  }

  origin {
    domain_name              = var.photos_bucket_regional_domain_name
    origin_id                = local.photos_origin_id
    origin_access_control_id = var.photos_origin_access_control_id
  }

  origin {
    domain_name = var.api_domain_name
    origin_id   = local.api_origin_id
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id       = local.site_origin_id
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = local.caching_optimized_policy_id
    compress               = true
  }

  ordered_cache_behavior {
    path_pattern             = "/api/*"
    target_origin_id         = local.api_origin_id
    viewer_protocol_policy   = "https-only"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = local.caching_disabled_policy_id
    origin_request_policy_id = local.all_viewer_except_host_policy_id
    compress                 = true
  }

  # Matches the actual S3 key prefix ("approved/..."), not a "/photos/"
  # namespace — CloudFront forwards the full request path to the origin
  # unmodified (no path stripping without a CloudFront Function/Lambda@Edge
  # rewrite, which this distribution doesn't have), so the path pattern
  # must equal the real object prefix or every request 403s against the
  # bucket policy (which also only grants "approved/*").
  ordered_cache_behavior {
    path_pattern           = "/approved/*"
    target_origin_id       = local.photos_origin_id
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = local.caching_optimized_policy_id
    compress               = true

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.strip_photos_prefix.arn
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  aliases = local.has_custom_domain ? [var.domain_name] : []

  viewer_certificate {
    cloudfront_default_certificate = local.has_custom_domain ? null : true
    acm_certificate_arn            = local.has_custom_domain ? var.acm_certificate_arn : null
    ssl_support_method             = local.has_custom_domain ? "sni-only" : null
    minimum_protocol_version       = local.has_custom_domain ? "TLSv1.2_2021" : null
  }

  tags = var.tags
}
