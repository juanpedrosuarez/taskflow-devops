variable "aws_region" {
  description = "Região da AWS onde a infraestrutura será criada."
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Nome do projeto, usado como prefixo dos recursos."
  type        = string
  default     = "taskflow"
}

variable "environment" {
  description = "Ambiente (staging ou production)."
  type        = string
  default     = "staging"

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment deve ser \"staging\" ou \"production\"."
  }
}

variable "vpc_cidr" {
  description = "Faixa de IPs da VPC."
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidr" {
  description = "Faixa de IPs da sub-rede pública."
  type        = string
  default     = "10.0.1.0/24"
}

variable "instance_type" {
  description = "Tipo da instância EC2 (t3.micro está no nível gratuito)."
  type        = string
  default     = "t3.micro"
}

variable "app_image" {
  description = "Imagem Docker da aplicação publicada pelo pipeline de CD."
  type        = string
  default     = "ghcr.io/seu-usuario/taskflow-api:latest"
}

variable "ssh_public_key" {
  description = "Chave pública SSH usada pelo deploy. Deixe vazio para acessar só via SSM."
  type        = string
  default     = ""
}

variable "ssh_allowed_cidr" {
  description = "Faixa de IPs autorizada a acessar a porta 22."
  type        = string
  default     = "0.0.0.0/32"
}

variable "log_retention_days" {
  description = "Dias de retenção dos logs no CloudWatch."
  type        = number
  default     = 14
}
