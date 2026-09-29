# OmniKali Project Knowledge Graph

> **GRAPH TAG:** OMNIKALI-KG-2026-09-28
> **ROLE:** Cross-repository architectural memory and agent orchestration contract.
> **SNAPSHOT:** 2026-09-28 EDT
> **AUTHORITY:** This graph is a coordination index, not a substitute for live verification. Current runtime behavior must be proven from the referenced validation/evidence documents and live systems before being declared working.

## 1. Purpose

This file is intentionally present in every repository in the OmniKali project family. Future human or AI agents MUST read it before making cross-project architectural changes.

The graph exists to answer, quickly:

1. What is this repository?
2. What does it depend on?
3. Which repository owns each responsibility?
4. What is historical, experimental, active, validated, or incomplete?
5. What has actually been proven?
6. What still needs implementation or repair?
7. Which previous mistakes must not be repeated?
8. Where should a future change be made instead of duplicating functionality?

## 2. Root hierarchy

```text
OMNIKALI SYSTEM
|
+-- A. Historical / provenance
|   +-- broccoli-core
|   +-- GPTOmniKali-full-stack
|
+-- B. Control-plane reconstruction
|   +-- Grasshopper
|       +-- production evidence
|       +-- contracts
|       +-- state/migration rules
|       +-- executor provenance
|       +-- security hardening
|
+-- C. Cloud control plane / runtime
|   +-- helix
|       +-- PostgreSQL persistence
|       +-- worker/task lifecycle
|       +-- AWS infrastructure
|       +-- authenticated APIs
|
+-- D. Remote workstation / desktop
|   +-- kali-node
|       +-- persistent Kali guest
|       +-- QEMU/KVM
|       +-- RFB/WebSocket
|       +-- browser desktop
|
+-- E. Kubernetes implementation
|   +-- grasshopper-kubernetes
|       +-- isolated Kali instances
|       +-- Kubernetes orchestration
|       +-- Guacamole/RFB
|       +-- PostgreSQL
|       +-- FRP
|       +-- AWS self-hosted ingress
|
+-- F. Public discovery / edge
|   +-- omnikali
|   +-- omnikali-link [legacy]
|   +-- onnxscibroccoli.github.io
|
+-- G. Alternative / experimental workstation
|   +-- kiln
|
+-- H. Independent products / research
    +-- lattice
    +-- lattice-audit
    +-- half-a-mile
    +-- newsroom-desk
    +-- dectalk-live
    +-- shizuku-silent-mic [empty]
    +-- android-virtual-mic-shizuku [empty]
    +-- shizuku-virtual-mic [empty]
    +-- GitHub write-test repositories
```

## 3. Canonical dependency and responsibility graph

```text
Public user / AI agent
        |
        v
omnikali  -----> endpoint discovery / fail-closed public door
        |
        v
helix  --------> authenticated control plane + task lifecycle
        |
        +-------> PostgreSQL persistence
        |
        +-------> worker/executor
        |
        v
kali-node ------> persistent real Kali workstation
        |
        +-------> QEMU/KVM
        +-------> guest agent / execution boundary
        +-------> RFB/WebSocket desktop
        |
        +------------------------------------+
                                             |
                                             v
grasshopper-kubernetes
        |
        +-------> Kubernetes namespaces
        +-------> per-instance isolation
        +-------> PostgreSQL
        +-------> Guacamole / guacd / RFB
        +-------> FRP
        +-------> AWS self-hosted ingress / TLS
        |
        v
future scalable multi-instance runtime

Grasshopper
   |
   +---- defines/control-plane contracts
   +---- preserves production evidence
   +---- reconciles state
   +---- defines safe implementation workflow
   +---- is the architectural bridge, NOT permission to replace validated production behavior

GPTOmniKali-full-stack
   |
   +---- recovery/provenance/reference material
   +---- historical implementation evidence
   +---- NOT current production source of truth

broccoli-core
   |
   +---- historical origin / experimentation
   +---- provenance
   +---- NOT current production architecture
```

## 4. Repository state matrix

