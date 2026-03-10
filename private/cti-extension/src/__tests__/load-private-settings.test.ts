import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { loadPrivateSettings } from '../config/load-private-settings.js';

const tempDirs: string[] = [];
const packageRootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

function createWorkspace() {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cti-extension-settings-'));
  const packageRootDir = path.join(workspaceRoot, 'cti-extension');
  const configDir = path.join(workspaceRoot, 'config');

  fs.mkdirSync(packageRootDir, { recursive: true });
  fs.mkdirSync(configDir, { recursive: true });

  tempDirs.push(workspaceRoot);

  return {
    packageRootDir,
    defaultLocalPath: path.join(configDir, 'feishu-menu-routes.local.json'),
    workspaceRoot,
  };
}

function writeJson(filePath: string, payload: unknown) {
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createPackageTempDir() {
  const tempDir = fs.mkdtempSync(path.join(packageRootDir, '.tmp-cti-extension-test-'));
  tempDirs.push(tempDir);
  return tempDir;
}

function buildPackage() {
  execFileSync(process.execPath, ['scripts/build.mjs'], {
    cwd: packageRootDir,
    stdio: 'pipe',
  });
}

describe('loadPrivateSettings', () => {
  it('uses a deterministic package-root default when packageRootDir is omitted', () => {
    const fixtureDir = createPackageTempDir();
    const alternateCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'cti-extension-cwd-'));
    const overridePath = path.join(fixtureDir, 'override-routes.json');
    const relativeOverridePath = path.relative(packageRootDir, overridePath);
    const originalCwd = process.cwd();

    tempDirs.push(alternateCwd);
    writeJson(overridePath, { routeKey: 'deterministic-default' });

    process.chdir(alternateCwd);

    try {
      const settings = loadPrivateSettings({
        env: { CTI_PRIVATE_MENU_ROUTE_FILE: relativeOverridePath },
      });

      assert.equal(settings.source, 'env');
      assert.equal(settings.menuRouteFilePath, overridePath);
      assert.deepEqual(settings.payload, { routeKey: 'deterministic-default' });
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('env path override wins', () => {
    const workspace = createWorkspace();
    const overridePath = path.join(workspace.workspaceRoot, 'override-routes.json');

    writeJson(workspace.defaultLocalPath, { routeKey: 'default' });
    writeJson(overridePath, { routeKey: 'env' });

    const settings = loadPrivateSettings({
      env: { CTI_PRIVATE_MENU_ROUTE_FILE: overridePath },
      packageRootDir: workspace.packageRootDir,
    });

    assert.equal(settings.source, 'env');
    assert.equal(settings.menuRouteFilePath, overridePath);
    assert.deepEqual(settings.payload, { routeKey: 'env' });
  });

  it('default local JSON path works', () => {
    const workspace = createWorkspace();

    writeJson(workspace.defaultLocalPath, { routeKey: 'local-json' });

    const settings = loadPrivateSettings({
      env: {},
      packageRootDir: workspace.packageRootDir,
    });

    assert.equal(settings.source, 'local-json');
    assert.equal(settings.menuRouteFilePath, workspace.defaultLocalPath);
    assert.deepEqual(settings.payload, { routeKey: 'local-json' });
  });

  it('missing local JSON is tolerated', () => {
    const workspace = createWorkspace();

    const settings = loadPrivateSettings({
      env: {},
      packageRootDir: workspace.packageRootDir,
    });

    assert.equal(settings.source, 'missing-local-json');
    assert.equal(settings.menuRouteFilePath, workspace.defaultLocalPath);
    assert.equal(settings.payload, null);
  });

  it('invalid JSON fails clearly', () => {
    const workspace = createWorkspace();

    fs.writeFileSync(workspace.defaultLocalPath, '{"routeKey":', 'utf8');

    assert.throws(
      () =>
        loadPrivateSettings({
          env: {},
          packageRootDir: workspace.packageRootDir,
        }),
      (error) => {
        assert.match((error as Error).message, /Failed to parse private settings JSON/);
        assert.match((error as Error).message, new RegExp(escapeRegExp(workspace.defaultLocalPath)));
        return true;
      },
    );
  });

  it('startPrivateExtension logs a successful load through its public entrypoint', async () => {
    const workspace = createWorkspace();
    const loggerMessages: string[] = [];
    const bootstrapMessages: string[] = [];
    const previousOverride = process.env.CTI_PRIVATE_MENU_ROUTE_FILE;
    const originalConsoleInfo = console.info;

    writeJson(workspace.defaultLocalPath, { routeKey: 'entrypoint-load' });

    process.env.CTI_PRIVATE_MENU_ROUTE_FILE = workspace.defaultLocalPath;
    console.info = (...args: unknown[]) => {
      bootstrapMessages.push(args.join(' '));
    };

    try {
      const indexModule = (await import(
        `${pathToFileURL(path.join(packageRootDir, 'src', 'index.ts')).href}?entrypoint-test`
      )) as typeof import('../index.js');

      if (previousOverride === undefined) {
        delete process.env.CTI_PRIVATE_MENU_ROUTE_FILE;
      } else {
        process.env.CTI_PRIVATE_MENU_ROUTE_FILE = previousOverride;
      }

      const settings = indexModule.startPrivateExtension({
        logger: {
          info(message: string) {
            loggerMessages.push(message);
          },
        },
        packageRootDir: workspace.packageRootDir,
      });

      assert.equal(settings.source, 'local-json');
      assert.equal(settings.menuRouteFilePath, workspace.defaultLocalPath);
      assert.deepEqual(settings.payload, { routeKey: 'entrypoint-load' });
      assert.deepEqual(loggerMessages, [
        `[cti-extension] private settings loaded (local-json) from ${workspace.defaultLocalPath}`,
      ]);
      assert.match(
        bootstrapMessages[0] ?? '',
        new RegExp(escapeRegExp(`[cti-extension] private settings loaded (env) from ${workspace.defaultLocalPath}`)),
      );
    } finally {
      console.info = originalConsoleInfo;

      if (previousOverride === undefined) {
        delete process.env.CTI_PRIVATE_MENU_ROUTE_FILE;
      } else {
        process.env.CTI_PRIVATE_MENU_ROUTE_FILE = previousOverride;
      }
    }
  });

  it('built dist entrypoint preserves module-relative default path resolution', async () => {
    const fixtureDir = createPackageTempDir();
    const alternateCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'cti-extension-dist-cwd-'));
    const overridePath = path.join(fixtureDir, 'dist-routes.json');
    const relativeOverridePath = path.relative(packageRootDir, overridePath);
    const loggerMessages: string[] = [];
    const bootstrapMessages: string[] = [];
    const previousOverride = process.env.CTI_PRIVATE_MENU_ROUTE_FILE;
    const originalConsoleInfo = console.info;
    const originalCwd = process.cwd();

    tempDirs.push(alternateCwd);
    writeJson(overridePath, { routeKey: 'built-entrypoint-load' });

    process.env.CTI_PRIVATE_MENU_ROUTE_FILE = relativeOverridePath;
    console.info = (...args: unknown[]) => {
      bootstrapMessages.push(args.join(' '));
    };
    process.chdir(alternateCwd);

    try {
      buildPackage();

      const distModule = (await import(
        `${pathToFileURL(path.join(packageRootDir, 'dist', 'index.js')).href}?dist-entrypoint-test`
      )) as typeof import('../index.js');

      assert.equal(distModule.privateSettings.source, 'env');
      assert.equal(distModule.privateSettings.menuRouteFilePath, overridePath);
      assert.deepEqual(distModule.privateSettings.payload, { routeKey: 'built-entrypoint-load' });

      const settings = distModule.startPrivateExtension({
        logger: {
          info(message: string) {
            loggerMessages.push(message);
          },
        },
      });

      assert.equal(settings.source, 'env');
      assert.equal(settings.menuRouteFilePath, overridePath);
      assert.deepEqual(settings.payload, { routeKey: 'built-entrypoint-load' });
      assert.deepEqual(loggerMessages, [
        `[cti-extension] private settings loaded (env) from ${overridePath}`,
      ]);
      assert.match(
        bootstrapMessages[0] ?? '',
        new RegExp(escapeRegExp(`[cti-extension] private settings loaded (env) from ${overridePath}`)),
      );
    } finally {
      process.chdir(originalCwd);
      console.info = originalConsoleInfo;

      if (previousOverride === undefined) {
        delete process.env.CTI_PRIVATE_MENU_ROUTE_FILE;
      } else {
        process.env.CTI_PRIVATE_MENU_ROUTE_FILE = previousOverride;
      }
    }
  });
});
