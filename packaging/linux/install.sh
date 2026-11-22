#!/bin/sh
# Installs 3MF Purifier for the current user: ~/.local/bin + app menu entry. No sudo needed.
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
BIN="$HOME/.local/bin"
APPS="$HOME/.local/share/applications"
ICONS="$HOME/.local/share/icons/hicolor/512x512/apps"
mkdir -p "$BIN" "$APPS" "$ICONS"
install -m 755 "$DIR/3mf-purifier" "$BIN/3mf-purifier"
install -m 644 "$DIR/3mf-purifier.png" "$ICONS/3mf-purifier.png"
cat > "$APPS/3mf-purifier.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=3MF Purifier
Comment=Remove slicer settings from 3MF files
Comment[pl]=Usuwa ustawienia slicera z plików 3MF
Exec="$BIN/3mf-purifier" %F
Icon=3mf-purifier
Terminal=false
Categories=Graphics;3DGraphics;Utility;
MimeType=model/3mf;application/vnd.ms-package.3dmanufacturing-3dmodel+xml;
StartupWMClass=3mf-purifier
EOF
command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$APPS" >/dev/null 2>&1 || true
command -v gtk-update-icon-cache >/dev/null 2>&1 && gtk-update-icon-cache -q "$HOME/.local/share/icons/hicolor" >/dev/null 2>&1 || true
if ! ldconfig -p 2>/dev/null | grep -q 'libwebkit2gtk-4\.[01]'; then
  echo "Note: WebKitGTK was not found. Install libwebkit2gtk-4.1-0 (Ubuntu/Debian), webkit2gtk4.1 (Fedora) or webkit2gtk-4.1 (Arch)."
fi
echo "3MF Purifier installed. Look for it in the app menu or run: $BIN/3mf-purifier"
