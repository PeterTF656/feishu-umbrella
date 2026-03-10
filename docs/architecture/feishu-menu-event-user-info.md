# Feishu Menu Event User Info

## Purpose

This note records what user information is actually available when the bot receives a Feishu custom menu click event, and what requires a follow-up API lookup.

The target event is:

- `application.bot.menu_v6`

This is the event Feishu sends when a user clicks a bot custom menu item of type "event".

## Official Proof

Primary official documentation:

- Menu event doc:
  `https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/application-v6/bot/events/menu`
- Contact user lookup doc:
  `https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/contact-v3/user/get`

Feishu's doc pages are JS-rendered. If the page content does not load reliably in a CLI/browser session, the same official content can be retrieved from Feishu's own document backend:

- `POST https://open.feishu.cn/api/tools/document/detail`
- request body for the menu event doc:
  `{"fullPath":"/uAjLw4CM/ukTMukTMukTM/application-v6/bot/events/menu"}`
- request body for the Contact user doc:
  `{"fullPath":"/uAjLw4CM/ukTMukTMukTM/reference/contact-v3/user/get"}`

## What Is Available Directly In The Menu Event

Feishu returns a small identity payload in the menu click event itself.

Direct user-related fields:

- `event.operator.operator_id.open_id`
- `event.operator.operator_id.union_id`
- `event.operator.operator_name`
- `event.operator.operator_id.user_id`

Other event metadata that also arrives with the event:

- `header.event_id`
- `header.event_type`
- `header.create_time`
- `header.token`
- `header.app_id`
- `header.tenant_key`
- `event.event_key`
- `event.timestamp`

## Permission Caveats

The menu event can be subscribed without any event-subscription permission, but some fields are permission-gated.

Field-level permission requirements from the official doc:

- `event.operator.operator_name`
  Requires `application:application.bot.operator_name:readonly`
- `event.operator.operator_id.user_id`
  Requires `contact:user.employee_id:readonly`

Practical result:

- `open_id` is the most reliable identity field to build around
- `union_id` is also included
- `operator_name` and tenant-scoped `user_id` may be absent if the app lacks those permissions

## What Is Not Available Directly In The Menu Event

The menu event does not directly provide a full user profile. Do not expect these fields in the event payload:

- avatar URLs
- email
- mobile
- nickname
- department IDs
- leader info
- city or country
- job or employment details
- detailed user status

If those fields are needed, an extra Contact API lookup is required.

## Official Follow-Up API For Richer User Info

Official API:

- `GET https://open.feishu.cn/open-apis/contact/v3/users/:user_id`

Important query parameter:

- `user_id_type`

Supported values from the official doc:

- `open_id`
- `union_id`
- `user_id`

Default value:

- `open_id`

That means the cleanest follow-up from a menu event is:

1. read `event.operator.operator_id.open_id`
2. call `GET /open-apis/contact/v3/users/:user_id?user_id_type=open_id`

This avoids depending on the permission-gated `user_id` field.

## What The Contact User API Can Return

The Contact user API can return a much richer profile, including:

- `name`
- `en_name`
- `nickname`
- `avatar`
- `open_id`
- `union_id`
- `user_id`
- `email`
- `mobile`
- `department_ids`
- `leader_user_id`
- `city`
- `country`
- `status`
- `is_tenant_manager`

Important caveat:

- many of these fields are themselves permission-gated
- using `tenant_access_token` also means the app's Contact permission scope must include the user, or the API can fail with authorization errors such as `41050 no user authority`

## Example Reasoning

For menu-event handling, the practical rule is:

- if you only need to know who clicked the menu, `open_id` from the event is enough
- if you want to display richer profile details in a card or use org data in routing/business logic, do a follow-up Contact lookup using that `open_id`

## Local Code Mapping

These local files are the current umbrella-owned integration points:

- `private/cti-extension/src/feishu/domain/menu-event.ts`
  defines the local event contract used by the extension
- `private/cti-extension/src/feishu/adapter/private-feishu-adapter.ts`
  receives the menu event and is the first place where raw event data is available
- `private/cti-extension/src/feishu/contact/contact-user-service.ts`
  owns the follow-up Contact user lookup by `open_id`
- `private/cti-extension/src/feishu/routing/menu-route-config.ts`
  is where per-menu-key enrichment policy belongs

Current implication for future implementation:

- direct event fields should be read in the adapter flow
- richer user enrichment should be implemented as a private umbrella-owned service called after the route is resolved, using `open_id` as the primary lookup key
- the decision to enrich should be a route contract, not a global adapter rule

## Recommended Implementation Direction

If future menu handlers need user profile enrichment, prefer this sequence:

1. receive `application.bot.menu_v6`
2. resolve the route for `event_key`
3. extract `open_id`, `union_id`, `operator_name`, `event_key`, `tenant_key`
4. perform a Contact user lookup by `open_id` only if that route declares it needs enrichment
5. pass the enriched profile into card-building or downstream service logic

This keeps the adapter resilient even when optional permissions have not been granted yet.

## Official Example Payload Highlights

The official menu event example includes:

- `operator_name`
- `operator_id.union_id`
- `operator_id.user_id`
- `operator_id.open_id`

This confirms that the event is identity-oriented, not profile-oriented.

## Session Notes

This knowledge was verified against the official Feishu documentation on 2026-03-10.
