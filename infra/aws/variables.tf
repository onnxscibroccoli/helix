variable "region" { type = string default = "us-east-1" }
variable "name" { type = string default = "helix-desktop" }
variable "instance_type" { type = string default = "m8i.2xlarge" }
variable "root_volume_size" { type = number default = 80 }
variable "persistent_volume_size" { type = number default = 200 }
variable "allowed_gateway_cidr" { type = string default = "0.0.0.0/0" }
