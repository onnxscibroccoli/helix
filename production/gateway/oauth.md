# Helix OAuth gateway

Helix desktop authentication uses an external OIDC provider. Google is the default documented provider, but any conforming OIDC provider can be used.

Required runtime configuration:
- OIDC_ISSUER_URL
- OIDC_CLIENT_ID
- OIDC_CLIENT_SECRET
- OIDC_REDIRECT_URI
- SESSION_SIGNING_SECRET

The gateway validates issuer, audience/client ID, signature, expiry, nonce/state, and redirect URI. A successful login creates a short-lived Helix session bound to the authenticated subject.

Desktop WebSocket access requires that session. noVNC and VNC remain localhost-only on the desktop host.

No OpenAI API credential is used for desktop authentication.
