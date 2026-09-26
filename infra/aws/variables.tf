variable "region" {
  type    = string
  default = "us-east-1"
}

variable "name" {
  type    = string
  default = "helix-desktop"
}

variable "instance_type" {
  type    = string
  default = "m8i.2xlarge"
}

variable "root_volume_size" {
  type    = number
  default = 80
}

variable "persistent_volume_size" {
  type    = number
  default = 200
}

variable "allowed_gateway_cidr" {
  type    = string
  default = "0.0.0.0/0"
}

variable "cloudfront_distribution_id" {
  type    = string
  default = "E3AT3ETQQVLZJ4"
}

variable "recovery_health_url" {
  type    = string
  default = "https://d22bad48irrbqe.cloudfront.net/"
}

variable "recovery_instance_id" {
  type    = string
  default = "i-03b6a82d46271d9cd"
}

variable "cognito_user_pool_id" {
  type    = string
  default = ""
}

variable "cognito_client_id" {
  type    = string
  default = ""
}
