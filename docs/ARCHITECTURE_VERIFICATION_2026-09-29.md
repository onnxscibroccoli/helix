# OmniKali Architecture Verification Record

**Verification timestamp (UTC): 2026-09-29T03:06:29Z**  
**Verifier:** Hugo verification protocol, initial baseline record  
**Evidence basis:** live authorized EC2 host inspection, public CloudFront HTTP checks, libvirt/QEMU guest-agent proof, local K3s inspection, and previously recorded production acceptance evidence.

## Purpose

This record prevents future agents from treating planned Kubernetes/FRP architecture as if it were the currently validated Helix production path.

## Live architecture proven at verification time

The AWS EC2 host is:

- Instance: `i-03b6a82d46271d9cd`
- Type: `c7i-flex.large`
- AZ: `us-east-1a`
- Private IP: `172.31.8.59`
- Observed public IP: `32.199.143.170` (Elastic IP status was not proven)
- IAM role: `HelixKaliDesktopRole`
- OS: Debian GNU/Linux 13 (trixie)
- AWS caller identity was proven as the instance role session.

### Validated public path

```
Internet
  -> AWS CloudFront HTTPS
  -> HTTP origin
  -> nginx :80
  -> Helix gateway :8092
  -> hypervisor daemon
  -> libvirt
  -> QEMU/KVM
  -> helix-omnikali
  -> Kali Linux Rolling 2026.3
```

CloudFront currently returns HTTP 200 for `/health`, `/auth/login`, and `/novnc/vnc.html`. Unauthenticated `/desktop/omnikali` redirects to `/auth/login`. Unauthenticated task creation returns HTTP 401.

nginx is listening on port 80. No evidence from this verification shows nginx terminating TLS on 443. CloudFront is the proven public HTTPS edge.

## Real Kali guest proof

Libvirt domain `helix-omnikali` is running, persistent, and autostarted.

- UUID: `c58b4df8-2138-4326-bebf-94966d423f5b`
- 2 vCPUs
- maximum memory: 2 GiB
- current configured memory: 1.5 GiB
- QEMU Guest Agent channel is present
- guest-agent ping succeeds
- guest IP: `192.168.122.78/24`
- guest-agent command execution proved hostname `kali`
- guest OS proved as Kali GNU/Linux Rolling, version `2026.3`
- guest command ran as root

This is the validated Kali VM. It is distinct from the Kubernetes desktop containers.

## Host noVNC distinction

The public `/novnc/vnc.html` page is served, but this verification does **not** prove that its WebSocket session reaches `helix-omnikali`.

Current nginx routes `/novnc/` to websockify on `127.0.0.1:6080`, which in turn targets host VNC `127.0.0.1:5900`. The validated Kali VM has a separate VNC endpoint. Therefore the public noVNC page must not be documented as the validated Kali VM desktop until an authenticated end-to-end VNC session is explicitly proven.

## Kubernetes prototype proven live

K3s is running on the same EC2 host:

- Kubernetes: `v1.36.4+k3s1`
- node: `ip-172-31-8-59`
- node is Ready and control-plane
- namespace: `omnikali-desktop`
- two running desktop pods: user1 and user2
- image: `ghcr.io/onnxscibroccoli/omnikali-kali-desktop:local`
- NodePorts: 30080 and 30081
- both NodePorts return HTTP 200 locally
- two 10Gi local-path PVCs are Bound

This is a real Kubernetes prototype, but it is **not** the current public ingress path and is **not** proven equivalent to the validated libvirt Kali VM.

## Not deployed / not running

At verification time:

- `frps`: inactive
- `frpc`: inactive
- Kubernetes Ingress resources: none
- Traefik public ingress: not running
- FRP domainless public ingress: not deployed
- Kubernetes as the CloudFront public origin: not proven and not current

Therefore the intended:

```
CloudFront -> ingress EC2 -> nginx/TLS -> frps -> frpc -> Kubernetes
```

is a target architecture, not the current production path.

## Historically proven but not freshly re-accepted in this run

The following remain supported by prior production acceptance evidence, but were not freshly authenticated/executed during this verification:

- authenticated task creation
- PostgreSQL production persistence
- PENDING -> RUNNING -> COMPLETED / FAILED lifecycle
- worker lease expiry and reclamation
- worker replacement after termination
- fencing/idempotency guard
- real Kali execution and result markers
- 14/14 state tests

Validated production recovery acceptance previously recorded:

- normal task: `396780ea-9405-4978-a1bb-2b61c210f8dd`
- recovery task: `145f00b8-049d-49d3-9581-cde87aa62f1f`
- recovery fix: `38903b021cca75189a99e1ed88b508bae577f048`

No synthetic session or exposed cookie was used for this verification.

## Not verified because AWS account IAM was restricted

The inspected instance role could not perform account-level inventory for:

- Elastic IP allocation status
- RDS DB inventory
- EKS clusters
- CloudFormation stacks
- Secrets Manager inventory
- ECR repositories
- exact CloudFront distribution origin configuration

The gateway does have runtime configuration wired to an AWS Secrets Manager RDS secret and agent token secret, but secret values were not exposed or inspected.

Also not freshly verified:

- complete EBS create/attach/detach/recovery lifecycle
- authenticated public noVNC session reaching the Kali VM
- exact identities of listeners on ports 8093, 8094, and 3100
- fresh authenticated task completion

## Protection rule

Future agents must preserve the distinction between:

1. **Validated Helix/Kali production:** CloudFront -> nginx -> Helix -> libvirt/QEMU -> `helix-omnikali`.
2. **Kubernetes prototype:** K3s -> `omnikali-desktop` pods -> NodePorts/local-path PVCs.

Do not install or enable a Kubernetes ingress controller, Traefik, FRP, or other listener on ports 80/443 without an explicit architecture change and a before/after acceptance test. The validated CloudFront -> nginx -> Helix path must not be displaced accidentally.

## Verification status

**Current production path:** proven at the host/public HTTP boundary.  
**Validated Kali guest:** proven live.  
**Kubernetes prototype:** proven live locally.  
**FRP/Kubernetes public ingress:** not deployed.  
**Public noVNC -> validated Kali guest:** not proven.  
**Full authenticated task acceptance:** historical proof exists; not freshly re-run here.  
**AWS account-wide inventory:** incomplete due IAM restrictions.

This document is an evidence record, not a claim that every historical component remains healthy at every later timestamp.
