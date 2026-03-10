import type { FeishuMenuEvent } from '../../domain/menu-event.js';

export function buildPendingFallbackText(event: FeishuMenuEvent, routeUrl: string) {
  return [
    'Working on your menu request...',
    `event_key: ${event.event_key ?? ''}`,
    `event_id: ${event.event_id ?? ''}`,
    `endpoint: ${routeUrl}`,
  ].join('\n');
}

export function buildResultFallbackText(
  event: FeishuMenuEvent,
  routeUrl: string,
  statusLabel: string,
  responseSnippet: string,
) {
  return [
    'Menu webhook result',
    `event_key: ${event.event_key ?? ''}`,
    `event_id: ${event.event_id ?? ''}`,
    `status: ${statusLabel}`,
    `endpoint: ${routeUrl}`,
    '',
    `response: ${responseSnippet}`,
  ].join('\n');
}
