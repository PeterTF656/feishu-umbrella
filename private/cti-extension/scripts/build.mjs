import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRootDir = path.resolve(scriptDir, '..');
const distDir = path.join(packageRootDir, 'dist');
const srcDir = path.join(packageRootDir, 'src');

fs.rmSync(distDir, { recursive: true, force: true });

const entryPoints = collectEntryPoints(srcDir);

await build({
  bundle: false,
  entryPoints,
  format: 'esm',
  outbase: srcDir,
  outdir: distDir,
  platform: 'node',
  sourcemap: true,
  target: 'node20',
});

function collectEntryPoints(directory) {
  const entryPoints = [];

  for (const dirent of fs.readdirSync(directory, { withFileTypes: true })) {
    const resolvedPath = path.join(directory, dirent.name);

    if (dirent.isDirectory()) {
      if (dirent.name === '__tests__') {
        continue;
      }

      entryPoints.push(...collectEntryPoints(resolvedPath));
      continue;
    }

    if (!dirent.name.endsWith('.ts')) {
      continue;
    }

    entryPoints.push(resolvedPath);
  }

  return entryPoints;
}
