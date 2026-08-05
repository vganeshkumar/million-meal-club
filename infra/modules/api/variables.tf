variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "table_names" {
  type        = map(string)
  description = "Logical table name -> DynamoDB table name (modules/data output)."
}

variable "table_arns" {
  type        = list(string)
  description = "All table/GSI ARNs the Lambda role needs (modules/data output)."
}

variable "photos_bucket_name" {
  type = string
}

variable "photos_bucket_arn" {
  type = string
}

variable "photos_public_base_url" {
  type        = string
  description = "Public base URL for approved photos, e.g. https://<cloudfront-domain>/photos. Set after the static-site distribution exists."
  default     = ""
}

variable "admin_emails" {
  type        = string
  description = "Comma-separated allowlist for /api/admin/* routes."
  default     = ""
}

variable "google_client_id" {
  type    = string
  default = ""
}

variable "session_secret" {
  type        = string
  description = "HMAC key for signing session JWTs. Required in real deployments — generate a long random value and pass it via a gitignored *.auto.tfvars file, never commit it."
  default     = ""
  sensitive   = true
}

variable "ses_from_email" {
  type        = string
  description = "Verified SES sending address for donor-onboarding emails. Empty disables email sending (SES_FROM_EMAIL unset, no ses:SendEmail IAM grant)."
  default     = ""
}

variable "ses_identity_arn" {
  type        = string
  description = "ARN of the aws_ses_email_identity (modules/dns-style optional resource, created at the env root when ses_from_email is set). Empty when ses_from_email is empty."
  default     = ""
}

variable "site_base_url" {
  type        = string
  description = "Public origin of the frontend (e.g. https://millionmealclub.org), used to build the redirect target on the donation-event share page. Empty when no custom domain is configured — the backend falls back to a localhost default in that case, so sharing only produces a real link once a domain exists."
  default     = ""
}

variable "geoapify_api_key" {
  type        = string
  description = "Geoapify Static Maps API key (free tier), used to build the og:image on the donation-event share page. Not provisioned yet (same situation as OAuth credentials) — empty disables the map image, no error, just an omitted og:image tag."
  default     = ""
  sensitive   = true
}

variable "tags" {
  type    = map(string)
  default = {}
}
