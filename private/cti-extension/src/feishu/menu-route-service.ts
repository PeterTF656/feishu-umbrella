export interface MenuRoute {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
}

export interface MenuRouteServiceOptions {
  dedupMax?: number;
  logger?: Pick<Console, 'warn'>;
}

const DEFAULT_MENU_DEDUP_MAX = 1000;

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

export class MenuRouteService {
  readonly routes: Map<string, MenuRoute>;

  private readonly dedupMax: number;
  private readonly seenEventIds = new Map<string, true>();

  constructor(payload: unknown, options: MenuRouteServiceOptions = {}) {
    this.routes = parseMenuRoutes(payload, options.logger);
    this.dedupMax = normalizeDedupMax(options.dedupMax);
  }

  resolve(eventKey: string | null | undefined): MenuRoute | null {
    const normalizedKey = eventKey?.trim() ?? '';

    if (!normalizedKey) {
      return null;
    }

    return this.routes.get(normalizedKey) ?? this.routes.get('*') ?? null;
  }

  markEventHandled(eventId: string | null | undefined): boolean {
    const normalizedId = eventId?.trim() ?? '';

    if (!normalizedId) {
      return true;
    }

    if (this.seenEventIds.has(normalizedId)) {
      return false;
    }

    this.seenEventIds.set(normalizedId, true);

    if (this.seenEventIds.size > this.dedupMax) {
      const excess = this.seenEventIds.size - this.dedupMax;
      let removed = 0;

      for (const key of this.seenEventIds.keys()) {
        this.seenEventIds.delete(key);
        removed += 1;

        if (removed >= excess) {
          break;
        }
      }
    }

    return true;
  }

  clearSeenEventIds() {
    this.seenEventIds.clear();
  }
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

function normalizeDedupMax(value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_MENU_DEDUP_MAX;
  }

  return Math.floor(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
