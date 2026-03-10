#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
UMBRELLA_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
EXT_PACKAGE_DIR="$UMBRELLA_ROOT/private/cti-extension"
EXT_DIST_ENTRY="$EXT_PACKAGE_DIR/dist/index.js"
CONFIG_SYNC_SCRIPT="$UMBRELLA_ROOT/private/runtime/sync-cti-config.mjs"
SKILL_DAEMON="$UMBRELLA_ROOT/Claude-to-IM-skill/scripts/daemon.sh"
DEFAULT_MENU_ROUTE_FILE="$UMBRELLA_ROOT/private/config/feishu-menu-routes.local.json"

CTI_HOME="${CTI_HOME:-$HOME/.claude-to-im}"
COMMAND="${1:-help}"

resolve_runner_path() {
  local target="$1"
  if [ -z "$target" ]; then
    return 1
  fi

  node -e "const path = require('node:path'); console.log(path.isAbsolute(process.argv[2]) ? process.argv[2] : path.resolve(process.argv[1], process.argv[2]));" "$EXT_PACKAGE_DIR" "$target"
}

ensure_extension_built() {
  local need_build=0

  if [ ! -f "$EXT_DIST_ENTRY" ]; then
    need_build=1
  else
    local newest_src
    newest_src=$(find "$EXT_PACKAGE_DIR/src" -name '*.ts' -newer "$EXT_DIST_ENTRY" 2>/dev/null | head -1)
    if [ -n "$newest_src" ]; then
      need_build=1
    fi
  fi

  if [ "$need_build" = "1" ]; then
    echo "Building private extension..."
    (cd "$EXT_PACKAGE_DIR" && npm run build)
  fi
}

if [ "$COMMAND" = "start" ]; then
  ensure_extension_built
  node "$CONFIG_SYNC_SCRIPT"
fi

export CTI_HOME
export CTI_PRIVATE_EXTENSION_ENTRY="$EXT_DIST_ENTRY"

if [ -n "${CTI_PRIVATE_MENU_ROUTE_FILE:-}" ]; then
  export CTI_PRIVATE_MENU_ROUTE_FILE
  CTI_PRIVATE_MENU_ROUTE_FILE="$(resolve_runner_path "$CTI_PRIVATE_MENU_ROUTE_FILE")"
  export CTI_PRIVATE_MENU_ROUTE_FILE
elif [ -f "$DEFAULT_MENU_ROUTE_FILE" ]; then
  export CTI_PRIVATE_MENU_ROUTE_FILE="$DEFAULT_MENU_ROUTE_FILE"
else
  unset CTI_PRIVATE_MENU_ROUTE_FILE 2>/dev/null || true
fi

exec "$SKILL_DAEMON" "$@"
