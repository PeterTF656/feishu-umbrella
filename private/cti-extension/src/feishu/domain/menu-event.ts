export interface FeishuMenuEventOperatorId {
  open_id?: string;
  user_id?: string;
  union_id?: string;
}

export interface FeishuMenuEventOperator {
  operator_name?: string;
  operator_id?: FeishuMenuEventOperatorId;
}

export interface FeishuMenuEvent {
  event_id?: string;
  tenant_key?: string;
  event_key?: string;
  timestamp?: number;
  operator?: FeishuMenuEventOperator;
  [key: string]: unknown;
}
