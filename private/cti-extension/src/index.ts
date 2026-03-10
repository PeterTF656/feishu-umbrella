import {
  loadPrivateSettings,
  resolvePrivateExtensionPackageRootDir,
  type LoadPrivateSettingsOptions,
} from './config/load-private-settings.js';
import { registerFeishuOverride } from './feishu/index.js';

export interface StartPrivateExtensionOptions extends LoadPrivateSettingsOptions {
  logger?: Pick<Console, 'info'>;
}

export function startPrivateExtension(options: StartPrivateExtensionOptions = {}) {
  const packageRootDir = resolvePrivateExtensionPackageRootDir(options.packageRootDir);
  const settings = loadPrivateSettings({
    ...options,
    packageRootDir,
  });

  const logger = options.logger ?? console;
  logger.info(
    `[cti-extension] private settings loaded (${settings.source}) from ${settings.menuRouteFilePath}`,
  );

  return settings;
}

registerFeishuOverride();

export const privateSettings = startPrivateExtension();

export { loadPrivateSettings } from './config/load-private-settings.js';
export { registerFeishuOverride } from './feishu/index.js';
