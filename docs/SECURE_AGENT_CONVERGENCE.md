# Secure Agent Convergence
Status: design and source contract
Date: 2026-09-29

## Objective
Run OpenHands (OpenDevin lineage) and Claude Code from two isolated environments: the existing production Helix host and a disposable/containerized agent environment. GitHub Actions remains the deployment authority.

## Trust model
human -> GitHub PR/review -> GitHub Actions -> OIDC deployment role -> AWS

Agents may inspect repositories, run tests, create branches, commit, push, and open/update pull requests. Agents must not receive long-lived AWS credentials, production database credentials, the Docker socket, libvirt socket, QEMU monitor access, or the Helix gateway bridge token.

## Production host
- dedicated non-root helix-agent user
- workspace under /var/lib/helix-agents
- no sudo, libvirt, kvm, or docker group membership
- no access to /etc/helix secrets
- no writes to /opt/helix
- disposable repository worktrees owned by helix-agent
- persistent state limited to agent state, caches, and logs
- outbound access restricted to required source-control and model endpoints

## Container environment
- non-root agent UID
- read-only image filesystem where practical
- writable persistent volume only for workspace and agent state
- no host Docker socket
- no host PID or network namespace
- no AWS credential files
- no production secrets

## Credential model
Do not create personal access tokens for agent deployment authority.

### GitHub
Use a repository-scoped GitHub App installation for automation. Store the private key only in the environment secret store and generate short-lived installation tokens at runtime.

Recommended app permissions:
- Contents: read/write
- Pull requests: read/write
- Issues: read/write only when issue-driven remediation is enabled
- Actions: read
- Metadata: read

Do not grant administration, secrets, environments, deployments, or organization administration.

Human interactive CLI access remains separate from the agent identity.

### AWS
GitHub Actions uses OIDC. No AWS access key or secret access key is stored in GitHub. The current deployment role must be split into bootstrap, plan/synth, and deployment roles with least-privilege policies. The existing cloudformation:* and iam:PassRole on * policy is not an acceptable steady-state agent boundary.

The agent itself receives no AWS role. A deployment workflow assumes the AWS role only after PR gates pass.

### Model providers
Claude Code may authenticate directly with Anthropic or through Bedrock. If Bedrock is selected, the workflow receives a short-lived AWS role dedicated to Bedrock invocation, not the deployment role. OpenHands receives its model credential through the runtime secret store and never writes it into the repository.

## Repository policy
Every agent must obey AGENTS.md and CLAUDE.md. They require:
1. inspect before modifying
2. create a branch for every autonomous change
3. run repository validation
4. never push directly to main
5. never change infrastructure credentials or trust policies as an ordinary code fix
6. open a PR with evidence
7. do not merge or deploy itself
8. treat production as read-only unless an explicitly approved operational workflow is running

## Self-correction loop
1. GitHub Actions detects a failure.
2. A bounded agent job receives only the failing job/log context and repository checkout.
3. Agent reproduces the failure in an isolated workspace.
4. Agent creates a branch and commits the smallest fix.
5. Agent runs static and targeted regression tests.
6. Agent opens or updates a PR.
7. Required CI and human review decide whether the fix is mergeable.
8. Deployment uses the merged immutable commit SHA.
9. Post-deployment verification records evidence.
10. Repeated failures stop the loop and create an issue rather than granting the agent more authority.

The loop is corrective, not self-authorizing.

## Required GitHub controls
- protected main
- required pull request reviews
- required status checks
- protected production deployment environment
- Actions default permissions read-only
- id-token: write only on jobs that assume an AWS role
- third-party production actions pinned to immutable commit SHAs
- Dependabot for action updates
- secret scanning and code scanning
- artifact attestations where applicable

GitHub OIDC trust must restrict the AWS role subject to the exact repository and deployment environment/ref. The deployment role is never available to pull-request code from untrusted forks.

## Current known gap
The current Helix OIDC stack creates one broad deployment role. This source contract does not silently change the live role. The next infrastructure PR must replace it with explicit roles and policies, then prove the trust conditions in a disposable AWS account before touching production.

## Acceptance gates
Both environments must:
- clone the permitted repository using the agent identity
- run tests without production credentials
- create a branch and push a commit
- open a PR
- observe a CI failure and perform one bounded corrective iteration
- fail to access AWS from the agent shell
- deploy only through the GitHub Actions OIDC role
- converge a disposable host through SSM/Ansible
- verify the immutable Helix SHA
- leave production unchanged during disposable tests
