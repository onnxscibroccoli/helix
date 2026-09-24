# Google-linked DCV launch (single owner)

The running `helix-studio-1` Ubuntu EC2 instance uses Amazon DCV on HTTPS 8443 and `helix-workspace` on a non-deleting EBS volume. Macaly's Helix app authenticates with its Google OAuth handoff; its Convex action checks account ownership and signs a 60-second launch proof. The Python broker in this directory verifies that proof once, creates a new DCV token through the loopback-only verifier, then redirects to DCV.

Current broker deployment: `/usr/local/bin/helix-launch.py`, `helix-launch.service`, TLS 9443, certificate for `3-237-173-174.sslip.io`. The signing key is stored only in protected AWS and Convex environment settings, never in this repository. Its SQLite nonce store is `/var/lib/helix-launch/nonces.db`. Configure `HELIX_DCV_LAUNCH_SECRET` and `HELIX_DESKTOP_OWNER_EMAIL` in the service's root-readable environment file before starting it. The Macaly app uses the same secret and `HELIX_DCV_BROKER_ORIGIN` as server-only settings.

Security checks: unauthenticated request 403, valid signed proof 303, replay 403; token verifier only on 127.0.0.1:8080. Restart the broker on certificate renewal.

Scope: this opens one existing Ubuntu desktop for one Google-linked owner. It does not provision per-user VMs or attach the separate CloudFront/Cognito gateway. After disconnect, open the Macaly portal again to obtain another one-use DCV token. A stable address is still needed if the EC2 public IP changes.
