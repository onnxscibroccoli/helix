from pathlib import Path


def test_login_route_exists():
    text = Path("src/routes/login.tsx").read_text()
    assert "signIn" in text
    assert "GROK_PROVIDERS" in text


def test_auth_api_mount():
    assert Path("src/routes/api/auth/$.ts").exists()
