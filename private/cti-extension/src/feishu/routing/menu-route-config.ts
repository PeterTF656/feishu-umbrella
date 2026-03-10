export type MenuUserEnrichment = 'contact_by_open_id';

export interface MenuRoute {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  userEnrichment?: MenuUserEnrichment;
}

export function parseMenuRoutes(
  payload: unknown,
  logger: Pick<Console, 'warn'> = console,
): Map<string, MenuRoute> {
  const routeMap = new Map<string, MenuRoute>();

  if (!isRecord(payload)) {
    if (payload != null) {
      logger.warn('[cti-extension] menu route payload must be a JSON object');
    }
    return routeMap;
  }

  for (const [eventKey, routeValue] of Object.entries(payload)) {
    const route = normalizeMenuRoute(routeValue);

    if (route) {
      routeMap.set(eventKey, route);
    }
  }

  return routeMap;
}

function normalizeMenuRoute(routeValue: unknown): MenuRoute | null {
  if (typeof routeValue === 'string') {
    const url = routeValue.trim();

    return url ? { url } : null;
  }

  if (!isRecord(routeValue)) {
    return null;
  }

  const url = typeof routeValue.url === 'string' ? routeValue.url.trim() : '';

  if (!url) {
    return null;
  }

  const headers = normalizeHeaders(routeValue.headers);
  const timeoutMs = normalizeTimeout(routeValue.timeoutMs);
  const userEnrichment = normalizeUserEnrichment(routeValue.userEnrichment);

  const route: MenuRoute = { url };

  if (typeof routeValue.method === 'string') {
    route.method = routeValue.method.toUpperCase();
  }

  if (headers) {
    route.headers = headers;
  }

  if (Object.prototype.hasOwnProperty.call(routeValue, 'body')) {
    route.body = routeValue.body;
  }

  if (timeoutMs !== undefined) {
    route.timeoutMs = timeoutMs;
  }

  if (userEnrichment) {
    route.userEnrichment = userEnrichment;
  }

  return route;
}

function normalizeHeaders(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const headers = Object.fromEntries(
    Object.entries(value).filter(([, headerValue]) => typeof headerValue === 'string'),
  ) as Record<string, string>;

  return Object.keys(headers).length > 0 ? headers : undefined;
}

function normalizeTimeout(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  return Math.floor(value);
}

function normalizeUserEnrichment(value: unknown): MenuUserEnrichment | undefined {
  if (value === 'contact_by_open_id') {
    return value;
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
