# Private S3 bucket for proof-of-delivery photos. `pending/*` is never
# public — only reachable via presigned URLs the backend mints. `approved/*`
# is made readable by CloudFront (via OAC) in a bucket policy attached at
# the env root (see envs/dev/main.tf), because that policy needs the
# CloudFront distribution's ARN, which doesn't exist until the static-site
# module (which needs this bucket's domain name) has been created — see
# specs/infra/design.md for why the bucket policy lives at the root instead
# of in this module.

resource "aws_s3_bucket" "photos" {
  bucket = var.bucket_name
  tags   = var.tags
}

resource "aws_s3_bucket_public_access_block" "photos" {
  bucket = aws_s3_bucket.photos.id

  block_public_acls       = true
  block_public_policy     = false # a scoped bucket policy is applied at the root
  ignore_public_acls      = true
  restrict_public_buckets = false
}

resource "aws_s3_bucket_server_side_encryption_configuration" "photos" {
  bucket = aws_s3_bucket.photos.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Unapproved/abandoned uploads don't accumulate storage cost forever.
resource "aws_s3_bucket_lifecycle_configuration" "photos" {
  bucket = aws_s3_bucket.photos.id

  rule {
    id     = "expire-pending"
    status = "Enabled"
    filter {
      prefix = "pending/"
    }
    expiration {
      days = 30
    }
  }
}

resource "aws_cloudfront_origin_access_control" "photos" {
  name                              = "${var.bucket_name}-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}
