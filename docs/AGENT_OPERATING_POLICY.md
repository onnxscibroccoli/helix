# Agent Operating Policy

This policy supplements the existing repository AGENTS.md.

- Work from a branch. Never push directly to main.
- Treat production hosts and production data as read-only unless an operational task explicitly authorizes a change.
- Never request, print, store, or commit AWS access keys, GitHub PATs, database passwords, session cookies, bridge tokens, or model API keys.
- Infrastructure changes require source review, CI, and an explicit deployment workflow.
- Prefer GitHub App installation tokens for automation and GitHub OIDC for AWS.
- Keep agent authority narrower than deployment authority.
- Every autonomous change must include tests and an evidence summary in its PR.
- If a repair fails twice, stop changing the system and record the failure with diagnostics.
