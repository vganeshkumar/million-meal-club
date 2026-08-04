variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "project_name" {
  type    = string
  default = "mmc"
}

variable "environment" {
  type    = string
  default = "dev"
}

variable "domain_name" {
  type        = string
  default     = ""
  description = "Custom domain, e.g. millionmealclub.org. Empty uses CloudFront's default domain — see specs/01-architecture.md."
}

variable "create_hosted_zone" {
  type    = bool
  default = false
}

variable "admin_emails" {
  type        = string
  default     = ""
  description = "Comma-separated allowlist for /api/admin/* routes."
}

variable "google_client_id" {
  type    = string
  default = ""
}

variable "facebook_app_id" {
  type    = string
  default = ""
}

variable "facebook_app_secret" {
  type      = string
  default   = ""
  sensitive = true
}

variable "session_secret" {
  type        = string
  default     = ""
  sensitive   = true
  description = "HMAC key for session JWTs. Set via a gitignored *.auto.tfvars file — never commit a real value."
}

variable "ses_from_email" {
  type        = string
  default     = ""
  description = "Verified SES sending address for donor-onboarding emails. Empty skips SES entirely — see specs/features/007-donor-application-approval/design.md. Remember: SES starts in sandbox mode, so recipient addresses need verifying too until AWS grants production access."
}

variable "geoapify_api_key" {
  type        = string
  default     = ""
  sensitive   = true
  description = "Geoapify Static Maps API key (free tier). Empty omits the donation-event share page's og:image — see specs/features/023-event-location-time-and-sharing/design.md."
}
