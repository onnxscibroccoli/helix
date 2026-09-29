# Agent Operating Policy

This policy supplements the existing repository AGENTS.md.

## Core boundary

Agents may be powerful inside an explicitly designated **agent sandbox tenancy**. They are never allowed to possess credentials that can reach OmniKali production.

The safety boundary is:

1. dedicated sandbox tenancy/project/account
2. provider-native identity and permission boundaries
3. production isolation and absence of trust
4. protected CI/CD deployment authority

- Work from a branch. Never push directly to main.
- Production hosts, production data, and production cloud accounts are read-only to agents.
- Agents may provision and destroy resources only inside a designated sandbox tenancy.
- Never request, print, store, or commit production credentials, long-lived cloud access keys, GitHub PATs, database passwords, session cookies, bridge tokens, or model API keys.
- Infrastructure changes require source review, CI, and an explicit deployment workflow when they target production.
- Prefer GitHub App installation tokens for automation and short-lived cloud federation.
- Every autonomous change must include tests and an evidence summary in its PR.
- If a repair fails twice, stop changing the system and record the failure with diagnostics.

## Provider-neutral sandbox

A sandbox is any provider boundary with independent credentials and resource ownership. Examples include:

- AWS account
- OCI compartment/tenancy
- GCP project
- Azure subscription/resource group
- Hetzner/Linode project or account
- another provider tenancy with equivalent isolation

AWS Organizations is **not** required. AWS SCPs are optional defense-in-depth when Organizations is available.

The sandbox identity must not:

- obtain production credentials
- assume production roles
- modify production resource policies
- modify provider organization/account ownership or billing controls
- remove or weaken its own required permission boundary
- create an unbounded identity that escapes the sandbox contract

## Production

Agents receive zero production cloud credentials.

Production changes follow:

agent -> branch -> PR -> required CI -> human/repository controls -> protected deployment environment -> short-lived federation -> production deployment role

The production deployment role is never exposed to pull-request code or agent shells.

## Credential delivery

Use short-lived credentials whenever the provider supports federation.

Preferred path:

agent runtime -> sandbox federation -> sandbox identity -> provider-native boundary

Do not place static credentials in /var/lib/helix-agents or repository workspaces.

## IaC

Provider-specific infrastructure may use CDK, Terraform/OpenTofu, Bicep, provider CLIs/SDKs, or Ansible. The provider adapter owns its resources.

Production infrastructure remains source-controlled and deployment-controlled.

## Cost containment

Every sandbox requires:

- ownership and expiry metadata
- resource ceilings
- provider-native budgets/alerts where available
- scheduled cleanup/reconciliation
- a dry-run cleanup path
- explicit rejection of production identifiers

Free-tier status is an optimization, not a security guarantee.

## GitHub authority

GitHub access remains repository-scoped through a GitHub App installation token.

The agent may inspect repositories, create branches, commit, push, and open/update PRs.

The agent must not:

- merge its own PR
- bypass required checks
- modify production environment protection
- create or rotate production deployment credentials
- weaken provider isolation to repair a failed deployment

## Evidence requirement

Every sandbox deployment records:

- provider
- account/project/tenancy identifier
- region
- caller identity
- Git SHA
- IaC commit/assembly identifier
- resource IDs
- creation and cleanup timestamps
- test/acceptance results

No secret material is recorded.

## Failure rule

The self-correction loop is corrective, not self-authorizing. Repeated failures must not cause an agent to request broader privileges. After two failed repair iterations, preserve diagnostics and open an issue for human review.
