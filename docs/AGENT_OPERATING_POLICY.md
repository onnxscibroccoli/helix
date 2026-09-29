# Agent Operating Policy

This policy supplements the existing repository AGENTS.md.

## Core boundary

Agents are allowed to be powerful inside explicitly designated **agent sandbox cloud accounts/projects**. They are not allowed to possess credentials that can reach OmniKali production.

The safety boundary is account/project isolation first, IAM permission boundaries second, and CI/CD deployment controls third.

- Work from a branch. Never push directly to main.
- Production hosts, production data, and production cloud accounts are read-only to agents.
- Agents may provision and destroy resources in a designated non-production sandbox account when the sandbox identity has been explicitly issued for that account.
- Never request, print, store, or commit production AWS credentials, long-lived cloud access keys, GitHub PATs, database passwords, session cookies, bridge tokens, or model API keys.
- Infrastructure changes require source review, CI, and an explicit deployment workflow when they target production.
- Prefer GitHub App installation tokens for automation and GitHub OIDC for AWS.
- Every autonomous change must include tests and an evidence summary in its PR.
- If a repair fails twice, stop changing the system and record the failure with diagnostics.

## AWS account isolation

### Agent sandbox

The agent sandbox is a separate AWS account under the organization. It is the only AWS account to which an autonomous agent may receive cloud credentials.

Within that account, the agent may provision, modify, and destroy workload resources needed for experimentation and validation, including EC2, VPCs, EBS, ECS, databases, queues, buckets, load balancers, and other ordinary workload services.

Full sandbox access does **not** mean organization-control-plane access. The sandbox identity must not be able to:

- access or assume roles in the production account
- move accounts between organizational units
- detach or modify organization SCPs
- modify organization/account ownership or billing controls
- modify the sandbox permission boundary itself
- create an unbounded IAM role or user
- register credentials or trust relationships that escape the sandbox boundary

A management-account administrator creates the sandbox account and organization-level SCPs. The agent cannot create its own safety boundary.

### Production

Agents receive **zero AWS credentials for production**.

Production changes follow:

agent -> branch -> PR -> required CI -> human/repository controls -> protected GitHub Actions environment -> GitHub OIDC -> production deployment role

The production deployment role is never exposed to pull-request code or agent shells.

### Multi-cloud

The same isolation model applies outside AWS:

- GCP: dedicated non-production project/folder
- Azure: dedicated non-production subscription/resource group
- Hetzner/Linode: dedicated non-production project/team/account
- other providers: dedicated sandbox tenancy where supported

A cloud credential is valid only for its sandbox tenancy. Production credentials are never mounted into the agent runtime.

## AWS credential delivery

Sandbox access uses short-lived credentials whenever the provider supports federation.

Preferred path:

agent runtime -> sandbox federation -> sandbox role -> permission boundary

Do not place static AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY files under /var/lib/helix-agents.

The agent runtime must be able to prove its current identity with sts:GetCallerIdentity, but it must not be able to assume a production role.

## IaC requirement

Agents may use AWS CDK, Terraform/OpenTofu, Ansible, cloud CLIs, SDKs, and provider APIs inside the sandbox when needed for testing.

Production infrastructure remains source-controlled and deployment-controlled.

For repeatable sandbox experiments, prefer IaC so resources can be tagged, audited, reconciled, and destroyed. Ad-hoc CLI/API calls are permitted for diagnosis and disposable experiments when they remain inside the sandbox account.

## Cost containment

The sandbox account requires independent cost guardrails:

- AWS Budgets and alerts
- service quota limits appropriate to the account
- mandatory ownership/expiry tags where practical
- scheduled cleanup/reconciliation
- optional AWS Nuke or Cloud Custodian cleanup after an explicit review of protected exceptions

Cleanup tooling must never run with production credentials or target production accounts.

## GitHub authority

GitHub access remains repository-scoped through a GitHub App installation token.

The agent may inspect repositories, create branches, commit, push, and open/update PRs.

The agent must not:

- merge its own PR
- bypass required checks
- modify production environment protection
- create or rotate production deployment credentials
- modify organization security controls as part of ordinary remediation

## Evidence requirement

Every sandbox deployment records:

- AWS account ID
- region
- caller identity ARN
- Git SHA
- IaC commit/assembly identifier
- resource tags
- creation and cleanup timestamps
- test/acceptance results

No secret material is recorded.

## Failure rule

The self-correction loop is corrective, not self-authorizing. Repeated failures must not cause an agent to request broader privileges. After two failed repair iterations, preserve diagnostics and open an issue for human review.
