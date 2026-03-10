import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { resolveRunnerContractPaths } from './runner-env-contract.js';

export interface ResolvePrivateRuntimeConfigSyncPathsOptions {
  ctiHomeDir?: string;
  packageRootDir?: string;
}

export interface PrivateRuntimeConfigSyncPaths {
  ctiConfigPath: string;
  ctiHomeDir: string;
  runtimeEnvLocalPath: string;
}

export interface SyncPrivateRuntimeConfigOptions extends ResolvePrivateRuntimeConfigSyncPathsOptions {}

export interface SyncPrivateRuntimeConfigResult extends PrivateRuntimeConfigSyncPaths {
  foundRuntimeEnvFile: boolean;
}

export function resolvePrivateRuntimeConfigSyncPaths(
  options: ResolvePrivateRuntimeConfigSyncPathsOptions = {},
): PrivateRuntimeConfigSyncPaths {
  const runnerPaths = resolveRunnerContractPaths({
    packageRootDir: options.packageRootDir,
  });
  const ctiHomeDir = options.ctiHomeDir ?? path.join(os.homedir(), '.claude-to-im');

  return {
    ctiConfigPath: path.join(ctiHomeDir, 'config.env'),
    ctiHomeDir,
    runtimeEnvLocalPath: path.join(runnerPaths.umbrellaRootDir, 'private', 'config', 'runtime.env.local'),
  };
}

export function parsePrivateRuntimeEnvFile(content: string): Array<[string, string]> {
  const entries: Array<[string, string]> = [];

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const normalized = trimmed.startsWith('- ') ? trimmed.slice(2).trim() : trimmed;
    const separatorIndex = normalized.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = normalized.slice(0, separatorIndex).trim();
    const rawValue = normalized.slice(separatorIndex + 1).trim();

    if (!key) {
      continue;
    }

    entries.push([key, stripSurroundingQuotes(rawValue)]);
  }

  return entries;
}

export function syncPrivateRuntimeConfig(
  options: SyncPrivateRuntimeConfigOptions = {},
): SyncPrivateRuntimeConfigResult {
  const paths = resolvePrivateRuntimeConfigSyncPaths(options);

  if (!fs.existsSync(paths.runtimeEnvLocalPath)) {
    return {
      ...paths,
      foundRuntimeEnvFile: false,
    };
  }

  const content = fs.readFileSync(paths.runtimeEnvLocalPath, 'utf8');
  const entries = parsePrivateRuntimeEnvFile(content);

  fs.mkdirSync(paths.ctiHomeDir, { recursive: true });

  const tempFilePath = `${paths.ctiConfigPath}.tmp`;
  fs.writeFileSync(tempFilePath, renderConfigEnv(entries), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tempFilePath, paths.ctiConfigPath);

  return {
    ...paths,
    foundRuntimeEnvFile: true,
  };
}

function renderConfigEnv(entries: Array<[string, string]>) {
  return `${entries.map(([key, value]) => `${key}=${value}`).join('\n')}\n`;
}

function stripSurroundingQuotes(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
