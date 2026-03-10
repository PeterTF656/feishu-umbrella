import type { FeishuMenuEvent } from '../../domain/menu-event.js';
import { resolveMenuReceivers, type MenuReceiver, type MenuReceiverType } from '../../shared/receivers.js';
import { buildPendingCardContent } from '../content/pending-card.js';
import { buildResultCardContent } from '../content/result-card.js';

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

    const content = buildPendingCardContent(event, routeUrl);
    const outcome = await this.sendWithFallback(receivers, content.cardJson, content.fallbackText);
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

    const content = buildResultCardContent(event, routeUrl, statusLabel, responseText, ok);
    const outcome = await this.sendWithFallback(receivers, content.cardJson, content.fallbackText);
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
