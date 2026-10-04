# Helix agent operating contract

## Ownership (OMNIKALI-MODULARIZATION-2026-10-04)

Helix owns authenticated desktop session / RFB tickets, the live gateway, hypervisor control, AWS/OCI IaC, and production contracts.

Helix does **not** own Android Rish (`broccoli-rish`), Grasshopper task lifecycle, the public discovery door (`omnikali`), the K8s substrate (`grasshopper-kubernetes`), or the in-browser v86 PC (`kiln`).

Do not split this repository into helix-app / helix-infra / helix-hypervisor until G2 (fresh production acceptance) and G3 (clean-host reconstruction) pass. Internal packages in this repo are allowed.

Frozen production path:

```text
omnikali discovery door -> CloudFront -> nginx :80 -> Helix :8092 -> libvirt/QEMU -> helix-omnikali
```

Host console is a different machine: `/novnc/vnc.html` -> host websockify :6080 -> host VNC :5900. Do not collapse those paths.

---

Helix is the OmniKali cloud desktop control plane: auth, workspace lifecycle, KVM guests, and browser remote display.

This file is the only always-on agent context. Do not ingest `.grok/`, `docs/` trees, or `infra/` wholesale.

## Context budget

1. Read this file and `CLAUDE.md`.
2. Read `README.md` only if the task is unfamiliar.
3. Open one area of the map below. Do not recursively read the rest.
4. Never load `.grok/skills/` or `.grok/references/` unless the task is explicitly the Vite preview UI.
5. Prefer `gh` + targeted file reads over dumping the repository into the prompt.

## Map (open only what the task needs)

- App / auth / workspace UI: `src/`
- Gateway / production contracts: `production/`
- Hypervisor / QEMU helpers: `hypervisor/`
- AWS / Terraform: `infra/terraform/`, `infra/aws/`
- Host convergence: `infra/ansible/`, `infra/agents/`
- Offline tests: `test-suite/tests` via `pytest` with `HELIX_SKIP_LIVE=1`
- Live paths: `docs/LIVE_PATHS.md`

## Safety

- Do not bind or capture host 80/443. K3s/Traefik is not the CloudFront origin.
- Do not deploy to AWS or mutate live Kali/Helix without explicit human authorization.
- Do not copy production credentials into git, workflows, prompts, or logs.
- Human GUI input wins on remote desktops.
- A running process is not proof of health.

## Verify

```text
pytest test-suite/tests -q          # HELIX_SKIP_LIVE=1 in CI
npm test                            # if the change is application code
```

Live KVM assertions require `/dev/kvm` and authorization. Do not invent them.

## App Builder brand pin (kept because `scripts/brand-check.test.mjs` asserts it)

In-flight share cards use `/workspace/.grok/og-pending`. That marker is stale after 10 minutes.

6. **Brand-asset pass — a subagent, never waited for.** never wait_tasks and never get_task_output
7. Verify the rest of the product independently.
