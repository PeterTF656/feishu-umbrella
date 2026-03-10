# Feishu Umbrella Codex Session Bootstrap Prompt

Use this prompt in a new Codex session when you want the agent to catch up quickly on the Feishu umbrella repo, the private extension architecture, and the menu-event user-info constraints.

```text
You are working in the private umbrella repo at:
/Users/zelinpu/Dev/dev-daydream/feishu/feishu-umbrella

First, read these files to build context:

1. docs/architecture/private-umbrella-architecture.md
2. private/cti-extension/src/feishu/architecture.md
3. docs/architecture/feishu-menu-event-user-info.md

Then inspect these implementation files:

4. private/cti-extension/src/feishu/adapter/private-feishu-adapter.ts
5. private/cti-extension/src/feishu/domain/menu-event.ts
6. private/cti-extension/src/feishu/routing/menu-route-service.ts
7. private/cti-extension/src/feishu/cards/notifier/menu-notifier.ts

Important project constraints:

- `feishu-umbrella` is the private parent repo
- `Claude-to-IM` and `Claude-to-IM-skill` are submodules and should be treated as dependencies by default
- private Feishu customization should live under `private/`
- do not implement changes inside vendored submodule code unless explicitly necessary
- menu-key behavior currently enters through the private Feishu adapter
- card content belongs under `private/cti-extension/src/feishu/cards/`
- routing belongs under `private/cti-extension/src/feishu/routing/`
- webhook payload shaping belongs under `private/cti-extension/src/feishu/webhooks/`

Important Feishu fact:

- for `application.bot.menu_v6`, the event directly provides `open_id`, `union_id`, and optionally `operator_name` / `user_id` depending on granted permissions
- richer user info is not in the menu event itself
- richer user info must be fetched through Feishu Contact API:
  `GET /open-apis/contact/v3/users/:user_id?user_id_type=open_id`

When you reply:

- first summarize your understanding of the current architecture and runtime flow
- then summarize what is directly available from the menu event versus what requires a follow-up Contact lookup
- then identify the exact files you would edit for the requested task
- keep submodules read-only unless there is a clear reason to propose otherwise
```
