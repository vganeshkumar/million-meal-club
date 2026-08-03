output "site_url" {
  value = local.has_custom_domain ? "https://${var.domain_name}" : "https://${module.static_site.distribution_domain_name}"
}

output "cloudfront_distribution_id" {
  value = module.static_site.distribution_id
}

output "site_bucket_name" {
  description = "Sync the frontend's static export here on each deploy. See infra/README.md."
  value       = module.static_site.site_bucket_id
}

output "api_ecr_repository_url" {
  description = "Push the backend container image here before the first apply, and on each deploy. See infra/README.md and backend/Dockerfile."
  value       = module.api.ecr_repository_url
}

output "lambda_function_name" {
  value = module.api.function_name
}

output "photos_bucket_name" {
  value = module.photos.bucket_id
}
