terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Para trabalho em equipe, guarde o estado remotamente (S3 + trava no DynamoDB):
  # backend "s3" {
  #   bucket         = "taskflow-terraform-state"
  #   key            = "taskflow/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "taskflow-terraform-lock"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