| Repository | Role | State | Agent interpretation |
|---|---|---|---|
| broccoli-core | historical OmniKali origin | HISTORICAL / EXPERIMENTAL | Evidence only; do not treat as current architecture |
| ara-github-write-test | GitHub write capability proof | COMPLETE TEST | Capability artifact only |
| ara-github-write-test-2 | multi-file write proof | COMPLETE TEST | Capability artifact only |
| lattice | rule-driven research engine | ACTIVE DEVELOPMENT | Independent subsystem |
| lattice-audit | LATTICE public audit mirror | PUBLIC AUDIT | Do not confuse with engine |
| shizuku-silent-mic | future Android audio project | EMPTY / PRE-IMPLEMENTATION | No capability exists until implemented and tested |
| android-virtual-mic-shizuku | future Android virtual mic | EMPTY / PRE-IMPLEMENTATION | No capability exists until implemented and tested |
| shizuku-virtual-mic | future Android virtual mic | EMPTY / PRE-IMPLEMENTATION | No capability exists until implemented and tested |
| half-a-mile | long-form publication | PUBLISHED / ACTIVE | Editorial/source integrity matters |
| onnxscibroccoli.github.io | public publication hub | PUBLISHED / ACTIVE | Deployment surface, not source of truth for apps |
| newsroom-desk | investigative publication | PUBLISHED / ACTIVE | Preserve source/consent/factual boundaries |
| dectalk-live | browser/WASM speech app | PUBLISHED / SMALL STABLE DEMO | Preserve cross-origin isolation/WASM assumptions |
| kali-node | real persistent Kali workstation | ACTIVE INTEGRATION / PRODUCTION LAB | Protect validated workstation and recovery state |
| omnikali-link | legacy public pointer | MAINTENANCE / LEGACY | Do not add core runtime logic here |
| GPTOmniKali-full-stack | recovered full-stack workspace | RECOVERY / RECONSTRUCTION | Provenance, not production source of truth |
| omnikali | public discovery/edge | ACTIVE PRODUCTION-EDGE | Must fail closed on stale/unverified endpoints |
| kiln | browser-contained workstation | FUNCTIONAL PROTOTYPE | Separate from persistent Kali/KVM architecture |
| helix | cloud desktop control plane | ACTIVE PRODUCTION RECONSTRUCTION / VALIDATION | Runtime source for validated control-plane behavior |
| Grasshopper | control-plane reference/reconstruction | ACTIVE REFERENCE / FORMALIZATION | Highest architectural coordination authority |
| grasshopper-kubernetes | scalable Kubernetes desktop platform | ACTIVE INFRA / ACCEPTANCE | Verify entire dependency chain, not pod health alone |

## 5. Proven production evidence currently known

The following claims were established during the preceding investigation and MUST be treated as evidence-backed historical facts, not permanent assumptions:

- Helix gateway has been live/healthy.
- Public CloudFront /health has returned HTTP 200.
- Real authenticated mobile-browser requests have reached production.
- Production task creation has been verified.
- PostgreSQL is used for production persistence.
- Task lifecycle PENDING -> RUNNING -> COMPLETED or FAILED has been exercised.
- Worker lease expiry/reclamation has been exercised.
- Worker termination while RUNNING has been recovered by a replacement worker.
- Real Kali execution and result markers have been verified.
- Gateway restart worker initialization was repaired.
- No synthetic session or exposed cookie was required for the acceptance path.
- Normal acceptance task: 396780ea-9405-4978-a1bb-2b61c210f8dd.
- Recovery acceptance task: 145f00b8-049d-49d3-9581-cde87aa62f1f.
- Recovery fencing/idempotency evidence included FIRST -> FIRST_COMPLETE -> DUPLICATE_BLOCKED.
- Fencing/idempotency fix commit: 38903b021cca75189a99e1ed88b508bae577f048.
- State tests were previously 14/14 passing.

These claims must be re-verified when the underlying infrastructure or code has changed.

## 6. Known architectural boundaries

### Source-of-truth hierarchy

1. **Live acceptance evidence and production runtime behavior**
2. **Grasshopper production contracts/evidence documents**
3. **Helix production implementation and infrastructure**
4. **kali-node validated workstation implementation**
5. **grasshopper-kubernetes validated Kubernetes implementation**
6. **Historical/recovery repositories**
7. **README descriptions and agent-generated summaries**

A README is never stronger evidence than an executable acceptance test.

### Do not collapse these distinctions

- QEMU running != desktop usable.
- Kubernetes pod Running != remote desktop working.
- HTTP health != authenticated session working.
- Authenticated API access != RFB/WebSocket desktop access.
- Fixture/unit test passing != live infrastructure acceptance.
- Historical code existing != current production capability.
- CloudFront reachable != origin healthy.
- A repository name != an implemented feature.
- A browser emulator workstation != the persistent Kali KVM workstation.
- Cloudflare-era infrastructure != current AWS self-hosted ingress.

## 7. Known mistakes and protections

Future agents MUST actively check for these failure classes:

1. **Replacing validated architecture with a cleaner redesign.**
   - Preserve existing contracts first. Propose substitutions separately.

2. **Taking down the validated Kali workstation while experimenting.**
   - Record restore state before destructive changes.
   - Prefer additive tests and isolated instances.

3. **Treating stale endpoint URLs as current.**
   - Verify endpoint discovery and health before exposing connection targets.

4. **Calling infrastructure healthy because a process/pod is Running.**
   - Test the complete chain through the user-visible boundary.

