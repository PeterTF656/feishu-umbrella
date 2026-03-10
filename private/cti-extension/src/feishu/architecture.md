# Feishu Extension Directory Architecture

## Purpose

This directory now uses a capability-oriented structure so customization points are visible without reading through the whole adapter.

The main separation is:

- `adapter/`: Feishu platform entry and orchestration
- `cards/`: user-visible card content and delivery logic
- `contact/`: Feishu Contact API lookup for optional user enrichment
- `routing/`: menu-key route parsing and resolution
- `webhooks/`: webhook payload shaping
- `domain/`: shared Feishu menu event contracts
- `shared/`: low-level helpers used across capabilities

## Current Layout

```text
private/cti-extension/src/feishu/
  architecture.md
  index.ts
  adapter/
    private-feishu-adapter.ts
    register-feishu-override.ts
  contact/
    contact-user-service.ts
  cards/
    actions/
      README.md
    content/
      fallback-text.ts
      pending-card.ts
      result-card.ts
    notifier/
      menu-notifier.ts
  domain/
    contact-user.ts
    menu-event.ts
  routing/
    menu-route-config.ts
    menu-route-service.ts
  shared/
    observability.ts
    receivers.ts
  webhooks/
    menu-payload.ts
```

## What Lives Where

### `adapter/`

`adapter/` owns the Feishu integration seam.

Files:

- `private-feishu-adapter.ts`
- `register-feishu-override.ts`

Responsibilities:

- register the private Feishu adapter with the upstream bridge registry
- receive Feishu websocket events
- orchestrate the menu-event flow
- call routing, webhook payload, and card delivery modules

If you want to change how a menu event enters the private system, start here.

### `contact/`

`contact/` owns Feishu Contact API integration for optional user enrichment.

Files:

- `contact-user-service.ts`

Responsibilities:

- perform Contact user lookup by `open_id`
- isolate Contact API error handling from adapter orchestration
- keep enrichment best-effort so route handling can continue without profile data

If you want to change how richer user info is fetched, start here.

### `cards/content/`

`cards/content/` owns what the Feishu operator sees.

Files:

- `pending-card.ts`
- `result-card.ts`
- `fallback-text.ts`

Responsibilities:

- build the pending card content
- build the result card content
- build text fallbacks for card delivery failures

If you want to change wording, markdown, or card layout, start here.

### `cards/notifier/`

`cards/notifier/` owns how those cards are delivered to Feishu.

Files:

- `menu-notifier.ts`

Responsibilities:

- choose the receiver order
- attempt interactive card delivery
- fall back to plain text when needed
- keep delivery-specific logging isolated from content generation

If you want to change send behavior, fallback behavior, or receiver selection, start here.

### `cards/actions/`

`cards/actions/` is reserved for future interactive card callbacks.

Current state:

- only `README.md` exists

Intent:

- parse future card-button callbacks
- translate them into domain-level intents

This directory does not own routing or webhook behavior.

### `routing/`

`routing/` owns menu-key lookup policy.

Files:

- `menu-route-config.ts`
- `menu-route-service.ts`

Responsibilities:

- normalize route config entries
- parse route-level enrichment policy such as `userEnrichment`
- parse route JSON into route objects
- resolve exact route matches and wildcard fallback
- deduplicate `event_id`

If you want to change how menu keys resolve, start here.

### `webhooks/`

`webhooks/` owns outbound webhook payload shaping.

Files:

- `menu-payload.ts`

Responsibilities:

- build the default webhook payload
- expand placeholder values into route-specific request bodies
- expose optional `contact_user` data when route-scoped enrichment succeeded

If you want to change the JSON sent to the webhook, start here.

### `domain/`

`domain/` owns the shared event contract.

Files:

- `contact-user.ts`
- `menu-event.ts`

Responsibilities:

- define the Feishu menu event shape used across adapter, cards, routing, and webhooks
- define the optional Contact user profile shape shared between `contact/` and `webhooks/`

### `shared/`

`shared/` owns low-level helpers used by multiple capabilities.

Files:

- `observability.ts`
- `receivers.ts`

Responsibilities:

- menu debug serialization and truthy-env parsing
- receiver extraction from Feishu event data

Guardrail:

- `shared/` is not a dumping ground for business logic
- menu policy, UI, webhook shaping, and orchestration should stay in their capability directories

## Actual Runtime Flow

```text
application.bot.menu_v6
  -> adapter/private-feishu-adapter.ts
  -> routing/menu-route-service.ts
  -> contact/contact-user-service.ts (only when route.userEnrichment requests it)
  -> cards/notifier/menu-notifier.ts
  -> cards/content/pending-card.ts
  -> webhooks/menu-payload.ts
  -> outbound HTTP request
  -> cards/notifier/menu-notifier.ts
  -> cards/content/result-card.ts
```

That is the live path today.

## Customization Map

Use this as the edit map:

- change menu-event entry or orchestration: `adapter/`
- change card appearance/content: `cards/content/`
- change card delivery behavior: `cards/notifier/`
- add future card callback parsing: `cards/actions/`
- change Contact lookup behavior: `contact/`
- change route parsing or route resolution: `routing/`
- change webhook payload body: `webhooks/`
- change shared event contracts: `domain/`
- change low-level helpers only: `shared/`

## Future Extensions

These are still planned, not implemented yet:

- `adapter/menu-action-controller.ts`
- `domain/menu-flow.ts`
- `webhooks/menu-webhook-client.ts`

Those should be added only when the corresponding behavior actually exists. The current structure already leaves a clear home for them.
