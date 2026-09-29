# Live paths 2026-09-29

These two URLs are both live. They are different machines.

## Product Kali path

`https://d22bad48irrbqe.cloudfront.net/auth/login`

Cognito → Helix session → Launch desktop → ticketed WSS → libvirt guest `helix-omnikali`.

Public check this session: `GET /health` returned
`{"ok":true,"oidcConfigured":true,"publicOrigin":"https://d22bad48irrbqe.cloudfront.net"}`.

## Intentional hypervisor console

`https://d22bad48irrbqe.cloudfront.net/novnc/vnc.html`

Host VNC `:5900` on Debian EC2 `ip-172-31-8-59` (`deb13-cloud-amd64`).
Operator accepted this as direct hypervisor access. Do not remove it.

## Not the public path

K3s `omnikali-desktop` on the same host is a local prototype.
Do not install Traefik/ingress on 80/443 without a before/after acceptance test.
See Grasshopper issue #62 and `docs/ARCHITECTURE_VERIFICATION_2026-09-29.md`.
