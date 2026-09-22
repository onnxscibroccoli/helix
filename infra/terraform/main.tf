resource "oci_core_instance" "hypervisor_node" {
  availability_domain = var.availability_domain
  compartment_id      = var.compartment_id
  display_name        = "hypervisor-node-01"
  shape               = "VM.Standard3.Flex"

  shape_config {
    ocpus         = 8
    memory_in_gbs = 64
  }

  source_details {
    source_type = "image"
    source_id   = var.ubuntu_24_04_image_id
  }

  create_vnic_details {
    subnet_id        = oci_core_subnet.private_subnet.id
    assign_public_ip = false
  }

  metadata = {
    user_data = base64encode(file("${path.module}/cloud-init.yaml"))
  }
}

resource "oci_core_volume" "user_persistent_storage" {
  availability_domain = var.availability_domain
  compartment_id      = var.compartment_id
  display_name        = "user-storage-vol-01"
  size_in_gbs         = 200
  vpus_per_gb         = 20
}

resource "oci_core_volume_attachment" "attach_user_storage" {
  attachment_type = "paravirtualized"
  instance_id     = oci_core_instance.hypervisor_node.id
  volume_id       = oci_core_volume.user_persistent_storage.id
}
