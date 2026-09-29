#!/usr/bin/env bash
set -euo pipefail

AGENT_USER=${AGENT_USER:-helix-agent}
AGENT_ROOT=${AGENT_ROOT:-/var/lib/helix-agents}

if [[ ${EUID} -ne 0 ]]; then
  echo "run as root during host provisioning" >&2
  exit 1
fi

if ! id -u "$AGENT_USER" >/dev/null 2>&1; then
  useradd --system --create-home --home-dir "$AGENT_ROOT/home" --shell /bin/bash "$AGENT_USER"
fi

install -d -o "$AGENT_USER" -g "$AGENT_USER" -m 0750   "$AGENT_ROOT" "$AGENT_ROOT/workspaces" "$AGENT_ROOT/state" "$AGENT_ROOT/cache" "$AGENT_ROOT/logs"

gpasswd -d "$AGENT_USER" sudo 2>/dev/null || true
gpasswd -d "$AGENT_USER" libvirt 2>/dev/null || true
gpasswd -d "$AGENT_USER" kvm 2>/dev/null || true
gpasswd -d "$AGENT_USER" docker 2>/dev/null || true

cat > "$AGENT_ROOT/POLICY" <<'EOF'
Agent workspaces are untrusted development sandboxes.
No AWS credentials. No production secrets. No host Docker/libvirt/QEMU access.
All production deployment occurs through protected GitHub Actions workflows.
EOF
chown "$AGENT_USER:$AGENT_USER" "$AGENT_ROOT/POLICY"
chmod 0640 "$AGENT_ROOT/POLICY"

echo "agent workspace ready: $AGENT_ROOT"
