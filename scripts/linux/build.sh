#!/usr/bin/env bash
# ==============================================================================
# Cyberpunk TCG - Linux Native Build Script (Fedora & Ubuntu)
# ==============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo "================================================================="
echo "⚡ CYBERPUNK TCG // LINUX STANDALONE BUILD SCRIPT"
echo "================================================================="

# Check Python 3
if ! command -v python3 &> /dev/null; then
    echo "[!] Error: python3 is not installed."
    echo "    On Fedora: sudo dnf install python3 python3-pip"
    echo "    On Ubuntu: sudo apt update && sudo apt install -y python3 python3-pip"
    exit 1
fi

echo "[*] Python 3 detected: $(python3 --version)"

# Check or install required build packages (pyinstaller & pywebview)
echo "[*] Checking Python dependencies..."
python3 -c "import PyInstaller" 2>/dev/null || {
    echo "[*] Installing PyInstaller..."
    pip3 install --user pyinstaller || pip install pyinstaller
}

python3 -c "import webview" 2>/dev/null || {
    echo "[*] Installing pywebview..."
    pip3 install --user pywebview || pip install pywebview
}

# Run standalone builder
cd "${ROOT_DIR}"
python3 "${SCRIPT_DIR}/build_standalone.py"

echo ""
echo "================================================================="
echo "🚀 BUILD COMPLETE!"
echo "To run your app, execute:"
echo "    ./dist/Cyberpunk_TCG_Linux"
echo ""
echo "To install a desktop icon/launcher menu shortcut, run:"
echo "    bash scripts/linux/install_desktop_shortcut.sh"
echo "================================================================="
