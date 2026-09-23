# Helix OAuth gateway

Helix does not require an OpenAI API key for desktop authentication.

The gateway uses an external OIDC provider. Google OAuth is the default recommended provider, but any OIDC provider can be used.

## Required runtime configuration

- OIDC_ISSUER_URL
- OIDC_CLIENT_ID
- OIDC_CLIENT_SECRET
- OIDC_REDIRECT_URI
- SESSION_SIGNING_SECRET

For Google:

- OIDC_ISSUER_URL=https://accounts.google.com
- Create an OAuth 2.0 Web application client in Google Cloud.
- Register the exact OIDC_REDIRECT_URI.
- Keep the client secret only in the deployment secret store.

The gateway must validate issuer, audience/client ID, signature, expiry, nonce/state, and redirect URI. After successful authentication it creates a short-lived Helix session bound to the authenticated subject.

Desktop WebSocket access must require that Helix session; the noVNC port remains localhost-only on the desktop host.

No OpenAI credential is involved in this flow.
