# Helix — Debian cloud desktop control plane

This Macaly app is a portal and authenticated backend. It is **not yet an operational cloud desktop**.

## Implemented
- TanStack Start responsive portal, Convex deployment and email OTP integration.
- Optional Google authorization-code flow with PKCE/state (requires AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET).
- Owner-scoped, paginated workspace specifications and a 20-workspace account quota.
- Server-only gateway calls with bounded timeouts, idempotency key, ownership checks and same-origin HTTPS session URLs.
- Debian Sid selected for this release: rolling development, XFCE, Firefox, apt and sudo inside a real cloud VM.
- Three passing isolated backend tests: unauthenticated denial, owner isolation/persistence, and quotas.

## Not yet implemented or proven
Cloud instance provisioning, a deployed compute gateway, anonymous guest admission, full Kasm integration, automatic guest cleanup, production Google consent, live desktop streaming, kernel replacement and persistent cloud volume tests.
A saved specification is not a VM. Compilation is not proof of streaming.

## Required connections
Set server-side Convex variables HELIX_GATEWAY_URL and HELIX_GATEWAY_TOKEN for a deployed gateway implementing docs/GATEWAY.md.
Google callback: the Convex HTTP Actions origin plus /api/auth/callback/google.
No infrastructure credentials belong in frontend variables or source control.

## Deployment boundary
Macaly serves the static browser app and Convex backend. A separate cloud provider runs Debian as a full VM. noVNC is the remote control; Linux is not emulated in the browser.
Do not move QEMU into a static host or tie VM lifetime to a browser tab.
Use a stable TLS hostname or named tunnel supervised by systemd; a quick tunnel cannot provide a durable endpoint.

## Verify
```sh
npm install
npx convex codegen
npx vitest run
npx tsc --noEmit
npm run build
```
Within Macaly use .sandbox/deploy-convex-app and .sandbox/check-errors.
The backend tests use convex-test; they do not provision cloud resources.
See docs/GATEWAY.md for the missing external service contract. Browser render was observed; full OTP login and reload verification did not complete.
