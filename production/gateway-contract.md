# Gateway contract

The browser never receives OCI credentials, libvirt access, Kasm API secrets, or a long-lived gateway credential.

## POST /api/v1/sessions

Authenticated by a server-to-server bearer credential from the portal backend.

Request:

```json
{
  "workspaceId": "convex-workspace-id",
  "owner": "convex-user-id",
  "distro": "debian",
  "tier": "persistent"
}
```

The gateway must ignore any browser-supplied owner identity and bind ownership to the verified backend credential.

Responses:

- `200`: an authenticated desktop entrypoint is ready.
- `202`: provisioning accepted; the caller polls the operation.
- `409`: another provisioning operation already owns the workspace.
- `429`: quota or admission limit.
- `5xx`: transient infrastructure failure.

Example `200`:

```json
{
  "session_url": "https://gateway.example/desktop/capability/REDACTED"
}
```

The capability is single-use and short-lived. Redeeming it creates an HttpOnly, Secure, SameSite session cookie and redirects to a token-free desktop URL. Capabilities are never logged.

## Durable reconciliation

Every durable instance record stores:

- OCI instance ID
- OCI volume ID
- libvirt domain UUID
- provider operation ID
- desired state
- observed state
- lease expiry
- last reconciliation timestamp

Provisioning is idempotent by workspace ID. Browser disconnect is not a lifecycle signal. A scheduled reconciler is authoritative for TTL expiry and crash recovery.
