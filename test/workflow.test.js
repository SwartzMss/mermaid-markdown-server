const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');
const manifest = require('../package.json');

test('package manifest exposes packaging scripts for CI', () => {
  assert.equal(manifest.scripts.package, 'vsce package');
  assert.equal(manifest.scripts.publish, 'vsce publish');
});

test('GitHub Actions workflows exist for CI and release', () => {
  assert.equal(fs.existsSync('.github/workflows/ci.yml'), true);
  assert.equal(fs.existsSync('.github/workflows/release.yml'), true);
});

test('release workflow uploads VSIX and supports Marketplace publishing', () => {
  const workflow = fs.readFileSync('.github/workflows/release.yml', 'utf8');

  assert.match(workflow, /softprops\/action-gh-release/);
  assert.match(workflow, /VSCE_PAT/);
  assert.match(workflow, /npm run publish/);
});

test('README defaults to Chinese and links to the English version', () => {
  const readme = fs.readFileSync('README.md', 'utf8');

  assert.match(readme, /中文/);
  assert.match(readme, /README\.en\.md/);
  assert.equal(fs.existsSync('README.en.md'), true);
});
