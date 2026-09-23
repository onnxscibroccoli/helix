# Helix EC2 desktop host

This host is the L1 browser-desktop substrate and can run Helix workspace VMs as L2 KVM guests.

## Prerequisites

The EC2 control plane must enable nested virtualization while the instance is stopped. After start, /dev/kvm must exist.

Run as root:
./production/desktop/helix-kvm-bootstrap.sh

The script installs QEMU/libvirt, starts libvirtd, enables the private libvirt default NAT network, and verifies KVM capabilities.

## Persistent storage

Workspace persistence is provider-backed. The production storage agent provisions one encrypted EBS volume per persistent workspace, attaches it to the hypervisor host, and returns the verified NVMe device path. The libvirt domain consumes that block device as a virtio disk.

Ephemeral workspaces use local qcow2 scratch storage and are destroyed with the workspace.

A persistent workspace volume is never deleted merely because a VM stops or a browser disconnects. Deletion is an explicit workspace-destroy operation.

## Network and display

Workspace guests use the libvirt default private network. VNC is bound to localhost only. The gateway is the only public entry point and must authenticate the user before creating a desktop WebSocket session.

Never expose TCP 5900, 6080, libvirt, or the hypervisor API to the public network.
