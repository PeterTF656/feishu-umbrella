import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PrivateFeishuAdapter } from '../feishu/private-feishu-adapter.js';

type MessageCreateRequest = {
  data: {
    content: string;
    msg_type: string;
    receive_id: string;
  };
  params: {
    receive_id_type: string;
  };
};

type CapturedLog = {
  level: 'error' | 'info' | 'log' | 'warn';
  message: string;
};

function formatLogMessage(args: unknown[]) {
  return args
    .map((value) => {
      if (typeof value === 'string') {
        return value;
      }

      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    })
    .join(' ');
}

function createCapturingLogger() {
  const entries: CapturedLog[] = [];

  return {
    entries,
    logger: {
      error(...args: unknown[]) {
        entries.push({ level: 'error', message: formatLogMessage(args) });
      },
      info(...args: unknown[]) {
        entries.push({ level: 'info', message: formatLogMessage(args) });
      },
      log(...args: unknown[]) {
        entries.push({ level: 'log', message: formatLogMessage(args) });
      },
      warn(...args: unknown[]) {
        entries.push({ level: 'warn', message: formatLogMessage(args) });
      },
    },
  };
}

function createNoopLogger() {
  return {
    error() {},
    info() {},
    log() {},
    warn() {},
  };
}

describe('PrivateFeishuAdapter', () => {
  it('uses a single dispatcher for inbound messages and menu events, then logs the menu flow when debug is enabled', async () => {
    const messageCalls: MessageCreateRequest[] = [];
    const fetchCalls: Array<{ body: string | undefined; init: RequestInit; url: string }> = [];
    const inboundEvents: unknown[] = [];
    const registeredHandlers: Record<string, (data: unknown) => Promise<void>> = {};
    const wsStartCalls: Array<{ eventDispatcher: unknown }> = [];
    const wsCloseCalls: Array<{ force: boolean }> = [];
    const { entries, logger } = createCapturingLogger();

    const adapter = new PrivateFeishuAdapter({
      botIdentityResolver: async () => {},
      bridgeSettings: {
        appId: 'app-id',
        appSecret: 'app-secret',
        domain: 'feishu',
      },
      debugEnabled: true,
      eventDispatcherFactory: () => ({
        register(handlers: Record<string, (data: unknown) => Promise<void>>) {
          Object.assign(registeredHandlers, handlers);
          return this;
        },
      }),
      fetch: async (url, init) => {
        fetchCalls.push({
          body: typeof init?.body === 'string' ? init.body : undefined,
          init: init ?? {},
          url: String(url),
        });

        return {
          ok: true,
          status: 202,
          async text() {
            return JSON.stringify({ queued: true });
          },
        };
      },
      inboundEventHandler: async (data) => {
        inboundEvents.push(data);
      },
      logger,
      restClientFactory: () => ({
        im: {
          message: {
            async create(request: MessageCreateRequest) {
              messageCalls.push(request);
              return { data: { message_id: `message-${messageCalls.length}` } };
            },
          },
        },
      }),
      settingsLoader: () => ({
        menuRouteFilePath: '/tmp/menu-routes.json',
        payload: {
          launch: {
            body: {
              event: '{{event_key}}',
              operator: '{{operator_name}}',
            },
            method: 'post',
            url: 'https://hooks.example.com/launch',
          },
        },
        source: 'local-json',
      }),
      wsClientFactory: () => ({
        close(options: { force: boolean }) {
          wsCloseCalls.push(options);
        },
        start(options: { eventDispatcher: unknown }) {
          wsStartCalls.push(options);
        },
      }),
    });

    await adapter.start();

    assert.equal(wsStartCalls.length, 1);
    assert.deepEqual(Object.keys(registeredHandlers).sort(), [
      'application.bot.menu_v6',
      'im.message.receive_v1',
    ]);

    await registeredHandlers['im.message.receive_v1']({
      message: { message_id: 'msg-inbound-1' },
      sender: { sender_type: 'user' },
    });

    assert.equal(inboundEvents.length, 1);

    await registeredHandlers['application.bot.menu_v6']({
      event_id: 'evt-success-1',
      event_key: 'launch',
      operator: {
        operator_id: {
          open_id: 'ou_success',
          user_id: 'user_success',
          union_id: 'union_success',
        },
        operator_name: 'Ada Lovelace',
      },
      tenant_key: 'tenant-success',
      timestamp: 1700000000000,
    });

    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0]?.url, 'https://hooks.example.com/launch');
    assert.equal(fetchCalls[0]?.init.method, 'POST');
    assert.deepEqual(JSON.parse(fetchCalls[0]?.body ?? '{}'), {
      event: 'launch',
      operator: 'Ada Lovelace',
    });

    assert.equal(messageCalls.length, 2);
    assert.deepEqual(
      messageCalls.map((call) => [call.params.receive_id_type, call.data.receive_id, call.data.msg_type]),
      [
        ['open_id', 'ou_success', 'interactive'],
        ['open_id', 'ou_success', 'interactive'],
      ],
    );

    const pendingCard = JSON.parse(messageCalls[0]!.data.content) as {
      header: { title: { content: string } };
    };
    const resultCard = JSON.parse(messageCalls[1]!.data.content) as {
      body: { elements: Array<{ content: string }> };
      header: { template: string; title: { content: string } };
    };

    assert.equal(pendingCard.header.title.content, 'Menu Request In Progress');
    assert.equal(resultCard.header.template, 'green');
    assert.equal(resultCard.header.title.content, 'Menu Webhook Result');
    assert.match(resultCard.body.elements[0]!.content, /HTTP 202/);

    assert.equal(
      entries.some((entry) => entry.message.includes('dispatcher registered') && entry.message.includes('application.bot.menu_v6')),
      true,
    );
    assert.equal(
      entries.some((entry) => entry.message.includes('menu event received') && entry.message.includes('evt-success-1')),
      true,
    );
    assert.equal(
      entries.some((entry) => entry.message.includes('menu webhook completed') && entry.message.includes('HTTP 202')),
      true,
    );
    assert.equal(
      entries.some((entry) => entry.message.includes('menu notification delivered') && entry.message.includes('pending')),
      true,
    );
    assert.equal(
      entries.some((entry) => entry.message.includes('menu notification delivered') && entry.message.includes('result')),
      true,
    );

    await adapter.stop();

    assert.deepEqual(wsCloseCalls, [{ force: true }]);
  });

  it('dedups event ids and falls back from open_id to user_id with text retry before failure results', async () => {
    const messageCalls: MessageCreateRequest[] = [];
    let fetchCount = 0;

    const adapter = new PrivateFeishuAdapter({
      bridgeSettings: {
        appId: 'app-id',
        appSecret: 'app-secret',
        domain: 'feishu',
      },
      fetch: async () => {
        fetchCount += 1;

        return {
          ok: false,
          status: 500,
          async text() {
            return 'upstream failed';
          },
        };
      },
      logger: createNoopLogger(),
      restClientFactory: () => ({
        im: {
          message: {
            async create(request: MessageCreateRequest) {
              messageCalls.push(request);

              if (request.params.receive_id_type === 'open_id') {
                return { code: 400, msg: 'open id failed' };
              }

              return { data: { message_id: `message-${messageCalls.length}` } };
            },
          },
        },
      }),
      settingsLoader: () => ({
        menuRouteFilePath: '/tmp/menu-routes.json',
        payload: {
          '*': 'https://hooks.example.com/fallback',
        },
        source: 'local-json',
      }),
    });

    await adapter.handleMenuEvent({
      event_id: 'evt-failure-1',
      event_key: 'missing',
      operator: {
        operator_id: {
          open_id: 'ou_failure',
          user_id: 'user_failure',
          union_id: 'union_failure',
        },
        operator_name: 'Grace Hopper',
      },
      tenant_key: 'tenant-failure',
      timestamp: 1700000000001,
    });

    await adapter.handleMenuEvent({
      event_id: 'evt-failure-1',
      event_key: 'missing',
      operator: {
        operator_id: {
          open_id: 'ou_failure',
          user_id: 'user_failure',
          union_id: 'union_failure',
        },
        operator_name: 'Grace Hopper',
      },
    });

    assert.equal(fetchCount, 1);
    assert.deepEqual(
      messageCalls.map((call) => [call.params.receive_id_type, call.data.msg_type]),
      [
        ['open_id', 'interactive'],
        ['open_id', 'text'],
        ['user_id', 'interactive'],
        ['open_id', 'interactive'],
        ['open_id', 'text'],
        ['user_id', 'interactive'],
      ],
    );

    const failureCard = JSON.parse(messageCalls[5]!.data.content) as {
      body: { elements: Array<{ content: string }> };
      header: { template: string };
    };

    assert.equal(failureCard.header.template, 'red');
    assert.match(failureCard.body.elements[0]!.content, /HTTP 500/);
    assert.equal(
      messageCalls.some((call) => call.params.receive_id_type === 'union_id'),
      false,
    );
  });
});
