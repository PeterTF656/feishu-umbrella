export interface FeishuMenuEventOperatorId {
  open_id?: string;
  user_id?: string;
  union_id?: string;
}

export interface FeishuMenuEventOperator {
  operator_name?: string;
  operator_id?: FeishuMenuEventOperatorId;
}

export interface FeishuMenuEvent {
  event_id?: string;
  tenant_key?: string;
  event_key?: string;
  timestamp?: number;
  operator?: FeishuMenuEventOperator;
  [key: string]: unknown;
}

export function buildMenuRequestBody<TRoute extends { body?: unknown }>(
  route: TRoute,
  event: FeishuMenuEvent,
  getNow: () => number = Date.now,
): unknown {
  if (route.body === undefined) {
    return buildDefaultMenuPayload(event, getNow);
  }

  return applyMenuPlaceholders(route.body, event);
}

export function buildDefaultMenuPayload(
  event: FeishuMenuEvent,
  getNow: () => number = Date.now,
) {
  return {
    event_key: event.event_key ?? '',
    event_id: event.event_id ?? '',
    timestamp: event.timestamp ?? getNow(),
    tenant_key: event.tenant_key ?? '',
    operator: {
      name: event.operator?.operator_name ?? '',
      open_id: event.operator?.operator_id?.open_id ?? '',
      user_id: event.operator?.operator_id?.user_id ?? '',
      union_id: event.operator?.operator_id?.union_id ?? '',
    },
    raw_event: event,
  };
}

export function applyMenuPlaceholders(value: unknown, event: FeishuMenuEvent): unknown {
  if (typeof value === 'string') {
    return replaceMenuPlaceholders(value, event);
  }

  if (Array.isArray(value)) {
    return value.map((item) => applyMenuPlaceholders(item, event));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, applyMenuPlaceholders(nestedValue, event)]),
    );
  }

  return value;
}

export function replaceMenuPlaceholders(template: string, event: FeishuMenuEvent) {
  const values: Record<string, string> = {
    event_key: event.event_key ?? '',
    event_id: event.event_id ?? '',
    timestamp: event.timestamp == null ? '' : String(event.timestamp),
    tenant_key: event.tenant_key ?? '',
    operator_open_id: event.operator?.operator_id?.open_id ?? '',
    operator_user_id: event.operator?.operator_id?.user_id ?? '',
    operator_union_id: event.operator?.operator_id?.union_id ?? '',
    operator_name: event.operator?.operator_name ?? '',
  };

  return template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_all, key: string) => values[key] ?? '');
}
