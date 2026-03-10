# Feishu Menu User Enrichment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add lazy Contact user enrichment for selected Feishu menu keys by making enrichment an explicit private route contract and passing optional enriched profile data into downstream webhook payloads.

**Architecture:** Keep menu-key policy in `routing/`, keep orchestration in `adapter/`, and keep payload shaping in `webhooks/`. Introduce a private `contact/` capability for Feishu Contact API lookup and keep enrichment best-effort so unconfigured or failed lookups do not block menu handling.

**Tech Stack:** TypeScript, Node test runner, `tsx`, Feishu Node SDK, private umbrella route JSON

---

### Task 1: Add route-contract tests for enrichment policy

**Files:**
- Modify: `private/cti-extension/src/__tests__/menu-route-service.test.ts`
- Modify: `private/cti-extension/src/feishu/routing/menu-route-config.ts`

**Step 1: Write the failing test**

Add a test that parses a route with:

```ts
{
  review: {
    url: 'https://hooks.example.com/review',
    userEnrichment: 'contact_by_open_id',
  },
}
```

and expects the parsed route to include:

```ts
{
  url: 'https://hooks.example.com/review',
  userEnrichment: 'contact_by_open_id',
}
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern "menu-route-service"`

Expected: FAIL because the route parser does not preserve `userEnrichment`.

**Step 3: Write minimal implementation**

Teach `menu-route-config.ts` to normalize and preserve the known enrichment mode.

**Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern "menu-route-service"`

Expected: PASS.

### Task 2: Add payload tests for optional enriched profile data

**Files:**
- Modify: `private/cti-extension/src/__tests__/menu-payload.test.ts`
- Modify: `private/cti-extension/src/feishu/webhooks/menu-payload.ts`
- Create: `private/cti-extension/src/feishu/domain/contact-user.ts`

**Step 1: Write the failing test**

Add tests that expect:

- the default payload to include `contact_user` when enrichment is present
- placeholder expansion to support enriched user fields such as `{{contact_user_name}}`

**Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern "menu-payload"`

Expected: FAIL because `menu-payload.ts` only knows about raw event fields.

**Step 3: Write minimal implementation**

Add the contact-user domain type and extend payload shaping to include optional enriched user data.

**Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern "menu-payload"`

Expected: PASS.

### Task 3: Add adapter tests for lazy route-scoped enrichment

**Files:**
- Modify: `private/cti-extension/src/__tests__/private-feishu-adapter.test.ts`
- Modify: `private/cti-extension/src/feishu/adapter/private-feishu-adapter.ts`
- Create: `private/cti-extension/src/feishu/contact/contact-user-service.ts`

**Step 1: Write the failing test**

Add tests that show:

- a route with `userEnrichment: "contact_by_open_id"` triggers a Contact lookup using the event `open_id`
- the webhook payload receives the enriched profile data
- a route without enrichment does not perform the lookup

**Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern "private-feishu-adapter"`

Expected: FAIL because the adapter does not yet perform Contact lookup or pass enrichment into payload shaping.

**Step 3: Write minimal implementation**

Create a private Contact lookup service and call it only when the resolved route requests enrichment.

**Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern "private-feishu-adapter"`

Expected: PASS.

### Task 4: Update private config and architecture docs

**Files:**
- Modify: `private/config/feishu-menu-routes.example.json`
- Modify: `private/config/feishu-menu-routes.local.json`
- Modify: `private/cti-extension/src/feishu/architecture.md`
- Modify: `docs/architecture/private-umbrella-architecture.md`
- Modify: `docs/architecture/feishu-menu-event-user-info.md`

**Step 1: Document the route contract**

Add `userEnrichment` examples and explain that it is a per-menu-key contract.

**Step 2: Document the new capability boundary**

Explain where Contact lookup code lives and how lazy enrichment fits the current runtime flow.

**Step 3: Verify docs read cleanly**

Read the changed docs from disk and confirm the boundaries are explicit.

### Task 5: Verify the implementation

**Files:**
- Verify: `private/cti-extension/src/__tests__/menu-route-service.test.ts`
- Verify: `private/cti-extension/src/__tests__/menu-payload.test.ts`
- Verify: `private/cti-extension/src/__tests__/private-feishu-adapter.test.ts`

**Step 1: Run focused tests**

Run:

```bash
npm test -- --test-name-pattern "menu-route-service|menu-payload|private-feishu-adapter"
```

Expected: PASS.

**Step 2: Run broader verification**

Run:

```bash
npm test
npm run build
```

Expected: PASS.
