import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { MenuRouteService, parseMenuRoutes } from '../feishu/routing/menu-route-service.js';

describe('menu-route-service', () => {
  it('parses string and object route entries', () => {
    const routes = parseMenuRoutes({
      launch: 'https://hooks.example.com/launch',
      review: {
        url: ' https://hooks.example.com/review ',
        method: 'patch',
        userEnrichment: 'contact_by_open_id',
        headers: {
          Authorization: 'Bearer token',
          'X-Ignored': 42,
        },
        body: {
          eventId: '{{event_id}}',
        },
        timeoutMs: 4321,
      },
      missingUrl: {
        method: 'post',
      },
      blank: '   ',
    });

    assert.deepEqual(Array.from(routes.keys()), ['launch', 'review']);
    assert.deepEqual(routes.get('launch'), {
      url: 'https://hooks.example.com/launch',
    });
    assert.deepEqual(routes.get('review'), {
      url: 'https://hooks.example.com/review',
      method: 'PATCH',
      userEnrichment: 'contact_by_open_id',
      headers: {
        Authorization: 'Bearer token',
      },
      body: {
        eventId: '{{event_id}}',
      },
      timeoutMs: 4321,
    });
  });

  it('uses the wildcard route when there is no exact match', () => {
    const service = new MenuRouteService({
      launch: 'https://hooks.example.com/launch',
      '*': {
        url: 'https://hooks.example.com/fallback',
        method: 'post',
      },
    });

    assert.deepEqual(service.resolve('launch'), {
      url: 'https://hooks.example.com/launch',
    });
    assert.deepEqual(service.resolve('missing'), {
      url: 'https://hooks.example.com/fallback',
      method: 'POST',
    });
    assert.equal(service.resolve(''), null);
  });

  it('dedups menu event ids and evicts older ids once the cache is full', () => {
    const service = new MenuRouteService({}, { dedupMax: 2 });

    assert.equal(service.markEventHandled('evt-1'), true);
    assert.equal(service.markEventHandled('evt-1'), false);
    assert.equal(service.markEventHandled('evt-2'), true);
    assert.equal(service.markEventHandled('evt-3'), true);
    assert.equal(service.markEventHandled('evt-1'), true);
    assert.equal(service.markEventHandled(''), true);
  });
});
