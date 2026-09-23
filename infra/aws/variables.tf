variable "region" { type = string default = "us-east-1" }
variable "name" { type = string default = "helix-desktop" }
variable "instance_type" { type = string default = "m8i.2xlarge" }
variable "root_volume_size" { type = number default = 80 }
variable "persistent_volume_size" { type = number default = 200 }
variable "allowed_gateway_cidr" { type = string default = "0.0.0.0/0" }

# Optional existing Cognito app client used by the Helix gateway.
# When both IDs are supplied, Terraform manages the required Managed Login
# branding style so a newly-created app client cannot regress to the
# "Login pages unavailable" state.
variable "cognito_user_pool_id" {
  type    = string
  default = ""
}

variable "cognito_client_id" {
  type    = string
  default = ""
}
