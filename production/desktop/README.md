# Helix EC2 desktop host

This host bootstrap provides a browser-desktop substrate for the Helix gateway.

## Runtime

- Xvfb display :99 at 1920x1080x24
- XFCE session on the virtual display
- x11vnc bound to localhost TCP 5900
- noVNC/websockify on TCP 6080
- VNC is never bound directly to the public interface

The public gateway must terminate TLS and authentication before proxying HTTP/WebSocket traffic to noVNC. Do not expose port 5900.

## Install

Copy the four systemd units into /etc/systemd/system/, then run:

```bash
systemctl daemon-reload
systemctl enable --now helix-desktop.service helix-xfce.service helix-vnc.service helix-novnc.service
```

Verify:

```bash
systemctl is-active helix-desktop.service helix-xfce.service helix-vnc.service helix-novnc.service
curl -fsS http://127.0.0.1:6080/vnc.html
```

This is separate from the QEMU/KVM hypervisor layer. A production workspace gateway should select a desktop provider and return a short-lived authenticated session URL rather than exposing this port directly.