5. **Using synthetic sessions/cookies to make acceptance appear successful.**
   - Acceptance must use the real authentication path.

6. **Ignoring worker lifecycle/recovery semantics.**
   - Test lease expiry, fencing, idempotency, replacement, and restart behavior.

7. **Changing ingress without checking the whole transport chain.**
   - Verify TLS -> ingress -> FRP/gateway -> Kubernetes -> Guacamole/RFB -> browser.

8. **Assuming historical Cloudflare/tunnel architecture is still authoritative.**
   - Current direction is self-hosted AWS ingress/FRP where applicable.

9. **Confusing independent projects with OmniKali runtime components.**
   - Use this graph before introducing cross-repository dependencies.

10. **Documenting a failure without recording the causal evidence.**
    - Record observed symptom, evidence, root cause if proven, recovery, protection, and timestamp.

## 8. Required workflow for future AI agents

Before modifying any repository:

1. Read this file.
2. Read the repository README.
3. Identify the repository's role and state in Section 4.
4. Inspect linked upstream/downstream repositories when the change crosses a boundary.
5. Read applicable AGENTS.md, implementation seed, production contracts, incident reports, and acceptance docs.
6. Establish a restore point or equivalent evidence snapshot before risky changes.
7. Make the smallest atomic change that satisfies the verified requirement.
8. Run static/unit tests first.
9. Run live acceptance only when authorized and safe.
10. Verify the user-visible boundary, not merely internal health.
11. Record what changed, what was tested, exact result, timestamp, and any new failure mode.
12. Update this graph when architecture, responsibility, state, dependency, proof, or known failure information changes.
13. Update the graph in every affected repository so future agents do not operate from split-brain documentation.

## 9. Change classification

Every cross-repository change SHOULD be classified as one of:

- **PATCH:** bug fix within an existing responsibility.
- **HARDENING:** security/reliability protection without changing ownership.
- **INTEGRATION:** connects existing components.
- **MIGRATION:** moves responsibility or infrastructure.
- **RECONSTRUCTION:** rebuilds behavior from validated evidence.
- **EXPERIMENT:** intentionally non-authoritative prototype.
- **DEPRECATION:** marks an old path as no longer authoritative.

Do not silently turn an EXPERIMENT or RECONSTRUCTION into the production source of truth.

## 10. Graph maintenance protocol

When a future agent discovers new information, update these graph sections as applicable:

- **Nodes:** repositories/services/devices.
- **Edges:** depends-on, exposes, persists-to, executes-on, publishes, replaces, supersedes, validates.
- **State:** empty, experimental, active, validated, production, deprecated, failed.
- **Proof:** test name, acceptance ID, commit, timestamp, or evidence document.
- **Failure memory:** symptom, cause, recovery, protection.
- **Ownership:** which repository should receive the next change.
- **Next work:** concrete implementation gaps.

Every update MUST distinguish:
- **PROVEN** facts,
- **OBSERVED** but not yet explained behavior,
- **HYPOTHESIS**,
- **PLANNED** work.

Never promote a hypothesis to a proven fact.

## 11. Cross-project orchestration rule

When a future request spans multiple repositories, agents SHOULD traverse this graph first and produce a dependency-aware change set.

Preferred order:

```requirement
  -> ownership
  -> dependency graph
  -> existing proof
  -> restore point
  -> smallest implementation
  -> tests
  -> live acceptance
  -> evidence
  -> graph update
  -> downstream synchronization
```

If two repositories appear to own the same responsibility, STOP and resolve the ownership conflict before adding another implementation.

## 12. Current consolidation direction

The current architectural consolidation path is:

```historical experiments
      |
      v
validated production behavior
      |
      v
Grasshopper contracts + evidence
      |
      v
Helix control plane
      |
      +--> persistent real Kali workstation (kali-node)
      |
      +--> scalable Kubernetes desktop platform (grasshopper-kubernetes)
      |
      v
OmniKali public discovery / agent access
```

The objective is not to erase historical repositories. Their value is provenance, lessons, recovered behavior, and evidence. Consolidation means assigning one authoritative owner to each responsibility and preventing divergent implementations from becoming accidental sources of truth.

## 13. Mandatory graph tag

Future agents MUST recognize the string:

`OMNIKALI-KG-2026-09-28`

as the cross-repository knowledge-graph marker.

If a repository contains this marker, the agent MUST:
- read the graph before cross-project changes,
- preserve the source-of-truth hierarchy,
- check known failure protections,
- update graph knowledge after material architectural changes,
- avoid claiming unverified capability.

---
**Maintenance note:** This snapshot reflects the repository investigation performed on 2026-09-28. It is deliberately timestamped. Future agents must append/update evidence rather than silently rewriting history.
