# Hugo security correction evidence

- Timestamp: 2026-09-29T21:09:37Z
- Scope: Helix production host only.

## Correction applied

Two live agent-secret files were found as root-owned mode 755. Because the gateway and agent services run as root, they were tightened to root-owned mode 600.

- `/opt/helix/production/gateway/state/agent-secret.mjs`: root:root 600
- `/opt/helix/production/agent/agent-secret.mjs`: root:root 600

No secret contents were read or recorded.

## Post-change proof

- `helix-gateway.service`: active.
- `helix-libvirt-hypervisor.service`: active.
- nginx: active.
- local Helix `/health`: HTTP 200.
- public CloudFront `/health`: HTTP 200.
- `omnikali`: still running, persistent, display 1.

## Boundary

This was a file-permission hardening change only. No ports, listeners, routes, VM state, Kubernetes ingress, FRP, or CloudFront configuration were changed.