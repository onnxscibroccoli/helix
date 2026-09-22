from pathlib import Path


def test_teardown_script_in_cloud_init():
    text = Path("infra/terraform/cloud-init.yaml").read_text()
    assert "virsh undefine" in text
    assert "tap-" in text
