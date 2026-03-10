# Feishu Private Extension Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a private Feishu extension architecture in `feishu-umbrella` that replaces vendored menu-key patches with a durable umbrella-owned extension and runner.

**Architecture:** Add a tiny extension loader seam to `Claude-to-IM-skill`, then implement a private extension package and umbrella-owned runner scripts that override the Feishu adapter through the upstream adapter registry. Keep the existing daemon/supervisor lifecycle, but wrap it with private env injection, private config overlay, and a repeatable test loop for macOS and Windows.

**Tech Stack:** TypeScript, Node.js, esbuild/tsx, git submodules, PowerShell, bash, existing `claude-to-im` bridge registry

---

### Task 1: Add the skill-side private extension loader seam

**Files:**
- Create: `feishu-umbrella/Claude-to-IM-skill/src/private-extension.ts`
- Modify: `feishu-umbrella/Claude-to-IM-skill/src/main.ts`
- Test: `feishu-umbrella/Claude-to-IM-skill/src/__tests__/private-extension.test.ts`

**Step 1: Write the failing loader tests**

Create tests that verify:
- no env var -> loader is a no-op
- env var set -> module is imported once
- missing module -> clear startup error

Use a helper API like:

```ts
export async function loadPrivateExtension(entry = process.env.CTI_PRIVATE_EXTENSION_ENTRY): Promise<void> {
  // implementation
}
```

**Step 2: Run the new test file to verify it fails**

Run:
```bash
cd /Users/zelinpu/Dev/dev-daydream/feishu/feishu-umbrella/Claude-to-IM-skill
CTI_HOME=$(mktemp -d) node --test --import tsx --test-timeout=15000 src/__tests__/private-extension.test.ts
```

Expected: FAIL because the loader module does not exist yet.

**Step 3: Implement the minimal loader**

Implement:
- env-driven dynamic import
- idempotent load guard
- readable error message

Call it from `main.ts` after bridge context setup and before `bridgeManager.start()`.

**Step 4: Run the loader test to verify it passes**

Run:
```bash
cd /Users/zelinpu/Dev/dev-daydream/feishu/feishu-umbrella/Claude-to-IM-skill
CTI_HOME=$(mktemp -d) node --test --import tsx --test-timeout=15000 src/__tests__/private-extension.test.ts
```

Expected: PASS.

**Step 5: Run the full skill test suite**

Run:
```bash
cd /Users/zelinpu/Dev/dev-daydream/feishu/feishu-umbrella/Claude-to-IM-skill
npm test
```

Expected: all tests pass.

**Step 6: Commit**

```bash
cd /Users/zelinpu/Dev/dev-daydream/feishu/feishu-umbrella/Claude-to-IM-skill
git add src/main.ts src/private-extension.ts src/__tests__/private-extension.test.ts
git commit -m "feat: add private extension loader seam"
```

### Task 2: Create the private extension package skeleton

**Files:**
- Create: `feishu-umbrella/private/cti-extension/package.json`
- Create: `feishu-umbrella/private/cti-extension/tsconfig.json`
- Create: `feishu-umbrella/private/cti-extension/scripts/build.mjs`
- Create: `feishu-umbrella/private/cti-extension/src/index.ts`
- Create: `feishu-umbrella/private/cti-extension/src/config/load-private-settings.ts`
- Create: `feishu-umbrella/private/cti-extension/src/__tests__/load-private-settings.test.ts`

**Step 1: Write failing tests for private settings loading**

Cover:
- env path override wins
- default local JSON path works
- missing local JSON is tolerated
- invalid JSON fails clearly

**Step 2: Run the test to confirm failure**

Run:
```bash
cd /Users/zelinpu/Dev/dev-daydream/feishu/feishu-umbrella/private/cti-extension
node --test --import tsx src/__tests__/load-private-settings.test.ts
```

Expected: FAIL.

**Step 3: Implement package/build skeleton**

Implement:
- local package metadata
- build script that outputs `dist/index.js`
- settings loader utility
- extension entrypoint that logs successful load

**Step 4: Run the settings test again**

Run:
```bash
cd /Users/zelinpu/Dev/dev-daydream/feishu/feishu-umbrella/private/cti-extension
node --test --import tsx src/__tests__/load-private-settings.test.ts
npm run build
```

Expected: tests pass and `dist/index.js` is generated.

**Step 5: Commit**

```bash
cd /Users/zelinpu/Dev/dev-daydream/feishu/feishu-umbrella
git add private/cti-extension
git commit -m "feat: add private extension package skeleton"
```

### Task 3: Implement the Feishu adapter override registration

**Files:**
- Create: `feishu-umbrella/private/cti-extension/src/feishu/register-feishu-override.ts`
- Create: `feishu-umbrella/private/cti-extension/src/feishu/private-feishu-adapter.ts`
- Test: `feishu-umbrella/private/cti-extension/src/__tests__/register-feishu-override.test.ts`

