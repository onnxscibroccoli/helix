# Paperclip isolation and migration plan

Date: 2026-10-04

Status: PLANNED

## Purpose

The 2026-10-04 production availability incident exposed a resource-isolation failure on the Helix host.

The production EC2 host is a small KVM workstation. The validated workload is the persistent helix-omnikali Kali desktop. Paperclip was also running on the same host and became a material CPU and memory consumer. During the incident the host sustained approximately 100 percent CPU, SSM became unavailable, and the public CloudFront path returned 504.

The immediate containment was to stop and disable paperclip.service. The production Kali guest was preserved and was not replaced.

This document defines the permanent boundary so Paperclip cannot become a competing host workload again.

## Evidence from the incident

Observed after host recovery:

- Host: c7i-flex.large, approximately 1 physical core and 2 threads.
- Host memory: approximately 3.7 GiB.
- QEMU for helix-omnikali: approximately 93 percent CPU immediately after boot and approximately 1.7 GiB RSS.
- Paperclip: approximately 38 percent CPU and approximately 412 MiB RSS.
- Guest process evidence did not show a runaway Kali process.
- After Paperclip was stopped and disabled, QEMU settled near approximately 23.5 percent CPU in the captured sample and approximately 990 MiB host memory was available.
- External acceptance returned HTTP 200 for /health, /auth/login, and /novnc/vnc.html.

The evidence supports host resource contention as the immediate failure mode. It does not prove that Paperclip was the sole cause of all CPU demand.

## Permanent architecture rule

Paperclip must not share the production Helix KVM desktop host as an unrestricted system service.

Paperclip is orchestration/control-plane software. Helix owns the validated workstation runtime and the KVM guest lifecycle.

The intended boundary is:

Paperclip or another orchestration surface
-> authenticated task/control API
-> Helix
-> isolated workstation worker
-> persistent guest

Paperclip must not:

- consume the production host's CPU or memory without an explicit resource budget;
- start arbitrary daemons on the Helix KVM host;
- compete with QEMU for unconstrained CPU;
- own the guest lifecycle directly;
- introduce a second task lifecycle;
- bypass Helix authorization, idempotency, cancellation, or acceptance gates.

## Migration target

Move Paperclip execution off the production KVM host.

Preferred target order:

1. Dedicated control-plane worker with explicit CPU and memory limits.
2. Separate development/control workstation when production orchestration is not required.
3. A dedicated cloud worker sized for Paperclip's actual workload.

The production Helix KVM host remains dedicated to the validated desktop path.

The canonical Helix infrastructure target should be evaluated against the current drifted c7i-flex.large host before any production resize. A resize is a separate capacity change and is not part of this containment document.

## Migration phases

### Phase 0: containment

- Keep paperclip.service stopped.
- Keep paperclip.service disabled on the production KVM host.
- Do not re-enable it as a convenience fix.
- Preserve the existing Kali VM and persistent storage.

Acceptance:

- CloudFront /health remains 200.
- /auth/login remains 200.
- /novnc/vnc.html remains 200.
- Helix guest remains running.
- Host CPU and memory remain within the normal desktop envelope.

### Phase 1: package and configuration inventory

Inventory Paperclip runtime dependencies without changing the production host:

- executable and version;
- configuration files;
- environment variables;
- systemd unit;
- ports and listeners;
- filesystem paths;
- persistent data;
- outbound network dependencies;
- GitHub or other integration credentials;
- scheduled jobs;
- logs;
- CPU and memory usage under representative workload.

Record the inventory as evidence before moving anything.

### Phase 2: isolated worker

Create a separate worker for Paperclip.

The worker must have:

- explicit CPU and memory limits;
- independent lifecycle from the KVM host;
- independent logs;
- health/readiness checks;
- no access to the KVM guest disk unless an explicit API contract requires it;
- no host-level access to QEMU process control;
- least-privilege credentials.

The worker should communicate with Helix only through an authenticated, versioned interface.

### Phase 3: contract integration

Paperclip integration must use the existing Helix task boundary.

Required properties:

- stable task identity;
- authorization before execution;
- idempotency;
- explicit cancellation;
- deterministic accepted/rejected/failed/cancelled states;
- timeout and lease behavior;
- evidence ID for live acceptance.

Do not create a second task state machine in Paperclip.

### Phase 4: shadow validation

Run Paperclip against a non-production fixture or isolated worker.

Compare:

- task identity;
- state transitions;
- cancellation;
- duplicate delivery;
- timeout/reclaim behavior;
- CPU and memory envelope;
- logs and evidence.

No production KVM mutation is allowed during this phase.

### Phase 5: production cutover

Only after isolated acceptance passes:

- deploy Paperclip to its isolated worker;
- verify Helix remains dedicated to the workstation runtime;
- verify the production host has no Paperclip listener or active service;
- execute one authenticated end-to-end task;
- capture evidence ID and resource metrics.

### Phase 6: decommission the old placement

After the isolated worker is proven:

- remove the old Paperclip package/unit/configuration from the production KVM host;
- retain the incident and migration evidence;
- add a drift check that fails if Paperclip is installed or enabled on the production KVM host.

## Prevention gates

A future deployment is blocked if any of the following are true:

- Paperclip is enabled on the production KVM host.
- Paperclip has an unbounded CPU or memory budget.
- Paperclip can directly control QEMU.
- Paperclip introduces a duplicate task lifecycle.
- Paperclip production integration lacks an evidence ID.
- Resource measurements are missing for representative workload.
- The migration depends on undocumented manual host steps.

## Ownership

- Helix owns the production KVM desktop runtime and guest lifecycle.
- Paperclip owns orchestration behavior only.
- kali-node owns the Paperclip integration keeper and workstation-side boundary documentation.
- Grasshopper owns orchestration contracts, BIST, reconstruction, and evidence coordination.
- The OmniKali knowledge graph records cross-repository provenance and current status.

## Evidence boundary

PROVEN:

- Paperclip was a material resource consumer on the affected host.
- Stopping and disabling Paperclip restored the host to a substantially healthier resource envelope.
- The public Helix path returned to HTTP 200 after recovery.

PLANNED:

- Isolated Paperclip worker.
- Versioned Helix integration contract.
- Automated drift check preventing Paperclip from returning to the production KVM host.

NOT_PROVEN:

- The exact Paperclip workload that generated its observed CPU usage.
- The final worker size required for sustained production load.
- Production cutover of the isolated Paperclip worker.

The migration is complete only when the final three items have fresh acceptance evidence.
