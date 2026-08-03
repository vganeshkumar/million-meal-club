variable "bucket_name" {
  type        = string
  description = "Globally-unique S3 bucket name for the static site."
}

variable "photos_bucket_regional_domain_name" {
  type        = string
  description = "Regional domain name of the photos bucket (modules/photos output), used as the /photos/* origin."
}

variable "photos_origin_access_control_id" {
  type        = string
  description = "OAC id from modules/photos, reused for the /photos/* behavior's origin."
}

variable "api_domain_name" {
  type        = string
  description = "API Gateway HTTP API's default endpoint domain (modules/api output), used as the /api/* origin."
}

variable "domain_name" {
  type        = string
  default     = ""
  description = "Custom domain for the site. Empty string uses CloudFront's own *.cloudfront.net domain (see specs/01-architecture.md 'No custom domain yet')."
}

variable "acm_certificate_arn" {
  type        = string
  default     = ""
  description = "ACM cert ARN (us-east-1) from modules/dns. Required only when domain_name is set."
}

variable "tags" {
  type    = map(string)
  default = {}
}
