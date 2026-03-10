# Feishu Menu User Enrichment Design

## Goal

Add lazy Feishu Contact user enrichment for selected menu keys without changing the default behavior for all menu routes.

## Constraints

- `feishu-umbrella` is the owner of private Feishu customization.
- `Claude-to-IM` and `Claude-to-IM-skill` stay read-only submodule dependencies.
- Menu-key entry behavior stays in `private/cti-extension/src/feishu/adapter/`.
- Routing policy stays in `private/cti-extension/src/feishu/routing/`.
- Webhook payload shaping stays in `private/cti-extension/src/feishu/webhooks/`.
- Rich user data must come from Feishu Contact API lookup by `open_id`.

## Approved Approach

Make user enrichment an explicit part of each menu-key route contract.

Example route shape:

```json
{
  "review-request": {
    "url": "https://hooks.example.com/review-request",
    "method": "POST",
    "userEnrichment": "contact_by_open_id"
  }
}
```

## Why This Is The Right Boundary

- The enrichment rule is attached to a specific menu key, so it belongs with the route contract for that key.
- `routing/` already owns menu-key-specific policy. This avoids creating a second policy file that can drift.
- `adapter/` remains the orchestrator: after resolving the route, it can decide whether to perform a Contact lookup.
- `webhooks/` remains a pure shaping layer: it receives direct event data plus optional enriched profile data and turns that into outbound JSON.

## Runtime Flow

1. Receive `application.bot.menu_v6`.
2. Resolve the route for the menu key.
3. If the resolved route declares `userEnrichment: "contact_by_open_id"`, read `open_id` from the event.
4. Perform a private Feishu Contact lookup by `open_id`.
5. Continue even if the lookup is unavailable, missing permissions, or fails.
6. Pass the optional enriched profile into downstream webhook payload shaping.

## Failure Policy

Enrichment is supplemental, not mandatory:

- if the route does not request enrichment, do nothing
- if `open_id` is missing, skip lookup
- if the Contact API fails or returns no user, continue with the original menu-event payload

This keeps the adapter resilient and preserves current behavior for unaffected menu keys.

## New Capability Boundary

This feature introduces a private Feishu Contact capability:

- `contact/`: Feishu Contact API integration for private menu flows

This keeps Contact API code out of `adapter/`, `routing/`, and `webhooks/` while preserving the existing architecture split.
