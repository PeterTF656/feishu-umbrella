# Feishu Private Extension Design

## Goal
Move the custom Feishu menu-key behavior out of vendored `node_modules` code and into the private `feishu-umbrella` repo, while keeping the service operable as a long-running Windows daemon and testable on macOS.

## Scope
- Keep `Claude-to-IM` unchanged for now.
- Keep the `Claude-to-IM-skill` fork delta small and durable.
- Put private Feishu customization, routing config, runner scripts, and tests in `feishu-umbrella/private/`.
- Preserve the existing daemon/supervisor operational model for 24/7 service use.

## Reviewed Constraints
- `Claude-to-IM-skill` currently starts the bridge from [src/main.ts](/Users/zelinpu/Dev/dev-daydream/feishu/feishu-umbrella/Claude-to-IM-skill/src/main.ts), imports the upstream adapter catalog, then calls `bridgeManager.start()`.
- The upstream bridge exposes an adapter registry in [channel-adapter.ts](/Users/zelinpu/Dev/dev-daydream/feishu/feishu-umbrella/Claude-to-IM/src/lib/bridge/channel-adapter.ts), and `registerAdapterFactory()` overwrites by `channelType`.
- The existing daemon scripts rebuild only `Claude-to-IM-skill/dist/daemon.mjs`; they do not know anything about umbrella-owned extension artifacts.
- Production target is Windows, likely as a 24/7 service. macOS is the fast local test machine.

## Recommended Architecture

### 1. Minimal skill-side extension seam
Add a small loader in `Claude-to-IM-skill`:

- `Claude-to-IM-skill/src/private-extension.ts`
- small call site in `Claude-to-IM-skill/src/main.ts`

Behavior:
- read `CTI_PRIVATE_EXTENSION_ENTRY`
- if unset, do nothing
- if set, dynamically import the module before `bridgeManager.start()`
- expect the module to register any adapter overrides or runtime hooks

This keeps the fork delta tiny and avoids private logic inside the skill repo.

### 2. Private extension package in the umbrella repo
Create a self-contained private package:

```text
feishu-umbrella/private/cti-extension/
  package.json
  tsconfig.json
  scripts/build.mjs
  src/index.ts
  src/feishu/register-feishu-override.ts
  src/feishu/private-feishu-adapter.ts
  src/feishu/menu-route-service.ts
  src/feishu/menu-payload.ts
  src/feishu/menu-notifier.ts
  src/config/load-private-settings.ts
  src/__tests__/
```

Responsibility split:
- `src/index.ts`: extension entrypoint
- `register-feishu-override.ts`: overrides the `feishu` adapter factory
- `private-feishu-adapter.ts`: private adapter implementation based on the upstream Feishu adapter
- `menu-route-service.ts`: route parsing, route lookup, event dedup
- `menu-payload.ts`: placeholder expansion and request body building
- `menu-notifier.ts`: pending/result cards and fallback text delivery
- `load-private-settings.ts`: reads umbrella-owned config files and/or env overrides

### 3. Adapter override model
Use the upstream adapter registry instead of monkey-patching:

- let the upstream adapters register normally
- the private extension registers a new factory for channel type `feishu`
- because the registry uses `Map.set`, the later registration wins

This is stable enough for a private overlay and much cleaner than editing `node_modules`.

### 4. Private config model
Avoid split-brain between runtime env and random private files by defining one overlay contract:

- `~/.claude-to-im/config.env` remains the skill runtime base config
- private menu route config lives in the umbrella repo, for example:
  - `feishu-umbrella/private/config/feishu-menu-routes.example.json`
  - `feishu-umbrella/private/config/feishu-menu-routes.local.json`
- the private extension overlays these values into bridge settings before adapter startup

Recommended precedence:
1. explicit env var, e.g. `CTI_PRIVATE_MENU_ROUTE_FILE`
2. umbrella local JSON file
3. optional base `CTI_FEISHU_MENU_ROUTES` from `config.env`

