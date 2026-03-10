# Findings

## Requirements

- Summarize the current private umbrella Feishu architecture and runtime flow first.
- Propose a disciplined design before implementation.
- Keep behavior private-umbrella owned under `private/` and keep submodules read-only by default.
- Add a button to the initial webhook response card.
- When that button is clicked in Feishu, return another card showing the caller's user profile.
- Use TDD before implementation and verify with targeted plus broader tests.

## Architecture

- `feishu-umbrella` is the private parent repo; `Claude-to-IM` and `Claude-to-IM-skill` are dependencies unless a missing seam forces upstream changes.
- The private Feishu extension is already capability-oriented:
  `adapter/` for event entry/orchestration,
  `cards/` for card content/delivery,
  `contact/` for Contact API lookup,
  `routing/` for menu-key route policy,
  `webhooks/` for payload shaping,
  `domain/` for shared contracts.
- `cards/actions/` currently exists only as a reserved placeholder for future interactive card callbacks, which is the intended landing zone for this feature.
- `PrivateFeishuAdapter.start()` currently registers the websocket menu handler and `handleMenuEvent()` drives:
  route resolution -> optional Contact enrichment -> pending card -> webhook -> result card.

## Feishu Contract

- `application.bot.menu_v6` directly provides `open_id`, `union_id`, and optionally `operator_name` / `user_id`.
- Richer profile data requires `GET /open-apis/contact/v3/users/:user_id?user_id_type=open_id`.
- `open_id` is the safest primary key because it is present on the menu event without depending on permission-gated `user_id`.

## Runtime Evidence

- Bridge log entries around 2026-03-10 21:47 Asia/Shanghai confirm:
  route `testing-menu-key` resolved in the private adapter,
  Contact lookup completed successfully,
  pending/result cards were delivered after the webhook call.
- Older bridge log lines show `no application.bot.menu_v6 handle` before the private dispatcher registration work, reinforcing that callback/event wiring must stay aligned with the adapter registration seam.

## Callback Capability Evidence

- The installed Feishu Node SDK README documents interactive card callbacks through `CardActionHandler` plus `adaptDefault('/webhook/card', cardDispatcher)`, not through `WSClient`.
- The SDK `InteractiveCardActionEvent` type includes:
  `open_id`,
  optional `user_id`,
  `tenant_key`,
  `open_message_id`,
  and `action.value`.
- The SDK request-handling layer supports `verificationToken` and `encryptKey`, so callback authenticity/decryption can be delegated to the official SDK if the private runtime hosts an HTTP endpoint.
- The upstream `Claude-to-IM` Feishu adapter already contains a matching comment: real `card.action.trigger` handling requires HTTP webhook support, so the current desktop/daemon runtime falls back to text commands for permission actions.

## Open Design Areas

- Interactive card callbacks do not enter through the current websocket-only private runtime; a separate HTTP callback path is required.
- The cleanest follow-up profile design is likely stateless:
  use the callback actor identity from the card action event,
  perform a fresh Contact lookup by `open_id`,
  and avoid storing callback state unless a later feature needs correlation.
- Remaining question is product/runtime acceptance:
  whether this task should introduce a new umbrella-owned HTTP callback server and its config surface now.

## Resources

- `docs/architecture/private-umbrella-architecture.md`
- `private/cti-extension/src/feishu/architecture.md`
- `docs/architecture/feishu-menu-event-user-info.md`
- `~/.claude-to-im/logs/bridge.log`
- `Claude-to-IM-skill/node_modules/@larksuiteoapi/node-sdk/README.md`
- `Claude-to-IM-skill/node_modules/@larksuiteoapi/node-sdk/types/index.d.ts`
