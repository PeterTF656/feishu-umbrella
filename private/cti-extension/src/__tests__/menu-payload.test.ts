import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  applyMenuPlaceholders,
  buildDefaultMenuPayload,
  buildMenuRequestBody,
  type FeishuMenuEvent,
} from '../feishu/menu-payload.js';
import type { MenuRoute } from '../feishu/menu-route-service.js';

const event: FeishuMenuEvent = {
  event_key: 'launch',
  event_id: 'evt-123',
  tenant_key: 'tenant-456',
  timestamp: 1700000000000,
  operator: {
    operator_name: 'Ada Lovelace',
    operator_id: {
      open_id: 'ou_123',
      user_id: 'u_456',
      union_id: 'on_789',
    },
  },
};

describe('menu-payload', () => {
  it('replaces supported placeholders recursively', () => {
    const payload = applyMenuPlaceholders(
      {
        key: '{{event_key}}',
        ids: ['{{event_id}}', '{{operator_open_id}}', '{{operator_user_id}}', '{{operator_union_id}}'],
        nested: {
          timestamp: '{{timestamp}}',
          tenant: '{{tenant_key}}',
          operator: '{{operator_name}}',
        },
      },
      event,
    );

    assert.deepEqual(payload, {
      key: 'launch',
      ids: ['evt-123', 'ou_123', 'u_456', 'on_789'],
      nested: {
        timestamp: '1700000000000',
        tenant: 'tenant-456',
        operator: 'Ada Lovelace',
      },
    });
  });

  it('builds the historical default payload shape when route.body is absent', () => {
    const route: MenuRoute = {
      url: 'https://hooks.example.com/launch',
    };

    assert.deepEqual(buildDefaultMenuPayload(event), {
      event_key: 'launch',
      event_id: 'evt-123',
      timestamp: 1700000000000,
      tenant_key: 'tenant-456',
      operator: {
        name: 'Ada Lovelace',
        open_id: 'ou_123',
        user_id: 'u_456',
        union_id: 'on_789',
      },
      raw_event: event,
    });

    assert.deepEqual(
      buildMenuRequestBody(route, event),
      buildDefaultMenuPayload(event),
    );
  });

  it('uses the current time for the default payload when the event timestamp is absent', () => {
    const route: MenuRoute = {
      url: 'https://hooks.example.com/launch',
    };

    const payload = buildMenuRequestBody(
      route,
      {
        event_id: 'evt-no-timestamp',
      },
      () => 1700001234567,
    );

    assert.equal((payload as { timestamp: number }).timestamp, 1700001234567);
  });
});
