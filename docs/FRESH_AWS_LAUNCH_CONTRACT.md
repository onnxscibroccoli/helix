# Fresh AWS account launch contract

Status: launch gate, not a claim of completed fresh-account deployment
Baseline: CloudFront -> nginx -> Helix -> libvirt/QEMU -> Kali
Repository: onnxscibroccoli/helix

## What is proven by the checked-in AWS module

`infra/aws` provisions the EC2 substrate:
- VPC, public subnet, internet gateway and route table
- EC2 hypervisor with nested virtualization enabled
- encrypted root and persistent EBS volumes
- SSM instance profile
- immutable Helix repository checkout
- libvirt/QEMU bootstrap prerequisites

This is NOT the complete public product deployment.

## Fresh-account gates

A new AWS account is launchable only when all of these are explicit and proven:
1. AWS bootstrap identity: one-time account bootstrap establishes GitHub Actions OIDC trust; deployment role trust is restricted to the designated repository and release ref/environment; no long-lived AWS access key is stored in GitHub.
2. Terraform state: remote encrypted state exists, state locking/concurrency is enabled, and state bootstrap is deterministic and separate from application infrastructure.
3. Compute substrate: EC2 instance type is available in the selected region and supports required virtualization features; /dev/kvm, nested virtualization, libvirt and the default guest network are proven; persistent EBS survives compute replacement.
4. Application bootstrap: exact immutable Helix SHA is supplied explicitly; gateway and hypervisor systemd units are installed/enabled/healthy; secrets/configuration come from a secret store; PostgreSQL is reachable and migrations are applied.
5. Public edge: TLS/DNS/public ingress is provisioned or explicitly external; CloudFront/nginx routing preserves the authenticated gateway boundary; VNC, websockify, libvirt and hypervisor APIs are not public.
6. Acceptance: health 200, authentication, desktop capability redemption, intended Kali guest RFB, guest task execution, persistent workspace recovery, and server-side ephemeral TTL reclamation are all proven.

## Current blockers

As of 2026-09-29:
- `infra/aws` does not contain CloudFront, DNS/TLS, RDS, Secrets Manager or GitHub OIDC resources.
- `user-data.sh` does not install/register/enable the production gateway/hypervisor systemd units.
- Terraform has no remote backend bootstrap in this module.
- The previous source-ref default could silently select an older release. This branch removes that default and requires an immutable SHA.
- The previous gateway CIDR default was `0.0.0.0/0`. This branch requires an explicit CIDR.
- `infra/terraform` is an OCI provider tree while `infra/aws` is the AWS substrate. It must be explicitly classified as historical/prototype or removed from the AWS launch workflow.

These are source-level findings, not claims about live AWS state.

## Protected production rule

Do not alter live production ingress, ports 80/443, CloudFront, the running Kali VM, or production database while closing these fresh-account gates. Validate on a disposable account first, then promote only after the complete acceptance sequence passes.