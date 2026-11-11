# Agent launch contract: chat-independent compute

## Goal

Reproduce the useful behavior of the early agent/Kali prototype without depending on the original chat workspace, its token budget, or an ephemeral tunnel.

The agent must be able to request a compute workspace and receive a durable capability. After the request completes, the workspace lifecycle belongs to the control plane, not the originating chat.

## Required lifecycle

1. Agent authenticates to the control plane with a server-side capability.
2. Agent requests a workspace with explicit kind: `ephemeral` or `persistent`.
3. Control plane creates an idempotent workspace record and provisioning operation.
4. Hypervisor provisions the guest.
5. Persistent kind gets provider-backed encrypted storage. Browser/chat disconnect must not destroy it.
6. Control plane observes and reconciles desired versus observed state.
7. Gateway issues short-lived desktop access capability.
8. Browser connects through authenticated WSS/RFB. No public VNC port is exposed.
9. Agent may continue operating the workspace through the control plane after the originating chat ends.
10. Ephemeral kind is reclaimed by server-side lease/TTL policy.

## Optional tunnel capability

A disposable Cloudflare Quick Tunnel can be treated as an **optional developer/bootstrap transport**, never as the persistence mechanism and never as the authoritative production identity/access layer. The architecture must also work without Cloudflare by using the existing authenticated gateway WSS path.

A tunnel URL is therefore an access artifact with its own lifecycle. It must not be stored as the workspace identity or persistent storage identity.

## Acceptance criteria

- Workspace survives browser disconnect and chat termination.
- Persistent storage survives guest stop/restart.
- Reconciliation can recover the guest without the original agent process.
- A new authorized agent can discover and operate the existing workspace.
- Ephemeral resources are reclaimed independently of chat state.
- No production listener on 80/443 is displaced by a tunnel implementation.
- No public 5900/5901/6080 exposure is required.
- Cloudflare is optional, not required for production correctness.
