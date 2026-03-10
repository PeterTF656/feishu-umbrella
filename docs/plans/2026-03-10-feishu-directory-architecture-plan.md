# Feishu Directory Architecture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a documentation-only architecture proposal for `private/cti-extension/src/feishu/` that defines a clearer future directory structure and customization map.

**Architecture:** Keep the current runtime unchanged and add a local `architecture.md` inside `private/cti-extension/src/feishu/`. The document will describe a capability-oriented future layout that separates adapter orchestration, card UI/content, card delivery, future card actions, routing, webhook shaping, and shared domain contracts.

**Tech Stack:** Markdown, existing Feishu private extension source layout

---

### Task 1: Capture the current `feishu/` responsibilities

**Files:**
- Inspect: `feishu-umbrella/private/cti-extension/src/feishu/private-feishu-adapter.ts`
- Inspect: `feishu-umbrella/private/cti-extension/src/feishu/menu-notifier.ts`
- Inspect: `feishu-umbrella/private/cti-extension/src/feishu/menu-route-service.ts`
- Inspect: `feishu-umbrella/private/cti-extension/src/feishu/menu-payload.ts`
- Inspect: `feishu-umbrella/private/cti-extension/src/feishu/register-feishu-override.ts`

**Step 1: Summarize current responsibilities**

Document what each existing file owns today.

**Step 2: Note current pain points**

Record where UI, routing, and orchestration are coupled too closely for future customization.

### Task 2: Write the local architecture proposal

**Files:**
- Create: `feishu-umbrella/private/cti-extension/src/feishu/architecture.md`

**Step 1: Describe the current flat layout**

Show the current file list and current responsibilities.

**Step 2: Describe the proposed future layout**

Include a directory tree for:

```text
adapter/
cards/
domain/
routing/
shared/
webhooks/
```

**Step 3: Document the boundaries**

Explain where future work should go for:

- card content and UI
- card delivery behavior
- future card button interactions
- route resolution
- outbound webhook shaping
- adapter entry orchestration

### Task 3: Review the proposal

**Files:**
- Review: `feishu-umbrella/private/cti-extension/src/feishu/architecture.md`

**Step 1: Review for architectural clarity**

Check for:

- unclear boundaries
- overlap between card UI and card delivery
- missing home for future button interactions
- hidden coupling between routing and webhook logic

**Step 2: Refine the document if needed**

Tighten the wording so future editors can use the doc as a placement guide.

### Task 4: Verify the documentation change

**Files:**
- Verify: `feishu-umbrella/private/cti-extension/src/feishu/architecture.md`

**Step 1: Read the final doc from disk**

Run:

```bash
sed -n '1,260p' /Users/zelinpu/Dev/dev-daydream/feishu/feishu-umbrella/private/cti-extension/src/feishu/architecture.md
```

Expected: the file exists and contains the proposed future directory structure and placement guidance.

**Step 2: Confirm no runtime code was changed**

Run:

```bash
git -C /Users/zelinpu/Dev/dev-daydream/feishu/feishu-umbrella diff -- private/cti-extension/src/feishu
```

Expected: only `architecture.md` is new or changed for this task.
