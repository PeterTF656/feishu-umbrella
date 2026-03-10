import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PRIVATE_MENU_ROUTE_FILE_ENV = 'CTI_PRIVATE_MENU_ROUTE_FILE';
export const BASE_MENU_ROUTES_ENV = 'CTI_FEISHU_MENU_ROUTES';

export type PrivateSettingsSource = 'env' | 'local-json' | 'missing-local-json' | 'base-env';

export interface PrivateSettingsLoadResult {
  source: PrivateSettingsSource;
  menuRouteFilePath: string;
  payload: Record<string, unknown> | null;
}

export interface LoadPrivateSettingsOptions {
  env?: NodeJS.ProcessEnv;
  packageRootDir?: string;
}

const DEFAULT_PRIVATE_EXTENSION_PACKAGE_ROOT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

export function resolvePrivateExtensionPackageRootDir(packageRootDir?: string) {
  return packageRootDir ?? DEFAULT_PRIVATE_EXTENSION_PACKAGE_ROOT_DIR;
}

export function getDefaultPrivateMenuRouteFilePath(packageRootDir: string) {
  return path.resolve(packageRootDir, '..', 'config', 'feishu-menu-routes.local.json');
}

export function loadPrivateSettings(options: LoadPrivateSettingsOptions = {}): PrivateSettingsLoadResult {
  const packageRootDir = resolvePrivateExtensionPackageRootDir(options.packageRootDir);
  const env = options.env ?? process.env;
  const envOverride = env[PRIVATE_MENU_ROUTE_FILE_ENV]?.trim();
  const baseEnvPayload = loadBaseMenuRoutes(env);

  if (envOverride) {
    const menuRouteFilePath = resolveFilePath(packageRootDir, envOverride);

    assertFileExists(menuRouteFilePath, `Missing private settings file from ${PRIVATE_MENU_ROUTE_FILE_ENV}`);

    return {
      source: 'env',
      menuRouteFilePath,
      payload: mergeMenuRoutePayloads(baseEnvPayload, parseMenuRoutePayload(parseJsonFile(menuRouteFilePath))),
    };
  }

  const menuRouteFilePath = getDefaultPrivateMenuRouteFilePath(packageRootDir);

  if (!fs.existsSync(menuRouteFilePath)) {
    if (baseEnvPayload) {
      return {
        source: 'base-env',
        menuRouteFilePath: `<env:${BASE_MENU_ROUTES_ENV}>`,
        payload: baseEnvPayload,
      };
    }

    return {
      source: 'missing-local-json',
      menuRouteFilePath,
      payload: null,
    };
  }

  return {
    source: 'local-json',
    menuRouteFilePath,
    payload: mergeMenuRoutePayloads(baseEnvPayload, parseMenuRoutePayload(parseJsonFile(menuRouteFilePath))),
  };
}

function resolveFilePath(packageRootDir: string, filePath: string) {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }

  return path.resolve(packageRootDir, filePath);
}

function assertFileExists(filePath: string, messagePrefix: string) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${messagePrefix}: ${filePath}`);
  }
}

function parseJsonFile(filePath: string) {
  const fileContents = fs.readFileSync(filePath, 'utf8');

  try {
    return JSON.parse(fileContents) as unknown;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse private settings JSON at ${filePath}: ${reason}`);
  }
}

function loadBaseMenuRoutes(env: NodeJS.ProcessEnv) {
  const rawBaseRoutes = env[BASE_MENU_ROUTES_ENV]?.trim();
  if (!rawBaseRoutes) {
    return null;
  }

  try {
    return parseMenuRoutePayload(JSON.parse(rawBaseRoutes) as unknown);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse menu routes from ${BASE_MENU_ROUTES_ENV}: ${reason}`);
  }
}

function mergeMenuRoutePayloads(
  basePayload: Record<string, unknown> | null,
  overlayPayload: Record<string, unknown> | null,
) {
  if (!basePayload) {
    return overlayPayload;
  }

  if (!overlayPayload) {
    return basePayload;
  }

  return {
    ...basePayload,
    ...overlayPayload,
  };
}

function parseMenuRoutePayload(payload: unknown): Record<string, unknown> | null {
  if (payload === null) {
    return null;
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Menu route payload must be a JSON object');
  }

  return payload as Record<string, unknown>;
}
