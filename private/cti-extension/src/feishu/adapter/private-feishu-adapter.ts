// @ts-expect-error The extension intentionally loads the SDK from the sibling skill install.
import * as lark from '../../../../../Claude-to-IM-skill/node_modules/@larksuiteoapi/node-sdk/lib/index.js';
import { FeishuAdapter } from '../../../../../Claude-to-IM-skill/node_modules/claude-to-im/dist/lib/bridge/adapters/feishu-adapter.js';
import { getBridgeContext } from '../../../../../Claude-to-IM-skill/node_modules/claude-to-im/dist/lib/bridge/context.js';

import { loadPrivateSettings, type PrivateSettingsLoadResult } from '../../config/load-private-settings.js';
import { MenuNotifier, type MenuRestClient } from '../cards/notifier/menu-notifier.js';
import { ContactUserService, type ContactUserLookupClient } from '../contact/contact-user-service.js';
import { MenuRouteService } from '../routing/menu-route-service.js';
import { isTruthy, safeJson, type MenuDebugDetails } from '../shared/observability.js';
import { buildMenuRequestBody } from '../webhooks/menu-payload.js';
import type { FeishuMenuEvent } from '../domain/menu-event.js';

export interface BridgeSettings {
  appId: string;
  appSecret: string;
  domain?: string;
}

export interface MenuEventDispatcher {
  register(handlers: Record<string, (data: unknown) => Promise<void>>): unknown;
}

export interface MenuWsClient {
  close(options?: { force?: boolean }): void;
  start(options: { eventDispatcher: unknown }): Promise<void> | void;
}

export interface FetchResponseLike {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<FetchResponseLike>;

export interface PrivateFeishuRestClient extends MenuRestClient, ContactUserLookupClient {}

export interface PrivateFeishuAdapterOptions {
  botIdentityResolver?: (settings: BridgeSettings) => Promise<void>;
  bridgeSettings?: BridgeSettings;
  debugEnabled?: boolean;
  eventDispatcherFactory?: () => MenuEventDispatcher;
  fetch?: FetchLike;
  inboundEventHandler?: (data: unknown) => Promise<void>;
  logger?: Pick<Console, 'error' | 'info' | 'log' | 'warn'>;
  restClientFactory?: (settings: BridgeSettings) => PrivateFeishuRestClient | null;
  settingsLoader?: () => PrivateSettingsLoadResult;
  wsClientFactory?: (settings: BridgeSettings) => MenuWsClient;
}

const DEFAULT_MENU_TIMEOUT_MS = 10_000;
const MENU_DEBUG_ENV = 'CTI_FEISHU_MENU_DEBUG';
const INBOUND_MESSAGE_EVENT_TYPE = 'im.message.receive_v1';
const MENU_EVENT_TYPE = 'application.bot.menu_v6';

export class PrivateFeishuAdapter extends FeishuAdapter {
  private readonly botIdentityResolver: (settings: BridgeSettings) => Promise<void>;
  private readonly bridgeSettingsOverride?: BridgeSettings;
  private readonly debugEnabled: boolean;
  private readonly eventDispatcherFactory: () => MenuEventDispatcher;
  private readonly fetchFn: FetchLike;
  private readonly inboundEventHandler?: (data: unknown) => Promise<void>;
  private readonly logger: Pick<Console, 'error' | 'info' | 'log' | 'warn'>;
  private readonly restClientFactory: (settings: BridgeSettings) => PrivateFeishuRestClient | null;
  private readonly settingsLoader: () => PrivateSettingsLoadResult;
  private readonly wsClientFactory: (settings: BridgeSettings) => MenuWsClient;

  private readonly menuRouteService: MenuRouteService;

  private contactUserService: ContactUserService | null = null;
  private menuNotifier: MenuNotifier | null = null;
  private menuRestClient: PrivateFeishuRestClient | null = null;

  constructor(options: PrivateFeishuAdapterOptions = {}) {
    super();
    this.botIdentityResolver = options.botIdentityResolver ?? ((settings) => this.resolveInheritedBotIdentity(settings));
    this.bridgeSettingsOverride = options.bridgeSettings;
    this.debugEnabled = options.debugEnabled ?? isTruthy(process.env[MENU_DEBUG_ENV]);
    this.eventDispatcherFactory = options.eventDispatcherFactory ?? createDefaultEventDispatcher;
    this.fetchFn = options.fetch ?? globalThis.fetch;
    this.inboundEventHandler = options.inboundEventHandler;
    this.logger = options.logger ?? console;
    this.restClientFactory = options.restClientFactory ?? createDefaultRestClient;
    this.settingsLoader = options.settingsLoader ?? loadPrivateSettings;
    this.wsClientFactory = options.wsClientFactory ?? createDefaultWsClient;
    this.menuRouteService = new MenuRouteService(this.settingsLoader().payload, {
      logger: this.logger,
    });
  }

