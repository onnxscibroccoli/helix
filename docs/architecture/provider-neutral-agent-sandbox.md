# Provider-Neutral Agent Sandbox Contract

Status: implementation contract
Date: 2026-09-29

## Decision

OmniKali does not require AWS Organizations, a multi-account AWS topology, or any specific cloud provider to obtain a safe autonomous-agent sandbox.

The invariant is:

agent runtime -> dedicated sandbox tenancy -> sandbox identity -> provider-native guardrails -> disposable workload

Production is a separate trust domain. Autonomous agents never receive production credentials.

A "tenancy" may be an AWS account, GCP project, Azure subscription/resource group, OCI tenancy/compartment, or another provider boundary with equivalent isolation.

## Why this replaces the AWS Organizations prerequisite

A standalone AWS account can still use IAM roles and permissions boundaries, but AWS SCPs are an Organizations feature. Therefore an SCP must be treated as an optional defense-in-depth layer, not as a prerequisite for launching OmniKali.

If AWS Organizations is unavailable, the sandbox must instead rely on:

1. a separate AWS account from production
2. a dedicated sandbox role
3. a permissions boundary
4. explicit denial of production role ARNs and cross-account AssumeRole
5. no production trust relationship
6. short-lived federation
7. budget/quota/cleanup controls
8. acceptance tests proving production access is denied

The same contract applies to other providers.

## Provider matrix

| Provider | Isolation primitive | Free/low-cost path | Agent authority |
| --- | --- | --- | --- |
| AWS | standalone account + IAM boundary | existing Free Tier account if available | sandbox account only |
| OCI | compartment + IAM policy | Always Free compute/storage/database resources | sandbox compartment/tenancy |
| GCP | project | Free Tier and eligible $300 trial | sandbox project |
| Azure | subscription/resource group | free services/credits when eligible | sandbox subscription/resource group |
| Cloudflare | account + Worker/namespace; Sandbox SDK for paid plans | Workers Free for control-plane/API pieces | not a full free VM replacement |

Provider selection is an implementation choice. The contract and acceptance suite are provider-neutral.

## Recommended zero-cost-first path

OCI is the strongest candidate for a persistent free compute sandbox because Oracle currently publishes Always Free compute, storage, networking, load balancing, monitoring, secrets, and database resources. OCI compartments are explicit resource/IAM isolation boundaries.

GCP is a strong second option for lightweight CI and agent workloads because projects are isolation boundaries and the current Free Tier includes an eligible e2-micro VM plus other services.

AWS remains the production provider and can also host a sandbox in the existing account only if the sandbox role is cryptographically and policy-isolated from production. A separate AWS account is preferable when available, but AWS Organizations is not required by this contract.

Cloudflare is useful for the control plane, edge routing, and lightweight agent APIs. Its current Workers Free plan is not a replacement for a persistent VM sandbox, and Cloudflare Containers/Sandbox SDK currently require a paid Workers plan.

## Production boundary

Production authority remains:

agent -> branch -> PR -> required CI -> protected deployment environment -> short-lived provider federation -> production deployment role

The autonomous agent runtime never receives that production role or its credentials.

## Sandbox credential contract

Every provider adapter must expose:

- `identity()`
- `createWorkload(spec)`
- `destroyWorkload(id)`
- `listOwnedWorkloads(owner)`
- `assertProductionInaccessible()`
- `cleanupExpired(owner)`

Credentials must be short-lived where supported. Static credentials are a fallback of last resort and must never be copied into persistent agent workspaces.

## Required sandbox acceptance

A provider is launch-compatible only after proving:

1. caller identity belongs to the designated sandbox tenancy
2. production identity/tenancy is distinct
3. sandbox workload creation succeeds
4. sandbox workload destruction succeeds
5. sandbox identity cannot assume or obtain production credentials
6. sandbox cleanup is bounded by owner and expiry
7. production resource inventory and health remain unchanged
8. evidence records provider, tenancy/project/account identifier, region, identity ARN/name, Git SHA, resource IDs, timestamps, and cleanup result
9. no secret material is recorded

## Cost safety

Free-tier eligibility is not a security boundary and must not be assumed permanent.

Every sandbox provider adapter must support:

- explicit ownership tags/labels
- expiry timestamps
- reconciliation
- hard resource ceilings
- provider-native budget/alert mechanisms where available
- automatic cleanup for disposable resources
- a dry-run inventory before destructive cleanup

Cleanup code must have no production credentials and must reject production identifiers before any mutation.

## IaC

The provider adapter is responsible for the provider-specific implementation:

- AWS: CDK or OpenTofu/Terraform
- OCI: Terraform/OpenTofu or OCI SDK
- GCP: Terraform/OpenTofu or gcloud APIs
- Azure: Bicep/Terraform/OpenTofu or Azure APIs
- host configuration: Ansible
- agent runtime: container/image definition

Only one system owns a given resource. Provider-neutral orchestration must not become a second infrastructure controller.

## Launch consequence

AWS Organizations account creation is no longer a hard blocker for OmniKali launch readiness.

The hard blocker is narrower: at least one real provider sandbox must be provisioned and pass the acceptance suite without production access.

Until that proof exists, autonomous agents remain unable to deploy infrastructure.

## Evidence

This contract is based on current provider documentation reviewed on 2026-09-29. Free-tier quantities and provider limits are expected to change and must be revalidated before each new sandbox deployment.
