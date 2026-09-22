import os
import pytest


@pytest.mark.skipif(os.environ.get("HELIX_SKIP_LIVE") == "1", reason="no guest SSH in CI")
def test_kernel_swap_and_persistence():
    pytest.skip("Requires a running persistent guest with SSH.")
