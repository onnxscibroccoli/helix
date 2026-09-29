# Agent Cloud Isolation

Status: implementation contract
Date: 2026-09-29

Autonomous agents receive real cloud provisioning authority only in a dedicated sandbox tenancy.

AWS model:

agent runtime -> sandbox account -> sandbox role -> IAM permissions boundary -> workload resources

Production is a separate AWS account. Agent runtimes receive no production AWS credentials.

The sandbox role can provision and destroy ordinary workload infrastructure. The boundary blocks organization/account/billing control, cross-account STS role assumption, unbounded IAM identities, and modification/removal of its own boundary.

The checked-in SCP is a management-account artifact. It must be created and attached by an organization administrator, not by the sandbox agent.

AWS documents that SCPs constrain the maximum permissions of principals in member accounts and do not grant permissions themselves. AWS also documents permissions boundaries as a maximum-permissions guardrail and supports the iam:PermissionsBoundary condition key for requiring a specific boundary.

Production independently requires no trust from sandbox principals, protected GitHub Actions deployment, and reviewed cross-account resource policies/data perimeters.

Sandbox acceptance must prove:
- caller account is the designated sandbox account
- caller account differs from production
- production role assumption is AccessDenied
- sandbox resource creation succeeds
- sandbox resource destruction succeeds
- no production resource changes during the run

Never deploy the sandbox stack to production. Its CDK entrypoint refuses when the current account is not the explicitly supplied sandbox account or when sandbox and production IDs match.
