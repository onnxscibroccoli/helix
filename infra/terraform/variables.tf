variable "tenancy_ocid" {
  type = string
}
variable "user_ocid" {
  type = string
}
variable "fingerprint" {
  type = string
}
variable "private_key_path" {
  type = string
}
variable "region" {
  type    = string
  default = "us-ashburn-1"
}
variable "compartment_id" {
  type = string
}
variable "availability_domain" {
  type = string
}
variable "ubuntu_24_04_image_id" {
  type = string
}
variable "ssh_public_key" {
  type = string
}
