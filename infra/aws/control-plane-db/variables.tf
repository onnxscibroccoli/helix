variable "region" {
  type    = string
  default = "us-east-1"
}

variable "name" {
  type    = string
  default = "helix-control-plane"
}

variable "vpc_id" {
  type        = string
  description = "Existing production VPC that contains the Helix compute tier."
}

variable "db_subnet_ids" {
  type        = list(string)
  description = "At least two private subnet IDs in distinct Availability Zones."

  validation {
    condition     = length(var.db_subnet_ids) >= 2
    error_message = "Provide at least two DB subnets in distinct Availability Zones."
  }
}

variable "allowed_security_group_ids" {
  type        = list(string)
  description = "Existing application security groups allowed to reach PostgreSQL on TCP/5432."
  default     = []
}

variable "instance_class" {
  type    = string
  default = "db.t4g.medium"
}

variable "engine_version" {
  type    = string
  default = "17.11"
}

variable "allocated_storage_gb" {
  type    = number
  default = 50
}

variable "max_allocated_storage_gb" {
  type    = number
  default = 200
}

variable "database_name" {
  type    = string
  default = "helix"
}

variable "master_username" {
  type    = string
  default = "helix_admin"
}

variable "backup_retention_days" {
  type    = number
  default = 14
}
