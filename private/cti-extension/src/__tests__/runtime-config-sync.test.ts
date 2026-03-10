import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';

import {
  parsePrivateRuntimeEnvFile,
  resolvePrivateRuntimeConfigSyncPaths,
  syncPrivateRuntimeConfig,
} from '../runtime/runtime-config-sync.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

function createWorkspace() {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cti-runtime-sync-'));
  const packageRootDir = path.join(workspaceRoot, 'private', 'cti-extension');
  const configDir = path.join(workspaceRoot, 'private', 'config');
  const ctiHomeDir = path.join(workspaceRoot, '.claude-to-im');

  fs.mkdirSync(packageRootDir, { recursive: true });
  fs.mkdirSync(configDir, { recursive: true });

  tempDirs.push(workspaceRoot);

  return {
    configDir,
    ctiHomeDir,
    packageRootDir,
    runtimeEnvLocalPath: path.join(configDir, 'runtime.env.local'),
  };
}

describe('runtime config sync', () => {
  it('resolves the default private runtime env path and CTI config path', () => {
    const workspace = createWorkspace();
    const paths = resolvePrivateRuntimeConfigSyncPaths({
      ctiHomeDir: workspace.ctiHomeDir,
      packageRootDir: workspace.packageRootDir,
    });

    assert.equal(paths.runtimeEnvLocalPath, workspace.runtimeEnvLocalPath);
    assert.equal(paths.ctiConfigPath, path.join(workspace.ctiHomeDir, 'config.env'));
  });

  it('parses plain env lines and bullet-prefixed env lines', () => {
    const entries = parsePrivateRuntimeEnvFile(`
      # comment
      - CTI_RUNTIME=claude
      CTI_ENABLED_CHANNELS=feishu
      - CTI_DEFAULT_MODE="code"
    `);

    assert.deepEqual(entries, [
      ['CTI_RUNTIME', 'claude'],
      ['CTI_ENABLED_CHANNELS', 'feishu'],
      ['CTI_DEFAULT_MODE', 'code'],
    ]);
  });

  it('writes CTI_HOME/config.env from private/config/runtime.env.local', () => {
    const workspace = createWorkspace();

    fs.writeFileSync(
      workspace.runtimeEnvLocalPath,
      [
        '- CTI_RUNTIME=claude',
        '- CTI_ENABLED_CHANNELS=feishu',
        '- CTI_FEISHU_APP_ID=app-id',
        '- CTI_FEISHU_APP_SECRET=app-secret',
        '- CTI_DEFAULT_WORKDIR=/tmp/project',
      ].join('\n'),
      'utf8',
    );

    const result = syncPrivateRuntimeConfig({
      ctiHomeDir: workspace.ctiHomeDir,
      packageRootDir: workspace.packageRootDir,
    });

    assert.equal(result.foundRuntimeEnvFile, true);
    assert.equal(result.runtimeEnvLocalPath, workspace.runtimeEnvLocalPath);
    assert.equal(result.ctiConfigPath, path.join(workspace.ctiHomeDir, 'config.env'));
    assert.equal(fs.existsSync(result.ctiConfigPath), true);
    assert.equal(
      fs.readFileSync(result.ctiConfigPath, 'utf8'),
      [
        'CTI_RUNTIME=claude',
        'CTI_ENABLED_CHANNELS=feishu',
        'CTI_FEISHU_APP_ID=app-id',
        'CTI_FEISHU_APP_SECRET=app-secret',
        'CTI_DEFAULT_WORKDIR=/tmp/project',
        '',
      ].join('\n'),
    );
  });
});