  async start(): Promise<void> {
    const adapterState = this as any;
    if (adapterState.running) {
      this.debug('adapter start skipped because it is already running');
      return;
    }

    if (!this.bridgeSettingsOverride) {
      const configError = super.validateConfig();
      if (configError) {
        this.logger.warn('[feishu-adapter] Cannot start:', configError);
        this.debug('adapter start aborted by validateConfig', { config_error: configError });
        return;
      }
    }

    const bridgeSettings = this.resolveBridgeSettings();
    if (!bridgeSettings) {
      this.logger.warn('[cti-extension] Feishu menu adapter skipped: missing bridge settings');
      this.debug('adapter start aborted because bridge settings are missing');
      return;
    }

    const restClient = this.restClientFactory(bridgeSettings);
    if (!restClient) {
      this.logger.warn('[cti-extension] Feishu adapter skipped: failed to initialize REST client');
      this.debug('adapter start aborted because rest client factory returned null');
      return;
    }

    adapterState.restClient = restClient;
    await this.botIdentityResolver(bridgeSettings);
    adapterState.running = true;

    const dispatcher = this.eventDispatcherFactory();
    const handlers: Record<string, (data: unknown) => Promise<void>> = {
      [INBOUND_MESSAGE_EVENT_TYPE]: async (data) => {
        await this.handleInboundEvent(data);
      },
      [MENU_EVENT_TYPE]: async (data) => {
        await this.handleMenuEvent(data as FeishuMenuEvent);
      },
    };
    const eventDispatcher = dispatcher.register(handlers);
    this.debug('dispatcher registered', {
      handler_keys: Object.keys(handlers),
      route_count: this.menuRouteService.routes.size,
      route_keys: [...this.menuRouteService.routes.keys()],
    });

    const wsClient = this.wsClientFactory(bridgeSettings);
    adapterState.wsClient = wsClient;
    await wsClient.start({ eventDispatcher });
    this.ensureMenuNotifier(bridgeSettings);
    this.debug('single ws client started', {
      domain: bridgeSettings.domain ?? 'feishu',
      route_count: this.menuRouteService.routes.size,
    });

    this.logger.info('[feishu-adapter] Started (botOpenId:', adapterState.botOpenId || 'unknown', ')');
  }

  async stop(): Promise<void> {
    this.contactUserService = null;
    this.menuNotifier = null;
    this.menuRestClient = null;
    this.menuRouteService.clearSeenEventIds();
    await super.stop();
  }

