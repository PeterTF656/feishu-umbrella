import type { FeishuMenuEvent } from '../../domain/menu-event.js';

import { buildPendingFallbackText } from './fallback-text.js';

export interface MenuCardMessageContent {
  cardJson: string;
  fallbackText: string;
}

export function buildPendingCardContent(
  event: FeishuMenuEvent,
  routeUrl: string,
): MenuCardMessageContent {
  const bodyMarkdown = [
    '⏳ **Working on your request...**',
    '',
    `**event_key**: \`${event.event_key ?? ''}\``,
    `**event_id**: \`${event.event_id ?? ''}\``,
    `**endpoint**: \`${routeUrl}\``,
    '',
    'Sending HTTP request now, result will follow shortly.',
  ].join('\n');

  return {
    cardJson: JSON.stringify({
      schema: '2.0',
      config: { wide_screen_mode: true },
      header: {
        template: 'blue',
        title: { tag: 'plain_text', content: 'Menu Request In Progress' },
      },
      body: {
        elements: [{ tag: 'markdown', content: bodyMarkdown }],
      },
    }),
    fallbackText: buildPendingFallbackText(event, routeUrl),
  };
}
