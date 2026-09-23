# Helix OAuth gateway

Helix desktop authentication uses Amazon Cognito managed login with the user pool's default Amazon Cognito domain. No custom Cognito hostname, ACM certificate, or Route 53 record is required. The configured user pool is `us-east-1_40X8yJKI2`, with the managed domain `https://helix-gateway-913427212571.auth.us-east-1.amazoncognito.com` and Managed Login v2. The gateway discovers the authorization and token endpoints from the Cognito issuer's OIDC discovery document rather than hard-coding a custom auth hostname.

Required runtime configuration:
- OIDC_ISSUER_URL
- OIDC_CLIENT_ID
- OIDC_CLIENT_SECRET
- OIDC_REDIRECT_URI
- SESSION_SIGNING_SECRET

Cognito configuration:
- OIDC_ISSUER_URL=https://cognito-idp.us-east-1.amazonaws.com/us-east-1_40X8yJKI2
- OIDC_REDIRECT_URI=https://d22bad48irrbqe.cloudfront.net/auth/callback
- Cognito managed-login domain=https://helix-gateway-913427212571.auth.us-east-1.amazoncognito.com

The gateway validates issuer, audience/client ID, signature, expiry, nonce/state, and redirect URI. A successful login creates a short-lived Helix session bound to the authenticated subject.

Desktop WebSocket access requires that session. noVNC and VNC remain localhost-only on the desktop host.

No OpenAI API credential is used for desktop authentication.

The browser-facing sign-in flow is: Helix `/auth/login` → Cognito managed login on the default `amazoncognito.com` domain → Helix `/auth/callback`. The application hostname remains the CloudFront hostname; it is the OAuth redirect target, not the Cognito login domain.
