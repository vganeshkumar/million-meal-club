output "api_domain_name" {
  description = "Hostname only (no scheme) for use as a CloudFront custom origin."
  value       = replace(aws_apigatewayv2_api.this.api_endpoint, "https://", "")
}

output "function_name" {
  value = aws_lambda_function.api.function_name
}

output "ecr_repository_url" {
  value = aws_ecr_repository.api.repository_url
}