**Step 1: Write failing registration tests**

Test that:
- the private extension registers a `feishu` factory
- the registered factory overrides the upstream one
- `createAdapter('feishu')` returns the private adapter after extension load

**Step 2: Run the registration test to confirm failure**

Run:
```bash
cd /Users/zelinpu/Dev/dev-daydream/feishu/feishu-umbrella/private/cti-extension
node --test --import tsx src/__tests__/register-feishu-override.test.ts
```

Expected: FAIL.

**Step 3: Implement minimal override**

Start with:
- import `registerAdapterFactory` from the upstream bridge package
- register a private Feishu adapter class
- keep the class minimal at first so the registration test can pass before the menu logic lands

**Step 4: Re-run the registration test**

Run:
```bash
cd /Users/zelinpu/Dev/dev-daydream/feishu/feishu-umbrella/private/cti-extension
node --test --import tsx src/__tests__/register-feishu-override.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
cd /Users/zelinpu/Dev/dev-daydream/feishu/feishu-umbrella
git add private/cti-extension/src/feishu private/cti-extension/src/__tests__/register-feishu-override.test.ts
git commit -m "feat: add private feishu adapter override"
```

### Task 4: Port menu-route logic into the private adapter

**Files:**
- Modify: `feishu-umbrella/private/cti-extension/src/feishu/private-feishu-adapter.ts`
- Create: `feishu-umbrella/private/cti-extension/src/feishu/menu-route-service.ts`
- Create: `feishu-umbrella/private/cti-extension/src/feishu/menu-payload.ts`
- Create: `feishu-umbrella/private/cti-extension/src/feishu/menu-notifier.ts`
- Test: `feishu-umbrella/private/cti-extension/src/__tests__/menu-route-service.test.ts`
- Test: `feishu-umbrella/private/cti-extension/src/__tests__/menu-payload.test.ts`
- Test: `feishu-umbrella/private/cti-extension/src/__tests__/private-feishu-adapter.test.ts`

**Step 1: Write the pure logic tests**

Cover:
- route JSON parsing
- wildcard `*` fallback
- placeholder replacement
- default payload generation
- dedup by `event_id`

**Step 2: Run those tests to confirm failure**

Run:
```bash
cd /Users/zelinpu/Dev/dev-daydream/feishu/feishu-umbrella/private/cti-extension
node --test --import tsx \
  src/__tests__/menu-route-service.test.ts \
  src/__tests__/menu-payload.test.ts
```

Expected: FAIL.

**Step 3: Implement the pure logic modules**

Implement:
- route parsing
- event-key route lookup
- placeholder replacement for:
  - `event_key`
  - `event_id`
  - `timestamp`
  - `tenant_key`
  - operator IDs and name

**Step 4: Write adapter integration tests**

Mock:
- Feishu REST client
- outbound notification calls
- webhook `fetch`

Verify:
- `application.bot.menu_v6` is handled
- pending notification is sent
- webhook request is emitted
- success and failure result notifications are sent

**Step 5: Run the full private extension test set**

Run:
```bash
cd /Users/zelinpu/Dev/dev-daydream/feishu/feishu-umbrella/private/cti-extension
node --test --import tsx src/__tests__/*.test.ts
```

Expected: PASS.

**Step 6: Build the extension**

Run:
```bash
cd /Users/zelinpu/Dev/dev-daydream/feishu/feishu-umbrella/private/cti-extension
npm run build
```

Expected: `dist/index.js` and related artifacts are updated.

**Step 7: Commit**

```bash
cd /Users/zelinpu/Dev/dev-daydream/feishu/feishu-umbrella
git add private/cti-extension
git commit -m "feat: port feishu menu routing into private extension"
```

### Task 5: Add private config files and precedence tests

**Files:**
- Create: `feishu-umbrella/private/config/feishu-menu-routes.example.json`
- Create: `feishu-umbrella/private/config/.gitignore`
- Test: `feishu-umbrella/private/cti-extension/src/__tests__/config-precedence.test.ts`
- Modify: `feishu-umbrella/private/cti-extension/src/config/load-private-settings.ts`

**Step 1: Write failing precedence tests**

Cover:
- `CTI_PRIVATE_MENU_ROUTE_FILE` overrides default local file
- local file overlays base `CTI_FEISHU_MENU_ROUTES`
- missing local file falls back safely

**Step 2: Run the precedence test to verify failure**

Run:
```bash
cd /Users/zelinpu/Dev/dev-daydream/feishu/feishu-umbrella/private/cti-extension
node --test --import tsx src/__tests__/config-precedence.test.ts
```

Expected: FAIL.

**Step 3: Implement precedence logic and config templates**

