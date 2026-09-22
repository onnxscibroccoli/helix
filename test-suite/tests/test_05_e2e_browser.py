from pathlib import Path


def test_kasm_websocket_client_present():
    text = Path("src/components/kasm/stream-viewer.tsx").read_text()
    assert "/kasm/ws/" in text
    assert "RFB" in text
