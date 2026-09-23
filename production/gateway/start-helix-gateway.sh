#!/bin/sh
set -eu
export OIDC_CLIENT_SECRET="$(
  /usr/bin/aws cognito-idp describe-user-pool-client     --region us-east-1     --user-pool-id us-east-1_40X8yJKI2     --client-id 4co7gd1bo4re206klembj9nr43     --query UserPoolClient.ClientSecret     --output text
)"
exec /usr/bin/node /opt/helix/production/gateway/helix-gateway.mjs
