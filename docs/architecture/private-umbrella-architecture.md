# Private Umbrella Architecture

## Purpose

`feishu-umbrella` is the private parent repository that owns your Feishu-specific integration layer, runtime wrappers, private config, testing harnesses, and operating docs.

The two child repos stay underneath it as git submodules:

- `Claude-to-IM/`: upstream bridge library
- `Claude-to-IM-skill/`: upstream daemon/skill application that wires the bridge to Claude Code or Codex

The practical rule is:

- keep private business logic in `feishu-umbrella/private/`
- keep top-level operator docs in `feishu-umbrella/docs/`
- treat the submodules as dependencies unless there is a deliberate upstream-facing change

## Repository Layout

```text
feishu-umbrella/
  Claude-to-IM/                    # bridge library submodule
  Claude-to-IM-skill/              # daemon / skill submodule
  docs/
    plans/                         # design + implementation plans
    architecture/                  # umbrella architecture docs
  private/
    config/                        # local/private route + runtime env files
    cti-extension/                 # umbrella-owned TypeScript overlay package
    runtime/                       # supported start/stop/status/logs wrappers
    testing/                       # local smoke harnesses and fixtures
    ops/                           # pre-live and Windows runbooks
```

## Ownership Boundaries

### `Claude-to-IM`

`Claude-to-IM` remains the bridge core. It owns adapter registration, bridge lifecycle, inbound routing, delivery, permission flows, markdown rendering, and host DI contracts.

Relevant role:

- `src/lib/bridge/channel-adapter.ts`: adapter registry
- `src/lib/bridge/bridge-manager.ts`: adapter start/stop orchestration
- `src/lib/bridge/adapters/feishu-adapter.ts`: upstream Feishu adapter base

This repo is not where you should put private Feishu menu logic.

### `Claude-to-IM-skill`

`Claude-to-IM-skill` remains the runnable daemon and operator-facing skill. It owns:

- config loading into `CTI_HOME`
- JSON-file store
- Claude/Codex provider wiring
- daemon scripts
- long-running lifecycle, PID, status, and heartbeat behavior

Only a minimal private-extension seam was added here so the umbrella repo can plug in private logic without forking large chunks of upstream code.

### `private/`

`private/` is the actual customization layer. It owns:

- private menu-route config
- private extension code
- wrapper entrypoints
- smoke-test harnesses
- ops runbooks

This is the default location for future Feishu-specific behavior.

## What Was Added

The umbrella architecture introduced five concrete layers.

### 1. Skill-side extension seam

Files:

- `Claude-to-IM-skill/src/private-extension.ts`
- `Claude-to-IM-skill/src/main.ts`

What it does:

- reads `CTI_PRIVATE_EXTENSION_ENTRY`
- resolves the entry to a module specifier
- installs a small host API on `globalThis` using `Symbol.for('claude-to-im.private-extension-api')`
- dynamically imports the umbrella extension before `bridgeManager.start()`

Why it exists:

- keeps the child repo delta small
- avoids private logic inside the skill repo
- gives the umbrella extension a stable way to register adapter overrides

### 2. Umbrella-owned extension package

Files:

- `private/cti-extension/src/index.ts`
- `private/cti-extension/src/config/load-private-settings.ts`
- `private/cti-extension/src/feishu/index.ts`
- `private/cti-extension/src/feishu/adapter/register-feishu-override.ts`
- `private/cti-extension/src/feishu/adapter/private-feishu-adapter.ts`
- `private/cti-extension/src/feishu/contact/contact-user-service.ts`
- `private/cti-extension/src/feishu/routing/menu-route-config.ts`
- `private/cti-extension/src/feishu/routing/menu-route-service.ts`
- `private/cti-extension/src/feishu/webhooks/menu-payload.ts`
- `private/cti-extension/src/feishu/cards/notifier/menu-notifier.ts`
- `private/cti-extension/src/feishu/cards/content/pending-card.ts`
- `private/cti-extension/src/feishu/cards/content/result-card.ts`
- `private/cti-extension/src/feishu/cards/content/fallback-text.ts`
- `private/cti-extension/src/feishu/domain/contact-user.ts`
- `private/cti-extension/src/feishu/domain/menu-event.ts`
- `private/cti-extension/src/feishu/shared/receivers.ts`
- `private/cti-extension/src/feishu/shared/observability.ts`

What it does:

- loads private menu-route settings
- logs which config source was selected
- registers a `feishu` adapter factory override
- handles Feishu menu events
- resolves routes, deduplicates events, performs lazy Contact enrichment when a route requests it, performs webhook POSTs
- sends Feishu pending/result cards back to the operator

### 3. Supported runtime wrappers

Files:

- `private/runtime/bridge.sh`
- `private/runtime/bridge.ps1`
- `private/runtime/sync-cti-config.mjs`

