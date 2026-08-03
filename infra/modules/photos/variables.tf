variable "bucket_name" {
  type        = string
  description = "Globally-unique S3 bucket name for proof-of-delivery photos."
}

variable "tags" {
  type    = map(string)
  default = {}
}
