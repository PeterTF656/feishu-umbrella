# Feishu Extension Directory Architecture

## Purpose

This document proposes a clearer future structure for `private/cti-extension/src/feishu/`.

The goal is not to change runtime behavior now. The goal is to make future customization obvious, especially for:

- menu-key receive flow
- card content and UI
- card delivery behavior
- future interactive cards with buttons
- route resolution
- webhook request shaping

This is a proposal for a later refactor, not a live directory migration.

## Current State

The directory is currently flat:

```text
private/cti-extension/src/feishu/
  menu-notifier.ts
  menu-payload.ts
  menu-route-service.ts
  private-feishu-adapter.ts
  register-feishu-override.ts
```

Current responsibilities:

- `private-feishu-adapter.ts`
  - registers the Feishu menu event handler
  - receives menu events
  - resolves routes
  - sends the pending card
  - performs the webhook request
  - sends the final result card
- `menu-notifier.ts`
  - sends Feishu cards and text fallbacks
  - chooses receiver IDs
- `menu-route-service.ts`
  - parses route definitions
  - resolves exact menu keys and wildcard fallback
  - deduplicates `event_id`
- `menu-payload.ts`
  - builds webhook request payloads
  - expands placeholders like `{{event_key}}`
- `register-feishu-override.ts`
  - registers the private adapter into the bridge registry

## Problem With The Current Layout

The current layout works, but it hides the customization map.

Examples:

- if you want to change Feishu card appearance, the obvious file is not obvious until you inspect notifier code
- if you want future card button callbacks, there is no explicit architectural home for them
- if you want to change route matching, the directory does not visually separate routing from card UI
- if you want to change outbound webhook logic, payload shaping is present but transport policy has no explicit future home

That makes the folder harder to navigate than it needs to be.

## Recommended Future Layout

Use a capability-oriented structure:

```text
private/cti-extension/src/feishu/
  architecture.md
  index.ts
  adapter/
    menu-action-controller.ts
    private-feishu-adapter.ts
    register-feishu-override.ts
  cards/
    actions/
      README.md
    content/
      pending-card.ts
      result-card.ts
      fallback-text.ts
    notifier/
      menu-notifier.ts
  domain/
    menu-event.ts
    menu-flow.ts
  routing/
    menu-route-config.ts
    menu-route-service.ts
  shared/
    observability.ts
    receivers.ts
  webhooks/
    menu-payload.ts
    menu-webhook-client.ts
```

This is the recommended target structure for a later refactor.

## Directory Responsibilities

### `adapter/`

This directory owns the Feishu platform seam.

It should contain:

- websocket event registration
- bridge adapter override registration
- top-level orchestration for Feishu menu-event handling
- top-level orchestration for future menu-action intents

If a future change affects how the event enters the private system, it belongs here.

### `cards/`

This directory owns what the Feishu operator sees and how those messages are delivered.

It should be split into three sub-areas.

#### `cards/content/`

This is where card appearance belongs:

- pending card body
- result card body
- fallback text content
- future alternate card layouts

If you want to change card wording, layout, markdown blocks, or visual structure, this should be the first place to look.

#### `cards/notifier/`

This is where Feishu message delivery behavior belongs:

- send card vs text fallback
- choose receiver types
- handle send failures
- keep delivery-specific logging

This is not the place for card layout definitions. It should deliver prepared content, not own the content design.

#### `cards/actions/`

This is the planned home for future interactive card actions.

Examples:

- button callbacks
- action payload parsing
- action-to-domain-intent translation

Important rule:

- a card action should not directly own route resolution or webhook transport behavior
- it should translate the callback into a domain-level intent, then hand off to orchestration logic in `adapter/`

That keeps future interactive cards from turning into unstructured callback code.

### `routing/`

This directory owns menu-key routing policy.

It should contain:

- route config normalization
- exact key match
- wildcard fallback
- dedup policy

If you want to change how event keys are resolved, this should be the only place to start.

### `webhooks/`

This directory owns outbound HTTP request concerns.

It should contain:

- request payload shaping
- future webhook transport logic
- future retry or auth policy
- response normalization if needed later

This keeps outbound network behavior separate from both route policy and card presentation.

### `domain/`

This directory owns shared menu-flow contracts.

It should contain:

- Feishu menu event types
- flow result types
- future button action intent types

This is where shared types should live so `adapter/`, `cards/`, `routing/`, and `webhooks/` do not invent incompatible local shapes.

### `shared/`

This directory owns cross-cutting helpers that do not define a business area by themselves.

Examples:

- receiver resolution
- observability helpers

If a helper is generic inside the Feishu private layer and does not belong clearly to cards, routing, or webhooks, it belongs here.

Guardrail:

- `shared/` is not a fallback home for business logic
- if a module owns menu behavior, it should stay in `adapter/`, `cards/`, `routing/`, `webhooks/`, or `domain/`

## Customization Map

When this future structure exists, the edit map should be:

- change menu-event entry behavior: `adapter/`
- change card appearance/content: `cards/content/`
- change card delivery rules: `cards/notifier/`
- add future card button handling: `cards/actions/`
- change route resolution or dedup: `routing/`
- change webhook payloads or HTTP behavior: `webhooks/`
- change shared types and flow contracts: `domain/`
- change generic helper behavior: `shared/`

This is the main reason for the proposed split. A future editor should not need to rediscover the architecture by reading several files first.

## Future Card Button Interaction Flow

The current system sends cards but does not yet implement follow-up interactions on those cards.

When button-based interactions are added later, the flow should be:

1. Feishu callback enters through `adapter/`
2. the callback payload is parsed in `cards/actions/`
3. the callback is translated into a domain-level intent
4. the intent is passed to orchestration logic in `adapter/menu-action-controller.ts` or equivalent adapter-owned flow control
5. any new card rendering still comes from `cards/content/`
6. any message delivery still goes through `cards/notifier/`
7. any network call still goes through `webhooks/`

This avoids three failure modes:

- card UI code making routing decisions
- callback parsing code directly constructing webhook payloads
- adapter code accumulating presentation logic

## Why This Approach Is Recommended

Alternative structures are possible, but this one is the best fit for the current private Feishu layer.

Why not keep it mostly flat:

- small now, but poor discoverability later
- no explicit home for future interactive cards

Why not split by flow stage like `receive/`, `dispatch/`, `respond/`:

- that reads well as a pipeline
- but it hides the actual customization seams
- card content and card delivery would still be mixed conceptually

Why capability-oriented is better:

- UI customization becomes obvious
- route logic stays isolated
- webhook concerns stay isolated
- future button interactions have a clear home

## Scope Of This Proposal

This document does not do any of the following:

- move current files
- add new imports
- change runtime logic
- add interactive card features
- add new webhook behavior

It is only the target architecture proposal for a future refactor.

## Practical Rule For Today

Until the refactor happens, the current files still own the live behavior:

- `private-feishu-adapter.ts` is still the event entrypoint
- `menu-notifier.ts` is still the current card delivery and content file
- `menu-route-service.ts` is still the current routing file
- `menu-payload.ts` is still the current webhook payload file

Use this document as the placement guide for the next cleanup pass, not as a statement that the reorganization already exists.
