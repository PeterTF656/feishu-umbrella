import type { FeishuContactUser } from '../domain/contact-user.js';
import type { FeishuMenuEvent } from '../domain/menu-event.js';
import type { MenuRoute } from '../routing/menu-route-config.js';

export interface MenuPayloadContext {
  contactUser?: FeishuContactUser | null;
  getNow?: () => number;
}

export type { FeishuMenuEvent } from '../domain/menu-event.js';

export function buildMenuRequestBody(
  route: MenuRoute,
  event: FeishuMenuEvent,
  context: MenuPayloadContext = {},
): unknown {
  if (route.body === undefined) {
    return buildDefaultMenuPayload(event, context);
  }

  return applyMenuPlaceholders(route.body, event, context);
}

export function buildDefaultMenuPayload(
  event: FeishuMenuEvent,
  context: MenuPayloadContext = {},
) {
  const payload: Record<string, unknown> = {
    event_key: event.event_key ?? '',
    event_id: event.event_id ?? '',
    timestamp: event.timestamp ?? (context.getNow ?? Date.now)(),
    tenant_key: event.tenant_key ?? '',
    operator: {
      name: event.operator?.operator_name ?? '',
      open_id: event.operator?.operator_id?.open_id ?? '',
      user_id: event.operator?.operator_id?.user_id ?? '',
      union_id: event.operator?.operator_id?.union_id ?? '',
    },
    raw_event: event,
  };

  if (context.contactUser) {
    payload.contact_user = context.contactUser;
  }

  return payload;
}

export function applyMenuPlaceholders(
  value: unknown,
  event: FeishuMenuEvent,
  context: MenuPayloadContext = {},
): unknown {
  if (typeof value === 'string') {
    return replaceMenuPlaceholders(value, event, context);
  }

  if (Array.isArray(value)) {
    return value.map((item) => applyMenuPlaceholders(item, event, context));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, applyMenuPlaceholders(nestedValue, event, context)]),
    );
  }

  return value;
}

export function replaceMenuPlaceholders(
  template: string,
  event: FeishuMenuEvent,
  context: MenuPayloadContext = {},
) {
  const contactUser = context.contactUser;
  const values: Record<string, string> = {
    event_key: event.event_key ?? '',
    event_id: event.event_id ?? '',
    timestamp: event.timestamp == null ? '' : String(event.timestamp),
    tenant_key: event.tenant_key ?? '',
    contact_user_avatar_origin: contactUser?.avatar?.avatar_origin ?? '',
    contact_user_city: contactUser?.city ?? '',
    contact_user_country: contactUser?.country ?? '',
    contact_user_email: contactUser?.email ?? '',
    contact_user_en_name: contactUser?.en_name ?? '',
    contact_user_leader_user_id: contactUser?.leader_user_id ?? '',
    contact_user_mobile: contactUser?.mobile ?? '',
    contact_user_name: contactUser?.name ?? '',
    contact_user_nickname: contactUser?.nickname ?? '',
    contact_user_open_id: contactUser?.open_id ?? '',
    contact_user_union_id: contactUser?.union_id ?? '',
    contact_user_user_id: contactUser?.user_id ?? '',
    operator_open_id: event.operator?.operator_id?.open_id ?? '',
    operator_user_id: event.operator?.operator_id?.user_id ?? '',
    operator_union_id: event.operator?.operator_id?.union_id ?? '',
    operator_name: event.operator?.operator_name ?? '',
  };

  return template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_all, key: string) => values[key] ?? '');
}
