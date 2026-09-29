#!/usr/bin/env bash
set -euxo pipefail
export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y qemu-system-x86 qemu-utils libvirt-daemon-system libvirt-clients virtinst bridge-utils ovmf nginx git curl ca-certificates nodejs npm awscli python3-venv cpu-checker util-linux

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

HELIX_REPO_URL="__HELIX_REPO_URL__"
HELIX_SOURCE_REF="__HELIX_SOURCE_REF__"
[[ "$HELIX_REPO_URL" =~ ^https://github\.com/[^/]+/[^/]+(\.git)?$ ]]
[[ "$HELIX_SOURCE_REF" =~ ^[0-9a-f]{40}$ ]]

install -d -m 0755 /opt/helix
if [[ ! -d /opt/helix/.git ]]; then
  git clone --no-checkout "$HELIX_REPO_URL" /opt/helix
fi
git -C /opt/helix remote set-url origin "$HELIX_REPO_URL"
git -C /opt/helix fetch --depth=1 origin "$HELIX_SOURCE_REF"
git -C /opt/helix checkout --detach --force "$HELIX_SOURCE_REF"
test "$(git -C /opt/helix rev-parse HEAD)" = "$HELIX_SOURCE_REF"

# Install runtime dependencies from the immutable checkout. A source-only clone is not executable.
cd /opt/helix
npm ci --omit=dev
cd -

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

# Materialize account/instance identity for the EBS agent from IMDSv2. No live instance
# IDs, regions, or availability zones are checked into the repository.
install -d -m 0750 /etc/helix
IMDS_TOKEN="$(curl -fsS -X PUT -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" http://169.254.169.254/latest/api/token)"
INSTANCE_ID="$(curl -fsS -H "X-aws-ec2-metadata-token: $IMDS_TOKEN" http://169.254.169.254/latest/meta-data/instance-id)"
AZ="$(curl -fsS -H "X-aws-ec2-metadata-token: $IMDS_TOKEN" http://169.254.169.254/latest/meta-data/placement/availability-zone)"
REGION="${AZ%?}"
cat > /etc/helix/ebs-agent.env <<EOF
AWS_REGION=$REGION
HELIX_INSTANCE_ID=$INSTANCE_ID
HELIX_AVAILABILITY_ZONE=$AZ
EOF
chmod 600 /etc/helix/ebs-agent.env

# RDC is an operational access channel, not the primary provisioning path.
# Only enable it automatically when an existing paired device session exists.
if [[ -e /opt/helix/production/desktop/helix-rdc-bootstrap.sh ]] &&
   find /root /home -path '*/.desktop-commander-device/device.json' -print -quit 2>/dev/null | grep -q .; then
  /opt/helix/production/desktop/helix-rdc-bootstrap.sh
fi

for unit in production/storage/helix-ebs-volume-agent.service production/desktop/helix-libvirt-hypervisor.service; do
  install -m 0644 "/opt/helix/$unit" "/etc/systemd/system/$(basename "$unit")"
done
systemctl daemon-reload
systemctl enable --now helix-ebs-volume-agent.service
systemctl enable --now helix-libvirt-hypervisor.service
systemctl is-active --quiet helix-ebs-volume-agent.service
systemctl is-active --quiet helix-libvirt-hypervisor.service

# The gateway requires account-specific OIDC, public-origin, database, and session
# configuration. Do not start it with implicit or stale production credentials.
if [[ -s /etc/helix/gateway.env ]]; then
  install -m 0644 /opt/helix/production/gateway/helix-gateway.service /etc/systemd/system/helix-gateway.service
  systemctl daemon-reload
  systemctl enable --now helix-gateway.service
  systemctl is-active --quiet helix-gateway.service
else
  echo "Helix gateway intentionally not started: /etc/helix/gateway.env is required for fresh-account auth/database configuration."
fi

systemctl --no-pager --full status libvirtd
systemctl --no-pager --full status snap.amazon-ssm-agent.amazon-ssm-agent.service
