export type MenuDebugDetails = Record<string, unknown>;

export function isTruthy(value: string | undefined) {
  if (!value) {
    return false;
  }

  return !['0', 'false', 'no', 'off'].includes(value.trim().toLowerCase());
}

export function safeJson(value: MenuDebugDetails) {
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
}
