import { registerAdapterFactory as fallbackRegisterAdapterFactory } from '../../../../Claude-to-IM-skill/node_modules/claude-to-im/dist/lib/bridge/channel-adapter.js';

import { PrivateFeishuAdapter } from './private-feishu-adapter.js';

const PRIVATE_EXTENSION_API_SYMBOL = Symbol.for('claude-to-im.private-extension-api');

type RegisterAdapterFactory = typeof fallbackRegisterAdapterFactory;

type PrivateExtensionApi = {
  registerAdapterFactory?: RegisterAdapterFactory;
};

function resolveRegisterAdapterFactory(): RegisterAdapterFactory {
  const hostApi = (globalThis as Record<PropertyKey, unknown>)[PRIVATE_EXTENSION_API_SYMBOL] as
    | PrivateExtensionApi
    | undefined;

  if (typeof hostApi?.registerAdapterFactory === 'function') {
    return hostApi.registerAdapterFactory;
  }

  return fallbackRegisterAdapterFactory;
}

export function registerFeishuOverride() {
  resolveRegisterAdapterFactory()('feishu', () => new PrivateFeishuAdapter());
}
