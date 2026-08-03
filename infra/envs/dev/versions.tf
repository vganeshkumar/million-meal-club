terraform {
  required_version = ">= 1.9"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Bootstrapped manually once (S3 bucket + DynamoDB lock table) — see
  # infra/README.md. Uncomment and fill in after bootstrapping:
  # backend "s3" {
  #   bucket         = "mmc-terraform-state"
  #   key            = "env/dev/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "mmc-terraform-locks"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = local.common_tags
  }
}

# CloudFront requires ACM certs to live in us-east-1 regardless of where
# everything else is deployed.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
  default_tags {
    tags = local.common_tags
  }
}
