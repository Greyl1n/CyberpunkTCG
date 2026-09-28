#!/usr/bin/env bash
# ==============================================================================
# Cyberpunk TCG - Build Linux Standalone Executable using Container (Podman/Docker)
# ==============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Detect container engine: podman (Fedora default) or docker (Ubuntu/Debian)
if command -v podman &> /dev/null; then
    CONTAINER_ENGINE="podman"
elif command -v docker &> /dev/null; then
    CONTAINER_ENGINE="docker"
else
    echo "[!] Error: Neither 'podman' nor 'docker' was found."
    echo "    To build natively without containers, run: bash scripts/linux/build.sh"
    exit 1
fi

echo "================================================================="
echo "⚡ BUILDING LINUX STANDALONE BINARY VIA ${CONTAINER_ENGINE^^}"
echo "================================================================="

cd "${ROOT_DIR}"
mkdir -p dist

IMAGE_TAG="cyberpunk-tcg-builder"
CONTAINER_NAME="cptcg-temp-extract"

echo "[*] Compiling inside isolated Linux container..."
${CONTAINER_ENGINE} build -t ${IMAGE_TAG} -f "${SCRIPT_DIR}/Dockerfile.builder" .

echo "[*] Extracting standalone binary to dist/Cyberpunk_TCG_Linux..."
${CONTAINER_ENGINE} rm -f ${CONTAINER_NAME} 2>/dev/null || true
${CONTAINER_ENGINE} create --name ${CONTAINER_NAME} ${IMAGE_TAG}
${CONTAINER_ENGINE} cp ${CONTAINER_NAME}:/app/dist/Cyberpunk_TCG_Linux ./dist/Cyberpunk_TCG_Linux
${CONTAINER_ENGINE} rm -f ${CONTAINER_NAME}

chmod +x ./dist/Cyberpunk_TCG_Linux

echo ""
echo "================================================================="
echo "✅ SUCCESS! Linux Standalone Executable extracted to:"
echo "   ${ROOT_DIR}/dist/Cyberpunk_TCG_Linux"
echo ""
echo "Run with:"
echo "   ./dist/Cyberpunk_TCG_Linux"
echo "================================================================="
