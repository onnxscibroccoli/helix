# Helix

**Status:** Cloud desktop control plane / active production reconstruction and validation  
**Repository:** `onnxscibroccoli/helix`  
**Documentation snapshot:** 2026-09-28 23:12 EDT

Helix is the cloud control-plane and remote-desktop gateway lineage for the persistent workstation platform.

Its central responsibility is to authenticate users, manage workspace/desktop lifecycle, provision or supervise KVM-backed guests, and expose a browser-compatible remote display path.

## Architecture

The repository documents this control-plane shape:

```
User
  ↓
Web application / authentication
  ↓
Helix control plane
  ↓
Hypervisor / QEMU
  ↓
KVM guest
  ↓
Kasm-compatible RFB WebSocket
  ↓
Browser
```

The repository contains both application code and infrastructure-as-code for the cloud/hypervisor layer.

## Repository map

Approximately 285 tracked files are present.

Important areas:

- `src/` — web application, authentication, fleet/workspace logic, hypervisor control, and desktop state.
- `infra/terraform/` — cloud infrastructure.
- `infra/aws/` — AWS reconstruction/provider configuration.
- `infra/ansible/` — hypervisor deployment/configuration.
- `production/` — production gateway, desktop, libvirt, storage, and systemd material.
- `hypervisor/bin/` — packaged QEMU utilities.
- `test-suite/` — hypervisor, OAuth, kernel-swap, teardown, browser E2E, and production-contract tests.
- `scripts/` — browser smoke, migration, preview, environment, and operational tooling.
- `.grok/skills/` — reusable model-facing skills and references.

## Development cycle

**ACTIVE PRODUCTION RECONSTRUCTION / VALIDATION.**

Recent commits include AWS reconstruction validation, Terraform syntax repair, incident documentation, and recovery work.

The project is not simply a frontend. It spans application, infrastructure, hypervisor, authentication, and remote-display boundaries.

The repository's test suite explicitly distinguishes declarative IaC validation from live KVM assertions.

## Development and verification

Application development follows the repository's Node/Vite/TanStack stack.

Infrastructure changes should be validated through the Terraform configuration and the repository's AWS validation workflow before any live mutation.

For live KVM assertions, use a node that actually exposes `/dev/kvm`.

Do not infer a working guest merely because Terraform validates.

## AI model instructions

Before modifying Helix:

1. read `AGENTS.md`;
2. inspect the relevant `production/` contract;
3. identify whether the change is application, gateway, hypervisor, storage, authentication, or infrastructure;
4. run static tests first;
5. run live tests only with authorized infrastructure;
6. document every production-state assumption.

For AWS changes, preserve the provider-neutral application contract. Infrastructure may be AWS-specific, but the control-plane interfaces should not silently become coupled to one provider.

For incidents, write down the observed failure, causal evidence, recovery action, and protection added for future agents.

**Bottom line:** Helix is the cloud/hypervisor control-plane line, not merely a web UI.
