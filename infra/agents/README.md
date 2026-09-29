# Secure coding-agent environments

OpenDevin is now OpenHands. The current OpenHands project is Agent Canvas, which can orchestrate OpenHands and external ACP agents such as Claude Code. The standalone OpenHands CLI remains useful for terminal and headless automation.

Production host:
- dedicated non-root helix-agent account
- no sudo
- no Docker socket
- workspace under /var/lib/helix-agent/workspaces
- Claude Code and OpenHands CLI installed outside the system Node package tree
- provider credentials are not baked into the image or playbook

Container:
- non-root UID 1000
- read-only root filesystem
- no-new-privileges
- all Linux capabilities dropped
- only workspace and agent-home volumes
- no host Docker socket
- explicit bridge network

GitHub credential model:
- preferred server-side identity is a GitHub App installed only on required repositories
- minimum repository permissions are Contents, Pull requests, and Issues
- generate installation tokens on demand
- constrain the token to the exact repository where possible
- cache only until shortly before the one-hour expiry
- never persist installation tokens in the repository or image
- GitHub Actions uses GITHUB_TOKEN for same-repository operations
- AWS uses GitHub OIDC, never long-lived AWS keys

Agent write policy:
1. create or update agent/* branch
2. run repository validation
3. push branch
4. open or update PR
5. wait for required checks
6. self-correct failed checks
7. stop at the merge gate

Hard limits:
- bounded agent turns
- bounded CI retries
- changed-file budget
- no secret access from arbitrary prompts
- no production AWS credentials in agent environment
- no dangerous permission bypass flags in CI
- no write-capable execution on untrusted fork content

Self-correction loop:
issue or PR -> agent -> branch -> tests -> CI -> failure evidence -> agent -> patch -> CI -> repeat
