# Claude Code Repository Policy

Read AGENTS.md and docs/AGENT_OPERATING_POLICY.md before making changes.

Claude Code may inspect, test, branch, commit, push, and open or update pull requests. It must not merge its own PR, modify production credentials, bypass required checks, or directly deploy infrastructure.

Use the smallest safe change. Preserve immutable source references and existing security boundaries. Before changing AWS, IAM, SSM, or CDK trust code, inspect current contracts and add or update tests.

For remediation, report: observed failure, root cause, changed files, tests run, and remaining uncertainty.
