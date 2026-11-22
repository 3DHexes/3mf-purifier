#!/bin/sh
# Removes what install.sh added. Settings in ~/.local/share/3mf-purifier stay.
rm -f "$HOME/.local/bin/3mf-purifier" "$HOME/.local/share/applications/3mf-purifier.desktop" \
      "$HOME/.local/share/icons/hicolor/512x512/apps/3mf-purifier.png"
command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$HOME/.local/share/applications" >/dev/null 2>&1 || true
echo "3MF Purifier removed."
