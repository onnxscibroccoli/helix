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
  git clone "__HELIX_REPO_URL__" /opt/helix
else
  git -C /opt/helix remote set-url origin "__HELIX_REPO_URL__"
fi
git -C /opt/helix fetch --force origin "__HELIX_SOURCE_REF__"
git -C /opt/helix reset --hard "__HELIX_SOURCE_REF__"
git -C /opt/helix clean -ffd
test "$(git -C /opt/helix rev-parse HEAD)" = "__HELIX_SOURCE_REF__"

# The executor bridge uses a freshly generated host-local secret on clean reconstruction.
# Production credential values are never copied into the source tree or image.
install -d -m 0700 /etc/helix
if [[ ! -s /etc/helix/agent.env ]]; then
  AGENT_TOKEN="$(openssl rand -hex 32)"
  umask 077
  printf 'AGENT_HOST=127.0.0.1\nAGENT_PORT=8093\nAGENT_VM=helix-omnikali\nHELIX_AGENT_BRIDGE_TOKEN=%s\n' "$AGENT_TOKEN" > /etc/helix/agent.env
  chmod 600 /etc/helix/agent.env
fi

install -m 0644 /opt/helix/production/agent/omni-agent.service /etc/systemd/system/omni-agent.service
systemctl daemon-reload
systemctl enable omni-agent.service

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
systemctl restart omni-agent.service
systemctl is-active --quiet omni-agent.service

if [[ -e /opt/helix/production/desktop/helix-rdc-bootstrap.sh ]] &&
   find /root /home -path '*/.desktop-commander-device/device.json' -print -quit 2>/dev/null | grep -q .; then
  /opt/helix/production/desktop/helix-rdc-bootstrap.sh
fi

systemctl --no-pager --full status libvirtd
systemctl --no-pager --full status snap.amazon-ssm-agent.amazon-ssm-agent.service
