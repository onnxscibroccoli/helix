#!/usr/bin/env bash
set -euo pipefail

SERVICE=/etc/systemd/system/helix-remote-desktop-commander.service
PKG='@wonderwhy-er/desktop-commander@0.2.51'

command -v npx >/dev/null 2>&1 || {
  echo "ERROR: npx is required before enabling the Helix Remote Desktop Commander service." >&2
  exit 1
}

session_home=''
session_user=''

for home in /root /home/*; do
  if [[ -f "$home/.desktop-commander-device/device.json" ]]; then
    session_home="$home"
    session_user="$(stat -c '%U' "$home")"
    break
  fi
done

if [[ -z "$session_home" || -z "$session_user" ]]; then
  echo "ERROR: no persisted Desktop Commander device session was found." >&2
  echo "Run the pairing command once as the intended service user:" >&2
  echo "  npx --yes $PKG remote" >&2
  exit 2
fi

cat > "$SERVICE" <<EOF
[Unit]
Description=Helix Remote Desktop Commander device agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$session_user
Group=$session_user
WorkingDirectory=$session_home
Environment=HOME=$session_home
Environment=NODE_ENV=production
ExecStart=/usr/bin/npx --yes $PKG remote
Restart=always
RestartSec=5
KillMode=control-group
TimeoutStopSec=20
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now helix-remote-desktop-commander.service
systemctl --no-pager --full status helix-remote-desktop-commander.service
