from pathlib import Path

def test_gateway_contract_is_server_authoritative():
    text = Path("production/gateway-contract.md").read_text()
    assert "ignore any browser-supplied owner identity" in text
    assert "Capabilities are never logged." in text

def test_ephemeral_teardown_never_deletes_persistent_volumes():
    text = Path("production/ephemeral-teardown.sh").read_text()
    assert "Persistent volumes are deliberately not referenced here." in text
    assert "virsh destroy" in text
    assert "virsh undefine" in text

def test_persistent_domain_uses_dedicated_block_device():
    text = Path("production/libvirt/persistent-domain.xml.tmpl").read_text()
    assert "<source dev='${BLOCK_DEVICE}'/>" in text
    assert "host-passthrough" in text
    assert "listen='127.0.0.1'" in text
