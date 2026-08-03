variable "domain_name" {
  type        = string
  description = "Custom domain, e.g. millionmealclub.org. Only instantiate this module when this is non-empty."
}

variable "create_hosted_zone" {
  type        = bool
  default     = false
  description = "If true, Terraform creates the Route53 hosted zone. If false (default), it looks up an existing zone for domain_name."
}

variable "tags" {
  type    = map(string)
  default = {}
}
