output "db_instance_identifier" {
  value = aws_db_instance.postgres.identifier
}

output "db_endpoint" {
  value = aws_db_instance.postgres.address
}

output "db_port" {
  value = aws_db_instance.postgres.port
}

output "db_name" {
  value = aws_db_instance.postgres.db_name
}

output "postgres_security_group_id" {
  value = aws_security_group.postgres.id
}

output "master_user_secret_arn" {
  value       = aws_db_instance.postgres.master_user_secret[0].secret_arn
  description = "AWS Secrets Manager ARN managed by RDS. Secret value is intentionally never output."
}