Tracked files:
- example JSON
- local `.gitignore` entry for `*.local.json`

**Step 4: Re-run the private extension tests**

Run:
```bash
cd /Users/zelinpu/Dev/dev-daydream/feishu/feishu-umbrella/private/cti-extension
node --test --import tsx src/__tests__/*.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
cd /Users/zelinpu/Dev/dev-daydream/feishu/feishu-umbrella
git add private/config private/cti-extension/src/config private/cti-extension/src/__tests__/config-precedence.test.ts
git commit -m "feat: add private menu route config overlay"
```

### Task 6: Build the umbrella-owned runner scripts

**Files:**
- Create: `feishu-umbrella/private/runtime/bridge.sh`
- Create: `feishu-umbrella/private/runtime/bridge.ps1`
- Create: `feishu-umbrella/private/runtime/README.md`
- Test: `feishu-umbrella/private/cti-extension/src/__tests__/runner-env-contract.test.ts`

**Step 1: Write a failing env-contract test**

Test the runner contract indirectly by extracting a small helper that computes:
- `CTI_PRIVATE_EXTENSION_ENTRY`
- `CTI_PRIVATE_MENU_ROUTE_FILE`
- extension build path

**Step 2: Run the env-contract test**

Run:
```bash
cd /Users/zelinpu/Dev/dev-daydream/feishu/feishu-umbrella/private/cti-extension
node --test --import tsx src/__tests__/runner-env-contract.test.ts
```

Expected: FAIL.

**Step 3: Implement runner scripts**

`bridge.sh` and `bridge.ps1` should:
- build the private extension if stale
- export or set required env vars
- delegate `start|stop|status|logs` to the skill daemon scripts

Do not replace the skill daemon logic.

**Step 4: Re-run the env-contract test and build**

Run:
```bash
cd /Users/zelinpu/Dev/dev-daydream/feishu/feishu-umbrella/private/cti-extension
node --test --import tsx src/__tests__/runner-env-contract.test.ts
cd /Users/zelinpu/Dev/dev-daydream/feishu/feishu-umbrella/private/cti-extension && npm run build
```

Expected: PASS.

**Step 5: Commit**

```bash
cd /Users/zelinpu/Dev/dev-daydream/feishu/feishu-umbrella
git add private/runtime private/cti-extension/src/__tests__/runner-env-contract.test.ts
git commit -m "feat: add umbrella bridge runner scripts"
```

### Task 7: Add local smoke-test harness

**Files:**
- Create: `feishu-umbrella/private/testing/fake-webhook-server.mjs`
- Create: `feishu-umbrella/private/testing/fixtures/feishu-menu-event.json`
- Create: `feishu-umbrella/private/testing/smoke-macos.sh`
- Create: `feishu-umbrella/private/testing/README.md`

**Step 1: Create the local fake webhook server**

It should:
- listen on localhost
- log incoming requests to a temp file
- return a deterministic JSON response

**Step 2: Create a representative menu event fixture**

Include:
- `event_key`
- `event_id`
- `tenant_key`
- operator IDs

**Step 3: Create a macOS smoke script**

Script flow:
- make temp `CTI_HOME`
- point menu route config to local fake server
- build the extension
- start the bridge through `private/runtime/bridge.sh`
- inject or simulate the menu event through a test seam
- assert the fake server received the POST
- print logs on failure

**Step 4: Run the smoke script**

Run:
```bash
cd /Users/zelinpu/Dev/dev-daydream/feishu/feishu-umbrella
bash private/testing/smoke-macos.sh
```

Expected: PASS with a captured local webhook request.

**Step 5: Commit**

```bash
cd /Users/zelinpu/Dev/dev-daydream/feishu/feishu-umbrella
git add private/testing
git commit -m "test: add local macos smoke harness"
```

### Task 8: Document the Windows service loop and pre-live checklist

**Files:**
- Create: `feishu-umbrella/private/ops/windows-service-runbook.md`
- Create: `feishu-umbrella/private/ops/prelive-checklist.md`
- Modify: `feishu-umbrella/WORKFLOW.md`

**Step 1: Write the runbook**

Document:
- install prerequisites
- private runner usage
- service install/start/status/logs flow
- where logs and status files live
- how to confirm the private extension loaded

**Step 2: Write the pre-live checklist**

Include:
- one menu-key smoke trigger
- restart verification
- overnight soak
- heartbeat/status review
- rollback path to previous deployment

**Step 3: Update umbrella workflow docs**

Add:
- one supported production entrypoint
- raw skill daemon commands are development-only

**Step 4: Commit**

```bash
cd /Users/zelinpu/Dev/dev-daydream/feishu/feishu-umbrella
git add private/ops WORKFLOW.md
git commit -m "docs: add private ops runbook and prelive checklist"
```
