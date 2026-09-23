# Helix EC2 desktop host

This host bootstrap provides a browser-desktop substrate for the Helix gateway.

## Runtime

- Xvfb display :99 at 1920x1080x24
- XFCE session on the virtual display
- x11vnc bound to localhost TCP 5900
- noVNC/websockify on TCP 6080
- VNC is never bound directly to the public interface

The public gateway must terminate TLS and authentication before proxying HTTP/WebSocket traffic to noVNC. Do not expose port 5900.

## L1 KVM/libvirt

Helix can run workspace VMs as L2 guests inside a supported EC2 host using AWS nested virtualization.

AWS must enable `NestedVirtualization=enabled` on the EC2 instance while it is stopped. The instance family must support nested virtualization. After the instance starts, `/dev/kvm` must exist before installing the hypervisor packages.

Run the reproducible host bootstrap as root:

```bash
./production/desktop/helix-kvm-bootstrap.sh
```

The script installs QEMU/libvirt, starts libvirtd, enables the libvirt default NAT network, and verifies that the KVM capability is available.

A disposable development guest can then be created with libvirt/virt-install. Production workspace disks should use the persistent storage design rather than the local development qcow2 layout.

## Install desktop services

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

The desktop service and the QEMU/KVM hypervisor are separate layers. A production workspace gateway should select a desktop provider and return a short-lived authenticated session URL rather than exposing port 5900 or 6080 directly.
