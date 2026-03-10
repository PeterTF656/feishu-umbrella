# Feishu Directory Architecture Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the approved capability-oriented directory architecture inside `private/cti-extension/src/feishu/` without changing runtime behavior.

**Architecture:** Move the current flat Feishu private-extension files into `adapter/`, `cards/`, `routing/`, `webhooks/`, and `shared/`, and add a small `feishu/index.ts` barrel for stable internal exports. Keep behavior unchanged by updating tests first to the new import paths, then moving code, then verifying the existing behavior suite still passes.

**Tech Stack:** TypeScript, Node.js test runner, tsx, esbuild

---

### Task 1: Redirect tests to the new architecture

**Files:**
- Modify: `feishu-umbrella/private/cti-extension/src/__tests__/menu-payload.test.ts`
- Modify: `feishu-umbrella/private/cti-extension/src/__tests__/menu-route-service.test.ts`
- Modify: `feishu-umbrella/private/cti-extension/src/__tests__/private-feishu-adapter.test.ts`
- Modify: `feishu-umbrella/private/cti-extension/src/__tests__/register-feishu-override.test.ts`

**Step 1: Write the failing import-path changes**

Update the tests to import from the approved future locations:

- `../feishu/webhooks/menu-payload.js`
- `../feishu/routing/menu-route-service.js`
- `../feishu/adapter/private-feishu-adapter.js`
- `./src/feishu/adapter/register-feishu-override.ts`

**Step 2: Run the focused tests to verify failure**

Run:

```bash
cd /Users/zelinpu/Dev/dev-daydream/feishu/feishu-umbrella/private/cti-extension
node --test --import tsx \
  src/__tests__/menu-payload.test.ts \
  src/__tests__/menu-route-service.test.ts \
  src/__tests__/private-feishu-adapter.test.ts \
  src/__tests__/register-feishu-override.test.ts
```

Expected: FAIL because the files do not exist at the new paths yet.

### Task 2: Move routing and webhook modules

**Files:**
- Create: `feishu-umbrella/private/cti-extension/src/feishu/routing/menu-route-service.ts`
- Create: `feishu-umbrella/private/cti-extension/src/feishu/webhooks/menu-payload.ts`
- Delete: `feishu-umbrella/private/cti-extension/src/feishu/menu-route-service.ts`
- Delete: `feishu-umbrella/private/cti-extension/src/feishu/menu-payload.ts`

**Step 1: Move the files without changing behavior**

Preserve exports and implementation.

**Step 2: Re-run the focused tests**

Run:

```bash
cd /Users/zelinpu/Dev/dev-daydream/feishu/feishu-umbrella/private/cti-extension
node --test --import tsx \
  src/__tests__/menu-payload.test.ts \
  src/__tests__/menu-route-service.test.ts
```

Expected: PASS.

### Task 3: Move card delivery and shared helpers

**Files:**
- Create: `feishu-umbrella/private/cti-extension/src/feishu/cards/notifier/menu-notifier.ts`
- Create: `feishu-umbrella/private/cti-extension/src/feishu/shared/receivers.ts`
- Delete: `feishu-umbrella/private/cti-extension/src/feishu/menu-notifier.ts`

**Step 1: Extract receiver resolution into `shared/receivers.ts`**

Move `resolveMenuReceivers()` and its related receiver types there.

**Step 2: Update the notifier to import from `shared/receivers.ts`**

Keep notifier behavior unchanged.

**Step 3: Run the focused adapter test**

Run:

```bash
cd /Users/zelinpu/Dev/dev-daydream/feishu/feishu-umbrella/private/cti-extension
node --test --import tsx src/__tests__/private-feishu-adapter.test.ts
```

Expected: PASS.

### Task 4: Move adapter files and add the Feishu barrel

**Files:**
- Create: `feishu-umbrella/private/cti-extension/src/feishu/adapter/private-feishu-adapter.ts`
- Create: `feishu-umbrella/private/cti-extension/src/feishu/adapter/register-feishu-override.ts`
- Create: `feishu-umbrella/private/cti-extension/src/feishu/index.ts`
- Modify: `feishu-umbrella/private/cti-extension/src/index.ts`
- Delete: `feishu-umbrella/private/cti-extension/src/feishu/private-feishu-adapter.ts`
- Delete: `feishu-umbrella/private/cti-extension/src/feishu/register-feishu-override.ts`

**Step 1: Move the adapter files**

Update internal imports to the new routing, cards, webhook, and shared locations.

**Step 2: Add `src/feishu/index.ts`**

Export the current Feishu private surface from a single internal barrel.

**Step 3: Update the package entry**

Point `src/index.ts` at the new `feishu/adapter/register-feishu-override.js` import/export path.

**Step 4: Run the focused adapter and override tests**

Run:

```bash
cd /Users/zelinpu/Dev/dev-daydream/feishu/feishu-umbrella/private/cti-extension
node --test --import tsx \
  src/__tests__/private-feishu-adapter.test.ts \
  src/__tests__/register-feishu-override.test.ts
```

Expected: PASS.

### Task 5: Run the full verification set

**Files:**
- Verify only

**Step 1: Run the private extension test suite**

Run:

```bash
cd /Users/zelinpu/Dev/dev-daydream/feishu/feishu-umbrella/private/cti-extension
node --test --import tsx src/__tests__/*.test.ts
```

Expected: all tests pass.

**Step 2: Run type-check and build**

Run:

```bash
cd /Users/zelinpu/Dev/dev-daydream/feishu/feishu-umbrella/private/cti-extension
npm run typecheck
npm run build
```

Expected: both exit 0.

**Step 3: Inspect the final layout**

Run:

```bash
find /Users/zelinpu/Dev/dev-daydream/feishu/feishu-umbrella/private/cti-extension/src/feishu -maxdepth 3 -type f | sort
```

Expected: the approved capability-oriented subdirectories exist, and runtime code is no longer flat under `src/feishu/`.
