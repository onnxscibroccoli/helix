import os
import pytest


@pytest.fixture
def skip_live():
    return os.environ.get("HELIX_SKIP_LIVE") == "1"
