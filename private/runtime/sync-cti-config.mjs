import os from 'node:os';
import path from 'node:path';

import { syncPrivateRuntimeConfig } from '../cti-extension/dist/runtime/runtime-config-sync.js';

const ctiHomeDir = process.env.CTI_HOME || path.join(os.homedir(), '.claude-to-im');

const result = syncPrivateRuntimeConfig({ ctiHomeDir });

if (result.foundRuntimeEnvFile) {
  console.log(`[feishu-umbrella] synced runtime config to ${result.ctiConfigPath}`);
} else {
  console.log(
    `[feishu-umbrella] no private runtime config found at ${result.runtimeEnvLocalPath}; leaving ${result.ctiConfigPath} unchanged`,
  );
}
