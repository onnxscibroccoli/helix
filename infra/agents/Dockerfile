FROM node:22-bookworm-slim@sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c

ARG OPENHANDS_VERSION=1.16.0
ENV DEBIAN_FRONTEND=noninteractive
ENV HOME=/home/agent
ENV PATH=/home/agent/.local/bin:/home/agent/.local/share/uv/tools/openhands/bin:/usr/local/bin:/usr/bin:/bin

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl git gh python3 python3-venv build-essential passwd \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --create-home --home-dir /home/agent --shell /bin/bash agent \
 && npm install --global --omit=dev @anthropic-ai/claude-code \
 && su - agent -s /bin/bash -c 'curl -LsSf https://astral.sh/uv/install.sh | sh' \
 && /home/agent/.local/bin/uv tool install --python 3.12 openhands==${OPENHANDS_VERSION} \
 && chown -R agent:agent /home/agent

USER agent
WORKDIR /workspace
ENTRYPOINT ["/bin/bash"]
