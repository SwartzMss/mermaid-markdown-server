const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const rootDir = path.resolve(__dirname, '..');
const vendorDir = path.join(rootDir, 'vendor');
const assets = [
  {
    source: path.join(rootDir, 'node_modules', 'marked', 'lib', 'marked.umd.js'),
    target: path.join(vendorDir, 'marked.min.js')
  },
  {
    source: path.join(rootDir, 'node_modules', 'mermaid', 'dist', 'mermaid.min.js'),
    target: path.join(vendorDir, 'mermaid.min.js')
  }
];

function main() {
  try {
    prepareVendorAssets();

    const vsceBin = process.platform === 'win32'
      ? path.join(rootDir, 'node_modules', '.bin', 'vsce.cmd')
      : path.join(rootDir, 'node_modules', '.bin', 'vsce');
    const result = spawnSync(vsceBin, ['package', '--no-dependencies', ...process.argv.slice(2)], {
      cwd: rootDir,
      stdio: 'inherit'
    });

    if (result.error) {
      throw result.error;
    }

    if (result.status !== 0) {
      process.exit(result.status || 1);
    }
  } finally {
    cleanupVendorAssets();
  }
}

function prepareVendorAssets() {
  fs.rmSync(vendorDir, { recursive: true, force: true });
  fs.mkdirSync(vendorDir, { recursive: true });

  for (const asset of assets) {
    fs.copyFileSync(asset.source, asset.target);
  }
}

function cleanupVendorAssets() {
  fs.rmSync(vendorDir, { recursive: true, force: true });
}

main();
