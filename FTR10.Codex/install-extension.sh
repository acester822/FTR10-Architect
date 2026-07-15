#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXT_DIR="$ROOT_DIR"

function info() {
  printf "\033[1;34m%s\033[0m\n" "$1"
}

function warn() {
  printf "\033[1;33m%s\033[0m\n" "$1"
}

function error() {
  printf "\033[1;31m%s\033[0m\n" "$1" >&2
}

info "\n=== Install extension helper ==="

info "Extension directory: $EXT_DIR"

if [ ! -f "$EXT_DIR/package.json" ]; then
  error "Extension directory is invalid (package.json not found): $EXT_DIR"
  exit 1
fi
# Remove previous installs of both old and new package IDs so installation is clean.
UNINSTALL_EXTS=(
  "acester822.markdown-preview-aces-edition"
  "acester822.ftr10-codex"
)
if command -v code >/dev/null 2>&1; then
  for ext in "${UNINSTALL_EXTS[@]}"; do
    if code --list-extensions | grep -qx "$ext"; then
      info "Existing extension $ext found in code, uninstalling first..."
      code --uninstall-extension "$ext" || warn "Failed to uninstall $ext from code"
    fi
  done
elif command -v code-server >/dev/null 2>&1; then
  for ext in "${UNINSTALL_EXTS[@]}"; do
    if code-server --list-extensions | grep -qx "$ext"; then
      info "Existing extension $ext found in code-server, uninstalling first..."
      code-server --uninstall-extension "$ext" || warn "Failed to uninstall $ext from code-server"
    fi
  done
fi
cd "$EXT_DIR"

# Require local modified crossnote in this repo. Never fall back to registry.
LOCAL_CROSSNOTE="$ROOT_DIR/crossnote"
if [ ! -d "$LOCAL_CROSSNOTE" ]; then
  if command -v git >/dev/null 2>&1 \
    && git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1 \
    && git -C "$ROOT_DIR" cat-file -e HEAD:crossnote/package.json 2>/dev/null; then
    warn "Local crossnote directory missing. Restoring ./crossnote from git HEAD..."
    git -C "$ROOT_DIR" restore --worktree --source=HEAD crossnote || {
      error "Failed to restore ./crossnote from git."
      exit 1
    }
  fi

  if [ ! -d "$LOCAL_CROSSNOTE" ]; then
    error "Local crossnote directory not found: $LOCAL_CROSSNOTE"
    error "This repository expects crossnote to be present at ./crossnote from the same git sync."
    exit 1
  fi
fi

if command -v pnpm >/dev/null 2>&1; then
  info "Using local crossnote source at $LOCAL_CROSSNOTE; no package linking required."
else
  warn "pnpm not found; install will continue but crossnote module will be built from the local source tree."
fi

# node >=18 required by package.json engines. Node 25 may lead to flaky old deps.
NODE_VERSION=$(node -v 2>/dev/null || echo "")
if [[ "$NODE_VERSION" =~ ^v([0-9]+) ]]; then
  NODE_MAJOR=${BASH_REMATCH[1]}
  if (( NODE_MAJOR < 18 || NODE_MAJOR > 24 )); then
    warn "Detected Node version $NODE_VERSION. Recommended: 18..24. Using other versions may cause build issues."
  fi
else
  warn "Could not detect Node version. Ensure Node 18/20/22 is in use."
fi

info "1) Cleanup and dependency install"
rm -rf node_modules
rm -f pnpm-lock.yaml yarn.lock package-lock.json

# Prefer pnpm
if command -v pnpm >/dev/null 2>&1; then
  info "Running pnpm install..."
  pnpm install --frozen-lockfile || pnpm install
else
  warn "pnpm not found. Trying npm install fallback."
  if command -v npm >/dev/null 2>&1; then
    npm install
  elif command -v yarn >/dev/null 2>&1; then
    warn "Using yarn fallback. Expect possible fsevents warnings; if build fails, switch to pnpm."
    yarn install --force
  else
    error "No package manager found (pnpm/npm/yarn). Install one first."
    exit 1
  fi
fi

info "1.5) Build local crossnote dependency"
if [ ! -f "$LOCAL_CROSSNOTE/package.json" ]; then
  error "crossnote/package.json is missing after install; cannot continue."
  exit 1
fi

if command -v pnpm >/dev/null 2>&1; then
  pnpm --dir "$LOCAL_CROSSNOTE" install --frozen-lockfile --ignore-scripts || pnpm --dir "$LOCAL_CROSSNOTE" install --ignore-scripts
  pnpm --dir "$LOCAL_CROSSNOTE" run build
elif command -v npm >/dev/null 2>&1; then
  npm --prefix "$LOCAL_CROSSNOTE" install --ignore-scripts
  npm --prefix "$LOCAL_CROSSNOTE" run build
elif command -v yarn >/dev/null 2>&1; then
  yarn --cwd "$LOCAL_CROSSNOTE" install --force --ignore-scripts
  yarn --cwd "$LOCAL_CROSSNOTE" build
else
  error "No package manager found to build local crossnote."
  exit 1
fi

if [ ! -f "$LOCAL_CROSSNOTE/out/cjs/index.cjs" ]; then
  error "crossnote build output missing: $LOCAL_CROSSNOTE/out/cjs/index.cjs"
  exit 1
fi

info "2) Build extension"
if command -v pnpm >/dev/null 2>&1; then
  pnpm run build
else
  npm run build
fi

info "3) Package extension to VSIX"
if command -v vsce >/dev/null 2>&1; then
  VSCE_CMD="vsce"
elif command -v npm >/dev/null 2>&1; then
  npm install -g @vscode/vsce
  if command -v vsce >/dev/null 2>&1; then
    VSCE_CMD="vsce"
  else
    error "Installed @vscode/vsce but 'vsce' command is still not available in PATH."
    exit 1
  fi
else
  error "Unable to find vsce/@vscode/vsce and npm. Install one of them to package extension."
  exit 1
fi

PACKAGE_NAME="$(node -e 'const p=require("./package.json"); console.log(`${p.name}-${p.version}.vsix`)')"

$VSCE_CMD package --no-dependencies --out "$PACKAGE_NAME"

info "4) Install packaged extension"
if command -v code >/dev/null 2>&1; then
  code --install-extension "$EXT_DIR/$PACKAGE_NAME" --force
elif command -v code-server >/dev/null 2>&1; then
  code-server --install-extension "$EXT_DIR/$PACKAGE_NAME" --force
else
  warn "Neither code nor code-server found in PATH. Package is available at $EXT_DIR/$PACKAGE_NAME"
  warn "Manually install with: code --install-extension '$EXT_DIR/$PACKAGE_NAME'"
  exit 0
fi

info "\n✅ Installed $PACKAGE_NAME successfully."
info "To run in dev mode (for debugging):"
info "  code --extensionDevelopmentPath=$EXT_DIR"

