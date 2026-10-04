"""Regression for Actions run 37175532507.

Unquoted ``AUTHORIZATION: bearer ...`` is invalid workflow YAML: Actions
reports a syntax error on that line and starts zero jobs.
"""

from pathlib import Path

import yaml


def test_agent_container_extraheader_is_a_scalar():
    workflow_path = (
        Path(__file__).resolve().parents[2]
        / ".github/workflows/agent-container-validation.yml"
    )
    workflow = yaml.safe_load(workflow_path.read_text())
    env = workflow["jobs"]["build"]["steps"][0]["env"]
    value = env["GIT_CONFIG_VALUE_0"]
    assert isinstance(value, str), value
    assert value.startswith("AUTHORIZATION: bearer ")
    assert env["GIT_CONFIG_KEY_0"] == "http.https://github.com/.extraheader"
