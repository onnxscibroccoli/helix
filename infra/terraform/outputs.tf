output "hypervisor_id" {
  value = oci_core_instance.hypervisor_node.id
}
output "volume_id" {
  value = oci_core_volume.user_persistent_storage.id
}
output "private_subnet_id" {
  value = oci_core_subnet.private_subnet.id
}
