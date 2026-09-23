#!/usr/bin/env bash
set -euxo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y qemu-system-x86 qemu-utils libvirt-daemon-system libvirt-clients virtinst bridge-utils ovmf nginx git curl ca-certificates nodejs npm python3-venv cpu-checker
snap install amazon-ssm-agent --classic || true
systemctl enable --now snap.amazon-ssm-agent.amazon-ssm-agent.service || systemctl enable --now amazon-ssm-agent || true
modprobe kvm_intel nested=1 || modprobe kvm_amd nested=1
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
if [[ -b /dev/nvme1n1 ]]; then
  blkid /dev/nvme1n1 >/dev/null 2>&1 || mkfs.ext4 -F /dev/nvme1n1
  mkdir -p /var/lib/helix-persistent
  mountpoint -q /var/lib/helix-persistent || mount /dev/nvme1n1 /var/lib/helix-persistent
  grep -q '/var/lib/helix-persistent' /etc/fstab || echo '/dev/nvme1n1 /var/lib/helix-persistent ext4 defaults,nofail 0 2' >> /etc/fstab
fi
if [[ -e /opt/helix/production/desktop/helix-kvm-bootstrap.sh ]]; then /opt/helix/production/desktop/helix-kvm-bootstrap.sh; fi
if [[ -e /opt/helix/production/desktop/helix-rdc-bootstrap.sh ]]; then /opt/helix/production/desktop/helix-rdc-bootstrap.sh || true; fi
systemctl daemon-reload
systemctl --no-pager status libvirtd || true
systemctl --no-pager status snap.amazon-ssm-agent.amazon-ssm-agent.service || systemctl --no-pager status amazon-ssm-agent || true
