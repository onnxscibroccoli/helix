data "aws_subnet" "db" {
  for_each = toset(var.db_subnet_ids)
  id       = each.value
}

resource "aws_security_group" "postgres" {
  name        = "${var.name}-postgres"
  description = "Helix production control-plane PostgreSQL"
  vpc_id      = var.vpc_id

  dynamic "ingress" {
    for_each = toset(var.allowed_security_group_ids)
    content {
      description     = "Helix application PostgreSQL access"
      protocol        = "tcp"
      from_port       = 5432
      to_port         = 5432
      security_groups = [ingress.value]
    }
  }

  egress {
    protocol    = "-1"
    from_port   = 0
    to_port     = 0
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name      = "${var.name}-postgres"
    Project   = "Helix"
    HelixRole = "control-plane-database"
  }
}

resource "aws_db_subnet_group" "postgres" {
  name       = "${var.name}-subnets"
  subnet_ids = var.db_subnet_ids

  lifecycle {
    precondition {
      condition = length(distinct([
        for id in var.db_subnet_ids : data.aws_subnet.db[id].availability_zone
      ])) >= 2
      error_message = "Helix PostgreSQL requires DB subnets in at least two Availability Zones."
    }
  }

  tags = {
    Name      = "${var.name}-subnets"
    Project   = "Helix"
    HelixRole = "control-plane-database"
  }
}

resource "aws_db_instance" "postgres" {
  identifier = var.name

  engine         = "postgres"
  engine_version = var.engine_version
  instance_class = var.instance_class
  db_name        = var.database_name
  username       = var.master_username
  port           = 5432

  allocated_storage     = var.allocated_storage_gb
  max_allocated_storage = var.max_allocated_storage_gb
  storage_type          = "gp3"
  storage_encrypted     = true

  # AWS owns the master password in Secrets Manager; it is never placed in
  # Terraform configuration or state as a literal password.
  manage_master_user_password         = true
  iam_database_authentication_enabled = true

  multi_az            = true
  publicly_accessible = false

  db_subnet_group_name   = aws_db_subnet_group.postgres.name
  vpc_security_group_ids = [aws_security_group.postgres.id]

  backup_retention_period  = var.backup_retention_days
  copy_tags_to_snapshot    = true
  deletion_protection      = true
  skip_final_snapshot      = false
  final_snapshot_identifier = "${var.name}-final"

  auto_minor_version_upgrade = true
  apply_immediately          = false
  delete_automated_backups   = false

  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  tags = {
    Name      = var.name
    Project   = "Helix"
    HelixRole = "control-plane-database"
  }
}
