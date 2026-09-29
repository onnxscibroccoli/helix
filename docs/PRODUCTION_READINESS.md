# Helix production-readiness checklist

Lane A. Updated 2026-09-29. StatusTag remains OBSERVED until a fresh task-lifecycle acceptance ID exists.

| Check | Status |
|---|---|
| Public HTTPS edge | PASS — CloudFront `/health` 200 |
| OIDC configured | PASS — health.oidcConfigured true |
| Auth login page | PASS — `/auth/login` 200 |
| Product vs host paths documented | PASS — `docs/LIVE_PATHS.md` |
| Host `/novnc` intentional | PASS — operator accepted |
| Guest identity from auth desktop (`uname`/`hostname kali`) | OPEN — operator confirmed path; guest uname shot not filed |
| Task lifecycle / fencing re-run | OPEN — historical IDs only |
| Secrets out of git | ASSUMED — do not commit `.env` or RDS secrets |
| CI / self-hosted runner Node 24 | OPEN — issue #13 |
| CloudFront 504 if origin stopped | KNOWN — issue #6 |
| K8s not public ingress | PASS as current state; protect |
