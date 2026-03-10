# Feishu Directory Architecture Design

## Goal

Propose a clearer internal architecture for `feishu-umbrella/private/cti-extension/src/feishu/` so customization points are easy to find, especially for:

- card content and UI
- card delivery behavior
- future interactive card button handling
- routing and event-key resolution
- outbound webhook shaping
- top-level Feishu adapter orchestration

This is a documentation-only proposal. It does not move files or change runtime behavior yet.

## Current State

Today the directory is flat:

```text
private/cti-extension/src/feishu/
  menu-notifier.ts
  menu-payload.ts
  menu-route-service.ts
  private-feishu-adapter.ts
  register-feishu-override.ts
```

That is workable for the current scope, but it has two problems:

1. The customization surface is not obvious.
2. UI concerns, routing concerns, and orchestration concerns are adjacent without explicit boundaries.

The result is that a future editor has to inspect multiple files before knowing where to change:

- Feishu card appearance
- button interactions
- route matching
- webhook request shaping
- event receive orchestration

## Recommended Approach

Use a capability-oriented directory structure.

Recommended target:

```text
private/cti-extension/src/feishu/
  architecture.md
  index.ts
  adapter/
    private-feishu-adapter.ts
    register-feishu-override.ts
  domain/
    menu-event.ts
    menu-flow.ts
  routing/
    menu-route-service.ts
    menu-route-config.ts
  webhooks/
    menu-payload.ts
    menu-webhook-client.ts
  cards/
    notifier/
      menu-notifier.ts
    content/
      pending-card.ts
      result-card.ts
      fallback-text.ts
    actions/
      README.md
  shared/
    receivers.ts
    observability.ts
```

## Why This Structure

### `adapter/`

This directory owns the Feishu platform seam:

- websocket event registration
- adapter override registration
- top-level orchestration of the menu flow

If someone wants to change how a menu event enters the private system, they should start here.

### `cards/`

This directory owns what Feishu users actually see and how card responses are delivered.

It is intentionally split again:

- `content/`: card content, layout, markdown blocks, text fallback, future alternative card types
- `notifier/`: delivery logic to Feishu APIs
- `actions/`: future button/action callback parsing and dispatch

This makes UI customization obvious and keeps future button interaction logic out of the adapter.

### `routing/`

This directory owns menu-key lookup and route policy:

- exact key match
- wildcard fallback
- dedup rules
- route config normalization

If someone wants to add route policies without touching card code, this is the place.

### `webhooks/`

This directory owns outbound HTTP request concerns:

- request payload shaping
- future request execution policy
- future retries, auth headers, or response normalization

This keeps webhook shaping separate from both routing and UI.

### `domain/`

This directory owns the shared contracts for menu flows:

- event type definitions
- flow result types
- future interaction intent types for button callbacks

This prevents UI modules and routing modules from inventing incompatible ad hoc shapes.

### `shared/`

This directory owns low-level helpers that are not UI-specific and not route-specific:

- receiver resolution
- menu observability helpers

These are cross-cutting utilities, not core domain modules.

## Alternatives Considered

### 1. Minimal split

Keep the directory mostly flat and only add `cards/` plus `routing/`.

Trade-off:

- less churn later
- but adapter orchestration remains too central
- future button actions still do not get a clear architectural home

### 2. Flow-stage split

Use `receive/`, `dispatch/`, `respond/`, `shared/`.

Trade-off:

- the runtime pipeline reads well
- but it hides the practical customization boundaries
- card content and card delivery would still be mixed under `respond/`

### 3. Capability-oriented split

Use `adapter/`, `cards/`, `routing/`, `webhooks/`, `domain/`, `shared/`.

Trade-off:

- slightly more directories
- but customization surfaces become explicit
- future button interactions have an obvious home

This is the recommended approach.

## Interaction Model For Future Card Buttons

The current system only sends result cards. It does not yet support follow-up button interactions on those cards.

When that feature is added later, the design should be:

1. Feishu card action callback enters through `adapter/`
2. action payload is translated into a domain-level intent in `cards/actions/`
3. the intent is handed to orchestration logic, not directly to the webhook layer
4. card rendering stays in `cards/content/`
5. API delivery stays in `cards/notifier/`

This keeps the architecture disciplined:

- UI content does not perform routing decisions
- button handlers do not own HTTP request construction
- adapter code does not embed card layout details

## File Placement Rules

When the reorganization is eventually implemented:

- change event registration or adapter entry logic in `adapter/`
- change card look-and-feel in `cards/content/`
- change message send behavior in `cards/notifier/`
- add button callback behavior in `cards/actions/`
- change route lookup or dedup in `routing/`
- change webhook request body or transport policy in `webhooks/`
- add shared menu contracts in `domain/`
- keep generic helper code in `shared/`

## Documentation Deliverables

The immediate implementation for this proposal should be:

1. add `private/cti-extension/src/feishu/architecture.md`
2. document:
   - current flat layout
   - proposed target layout
   - responsibility boundaries
   - future interactive-card action placement
   - file placement rules for future edits
3. do not move files yet
4. do not change runtime imports yet

## Success Criteria

This proposal is successful if:

- a future editor can identify where card UI belongs without reading adapter code
- a future editor can identify where route logic belongs without reading notifier code
- future button interactions have an explicit planned location
- the document is precise enough to guide a later refactor without guesswork
