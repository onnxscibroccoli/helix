#!/usr/bin/env bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
if [[ ! -e /dev/kvm ]]; then echo "ERROR: /dev/kvm is absent. Enable EC2 NestedVirtualization first." >&2; exit 1; fi
apt-get update -y
apt-get install -y qemu-system-x86 qemu-utils libvirt-daemon-system libvirt-clients virtinst bridge-utils ovmf
systemctl enable --now libvirtd.service
virsh -c qemu:///system net-start default 2>/dev/null || true
virsh -c qemu:///system net-autostart default
virsh -c qemu:///system domcapabilities --virttype kvm >/dev/null
echo "Helix KVM/libvirt host ready"
echo "kvm=$(test -e /dev/kvm && echo PRESENT || echo ABSENT)"
virsh -c qemu:///system version
virsh -c qemu:///system net-info default