This keeps the existing setup flow usable while allowing private route ownership.

### 5. Umbrella-owned runner
Use private wrapper scripts as the only supported production entrypoint:

```text
feishu-umbrella/private/runtime/
  bridge.sh
  bridge.ps1
  env.sh
  env.ps1
```

The wrapper should:
- set `CTI_HOME`
- set `CTI_PRIVATE_EXTENSION_ENTRY`
- set `CTI_PRIVATE_MENU_ROUTE_FILE`
- build the private extension if stale
- delegate to the existing skill daemon scripts

It should not replace the existing daemon/supervisor logic. It should wrap it.

### 6. Windows production model
Windows remains the primary 24/7 host:

- preferred: existing WinSW/NSSM-based service path from the skill repo
- the umbrella PowerShell runner becomes the supported operational surface
- the service must still run as the current user, because that is how the existing supervisor preserves access to `~/.claude-to-im` and local auth state

The wrapper must preserve:
- `USERPROFILE`
- `APPDATA`
- `LOCALAPPDATA`
- `CTI_HOME`
- any runtime auth vars the existing scripts rely on

### 7. macOS testing model
macOS is used for fast local iteration:

- run private tests directly
- run a local fake webhook server
- start the bridge through the umbrella shell runner
- feed fixture events or mocked adapter calls
- inspect logs and runtime state under a temp `CTI_HOME`

## Service Flow
1. Operator runs umbrella runner
2. Runner builds private extension if needed
3. Runner exports extension/config env vars
4. Runner delegates to skill daemon script
5. `Claude-to-IM-skill` starts, loads base config, initializes bridge context
6. `loadPrivateExtension()` imports umbrella extension
7. Private extension overrides Feishu adapter factory
8. `bridgeManager.start()` creates the private Feishu adapter
9. Adapter handles:
   - `im.message.receive_v1`
   - `application.bot.menu_v6`
10. Menu click flow:
   - parse event
   - dedup by `event_id`
   - resolve route
   - send pending notification
   - POST webhook
   - send result notification

## Testing Loop

### Unit loop
Purpose: validate pure logic quickly.

Test targets:
- route parsing
- wildcard fallback route selection
- placeholder substitution
- default request payload generation
- dedup cache behavior

Run on every change.

### Integration loop
Purpose: validate adapter behavior without real Feishu.

Test targets:
- extension loader imports correctly
- Feishu adapter override registration wins
- menu event dispatch path works
- pending/result notifier behavior
- receiver fallback order
- webhook success and failure handling

Use mocked Feishu REST client and mocked fetch.

### Local smoke loop on macOS
Purpose: validate the whole private stack together.

Setup:
- temp `CTI_HOME`
- umbrella local route config
- local HTTP capture server
- skill daemon started through `private/runtime/bridge.sh`

Checks:
- daemon starts cleanly
- extension logs a startup message
- menu route config is loaded
- test menu event results in an HTTP POST to the local capture server

### Windows smoke loop
Purpose: validate service packaging and live host assumptions.

Checks:
- `private/runtime/bridge.ps1 start`
- `status`
- `logs`
- one known menu-key trigger end-to-end
- restart behavior
- service remains healthy

### Soak loop
Purpose: validate 24/7 stability.

Run on Windows after smoke tests:
- leave service up for hours/overnight
- periodic synthetic menu route trigger
- inspect status/logs for restarts, stale PID issues, or growing failures

## Risks
- A full private copy of the Feishu adapter can drift from upstream.
- A second config source can confuse operators if not documented and layered explicitly.
- If the wrapper is optional instead of mandatory, operators can accidentally start the raw skill daemon without the private extension.

## Required Guardrails
- one supported production entrypoint: umbrella runner only
- one explicit config precedence model
- startup log line confirming private extension loaded
- startup log line confirming menu route config source
- tests for the extension loader and adapter override registration

## Recommended Next Step
Implement the minimal skill-side loader first, then build the private extension package and wrapper scripts around it. That reduces risk before copying any large adapter logic.
