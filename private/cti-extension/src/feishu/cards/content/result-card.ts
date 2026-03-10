import type { FeishuMenuEvent } from '../../domain/menu-event.js';

import { buildResultFallbackText } from './fallback-text.js';
import type { MenuCardMessageContent } from './pending-card.js';

export function buildResultCardContent(
  event: FeishuMenuEvent,
  routeUrl: string,
  statusLabel: string,
  responseText: string,
  ok: boolean,
): MenuCardMessageContent {
  const responseSnippet = toCardSnippet(responseText, 1200);
  const bodyMarkdown = [
    `**event_key**: \`${event.event_key ?? ''}\``,
    `**event_id**: \`${event.event_id ?? ''}\``,
    `**status**: \`${statusLabel}\``,
    `**endpoint**: \`${routeUrl}\``,
    '',
    '**endpoint response (trimmed)**',
    '```',
    responseSnippet,
    '```',
  ].join('\n');

  return {
    cardJson: JSON.stringify({
      schema: '2.0',
      config: { wide_screen_mode: true },
      header: {
        template: ok ? 'green' : 'red',
        title: { tag: 'plain_text', content: 'Menu Webhook Result' },
      },
      body: {
        elements: [{ tag: 'markdown', content: bodyMarkdown }],
      },
    }),
    fallbackText: buildResultFallbackText(event, routeUrl, statusLabel, responseSnippet),
  };
}

export function toCardSnippet(raw: string, maxLen: number) {
  let text = raw;

  try {
    text = JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    // Keep raw string when the response is not JSON.
  }

  text = text.replace(/```/g, "'''");

  if (text.length > maxLen) {
    return `${text.slice(0, maxLen)}\n...`;
  }

  return text;
}
