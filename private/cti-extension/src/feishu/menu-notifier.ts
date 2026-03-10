import type { FeishuMenuEvent } from './menu-payload.js';

export type MenuReceiverType = 'open_id' | 'user_id' | 'union_id';

export interface MenuReceiver {
  id: string;
  type: MenuReceiverType;
}

export interface MenuMessageCreateRequest {
  data: {
    content: string;
    msg_type: 'interactive' | 'text';
    receive_id: string;
  };
  params: {
    receive_id_type: MenuReceiverType;
  };
}

export interface MenuRestClient {
  im: {
    message: {
      create(request: MenuMessageCreateRequest): Promise<{
        code?: number;
        data?: { message_id?: string };
        msg?: string;
      }>;
    };
  };
}

export interface MenuNotifierOptions {
  debugLog?: (message: string, details?: Record<string, unknown>) => void;
  logger?: Pick<Console, 'info' | 'warn'>;
  restClient: MenuRestClient | null;
}

export class MenuNotifier {
  private readonly debugLog?: (message: string, details?: Record<string, unknown>) => void;
  private readonly logger: Pick<Console, 'info' | 'warn'>;
  private readonly restClient: MenuRestClient | null;

  constructor(options: MenuNotifierOptions) {
    this.debugLog = options.debugLog;
    this.logger = options.logger ?? console;
    this.restClient = options.restClient;
  }

  async sendPending(event: FeishuMenuEvent, routeUrl: string): Promise<void> {
    const receivers = resolveMenuReceivers(event);
    if (!this.restClient || receivers.length === 0) {
      this.debugLog?.('menu notification skipped', {
        has_rest_client: !!this.restClient,
        phase: 'pending',
        receiver_count: receivers.length,
      });
      return;
    }

    const bodyMarkdown = [
      '⏳ **Working on your request...**',
      '',
      `**event_key**: \`${event.event_key ?? ''}\``,
      `**event_id**: \`${event.event_id ?? ''}\``,
      `**endpoint**: \`${routeUrl}\``,
      '',
      'Sending HTTP request now, result will follow shortly.',
    ].join('\n');

    const cardJson = JSON.stringify({
      schema: '2.0',
      config: { wide_screen_mode: true },
      header: {
        template: 'blue',
        title: { tag: 'plain_text', content: 'Menu Request In Progress' },
      },
      body: {
        elements: [{ tag: 'markdown', content: bodyMarkdown }],
      },
    });

    const fallbackText = [
      'Working on your menu request...',
      `event_key: ${event.event_key ?? ''}`,
      `event_id: ${event.event_id ?? ''}`,
      `endpoint: ${routeUrl}`,
    ].join('\n');

    const outcome = await this.sendWithFallback(receivers, cardJson, fallbackText);
    this.debugLog?.('menu notification delivered', {
      delivered: outcome.delivered,
      msg_type: outcome.msgType ?? null,
      phase: 'pending',
      receiver_type: outcome.receiverType ?? null,
      route_url: routeUrl,
    });
  }

  async sendResult(
    event: FeishuMenuEvent,
    routeUrl: string,
    statusLabel: string,
    responseText: string,
    ok: boolean,
  ): Promise<void> {
    const receivers = resolveMenuReceivers(event);
    if (!this.restClient || receivers.length === 0) {
      this.debugLog?.('menu notification skipped', {
        has_rest_client: !!this.restClient,
        phase: 'result',
        receiver_count: receivers.length,
        status: statusLabel,
      });
      return;
    }

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

    const cardJson = JSON.stringify({
      schema: '2.0',
      config: { wide_screen_mode: true },
      header: {
        template: ok ? 'green' : 'red',
        title: { tag: 'plain_text', content: 'Menu Webhook Result' },
      },
      body: {
        elements: [{ tag: 'markdown', content: bodyMarkdown }],
      },
    });

    const fallbackText = [
      'Menu webhook result',
      `event_key: ${event.event_key ?? ''}`,
      `event_id: ${event.event_id ?? ''}`,
      `status: ${statusLabel}`,
      `endpoint: ${routeUrl}`,
      '',
      `response: ${responseSnippet}`,
    ].join('\n');

    const outcome = await this.sendWithFallback(receivers, cardJson, fallbackText);
    this.debugLog?.('menu notification delivered', {
      delivered: outcome.delivered,
      msg_type: outcome.msgType ?? null,
      phase: 'result',
      receiver_type: outcome.receiverType ?? null,
      route_url: routeUrl,
      status: statusLabel,
    });
  }

  private async sendWithFallback(
    receivers: MenuReceiver[],
    cardJson: string,
    fallbackText: string,
  ): Promise<{ delivered: boolean; msgType?: 'interactive' | 'text'; receiverType?: MenuReceiverType }> {
    for (const receiver of receivers) {
      const cardOk = await this.trySendCard(receiver, cardJson);
      if (cardOk) {
        return {
          delivered: true,
          msgType: 'interactive',
          receiverType: receiver.type,
        };
      }

      const textOk = await this.trySendText(receiver, fallbackText);
      if (textOk) {
        return {
          delivered: true,
          msgType: 'text',
          receiverType: receiver.type,
        };
      }
    }

    return { delivered: false };
  }

  private async trySendCard(receiver: MenuReceiver, cardJson: string): Promise<boolean> {
    return this.trySendMessage(receiver, 'interactive', cardJson);
  }

  private async trySendText(receiver: MenuReceiver, text: string): Promise<boolean> {
    return this.trySendMessage(receiver, 'text', JSON.stringify({ text }));
  }

  private async trySendMessage(
    receiver: MenuReceiver,
    msgType: 'interactive' | 'text',
    content: string,
  ): Promise<boolean> {
    try {
      const response = await this.restClient!.im.message.create({
        params: {
          receive_id_type: receiver.type,
        },
        data: {
          receive_id: receiver.id,
          msg_type: msgType,
          content,
        },
      });

      return !!response?.data?.message_id;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`[cti-extension] Menu notification send failed via ${receiver.type}: ${reason}`);
      return false;
    }
  }
}

export function resolveMenuReceivers(event: FeishuMenuEvent): MenuReceiver[] {
  const receivers: MenuReceiver[] = [];
  const openId = event.operator?.operator_id?.open_id ?? '';
  const userId = event.operator?.operator_id?.user_id ?? '';
  const unionId = event.operator?.operator_id?.union_id ?? '';

  if (openId) {
    receivers.push({ type: 'open_id', id: openId });
  }

  if (userId) {
    receivers.push({ type: 'user_id', id: userId });
  }

  if (unionId) {
    receivers.push({ type: 'union_id', id: unionId });
  }

  return receivers;
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
