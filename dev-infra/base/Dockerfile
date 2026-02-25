FROM node:20-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    jq \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -ms /bin/bash devuser
USER devuser
WORKDIR /workspace

CMD ["bash"]
