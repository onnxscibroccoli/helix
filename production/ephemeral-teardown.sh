#!/usr/bin/env bash
set -euo pipefail

GUEST_ID="${1:?guest id required}"
DOMAIN="helix-${GUEST_ID}"
SCRATCH="/var/lib/helix/ephemeral/${GUEST_ID}"

virsh destroy "${DOMAIN}" 2>/dev/null || true
virsh undefine "${DOMAIN}" --nvram 2>/dev/null || true

if mountpoint -q "${SCRATCH}" 2>/dev/null; then
  umount "${SCRATCH}" || true
fi
rm -rf -- "${SCRATCH}"

for dev in /sys/class/net/tap-"$GUEST_ID"*; do
  [ -e "$dev" ] || continue
  ip link delete "$(basename "$dev")" 2>/dev/null || true
done

# Persistent volumes are deliberately not referenced here.
echo "ephemeral teardown complete: ${GUEST_ID}"
