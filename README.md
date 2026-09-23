# Helix

Persistent cloud desktop control plane. Nested KVM guests stream into the browser over a Kasm-compatible RFB WebSocket, gated by Google/X OIDC.

## Control plane

1. Sign in with Google or X.
2. Open **Deploy** and provision a persistent studio or ephemeral guest.
3. QEMU boots on `/dev/kvm` with `nested=Y`.
4. noVNC attaches to `/kasm/ws/:id` (WebSocket 101 → RFB).

## Hypervisor

`scripts/hypervisor-daemon.mjs` owns QEMU domains and the websockify path. The Vite preview proxies `/kasm` to that daemon.

OCI tenancy resources live in `infra/terraform` (VCN, nested-KVM compute, 200 GB volumes) and are finalized with `infra/ansible/deploy-hypervisor.yml` (Kasm workspace spec + nested virt check).

## Proofs

`test-suite/tests` covers IaC declarations, OIDC wiring, teardown scripts, and the WebSocket client. Live KVM assertions run on a node with `/dev/kvm`.

## Macaly portal work

The separate `apps/macaly-portal` app contains the Debian-targeted portal and Convex backend. See its README for implementation and verification limits. No usable cloud host has been provisioned by this change. The original hypervisor implementation remains unchanged.
