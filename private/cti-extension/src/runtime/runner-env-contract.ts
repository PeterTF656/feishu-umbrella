import path from 'node:path';
import fs from 'node:fs';

import {
  getDefaultPrivateMenuRouteFilePath,
  PRIVATE_MENU_ROUTE_FILE_ENV,
  resolvePrivateExtensionPackageRootDir,
} from '../config/load-private-settings.js';

export const PRIVATE_EXTENSION_ENTRY_ENV = 'CTI_PRIVATE_EXTENSION_ENTRY';

export interface ResolveRunnerContractPathsOptions {
  packageRootDir?: string;
}

export interface RunnerContractPaths {
  defaultMenuRouteFilePath: string;
  extensionEntryPath: string;
  extensionPackageRootDir: string;
  runtimeEnvLocalPath: string;
  skillDaemonPs1Path: string;
  skillDaemonShPath: string;
  skillDir: string;
  umbrellaRootDir: string;
}

export interface BuildRunnerEnvironmentOptions extends ResolveRunnerContractPathsOptions {
  env?: NodeJS.ProcessEnv;
}

export function resolveRunnerContractPaths(
  options: ResolveRunnerContractPathsOptions = {},
): RunnerContractPaths {
  const extensionPackageRootDir = resolvePrivateExtensionPackageRootDir(options.packageRootDir);
  const umbrellaRootDir = path.resolve(extensionPackageRootDir, '..', '..');
  const skillDir = path.join(umbrellaRootDir, 'Claude-to-IM-skill');

  return {
    defaultMenuRouteFilePath: getDefaultPrivateMenuRouteFilePath(extensionPackageRootDir),
    extensionEntryPath: path.join(extensionPackageRootDir, 'dist', 'index.js'),
    extensionPackageRootDir,
    runtimeEnvLocalPath: path.join(umbrellaRootDir, 'private', 'config', 'runtime.env.local'),
    skillDaemonPs1Path: path.join(skillDir, 'scripts', 'daemon.ps1'),
    skillDaemonShPath: path.join(skillDir, 'scripts', 'daemon.sh'),
    skillDir,
    umbrellaRootDir,
  };
}

export function buildRunnerEnvironment(
  options: BuildRunnerEnvironmentOptions = {},
): Record<string, string> {
  const paths = resolveRunnerContractPaths(options);
  const env = options.env ?? process.env;
  const privateMenuRouteFile = env[PRIVATE_MENU_ROUTE_FILE_ENV]?.trim();
  const runnerEnvironment: Record<string, string> = {
    [PRIVATE_EXTENSION_ENTRY_ENV]: paths.extensionEntryPath,
  };

  if (privateMenuRouteFile) {
    runnerEnvironment[PRIVATE_MENU_ROUTE_FILE_ENV] = resolveRunnerPath(
      paths.extensionPackageRootDir,
      privateMenuRouteFile,
    );
    return runnerEnvironment;
  }

  if (fs.existsSync(paths.defaultMenuRouteFilePath)) {
    runnerEnvironment[PRIVATE_MENU_ROUTE_FILE_ENV] = paths.defaultMenuRouteFilePath;
  }

  return runnerEnvironment;
}

function resolveRunnerPath(baseDir: string, filePath: string) {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }

  return path.resolve(baseDir, filePath);
}