What they do:

- optionally sync `private/config/runtime.env.local` into `CTI_HOME/config.env`
- build `private/cti-extension` if its bundle is stale or missing
- set `CTI_PRIVATE_EXTENSION_ENTRY`
- set `CTI_PRIVATE_MENU_ROUTE_FILE`
- delegate to `Claude-to-IM-skill/scripts/daemon.sh` or `daemon.ps1`

These wrappers are the supported operational surface. The raw skill daemon scripts are intentionally not the production entrypoint anymore.

### 4. Umbrella-owned config

Files:

- `private/config/runtime.env.example`
- `private/config/runtime.env.local`
- `private/config/feishu-menu-routes.example.json`
- `private/config/feishu-menu-routes.local.json`

What they do:

- keep private runtime credentials and route mapping in the umbrella repo
- separate local private data from the submodules
- make menu routing editable without editing any package code

### 5. Test and ops support

Files:

- `private/testing/smoke-macos.sh`
- `private/testing/fake-webhook-server.mjs`
- `private/testing/fixtures/feishu-menu-event.json`
- `private/ops/prelive-checklist.md`
- `private/ops/windows-service-runbook.md`

What they do:

- provide fast local smoke validation on macOS
- document the Windows long-running service model
- define a repeatable pre-live and soak-test loop

## Reference Map

This is the important "what references what" chain.

### Startup and loading chain

1. `private/runtime/bridge.sh` or `private/runtime/bridge.ps1`
   - references `private/runtime/sync-cti-config.mjs`
   - references `private/cti-extension/dist/index.js`
   - references `Claude-to-IM-skill/scripts/daemon.sh` or `daemon.ps1`
2. `Claude-to-IM-skill/src/main.ts`
   - references `loadPrivateExtension()` from `Claude-to-IM-skill/src/private-extension.ts`
   - calls it before `bridgeManager.start()`
3. `Claude-to-IM-skill/src/private-extension.ts`
   - references `registerAdapterFactory` from `claude-to-im`
   - publishes it through a global symbol-based host API
   - imports the umbrella extension from `CTI_PRIVATE_EXTENSION_ENTRY`
4. `private/cti-extension/src/index.ts`
   - references `loadPrivateSettings()`
   - references `registerFeishuOverride()`
   - loads config and registers the override as a side effect
5. `private/cti-extension/src/feishu/adapter/register-feishu-override.ts`
   - first tries the host API exposed by `private-extension.ts`
   - falls back to the built `claude-to-im` registry import if needed
   - registers the `PrivateFeishuAdapter`
6. `private/cti-extension/src/feishu/adapter/private-feishu-adapter.ts`
   - extends the upstream `FeishuAdapter`
   - imports the Feishu SDK from the sibling skill install
   - orchestrates routing, optional Contact lookup, webhook payload building, and Feishu notifier delivery
7. `private/cti-extension/src/feishu/contact/contact-user-service.ts`
   - owns Feishu Contact lookup by `open_id` for routes that opt into enrichment
8. `private/cti-extension/src/feishu/cards/notifier/menu-notifier.ts`
   - delivers cards to Feishu while keeping card content in `cards/content/`
9. `private/cti-extension/src/feishu/routing/menu-route-service.ts`
   - owns route resolution and dedup while `menu-route-config.ts` owns config parsing

### Menu-event chain

1. Feishu sends `application.bot.menu_v6`
2. `PrivateFeishuAdapter.start()` registers both:
   - `im.message.receive_v1`
   - `application.bot.menu_v6`
3. The single `WSClient` delivers the menu event to `handleMenuEvent()`
4. `MenuRouteService`
   - deduplicates by `event_id`
   - resolves the exact `event_key`
   - falls back to `*` if no exact route exists
5. If the resolved route declares `userEnrichment: "contact_by_open_id"`
   - `ContactUserService` fetches richer user info by event `open_id`
   - lookup failure does not block the route
6. `MenuNotifier.sendPending()`
   - sends an immediate "in progress" Feishu card
7. `buildMenuRequestBody()`
   - expands placeholders like `{{event_key}}`, `{{event_id}}`, operator fields, and optional Contact user fields
8. The adapter performs the webhook request
9. `MenuNotifier.sendResult()`
   - sends a second Feishu card with success/failure status and response preview

## Runtime Flow

### Service start flow

```text
Operator
  -> private/runtime/bridge.(sh|ps1)
  -> build private extension if needed
  -> sync runtime.env.local into CTI_HOME/config.env if present
  -> export CTI_PRIVATE_EXTENSION_ENTRY
  -> export CTI_PRIVATE_MENU_ROUTE_FILE
  -> Claude-to-IM-skill daemon script
  -> Claude-to-IM-skill/src/main.ts
  -> loadPrivateExtension()
  -> private/cti-extension/src/index.ts
  -> registerFeishuOverride()
  -> bridgeManager.start()
  -> PrivateFeishuAdapter.start()
```

