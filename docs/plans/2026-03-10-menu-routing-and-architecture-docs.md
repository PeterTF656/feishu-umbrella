# Menu Routing And Architecture Docs Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an explicit umbrella-owned route for the current Feishu testing menu key and document the private umbrella architecture, ownership boundaries, and runtime flow.

**Architecture:** Keep menu routing data in umbrella-owned JSON under `private/config/`, with explicit entries for known testing keys and `*` as a fallback only. Document the actual runtime path from `private/runtime/bridge.*` through the skill-side extension seam into the private Feishu adapter so future private work stays in `feishu-umbrella/private/` instead of drifting into vendored or submodule code.

**Tech Stack:** JSON config, Markdown docs, bash/PowerShell wrappers, TypeScript private extension, git submodules

---

### Task 1: Add explicit test menu-key routes

**Files:**
- Modify: `feishu-umbrella/private/config/feishu-menu-routes.local.json`
- Modify: `feishu-umbrella/private/config/feishu-menu-routes.example.json`

**Step 1: Inspect the current route files**

Confirm the existing keys, fallback behavior, and target endpoints.

**Step 2: Add the explicit key**

Add `testing-menu-key` as an explicit top-level route entry.

- Local file should keep the current public echo endpoint used for live validation.
- Example file should show the same shape with a safe local/test endpoint.
- Preserve `*` as the fallback route.

**Step 3: Sanity-check the JSON**

Run:

```bash
node -e "JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8')); JSON.parse(require('node:fs').readFileSync(process.argv[2], 'utf8'));" \
  /Users/zelinpu/Dev/dev-daydream/feishu/feishu-umbrella/private/config/feishu-menu-routes.local.json \
  /Users/zelinpu/Dev/dev-daydream/feishu/feishu-umbrella/private/config/feishu-menu-routes.example.json
```

Expected: exit 0.

### Task 2: Add umbrella architecture documentation

**Files:**
- Create: `feishu-umbrella/docs/architecture/private-umbrella-architecture.md`
- Modify: `feishu-umbrella/README.md`
- Modify: `feishu-umbrella/WORKFLOW.md`

**Step 1: Write the architecture document**

Cover:
- what the umbrella repo owns
- what each submodule owns
- what was added in the private extension work
- runtime startup path
- menu-event handling path
- config/file precedence
- testing and operations loops
- where future private customization should live

**Step 2: Link the document from top-level docs**

Add a pointer from `README.md` and `WORKFLOW.md` so the architecture doc is discoverable.

### Task 3: Verify the change against the running model

**Files:**
- No file edits required

**Step 1: Run focused checks**

Run:

```bash
node -e "JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8')); JSON.parse(require('node:fs').readFileSync(process.argv[2], 'utf8'));" \
  /Users/zelinpu/Dev/dev-daydream/feishu/feishu-umbrella/private/config/feishu-menu-routes.local.json \
  /Users/zelinpu/Dev/dev-daydream/feishu/feishu-umbrella/private/config/feishu-menu-routes.example.json
```

```bash
cd /Users/zelinpu/Dev/dev-daydream/feishu/feishu-umbrella/private/cti-extension
node --test --import tsx src/__tests__/private-feishu-adapter.test.ts
npm run build
```

Expected:
- route files parse cleanly
- private Feishu adapter tests pass
- extension build succeeds

**Step 2: If the live bridge needs the updated local route file immediately**

Restart through the umbrella wrapper:

```bash
cd /Users/zelinpu/Dev/dev-daydream/feishu/feishu-umbrella
bash private/runtime/bridge.sh stop
bash private/runtime/bridge.sh start
```

Then inspect logs with:

```bash
bash private/runtime/bridge.sh logs 100
```
