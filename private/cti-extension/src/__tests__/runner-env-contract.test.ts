import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  buildRunnerEnvironment,
  resolveRunnerContractPaths,
} from '../runtime/runner-env-contract.js';

const packageRootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const tempDirs: string[] = [];

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

function createWorkspace() {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cti-runner-env-'));
  const packageRootDir = path.join(workspaceRoot, 'private', 'cti-extension');
  const configDir = path.join(workspaceRoot, 'private', 'config');
  const defaultMenuRouteFilePath = path.join(configDir, 'feishu-menu-routes.local.json');

  fs.mkdirSync(packageRootDir, { recursive: true });
  fs.mkdirSync(configDir, { recursive: true });
  tempDirs.push(workspaceRoot);

  return {
    defaultMenuRouteFilePath,
    packageRootDir,
  };
}

describe('runner env contract', () => {
  it('computes the default extension entry, build dir, and local menu route file', () => {
    const workspace = createWorkspace();
    fs.writeFileSync(workspace.defaultMenuRouteFilePath, '{"launch":"https://example.test"}', 'utf8');

    const paths = resolveRunnerContractPaths({ packageRootDir: workspace.packageRootDir });

    assert.equal(paths.extensionPackageRootDir, workspace.packageRootDir);
    assert.equal(paths.extensionEntryPath, path.join(workspace.packageRootDir, 'dist', 'index.js'));
    assert.equal(paths.defaultMenuRouteFilePath, workspace.defaultMenuRouteFilePath);
    assert.equal(paths.runtimeEnvLocalPath, path.join(workspace.packageRootDir, '..', 'config', 'runtime.env.local'));
    assert.equal(paths.skillDaemonShPath, path.join(workspace.packageRootDir, '..', '..', 'Claude-to-IM-skill', 'scripts', 'daemon.sh'));
    assert.equal(paths.skillDaemonPs1Path, path.join(workspace.packageRootDir, '..', '..', 'Claude-to-IM-skill', 'scripts', 'daemon.ps1'));

    assert.deepEqual(
      buildRunnerEnvironment({
        env: {},
        packageRootDir: workspace.packageRootDir,
      }),
      {
        CTI_PRIVATE_EXTENSION_ENTRY: paths.extensionEntryPath,
        CTI_PRIVATE_MENU_ROUTE_FILE: paths.defaultMenuRouteFilePath,
      },
    );
  });

  it('preserves an explicit CTI_PRIVATE_MENU_ROUTE_FILE override while still pointing the loader at the built extension', () => {
    const overridePath = '../overrides/feishu-menu-routes.json';

    assert.deepEqual(
      buildRunnerEnvironment({
        env: {
          CTI_PRIVATE_MENU_ROUTE_FILE: overridePath,
        },
        packageRootDir,
      }),
      {
        CTI_PRIVATE_EXTENSION_ENTRY: path.join(packageRootDir, 'dist', 'index.js'),
        CTI_PRIVATE_MENU_ROUTE_FILE: path.resolve(packageRootDir, overridePath),
      },
    );
  });

  it('leaves CTI_PRIVATE_MENU_ROUTE_FILE unset when no override is provided and the default local file is missing', () => {
    const workspace = createWorkspace();

    assert.deepEqual(
      buildRunnerEnvironment({
        env: {},
        packageRootDir: workspace.packageRootDir,
      }),
      {
        CTI_PRIVATE_EXTENSION_ENTRY: path.join(workspace.packageRootDir, 'dist', 'index.js'),
      },
    );
  });
});