  async handleMenuEvent(event: FeishuMenuEvent): Promise<void> {
    const eventKey = event.event_key?.trim() ?? '';
    const eventId = event.event_id?.trim() ?? '';
    this.debug('menu event received', {
      event_id: eventId || null,
      event_key: eventKey || null,
      operator_open_id: event.operator?.operator_id?.open_id ?? null,
      tenant_key: event.tenant_key ?? null,
    });

    if (!eventKey) {
      this.logger.warn('[cti-extension] Menu event ignored: missing event_key');
      this.debug('menu event ignored because event_key is missing', { event_id: eventId || null });
      return;
    }

    if (!this.menuRouteService.markEventHandled(event.event_id)) {
      this.logger.log(`[cti-extension] Duplicate menu event ignored: ${event.event_id}`);
      this.debug('menu event ignored as duplicate', { event_id: eventId || null, event_key: eventKey });
      return;
    }

    const route = this.menuRouteService.resolve(eventKey);
    if (!route) {
      this.logger.log(`[cti-extension] Menu event ignored (no route): ${eventKey}`);
      this.debug('menu event ignored because no route resolved', { event_id: eventId || null, event_key: eventKey });
      return;
    }

    this.debug('menu route resolved', {
      event_id: eventId || null,
      event_key: eventKey,
      method: (route.method ?? 'POST').toUpperCase(),
      url: route.url,
    });

    const notifier = this.ensureMenuNotifier(this.resolveBridgeSettings());
    await notifier?.sendPending(event, route.url);
    const contactUser = await this.resolveContactUser(route, event);

    const method = (route.method ?? 'POST').toUpperCase();
    const headers = {
      'Content-Type': 'application/json',
      ...(route.headers ?? {}),
    };
    const timeoutMs = route.timeoutMs ?? DEFAULT_MENU_TIMEOUT_MS;
    const body = buildMenuRequestBody(route, event, { contactUser });
    const startedAt = Date.now();

    this.debug('menu webhook request started', {
      event_id: eventId || null,
      event_key: eventKey,
      method,
      timeout_ms: timeoutMs,
      url: route.url,
    });

    try {
      const response = await this.fetchFn(route.url, {
        method,
        headers,
        body: method === 'GET' || method === 'HEAD' ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const responseText = await response.text();
      const statusLabel = `HTTP ${response.status}`;

      this.debug('menu webhook completed', {
        duration_ms: Date.now() - startedAt,
        event_id: eventId || null,
        event_key: eventKey,
        response_length: responseText.length,
        status: statusLabel,
        url: route.url,
      });

      if (!response.ok) {
        await notifier?.sendResult(event, route.url, statusLabel, responseText, false);
        return;
      }

      await notifier?.sendResult(event, route.url, statusLabel, responseText, true);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.debug('menu webhook failed', {
        duration_ms: Date.now() - startedAt,
        error: reason,
        event_id: eventId || null,
        event_key: eventKey,
        url: route.url,
      });
      await notifier?.sendResult(event, route.url, 'request_error', reason, false);
    }
  }

  private ensureMenuNotifier(bridgeSettings: BridgeSettings | null) {
    if (this.menuNotifier) {
      return this.menuNotifier;
    }

    const restClient = this.ensureRestClient(bridgeSettings);
    if (!restClient) {
      this.debug('menu notifier unavailable because rest client is missing');
      return null;
    }

    this.menuNotifier = new MenuNotifier({
      debugLog: (message, details) => this.debug(message, details),
      logger: this.logger,
      restClient,
    });

    return this.menuNotifier;
  }

  private ensureContactUserService(bridgeSettings: BridgeSettings | null) {
    if (this.contactUserService) {
      return this.contactUserService;
    }

    const restClient = this.ensureRestClient(bridgeSettings);
    if (!restClient) {
      this.debug('contact user service unavailable because rest client is missing');
      return null;
    }

    this.contactUserService = new ContactUserService({
      debugLog: (message, details) => this.debug(message, details),
      logger: this.logger,
      restClient,
    });

    return this.contactUserService;
  }

  private ensureRestClient(bridgeSettings: BridgeSettings | null) {
    const adapterState = this as any;
    if (!this.menuRestClient) {
      this.menuRestClient = adapterState.restClient ?? (bridgeSettings ? this.restClientFactory(bridgeSettings) : null);
    }

    return this.menuRestClient;
  }

  private async resolveContactUser(route: { userEnrichment?: string }, event: FeishuMenuEvent) {
    if (route.userEnrichment !== 'contact_by_open_id') {
      return null;
    }

    const openId = event.operator?.operator_id?.open_id?.trim() ?? '';
    if (!openId) {
      this.debug('menu contact enrichment skipped because operator open_id is missing', {
        event_id: event.event_id ?? null,
        event_key: event.event_key ?? null,
      });
      return null;
    }

    const contactUser = await this.ensureContactUserService(this.resolveBridgeSettings())?.getByOpenId(openId);
    this.debug('menu contact enrichment completed', {
      contact_user_found: !!contactUser,
      event_id: event.event_id ?? null,
      event_key: event.event_key ?? null,
      open_id: openId,
    });
    return contactUser ?? null;
  }

  private async handleInboundEvent(data: unknown) {
    if (this.inboundEventHandler) {
      await this.inboundEventHandler(data);
      this.debug('inbound event delegated through injected handler');
      return;
    }

    const inheritedHandler = (this as any).handleIncomingEvent;
    if (typeof inheritedHandler !== 'function') {
      throw new Error('FeishuAdapter.handleIncomingEvent is unavailable');
    }

    await inheritedHandler.call(this, data);
  }

  private resolveBridgeSettings(): BridgeSettings | null {
    if (this.bridgeSettingsOverride) {
      return this.bridgeSettingsOverride;
    }

    try {
      const store = getBridgeContext().store;
      const appId = store.getSetting('bridge_feishu_app_id') || '';
      const appSecret = store.getSetting('bridge_feishu_app_secret') || '';
      const domain = store.getSetting('bridge_feishu_domain') || 'feishu';

      if (!appId || !appSecret) {
        return null;
      }

      return {
        appId,
        appSecret,
        domain,
      };
    } catch {
      return null;
    }
  }

  private async resolveInheritedBotIdentity(settings: BridgeSettings) {
    const inheritedResolver = (this as any).resolveBotIdentity;
    if (typeof inheritedResolver !== 'function') {
      return;
    }

    await inheritedResolver.call(
      this,
      settings.appId,
      settings.appSecret,
      resolveLarkDomain(settings.domain),
    );
  }

  private debug(message: string, details?: MenuDebugDetails) {
    if (!this.debugEnabled) {
      return;
    }

    if (!details || Object.keys(details).length === 0) {
      this.logger.info(`[cti-extension][menu-debug] ${message}`);
      return;
    }

    this.logger.info(`[cti-extension][menu-debug] ${message} ${safeJson(details)}`);
  }
}

function createDefaultEventDispatcher() {
  return new lark.EventDispatcher({});
}

function createDefaultRestClient(settings: BridgeSettings) {
  return new lark.Client({
    appId: settings.appId,
    appSecret: settings.appSecret,
    domain: resolveLarkDomain(settings.domain),
  }) as PrivateFeishuRestClient;
}

function createDefaultWsClient(settings: BridgeSettings) {
  return new lark.WSClient({
    appId: settings.appId,
    appSecret: settings.appSecret,
    domain: resolveLarkDomain(settings.domain),
  }) as MenuWsClient;
}

function resolveLarkDomain(domain: string | undefined) {
  return domain === 'lark' ? lark.Domain.Lark : lark.Domain.Feishu;
}
