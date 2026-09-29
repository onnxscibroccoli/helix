#!/bin/sh
set -eu

: "${AWS_REGION:?AWS_REGION must be set in /etc/helix/gateway.env}"
: "${COGNITO_USER_POOL_ID:?COGNITO_USER_POOL_ID must be set in /etc/helix/gateway.env}"
: "${COGNITO_CLIENT_ID:?COGNITO_CLIENT_ID must be set in /etc/helix/gateway.env}"

export OIDC_CLIENT_SECRET="$(
  /usr/bin/aws cognito-idp describe-user-pool-client \
    --region "$AWS_REGION" \
    --user-pool-id "$COGNITO_USER_POOL_ID" \
    --client-id "$COGNITO_CLIENT_ID" \
    --query UserPoolClient.ClientSecret \
    --output text
)"

test -n "$OIDC_CLIENT_SECRET"
test "$OIDC_CLIENT_SECRET" != "None"

exec /usr/bin/node /opt/helix/production/gateway/helix-gateway.mjs
