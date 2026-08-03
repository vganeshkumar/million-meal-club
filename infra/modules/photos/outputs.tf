output "bucket_id" {
  value = aws_s3_bucket.photos.id
}

output "bucket_arn" {
  value = aws_s3_bucket.photos.arn
}

output "bucket_regional_domain_name" {
  value = aws_s3_bucket.photos.bucket_regional_domain_name
}

output "origin_access_control_id" {
  value = aws_cloudfront_origin_access_control.photos.id
}
