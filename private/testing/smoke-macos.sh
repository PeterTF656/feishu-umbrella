#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
UMBRELLA_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
RUNNER_SCRIPT="$UMBRELLA_ROOT/private/runtime/bridge.sh"
EXT_PACKAGE_DIR="$UMBRELLA_ROOT/private/cti-extension"
FIXTURE_FILE="$SCRIPT_DIR/fixtures/feishu-menu-event.json"
EXTENSION_ADAPTER_MODULE="$EXT_PACKAGE_DIR/dist/feishu/private-feishu-adapter.js"

TEMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/cti-smoke.XXXXXX")"
CTI_HOME="$TEMP_ROOT/cti-home"
CAPTURE_FILE="$TEMP_ROOT/webhook-capture.json"
SERVER_INFO_FILE="$TEMP_ROOT/server-info.json"
ROUTE_FILE="$TEMP_ROOT/feishu-menu-routes.json"
STATUS_OUTPUT="$TEMP_ROOT/status.txt"

SERVER_PID=""
BRIDGE_STARTED=0

cleanup() {
  if [ "$BRIDGE_STARTED" = "1" ]; then
    CTI_HOME="$CTI_HOME" CTI_PRIVATE_MENU_ROUTE_FILE="$ROUTE_FILE" bash "$RUNNER_SCRIPT" stop >/dev/null 2>&1 || true
  fi

  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
    wait "$SERVER_PID" >/dev/null 2>&1 || true
  fi

  rm -rf "$TEMP_ROOT"
}

show_failure_context() {
  echo ""
  echo "Smoke test failed."
  echo ""
  echo "Bridge logs:"
  tail -100 "$CTI_HOME/logs/bridge.log" 2>/dev/null || echo "  (no bridge log)"
  echo ""
  echo "Capture file:"
  cat "$CAPTURE_FILE" 2>/dev/null || echo "  (no capture file)"
}

trap cleanup EXIT
trap 'show_failure_context' ERR

mkdir -p "$CTI_HOME"

cat > "$CTI_HOME/config.env" <<EOF
CTI_RUNTIME=claude
CTI_ENABLED_CHANNELS=
CTI_DEFAULT_WORKDIR=$UMBRELLA_ROOT
EOF

CTI_SMOKE_CAPTURE_FILE="$CAPTURE_FILE" node "$SCRIPT_DIR/fake-webhook-server.mjs" >"$SERVER_INFO_FILE" &
SERVER_PID="$!"

for _ in $(seq 1 30); do
  if [ -s "$SERVER_INFO_FILE" ]; then
    break
  fi
  sleep 1
done

if [ ! -s "$SERVER_INFO_FILE" ]; then
  echo "Fake webhook server did not start"
  exit 1
fi

SERVER_PORT="$(node -e "const fs = require('node:fs'); const info = JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); process.stdout.write(String(info.port));" "$SERVER_INFO_FILE")"

cat > "$ROUTE_FILE" <<EOF
{
  "launch": {
    "url": "http://127.0.0.1:${SERVER_PORT}/menu/launch",
    "method": "POST",
    "body": {
      "event_key": "{{event_key}}",
      "event_id": "{{event_id}}",
      "tenant_key": "{{tenant_key}}",
      "operator_name": "{{operator_name}}"
    }
  }
}
EOF

CTI_HOME="$CTI_HOME" CTI_PRIVATE_MENU_ROUTE_FILE="$ROUTE_FILE" bash "$RUNNER_SCRIPT" stop >/dev/null 2>&1 || true

if CTI_HOME="$CTI_HOME" CTI_PRIVATE_MENU_ROUTE_FILE="$ROUTE_FILE" bash "$RUNNER_SCRIPT" start; then
  BRIDGE_STARTED=1
else
  if ! grep -q "No adapters started successfully, bridge not activated" "$CTI_HOME/logs/bridge.log" 2>/dev/null; then
    echo "Bridge runner failed for an unexpected reason"
    exit 1
  fi
fi

for _ in $(seq 1 30); do
  if grep -q "private settings loaded" "$CTI_HOME/logs/bridge.log" 2>/dev/null; then
    break
  fi
  sleep 1
done

grep -q "private settings loaded" "$CTI_HOME/logs/bridge.log"

CTI_PRIVATE_MENU_ROUTE_FILE="$ROUTE_FILE" \
CTI_SMOKE_EVENT_FIXTURE="$FIXTURE_FILE" \
CTI_SMOKE_EXTENSION_ADAPTER_MODULE="$EXTENSION_ADAPTER_MODULE" \
node --input-type=module <<'NODE'
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const adapterModulePath = process.env.CTI_SMOKE_EXTENSION_ADAPTER_MODULE;
const eventFixture = process.env.CTI_SMOKE_EVENT_FIXTURE;
const routeFile = process.env.CTI_PRIVATE_MENU_ROUTE_FILE;
if (!adapterModulePath || !eventFixture || !routeFile) {
  throw new Error('Smoke injection paths are not fully configured');
}

const { PrivateFeishuAdapter } = await import(pathToFileURL(adapterModulePath).href);
const payload = JSON.parse(fs.readFileSync(routeFile, 'utf8'));
const event = JSON.parse(fs.readFileSync(eventFixture, 'utf8'));

const adapter = new PrivateFeishuAdapter({
  logger: {
    error() {},
    info() {},
    log() {},
    warn() {},
  },
  restClientFactory: () => ({
    im: {
      message: {
        async create() {
          return { data: { message_id: 'smoke-message' } };
        },
      },
    },
  }),
  settingsLoader: () => ({
    source: 'env',
    menuRouteFilePath: routeFile,
    payload,
  }),
});

await adapter.handleMenuEvent(event);
NODE

for _ in $(seq 1 30); do
  if [ -s "$CAPTURE_FILE" ]; then
    break
  fi
  sleep 1
done

if [ ! -s "$CAPTURE_FILE" ]; then
  echo "No webhook capture was recorded"
  exit 1
fi

node -e "const fs = require('node:fs'); const capture = JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); if (!Array.isArray(capture.requests) || capture.requests.length === 0) { throw new Error('Expected at least one webhook request'); } const body = JSON.parse(capture.requests[0].body); if (body.event_key !== 'launch') { throw new Error('Unexpected webhook payload'); }" "$CAPTURE_FILE"

echo "Smoke test passed."
