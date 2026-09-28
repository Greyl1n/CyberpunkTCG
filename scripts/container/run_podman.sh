#!/usr/bin/env bash
# ==============================================================================
# Cyberpunk TCG - Run Server with Podman (Recommended for Fedora / RHEL)
# ==============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo "================================================================="
echo "⚡ CYBERPUNK TCG // LAUNCHING SERVER WITH PODMAN"
echo "================================================================="

cd "${ROOT_DIR}"

IMAGE_NAME="cyberpunk-tcg-server"
CONTAINER_NAME="cptcg-web"
PORT="${PORT:-8080}"

# Build image
echo "[*] Building container image..."
podman build -t "${IMAGE_NAME}" -f "${SCRIPT_DIR}/Dockerfile" .

# Stop and remove existing container if running
podman rm -f "${CONTAINER_NAME}" 2>/dev/null || true

# Run container
echo "[*] Starting container on port ${PORT}..."
podman run -d \
  --name "${CONTAINER_NAME}" \
  --restart unless-stopped \
  -p "${PORT}:8080" \
  "${IMAGE_NAME}"

echo ""
echo "================================================================="
echo "🚀 SERVER RUNNING ONLINE!"
echo "   Access in browser: http://localhost:${PORT}/"
echo "   Stop container:    podman stop ${CONTAINER_NAME}"
echo "   View live logs:    podman logs -f ${CONTAINER_NAME}"
echo "================================================================="
