import { parseMenuRoutes, type MenuRoute } from './menu-route-config.js';

export { parseMenuRoutes } from './menu-route-config.js';
export type { MenuRoute } from './menu-route-config.js';

export interface MenuRouteServiceOptions {
  dedupMax?: number;
  logger?: Pick<Console, 'warn'>;
}

const DEFAULT_MENU_DEDUP_MAX = 1000;

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

function normalizeDedupMax(value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_MENU_DEDUP_MAX;
  }

  return Math.floor(value);
}
