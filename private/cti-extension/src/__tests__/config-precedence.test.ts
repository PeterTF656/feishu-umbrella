import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';

import { loadPrivateSettings } from '../config/load-private-settings.js';

const tempDirs: string[] = [];
const BASE_MENU_ROUTES_ENV = 'CTI_FEISHU_MENU_ROUTES';
const PRIVATE_MENU_ROUTE_FILE_ENV = 'CTI_PRIVATE_MENU_ROUTE_FILE';

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

function createWorkspace() {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cti-extension-config-precedence-'));
  const packageRootDir = path.join(workspaceRoot, 'cti-extension');
  const configDir = path.join(workspaceRoot, 'config');

  fs.mkdirSync(packageRootDir, { recursive: true });
  fs.mkdirSync(configDir, { recursive: true });

  tempDirs.push(workspaceRoot);

  return {
    defaultLocalPath: path.join(configDir, 'feishu-menu-routes.local.json'),
    packageRootDir,
    workspaceRoot,
  };
}

function writeJson(filePath: string, payload: unknown) {
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
}

describe('private menu route config precedence', () => {
  it('prefers the CTI_PRIVATE_MENU_ROUTE_FILE target over the default local file', () => {
    const workspace = createWorkspace();
    const overridePath = path.join(workspace.workspaceRoot, 'override-routes.json');

    writeJson(workspace.defaultLocalPath, {
      defaultOnly: 'https://hooks.example.com/default-only',
    });
    writeJson(overridePath, {
      overrideOnly: 'https://hooks.example.com/override-only',
    });

    const settings = loadPrivateSettings({
      env: {
        [BASE_MENU_ROUTES_ENV]: JSON.stringify({
          baseOnly: 'https://hooks.example.com/base-only',
        }),
        [PRIVATE_MENU_ROUTE_FILE_ENV]: overridePath,
      },
      packageRootDir: workspace.packageRootDir,
    });

    assert.equal(settings.source, 'env');
    assert.equal(settings.menuRouteFilePath, overridePath);
    assert.deepEqual(settings.payload, {
      baseOnly: 'https://hooks.example.com/base-only',
      overrideOnly: 'https://hooks.example.com/override-only',
    });
  });

  it('overlays the default local file on top of CTI_FEISHU_MENU_ROUTES', () => {
    const workspace = createWorkspace();

    writeJson(workspace.defaultLocalPath, {
      launch: {
        url: 'https://hooks.example.com/local-launch',
      },
      localOnly: 'https://hooks.example.com/local-only',
    });

    const settings = loadPrivateSettings({
      env: {
        [BASE_MENU_ROUTES_ENV]: JSON.stringify({
          launch: {
            url: 'https://hooks.example.com/base-launch',
          },
          baseOnly: 'https://hooks.example.com/base-only',
        }),
      },
      packageRootDir: workspace.packageRootDir,
    });

    assert.equal(settings.source, 'local-json');
    assert.equal(settings.menuRouteFilePath, workspace.defaultLocalPath);
    assert.deepEqual(settings.payload, {
      launch: {
        url: 'https://hooks.example.com/local-launch',
      },
      baseOnly: 'https://hooks.example.com/base-only',
      localOnly: 'https://hooks.example.com/local-only',
    });
  });

  it('falls back to CTI_FEISHU_MENU_ROUTES when the local file is missing', () => {
    const workspace = createWorkspace();

    const settings = loadPrivateSettings({
      env: {
        [BASE_MENU_ROUTES_ENV]: JSON.stringify({
          fallback: 'https://hooks.example.com/base-only',
        }),
      },
      packageRootDir: workspace.packageRootDir,
    });

    assert.equal(settings.source, 'base-env');
    assert.equal(settings.menuRouteFilePath, '<env:CTI_FEISHU_MENU_ROUTES>');
    assert.deepEqual(settings.payload, {
      fallback: 'https://hooks.example.com/base-only',
    });
  });
});
