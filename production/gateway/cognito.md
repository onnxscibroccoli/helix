# Helix Cognito OIDC

Helix uses an Amazon Cognito user pool as the production OIDC issuer for the public gateway.

Current deployment:
- User pool: helix-gateway-users
- User pool ID: us-east-1_40X8yJKI2
- Managed-login domain: helix-gateway-913427212571.auth.us-east-1.amazoncognito.com
- CloudFront gateway: https://d22bad48irrbqe.cloudfront.net
- OIDC callback: https://d22bad48irrbqe.cloudfront.net/auth/callback

The gateway validates the Cognito issuer, audience, signature and authorization-code state, then creates its own HttpOnly Secure session.

Workspace authorization is owner-bound:
- the libvirt control plane stores an owner subject on each workspace;
- the gateway compares the authenticated OIDC sub with the workspace owner;
- only an owner receives the short-lived desktop WebSocket ticket;
- the gateway then tunnels RFB to the workspace localhost-only VNC port.

Cognito's managed login is an OIDC authorization server and can provide browser sign-in and account creation without exposing the gateway's client secret to the browser.
