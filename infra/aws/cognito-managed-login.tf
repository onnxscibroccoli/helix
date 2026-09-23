# Cognito Managed Login requires a branding style per app client.
#
# This is intentionally optional because the production user pool is an
# existing authentication resource rather than part of the EC2 substrate.
# Supply cognito_user_pool_id and cognito_client_id to manage the style.
#
# For an already-fixed production client, import the existing style into
# Terraform state before applying:
#   terraform import 'aws_cognito_managed_login_branding.gateway[0]' '<user-pool-id>,<managed-login-branding-id>'
#
# The current live style can be discovered with:
#   aws cognito-idp describe-managed-login-branding-by-client \
#     --user-pool-id <user-pool-id> --client-id <client-id>

resource "aws_cognito_managed_login_branding" "gateway" {
  count = var.cognito_user_pool_id != "" && var.cognito_client_id != "" ? 1 : 0

  user_pool_id                = var.cognito_user_pool_id
  client_id                   = var.cognito_client_id
  use_cognito_provided_values = true
}
