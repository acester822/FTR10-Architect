#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

function info()  { printf "\033[1;34m%s\033[0m\n" "$*"; }
function warn()  { printf "\033[1;33m%s\033[0m\n" "$*"; }
function error() { printf "\033[1;31m%s\033[0m\n" "$*" >&2; }

info "=== FTR10 Architect — build & install ==="
info "Extension directory: $ROOT_DIR"

cd "$ROOT_DIR"

if [ ! -f package.json ]; then
  error "package.json not found in $ROOT_DIR"
  exit 1
fi

# Derive extension identifier from package.json
EXT_ID="$(node -e 'const p=require("./package.json"); console.log(p.publisher+"."+p.name)')"
PACKAGE_NAME="$(node -e 'const p=require("./package.json"); console.log(`${p.name}-${p.version}.vsix`)')"

# ── Step 1: Build ──
info "1) Building extension…"
node build.js

# ── Step 2: Remove current install (code or code-server) ──
info "2) Removing previously installed $EXT_ID…"
if command -v code >/dev/null 2>&1 && code --list-extensions 2>/dev/null | grep -qxF "$EXT_ID"; then
  code --uninstall-extension "$EXT_ID" || warn "Failed to uninstall from code"
elif command -v code-server >/dev/null 2>&1 && code-server --list-extensions 2>/dev/null | grep -qxF "$EXT_ID"; then
  code-server --uninstall-extension "$EXT_ID" || warn "Failed to uninstall from code-server"
fi

# ── Step 3: Package VSIX ──
info "3) Packaging as $PACKAGE_NAME…"
rm -f "$PACKAGE_NAME"

VSCE_CMD=""
if command -v vsce >/dev/null 2>&1; then
  VSCE_CMD="vsce"
elif command -v npx >/dev/null 2>&1; then
  VSCE_CMD="npx @vscode/vsce"
else
  error "Neither vsce nor npx found. Install @vscode/vsce: npm i -g @vscode/vsce"
  exit 1
fi

$VSCE_CMD package --no-dependencies --out "$PACKAGE_NAME"

if [ ! -f "$PACKAGE_NAME" ]; then
  error "VSIX package not created: $PACKAGE_NAME"
  exit 1
fi

# ── Step 4: Install fresh VSIX ──
info "4) Installing $PACKAGE_NAME…"
if command -v code >/dev/null 2>&1; then
  code --install-extension "$ROOT_DIR/$PACKAGE_NAME" --force
elif command -v code-server >/dev/null 2>&1; then
  code-server --install-extension "$ROOT_DIR/$PACKAGE_NAME" --force
else
  warn "Neither code nor code-server found. VSIX is at: $ROOT_DIR/$PACKAGE_NAME"
fi

info ""
info "✅ $PACKAGE_NAME built and installed."