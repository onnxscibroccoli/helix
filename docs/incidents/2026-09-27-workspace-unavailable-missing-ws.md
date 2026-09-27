# Production Incident: Workspace Unavailable / Missing `ws` Runtime Dependency

**Date:** 2026-09-27  
**System:** OmniKali / Helix production cloud desktop  
**Severity:** Service interruption affecting workspace launch and remote desktop availability  
**Status:** Resolved and verified

## Summary

The OmniKali mobile web UI reported **"workspace unavailable"** after the production host recovered from a separate resource-pressure/restart event. The Kali VM itself was healthy, but the Helix hypervisor reconciliation service was crash-looping.

The immediate failure was:

```text
Error [ERR_MODULE_NOT_FOUND]:
Cannot find package 'ws'
imported from /opt/helix/scripts/hypervisor-daemon.mjs
```

The repository already declared `ws@^8.21.3` in `package.json` and `package-lock.json`, but the deployed `/opt/helix/node_modules` was incomplete and did not contain the dependency.

## User-visible symptoms

- OmniKali workstation page loaded successfully.
- The workstation card showed **Authentication required**.
- Launching the desktop produced **workspace unavailable**.
- The remote desktop surface remained blank.
- The control bar continued to render, including Keyboard, Paste, Reconnect, Console, and other controls.

A preceding authentication request also returned **502 Bad Gateway / nginx** while the gateway/hypervisor dependency was unstable.

## Investigation

The following production components were checked:

- Helix gateway
- `helix-libvirt-hypervisor.service`
- QEMU/KVM Kali VM
- QEMU guest agent
- VNC
- websockify/noVNC
- nginx
- local health endpoints
- gateway and hypervisor systemd journals

The Kali guest was running and the guest agent responded. VNC/websockify listeners were present. The failure was therefore narrowed to the Helix hypervisor daemon rather than the guest desktop.

The hypervisor service was configured with `Restart=always` and `RestartSec=3`, which made the missing dependency appear as repeated service flapping.

## Root cause

The source repository and lockfile contained the required dependency:

```json
"ws": "^8.21.3"
```

The production deployment artifact did not contain the corresponding `node_modules/ws` package.

Because `scripts/hypervisor-daemon.mjs` imports `ws`, Node terminated before the hypervisor HTTP service could remain available.

Dependency chain:

```text
missing node_modules/ws
        ↓
hypervisor-daemon.mjs fails at startup
        ↓
helix-libvirt-hypervisor crash loop
        ↓
workspace reconciliation unavailable
        ↓
/api/v1/workspaces/omnikali unavailable
        ↓
mobile UI: "workspace unavailable"
        ↓
desktop launch fails
```

## Recovery

The production host was repaired directly within the existing deployment boundary.

1. Confirmed the source declaration of `ws@8.21.3`.
2. Installed the missing runtime dependency on the production host without modifying application source.
3. Reset the failed systemd state.
4. Restarted `helix-libvirt-hypervisor.service`.
5. Confirmed the hypervisor health endpoint returned `{"ok":true}`.
6. Confirmed `helix-gateway.service` remained active.
7. Confirmed the Kali VM remained running.
8. Monitored the services continuously after recovery.
9. User confirmed the mobile desktop worked normally after reconnecting.

Post-recovery monitoring showed the hypervisor and gateway remaining active with the hypervisor health endpoint continuously returning OK.

## Important distinction

This incident did **not** require recreating the Kali VM or its persistent workspace. The VM and persistent disk were intact.

The failure was a **host deployment dependency integrity problem** in the Helix hypervisor service.

## Prevention / deployment requirement

Production deployment must install dependencies from the committed lockfile before enabling the hypervisor service.

The deployment acceptance gate should verify at minimum:

```bash
npm ci
node -e 'console.log(require.resolve("ws"))'
systemctl restart helix-libvirt-hypervisor.service
curl -fsS http://127.0.0.1:8090/health
systemctl is-active helix-libvirt-hypervisor.service
```

A deployment must not be considered complete merely because `package.json` declares a dependency. The deployed runtime artifact must contain it.

## Verification

Verified after recovery:

- `helix-libvirt-hypervisor.service` active
- `helix-gateway.service` active
- hypervisor `/health` returned `{"ok":true}`
- Kali VM running
- QEMU guest agent responding
- VNC listener present
- websockify listener present
- public OmniKali authentication path recovered
- user-confirmed desktop launch successful

## Related incident

This followed the earlier production-origin availability incident recorded as Helix issue #6. That incident involved CloudFront returning 504 because the origin host was unavailable. The two incidents are distinct:

- the earlier incident was origin/host availability;
- this incident was a missing runtime dependency after host recovery.

Both are now part of the production recovery history.
