#!/usr/bin/env bash
set -euxo pipefail
export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y qemu-system-x86 qemu-utils libvirt-daemon-system libvirt-clients virtinst bridge-utils ovmf nginx git curl ca-certificates nodejs npm python3-venv cpu-checker util-linux

# AWS Ubuntu AMIs normally ship with SSM Agent. Keep provisioning deterministic
# and fail the build if the agent cannot be started.
if ! snap list amazon-ssm-agent >/dev/null 2>&1; then
  snap install amazon-ssm-agent --classic
fi
systemctl enable snap.amazon-ssm-agent.amazon-ssm-agent.service
systemctl restart snap.amazon-ssm-agent.amazon-ssm-agent.service
systemctl is-active --quiet snap.amazon-ssm-agent.amazon-ssm-agent.service

modprobe kvm_intel nested=1 || modprobe kvm_amd nested=1
test -e /dev/kvm
systemctl enable --now libvirtd
virsh -c qemu:///system net-start default || true
virsh -c qemu:///system net-autostart default

install -d -m 0755 /opt/helix
if [[ ! -d /opt/helix/.git ]]; then
  git clone https://github.com/onnxscibroccoli/helix.git /opt/helix
else
  git -C /opt/helix fetch origin
  git -C /opt/helix reset --hard origin/main
fi

# EBS attachment names become NVMe names on Nitro. Never assume /dev/nvme1n1.
# Select the largest non-root disk; Terraform creates the persistent volume
# separately from the root volume.
mkdir -p /var/lib/helix-persistent
ROOT_SOURCE="$(findmnt -n -o SOURCE /)"
ROOT_DISK="$(lsblk -no PKNAME "$ROOT_SOURCE" 2>/dev/null || true)"
persistent_device=""
persistent_size=0
while read -r name type size; do
  [[ "$type" == "disk" ]] || continue
  [[ "$name" == "$ROOT_DISK" ]] && continue
  if (( size > persistent_size )); then
    persistent_device="/dev/$name"
    persistent_size="$size"
  fi
done < <(lsblk -dnbo NAME,TYPE,SIZE | awk '{print $1, $2, $3}')

if [[ -n "$persistent_device" ]]; then
  blkid "$persistent_device" >/dev/null 2>&1 || mkfs.ext4 -F "$persistent_device"
  uuid="$(blkid -s UUID -o value "$persistent_device")"
  mountpoint -q /var/lib/helix-persistent || mount "$persistent_device" /var/lib/helix-persistent
  grep -q "UUID=$uuid /var/lib/helix-persistent " /etc/fstab || echo "UUID=$uuid /var/lib/helix-persistent ext4 defaults,nofail 0 2" >> /etc/fstab
fi

if [[ -e /opt/helix/production/desktop/helix-kvm-bootstrap.sh ]]; then
  /opt/helix/production/desktop/helix-kvm-bootstrap.sh
fi

# RDC is an operational access channel, not the primary provisioning path.
# Only enable it automatically when an existing paired device session exists.
if [[ -e /opt/helix/production/desktop/helix-rdc-bootstrap.sh ]] &&
   find /root /home -path '*/.desktop-commander-device/device.json' -print -quit 2>/dev/null | grep -q .; then
  /opt/helix/production/desktop/helix-rdc-bootstrap.sh
fi

systemctl --no-pager --full status libvirtd
systemctl --no-pager --full status snap.amazon-ssm-agent.amazon-ssm-agent.service
