import type { FeishuMenuEvent } from '../domain/menu-event.js';

export type MenuReceiverType = 'open_id' | 'user_id' | 'union_id';

export interface MenuReceiver {
  id: string;
  type: MenuReceiverType;
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
