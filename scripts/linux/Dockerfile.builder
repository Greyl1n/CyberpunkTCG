# ==============================================================================
# Cyberpunk TCG - Hermetic Linux Executable Builder
# Based on Ubuntu 22.04 LTS for universal glibc compatibility across:
# - Ubuntu 22.04 / 24.04+
# - Fedora 38 / 39 / 40 / 41+
# - Debian 12+
# - Arch Linux, openSUSE, RHEL 9
# ==============================================================================
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install build dependencies and Python environment
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-dev \
    build-essential \
    libwebkit2gtk-4.0-37 \
    libwebkit2gtk-4.0-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install PyInstaller and desktop webview dependencies
RUN pip3 install --no-cache-dir pyinstaller pywebview

WORKDIR /app

# Copy project repository
COPY . /app

# Compile monolith and package standalone Linux executable
RUN python3 scripts/linux/build_standalone.py

CMD ["ls", "-lh", "/app/dist/Cyberpunk_TCG_Linux"]
