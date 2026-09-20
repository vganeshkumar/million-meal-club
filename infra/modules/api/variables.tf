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
  description = "Prefix for approved-photo URLs. Empty (the default) is correct for the same-origin CloudFront setup — see modules/static-site's /approved/* cache behavior, which routes on the S3 key prefix as-is."
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

variable "facebook_page_id" {
  type        = string
  description = "Million Meal Club Facebook Page id to post completed-event photos to. Empty disables Facebook posting (admin sees a clear 'not configured' error instead of a silent no-op)."
  default     = ""
}

variable "facebook_page_access_token" {
  type        = string
  description = "Long-lived Facebook Page access token (pages_manage_posts, pages_read_engagement). Not provisioned yet — same situation as Google OAuth credentials. Pass via a gitignored *.auto.tfvars file, never commit it."
  default     = ""
  sensitive   = true
}

variable "tags" {
  type    = map(string)
  default = {}
}
