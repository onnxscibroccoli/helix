# Helix Production Architecture

## Runtime topology

```
Browser
  │ HTTPS 443 / WSS
  ▼
Public ingress (Nginx / managed TLS)
  │
  ├── OIDC callback + portal API
  └── authenticated desktop capability
          │
          ▼
Control plane
  ├── PostgreSQL: users, workspace, instance, volume, lease, provider-operation IDs
  ├── Redis: short-lived locks/leases and reconciliation work queues
  └── gateway service
          │ private API
          ▼
OCI hypervisor nodes (Ubuntu 24.04)
  ├── libvirt / QEMU / KVM
  │     ├── persistent VM → dedicated OCI Block Volume
  │     └── ephemeral VM → dedicated scratch file/device, deleted by server-side lease expiry
  └── Kasm Agent / Kasm Connection Proxy for containerized or standard VNC/RDP sessions

Persistent VM desktop path:
Browser → WSS gateway → RFB/VNC proxy → persistent QEMU guest.

Ephemeral Kasm path:
Browser → Kasm Proxy → Kasm Agent → disposable container.

Kasm is not treated as a libvirt VM provisioner. The gateway owns arbitrary-kernel QEMU/libvirt lifecycle.
```
