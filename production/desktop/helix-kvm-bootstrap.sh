#!/usr/bin/env bash
set -euo pipefail

# Helix L1 KVM/libvirt host bootstrap for supported AWS EC2 nested-virtualization hosts.
# AWS CPU option NestedVirtualization=enabled must be configured at the EC2 control plane
# before this script is run.

export DEBIAN_FRONTEND=noninteractive

if [[ ! -e /dev/kvm ]]; then
  echo "ERROR: /dev/kvm is absent. Enable EC2 NestedVirtualization first." >&2
  exit 1
fi

apt-get update -y
apt-get install -y   qemu-system-x86   qemu-utils   libvirt-daemon-system   libvirt-clients   virtinst   bridge-utils   ovmf

systemctl enable --now libvirtd.service

# The libvirt default network provides private NAT for disposable/dev guests.
virsh -c qemu:///system net-start default 2>/dev/null || true
virsh -c qemu:///system net-autostart default

# Fail closed if libvirt cannot actually use hardware KVM acceleration.
virsh -c qemu:///system domcapabilities --virttype kvm >/dev/null

echo "Helix KVM/libvirt host ready"
echo "kvm=$(test -e /dev/kvm && echo PRESENT || echo ABSENT)"
virsh -c qemu:///system version
virsh -c qemu:///system net-info default