### Menu click flow

```text
Feishu menu click
  -> application.bot.menu_v6
  -> PrivateFeishuAdapter.handleMenuEvent()
  -> MenuRouteService.resolve(event_key)
  -> ContactUserService.getByOpenId(open_id) when route.userEnrichment requires it
  -> send pending card
  -> POST configured webhook
  -> send result card
```

## Why The Private Adapter Extends The Upstream Adapter

The private Feishu adapter uses inheritance instead of composition because composition led to two websocket clients being started. That caused menu events to land on the wrong client and get dropped.

The current design keeps one websocket client and one dispatcher, while still reusing upstream Feishu adapter behavior where it is already correct.

That is the key reason the menu path now works reliably.

## Menu Routing Model

The route JSON is a top-level object keyed by `event_key`.

Example shape:

```json
{
  "launch": {
    "url": "http://127.0.0.1:8787/menu/launch",
    "method": "POST"
  },
  "testing-menu-key": {
    "url": "http://127.0.0.1:8787/menu/testing-menu-key",
    "method": "POST",
    "userEnrichment": "contact_by_open_id"
  },
  "*": "http://127.0.0.1:8787/menu/fallback"
}
```

Resolution order:

1. exact `event_key`
2. wildcard `*`
3. no route -> ignore event

Optional per-route policy:

- `userEnrichment: "contact_by_open_id"` means the adapter should perform a Feishu Contact user lookup by event `open_id` before building the webhook payload
- if that lookup fails, menu handling still continues with the direct event fields only

### Current explicit testing route

`private/config/feishu-menu-routes.local.json` now contains an explicit route for:

- `testing-menu-key`

This keeps the current live testing key visible in logs and no longer relies on wildcard fallback.

### Adding future testing menu keys

For each new Feishu testing menu item:

1. add a new top-level key in `private/config/feishu-menu-routes.local.json`
2. point it to either:
   - a safe public capture endpoint for live testing
   - or a local harness endpoint for smoke tests
3. add `userEnrichment: "contact_by_open_id"` only when that key actually needs richer profile data
4. keep `*` in place as a guardrail for unknown keys
5. restart through `private/runtime/bridge.(sh|ps1)` if the service is already running

This is the intended customization mechanism. Do not hardcode new testing keys into the adapter.

## Config Precedence

Menu route config is loaded in this precedence order:

1. `CTI_PRIVATE_MENU_ROUTE_FILE`
2. default local JSON: `private/config/feishu-menu-routes.local.json`
3. base env fallback: `CTI_FEISHU_MENU_ROUTES`

This logic lives in:

- `private/cti-extension/src/config/load-private-settings.ts`

The runtime wrapper usually sets `CTI_PRIVATE_MENU_ROUTE_FILE` to the umbrella local JSON automatically if that file exists.

## Observability

When `CTI_FEISHU_MENU_DEBUG=1` is set, the private adapter emits explicit trace logs for:

- dispatcher registration
- menu event receipt
- route resolution
- Contact user lookup
- webhook start and completion
- pending card delivery
- result card delivery

This is the main debugging switch for future menu-key investigations.

## Testing Loop

### Unit and focused integration

Run under `private/cti-extension/`:

```bash
node --test --import tsx src/__tests__/*.test.ts
npm run build
```

This covers route parsing, config precedence, payload expansion, adapter behavior, and runner env assumptions.

### Local smoke loop on macOS

Use:

```bash
bash private/testing/smoke-macos.sh
```

This validates:

- wrapper startup
- private extension loading
- route file loading
- webhook emission

without depending on live Feishu delivery.

### Live operator loop

Use:

```bash
bash private/runtime/bridge.sh start
bash private/runtime/bridge.sh logs 100
```

or on Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\private\runtime\bridge.ps1 start
powershell -ExecutionPolicy Bypass -File .\private\runtime\bridge.ps1 logs 100
```

Then press the Feishu menu key and confirm:

- pending card arrives immediately
- webhook request is logged
- result card arrives after the webhook completes

### Windows 24/7 service loop

Use the wrapper described in `private/ops/windows-service-runbook.md` and validate with `private/ops/prelive-checklist.md`.

That is the production path for long-running service operation and heartbeats.

## Practical Rules For Future Work

- default to editing `private/` and `docs/`
- use `private/runtime/bridge.(sh|ps1)` for all real service operations
- add new testing menu keys in route JSON, not in adapter code
- add per-key user enrichment policy in route JSON, not in adapter code
- keep child repo deltas minimal and intentional
- if a future change only affects private Feishu behavior, it probably belongs in `private/cti-extension/`
