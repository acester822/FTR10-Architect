#!/usr/bin/env bash
#
# install-theme-engine.sh — FAST incremental install for the FTR10 Codex theme engine.
#
# Unlike install-extension.sh (which wipes node_modules, rebuilds crossnote from
# scratch, and packages a fresh VSIX), this script ONLY:
#   1. refreshes crossnote's runtime assets from the CACHED crossnote build
#      (out/dependencies, out/webview) — it does NOT rebuild crossnote itself
#   2. recompiles the theme engine (src/extension.ts + src/extension-web.ts) via esbuild
#   3. packages + installs the extension with vsce
#
# Use this after editing theme/sync code (e.g. src/theme-sync.ts). Use the full
# install-extension.sh only when crossnote itself changes or deps need a refresh.
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

function info()  { printf "\033[1;34m%s\033[0m\n" "$1"; }
function warn()  { printf "\033[1;33m%s\033[0m\n" "$1"; }
function error() { printf "\033[1;31m%s\033[0m\n" "$1" >&2; }

info "=== FAST theme-engine install (cached crossnote) ==="

if [ ! -f "$ROOT_DIR/package.json" ]; then
  error "Invalid extension directory (package.json not found): $ROOT_DIR"
  exit 1
fi

# ── 0) Sanity-check that the cached crossnote build exists ────────────────────
if [ ! -f "$ROOT_DIR/crossnote/out/cjs/index.cjs" ]; then
  error "Cached crossnote build missing: crossnote/out/cjs/index.cjs"
  error "Run the full install-extension.sh once to populate the crossnote build cache."
  exit 1
fi

# ── 1) Refresh crossnote runtime assets from cache (no crossnote rebuild) ──────
info "1) Refreshing crossnote runtime assets from cache (gulp copy-files)..."
if command -v pnpm >/dev/null 2>&1; then
  pnpm exec gulp copy-files
elif command -v npx >/dev/null 2>&1; then
  npx gulp copy-files
else
  warn "gulp not available via pnpm/npx; skipping copy-files (crossnote assets already in place)."
fi

# ── 2) Compile the theme engine only (esbuild, no clean + no crossnote build) ──
info "2) Compiling theme engine (esbuild native + web)..."
node build.js

if [ ! -f "$ROOT_DIR/out/native/extension.js" ] || [ ! -f "$ROOT_DIR/out/web/extension.js" ]; then
  error "Theme-engine build output missing (out/native/extension.js or out/web/extension.js)."
  exit 1
fi

# ── 3) Package with vsce ──────────────────────────────────────────────────────
info "3) Packaging extension to VSIX..."
# Resolve vsce: check PATH first, then fall back to the npm global-prefix bin dir
# (which may not be on PATH in non-interactive shells).
VSCE_CMD=""
if command -v vsce >/dev/null 2>&1; then
  VSCE_CMD="vsce"
else
  NPM_PREFIX="$(npm config get prefix 2>/dev/null || true)"
  if [ -n "$NPM_PREFIX" ] && [ -x "$NPM_PREFIX/bin/vsce" ]; then
    VSCE_CMD="$NPM_PREFIX/bin/vsce"
  fi
fi
if [ -z "$VSCE_CMD" ]; then
  error "vsce / @vscode/vsce not found on PATH or in npm global prefix."
  error "Install it once with: npm install -g @vscode/vsce"
  exit 1
fi

# NOTE: package.json intentionally has NO "files" property — see .vscodeignore.
# Mixing both makes vsce abort. --no-dependencies avoids re-bundling node_modules.
PACKAGE_NAME="$(node -e 'const p=require("./package.json"); console.log(`${p.name}-${p.version}.vsix`)')"
"$VSCE_CMD" package --no-dependencies --out "$PACKAGE_NAME"

# ── 4) Install the packaged extension ─────────────────────────────────────────
info "4) Installing packaged extension..."
if command -v code >/dev/null 2>&1; then
  code --install-extension "$ROOT_DIR/$PACKAGE_NAME" --force
elif command -v code-server >/dev/null 2>&1; then
  code-server --install-extension "$ROOT_DIR/$PACKAGE_NAME" --force
else
  warn "Neither code nor code-server found in PATH. VSIX is ready at $ROOT_DIR/$PACKAGE_NAME"
  exit 0
fi

info ""
info "✅ Installed $PACKAGE_NAME (theme engine only; crossnote reused from cache)."
info "   Reload the window to pick up the new build."
