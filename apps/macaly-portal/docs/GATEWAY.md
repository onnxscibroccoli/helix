# External desktop gateway contract

Status: integration contract, not an implemented compute service.

## Session request
POST /api/v1/sessions over HTTPS, Authorization: Bearer server-only service credential.
Idempotency-Key: workspace ID.
JSON: {workspaceId, owner, distro: "debian", tier: "persistent" | "ephemeral"}.
Owner is derived by the portal backend from verified authentication, never accepted as browser authority.

The gateway must authenticate the backend, enforce owner binding in durable storage, enforce resource quotas and serialize provisioning by workspace ID. It must reconcile after crashes rather than creating another instance.
Return 200 {session_url: "https://<same-gateway-origin>/desktop/..."} only for a usable authenticated entrypoint.
Provisioning should return 202 separately in a future version; the current portal contract requires a completed session URL.
The launch URL should redeem a short-lived, single-use capability into an HttpOnly Secure session cookie, then redirect to a token-free URL. Do not log capabilities.

## Actual computer
A provider VM running Debian Sid, with its own kernel and durable root volume. A nested KVM guest is optional if the chosen host and budget support it; never require nested virtualization merely to obtain a full cloud Linux machine.
Install XFCE, dbus-x11, TigerVNC, Firefox and sudo. Give the workspace owner root inside this guest.
Use apt install/upgrade/full-upgrade. pkg is a Termux package command, not the Debian package manager.
Preserve running apps across browser detach. A guest reboot preserves disk, not process memory.

## Desktop path
Browser noVNC -> authenticated WSS gateway -> loopback/private TigerVNC.
Alternatively deploy KasmVNC inside the guest and use its matching web client.
QEMU VNC and TigerVNC use standard RFB; raw websocket wrapping does not convert them to KasmVNC.
Do not claim Kasm Workspaces provisions arbitrary libvirt VMs through an invented JSON setting.

## Durable lifecycle
Persistent owner/workspace/instance/volume IDs belong in the gateway database. Unique owner+workspace constraint, job idempotency, leases, provider operation IDs and reconciliation.
Google identity returns the user to the same machine.
Unauthenticated trial sessions require a separate admission endpoint with bot/rate limits, a capability session and a hard TTL. They must not share a desktop with a signed-in user.
Deleting a lease must not delete a persistent volume. Trial cleanup is server-driven and must survive browser loss and gateway restart.

## Network and recovery
Use stable DNS and HTTPS. Named Cloudflare Tunnel or normal TLS ingress; restart the transport independently of the VM.
Block guest access to host management, metadata, internal/private networks, other guests and IPv6 equivalents while permitting intended internet access.
Keep SSH/RFB off public ingress. Default-deny firewall. Root inside guest is not host root.
Reconnection uses bounded exponential backoff with jitter; status checks are deterministic code, not repeated LLM requests.
A missing RFB banner means desktop transport unavailable, not VM booting.
Only mark connected after the desktop protocol and framebuffer initialize.

## Acceptance gates
1. Record provider instance ID, boot ID, OS release and current kernel from the actual guest.
2. Exercise apt update/install/upgrade and Firefox HTTPS navigation.
3. Confirm unauthenticated and cross-owner session denial; complete real Google OAuth.
4. Close browser; reopen and confirm same VM, files and running app. Reboot guest and confirm same disk hash.
5. Install a specific different kernel; require new boot ID and exact expected uname -r. Preserve old boot fallback.
6. Expire trial lease; verify domain/instance, mounts and resources removed. File unlink alone is not secure erasure.
7. Measure real input-to-frame latency and FPS under stated viewport, animation and network conditions. A 101 response alone proves no rendering.
