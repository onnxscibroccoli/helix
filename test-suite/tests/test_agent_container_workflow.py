"""Regression for helix Actions run 37881622440.

GitHub rejected .github/workflows/agent-container-validation.yml before any
job started: line 30 was an unquoted mapping value containing a colon
(`AUTHORIZATION: bearer ...`). The invariant is that the workflow parses and
that GIT_CONFIG_VALUE_0 remains a single string.
"""

from pathlib import Path

import yaml


WORKFLOW = (
    Path(__file__).resolve().parents[2]
    / ".github"
    / "workflows"
    / "agent-container-validation.yml"
)


def test_agent_container_workflow_quotes_git_extraheader():
    document = yaml.safe_load(WORKFLOW.read_text())
    env = document["jobs"]["build"]["steps"][0]["env"]
    value = env["GIT_CONFIG_VALUE_0"]
    assert isinstance(value, str)
    assert value.startswith("AUTHORIZATION: bearer ")
    assert "github.token" in value
