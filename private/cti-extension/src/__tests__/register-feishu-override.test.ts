import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const packageRootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const upstreamChannelAdapterImport = '../../Claude-to-IM-skill/node_modules/claude-to-im/dist/lib/bridge/channel-adapter.js';
const upstreamFeishuAdapterImport =
  '../../Claude-to-IM-skill/node_modules/claude-to-im/dist/lib/bridge/adapters/feishu-adapter.js';

type UpstreamScenario = {
  adapterConstructorName: string | null;
  registeredTypes: string[];
};

type OverrideScenario = {
  afterConstructorName: string | null;
  beforeConstructorName: string | null;
  registeredTypes: string[];
};

type ExtensionLoadScenario = {
  adapterConstructorName: string | null;
  adapterType: string | null;
};

function runScenario(script: string) {
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', script], {
    cwd: packageRootDir,
    encoding: 'utf8',
  });

  return result;
}

function expectScenarioResult<T>(script: string): T {
  const result = runScenario(script);

  assert.equal(
    result.status,
    0,
    `registration scenario exited with ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );

  return JSON.parse(result.stdout) as T;
}

function expectUpstreamScenario(): UpstreamScenario {
  return expectScenarioResult<UpstreamScenario>(`
    import { createAdapter, getRegisteredTypes } from '${upstreamChannelAdapterImport}';
    await import('${upstreamFeishuAdapterImport}');

    process.stdout.write(JSON.stringify({
      adapterConstructorName: createAdapter('feishu')?.constructor?.name ?? null,
      registeredTypes: getRegisteredTypes(),
    }));
  `);
}

function expectOverrideScenario(): OverrideScenario {
  return expectScenarioResult<OverrideScenario>(`
    import { createAdapter, getRegisteredTypes } from '${upstreamChannelAdapterImport}';
    await import('${upstreamFeishuAdapterImport}');

    const before = createAdapter('feishu');
    const { registerFeishuOverride } = await import('./src/feishu/register-feishu-override.ts');

    registerFeishuOverride();

    process.stdout.write(JSON.stringify({
      afterConstructorName: createAdapter('feishu')?.constructor?.name ?? null,
      beforeConstructorName: before?.constructor?.name ?? null,
      registeredTypes: getRegisteredTypes(),
    }));
  `);
}

function expectExtensionLoadScenario(): ExtensionLoadScenario {
  return expectScenarioResult<ExtensionLoadScenario>(`
    import { createAdapter } from '${upstreamChannelAdapterImport}';
    await import('${upstreamFeishuAdapterImport}');

    console.info = () => {};
    await import('./src/index.ts');

    const adapter = createAdapter('feishu');

    process.stdout.write(JSON.stringify({
      adapterConstructorName: adapter?.constructor?.name ?? null,
      adapterType: adapter?.channelType ?? null,
    }));
  `);
}

function expectHostApiScenario() {
  return expectScenarioResult<{ callCount: number; channelType: string | null; constructorName: string | null }>(`
    const calls = [];
    globalThis[Symbol.for('claude-to-im.private-extension-api')] = {
      registerAdapterFactory(channelType, factory) {
        const adapter = factory();
        calls.push({
          channelType,
          constructorName: adapter?.constructor?.name ?? null,
        });
      },
    };

    const { registerFeishuOverride } = await import('./src/feishu/register-feishu-override.ts');
    registerFeishuOverride();

    process.stdout.write(JSON.stringify({
      callCount: calls.length,
      channelType: calls[0]?.channelType ?? null,
      constructorName: calls[0]?.constructorName ?? null,
    }));
  `);
}

describe('private Feishu override registration', () => {
  it('starts with the upstream feishu adapter registered', () => {
    const scenario = expectUpstreamScenario();

    assert.equal(scenario.adapterConstructorName, 'FeishuAdapter');
    assert.ok(scenario.registeredTypes.includes('feishu'));
  });

  it('registerFeishuOverride replaces the upstream feishu factory', () => {
    const scenario = expectOverrideScenario();

    assert.equal(scenario.beforeConstructorName, 'FeishuAdapter');
    assert.equal(scenario.afterConstructorName, 'PrivateFeishuAdapter');
    assert.ok(scenario.registeredTypes.includes('feishu'));
    assert.notEqual(scenario.afterConstructorName, scenario.beforeConstructorName);
  });

  it("returns the private adapter from createAdapter('feishu') after extension load", () => {
    const scenario = expectExtensionLoadScenario();

    assert.equal(scenario.adapterConstructorName, 'PrivateFeishuAdapter');
    assert.equal(scenario.adapterType, 'feishu');
  });

  it('uses the host private extension API when it is available', () => {
    const scenario = expectHostApiScenario();

    assert.equal(scenario.callCount, 1);
    assert.equal(scenario.channelType, 'feishu');
    assert.equal(scenario.constructorName, 'PrivateFeishuAdapter');
  });
});
