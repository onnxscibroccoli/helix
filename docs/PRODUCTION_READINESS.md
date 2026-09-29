# Helix production-readiness checklist

Lane A. Updated 2026-09-29 after fresh live AWS/host reconciliation and current-source verification.

| Check | Status |
|---|---|
| Public HTTPS edge | PASS — CloudFront /health 200 |
| OIDC configured | PASS — health.oidcConfigured true |
| Auth login page | PASS — /auth/login 200 |
| Intentional hypervisor /novnc path | PASS — public page 200; operator-accepted host console |
| Product vs host paths documented | PASS — docs/LIVE_PATHS.md |
| Running libvirt guest | PASS — helix-omnikali running, persistent, autostarted |
| Fresh Kali guest identity | PASS — QEMU guest-agent returned Kali 7.1.5+kali-amd64 and hostname kali |
| PostgreSQL production instance | PASS — helix-control-plane available, private, encrypted, Multi-AZ |
| RDS backup retention | BLOCKED — live value is 1 day; AWS rejected requested 14-day change with FreeTierRestrictionError |
| Task lifecycle / fencing re-run | OPEN — historical acceptance IDs exist, but current evidence harness requires fresh dated runs |
| Current-source Grasshopper tests | PASS — 140/140 on GitHub HEAD 6c0aa647dd5f5d68352defa5235697343826f2b1 |
| Live-acceptance harness | OPEN — all 8 required scenarios remain OPEN by design |
| CI / self-hosted runner Node 24 | OPEN — issue #13 |
| CloudFront 504 recovery automation | KNOWN DEBT — issue #6 |
| K8s not public ingress | PASS as current state; protected by issue #62 |
| Secrets out of git | PASS by repository checks; runtime secrets remain external |

## Release blockers

1. Fresh authenticated production acceptance requires an authenticated operator/session to exercise the real /auth/login path and task lifecycle. No synthetic cookie or session should be introduced.
2. Eight live-acceptance scenarios remain OPEN until dated authorized evidence is recorded.
3. 14-day RDS PITR is blocked by the AWS account's Free Tier restriction. Do not replace RDS to work around this restriction.
4. Self-hosted GitHub Actions runner verification remains open under issue #13.

These are release gates, not reasons to alter the validated CloudFront → nginx → Helix → libvirt/QEMU path.
