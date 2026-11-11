# Portfolio reviewer readiness — helix

> **Status:** Reviewable documentation plan, not a production certification. **As of:** 2026-11-11. **Tracking:** [local issue](https://github.com/onnxscibroccoli/helix/issues/66) · [cross-repository ledger](https://github.com/onnxscibroccoli/broccoli-core/issues/102).  
> Do not interpret AI-assisted source development, successful offline tests or simulations as independently verified industry employment, compliance, or live operations.

## One-minute technical orientation

**Focus:** Cloud desktop, authentication and hypervisor lifecycle. IaC and application contracts for authentication, remote workstation lifecycle, KVM/QEMU guests, browser-delivered RFB sessions, and operational recovery.

**What is demonstrable:** The listed source files and explicitly scoped CI runs can be inspected. A reviewer can evaluate the code, rerun supported unit tests, and challenge the architecture decisions. Any claimed practical capability requires the corresponding test, environment, and source revision; not all systems are integrated or generally available.

## Source and reviewer starting points

| Evidence | Path |
| --- | --- |
| Cloud IaC directory | [Inspect](https://github.com/onnxscibroccoli/helix/tree/main/infra) |
| Guest and recovery test harness | [Inspect](https://github.com/onnxscibroccoli/helix/tree/main/test-suite) |
| Main validation CI | [Inspect](https://github.com/onnxscibroccoli/helix/blob/main/.github/workflows/validate.yml) |
| Production readiness notes | [Inspect](https://github.com/onnxscibroccoli/helix/blob/main/docs/PRODUCTION_READINESS.md) |

## Executed CI references (historical, scoped)

| Check | Exact run |
| --- | --- |
| Main validation run (offline/test-harness only) | [Run 43029338390](https://github.com/onnxscibroccoli/helix/actions/runs/43029338390) |

These run links refer to the specific branch/commit shown on GitHub. They must not be silently attributed to a different current HEAD, production environment, device or approval state.

## Reproduce the relevant local checks

After cloning the repository and reviewing dependencies and safe environment requirements:

```sh
HELIX_SKIP_LIVE=1 pytest test-suite/tests -q
```

This is a **documented command**, not a claim that this portfolio PR executed it. Some modules require dependencies or privileges, and a missing dependency must be reported rather than converted into a false PASS.

## Ordered actionable changes

1. [ ] Publish a system map showing application/auth/hypervisor/RFB boundary ownership.
2. [ ] Explain precisely that main validate.yml sets HELIX_SKIP_LIVE=1.
3. [ ] Create a credential-free local contract-test demonstration and link its exact Actions run.
4. [ ] Document live acceptance prerequisites (/dev/kvm, guest image, authenticated transport) without modifying the environment.
5. [ ] Only promote production claims after an authorized, current, repeatable end-to-end run.

## Maturity and verification boundary

Main CI success exercises a live-skipped validation harness; no live VM, OAuth login, remote desktop stream or running production environment is established by this check.

## Release and artifact strategy

Document a validated local demo and infrastructure templates; do not distribute real cloud configuration, secrets or guest disks.

## Safe continuation after interruption

1. Follow the local issue and the [master execution ledger](https://github.com/onnxscibroccoli/broccoli-core/issues/102); inspect existing PRs before creating new ones.
2. Check `git rev-parse HEAD`, repo default branch, current feature branches and fresh Actions conclusions.
3. For each checklist item, implement the smallest change on a reviewable PR; record exact SHA, test scope, successes, failed/untested checks and outstanding decisions.
4. Keep a previously failing independent-approval requirement or live-device gate unresolved until a legitimately authorized actor/environment supplies evidence.
5. Re-read this document against source after changing implementation. Do **not** mark a checklist item complete merely because it is documented.

**Human-only / outside repository assertions:** employment history, professional tenure, team-management responsibilities, third-party audit and approvals.