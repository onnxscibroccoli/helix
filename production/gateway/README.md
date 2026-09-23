# Helix authenticated public gateway

The gateway is the only public desktop entry point. It terminates OIDC login, creates an HttpOnly Secure session cookie, authorizes a workspace, issues a short-lived signed desktop WebSocket ticket, and proxies that WebSocket to the workspace localhost VNC socket.

Security:
- VNC, noVNC, libvirt and the hypervisor API remain localhost-only.
- OIDC credentials never enter the desktop stream.
- The browser receives only a short-lived workspace-scoped Helix ticket.
- The ticket is signed and expires after WS_TICKET_TTL_SECONDS.
- TLS is terminated by the public reverse proxy.

Google OIDC requires a Google Web Application OAuth client with the exact callback URI.

Browser flow:
1. GET /
2. /auth/login
3. Google OIDC authorization
4. /auth/callback
5. Secure Helix session cookie
6. GET /api/v1/workspaces/:id
7. Receive short-lived WebSocket ticket
8. Connect wss://host/kasm/ws/:id?ticket=...
9. Gateway tunnels binary RFB/VNC traffic to localhost.
