import os
from pathlib import Path

import pytest


def test_nested_kvm_declared_in_cloud_init():
    text = Path("infra/terraform/cloud-init.yaml").read_text()
    assert "nested=1" in text
    assert "qemu-kvm" in text


def test_terraform_declares_flex_shape():
    text = Path("infra/terraform/main.tf").read_text()
    assert "VM.Standard3.Flex" in text
    assert "oci_core_volume" in text


@pytest.mark.skipif(os.environ.get("HELIX_SKIP_LIVE") == "1", reason="no live hypervisor in CI")
def test_devkvm_present():
    assert Path("/dev/kvm").exists()
