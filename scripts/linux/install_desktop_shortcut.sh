#!/usr/bin/env bash
# ==============================================================================
# Cyberpunk TCG - Desktop Menu Shortcut Installer (Fedora & Ubuntu)
# Integrates Cyberpunk_TCG_Linux into your GNOME / KDE / XFCE Applications Menu.
# ==============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
BIN_SRC="${ROOT_DIR}/dist/Cyberpunk_TCG_Linux"

if [ ! -f "${BIN_SRC}" ]; then
    echo "[!] Error: Standalone binary not found at:"
    echo "    ${BIN_SRC}"
    echo "    Please run 'bash scripts/linux/build.sh' or 'bash scripts/linux/build_with_container.sh' first."
    exit 1
fi

# Ensure executable bit
chmod +x "${BIN_SRC}"

# Target user directories
BIN_DEST="${HOME}/.local/bin"
APP_DEST="${HOME}/.local/share/applications"

mkdir -p "${BIN_DEST}"
mkdir -p "${APP_DEST}"

# Symlink or copy binary
echo "[*] Linking executable to ${BIN_DEST}/Cyberpunk_TCG_Linux..."
ln -sf "${BIN_SRC}" "${BIN_DEST}/Cyberpunk_TCG_Linux"

# Install .desktop file
DESKTOP_FILE="${APP_DEST}/cyberpunk-tcg.desktop"
echo "[*] Installing desktop shortcut to ${DESKTOP_FILE}..."
cat > "${DESKTOP_FILE}" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Cyberpunk TCG
GenericName=Trading Card Game Companion
Comment=Official WeirdCo Cyberpunk Trading Card Game Companion & Tournament Deck Builder
Exec=${BIN_DEST}/Cyberpunk_TCG_Linux
Icon=applications-games
Terminal=false
Categories=Game;CardGame;Utility;
Keywords=cyberpunk;tcg;cards;deckbuilder;weirdco;
StartupNotify=true
EOF

chmod +x "${DESKTOP_FILE}"

# Refresh desktop database if tool is present
if command -v update-desktop-database &> /dev/null; then
    update-desktop-database "${APP_DEST}" 2>/dev/null || true
fi

echo ""
echo "================================================================="
echo "✅ Desktop shortcut installed successfully!"
echo "You can now launch 'Cyberpunk TCG' directly from your application launcher,"
echo "or type 'Cyberpunk_TCG_Linux' in your terminal (if ~/.local/bin is in PATH)."
echo "================================================================="
