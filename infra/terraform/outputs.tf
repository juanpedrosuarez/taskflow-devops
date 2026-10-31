output "public_ip" {
  description = "IP público fixo da aplicação."
  value       = aws_eip.app.public_ip
}

output "app_url" {
  description = "URL da aplicação."
  value       = "http://${aws_eip.app.public_ip}"
}

output "instance_id" {
  description = "ID da instância (útil para acessar via SSM)."
  value       = aws_instance.app.id
}

output "log_group" {
  description = "Grupo de logs no CloudWatch."
  value       = aws_cloudwatch_log_group.app.name
}
