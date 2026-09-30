# Helix agent operating contract

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
