const test = require('node:test');
const assert = require('node:assert/strict');
const manifest = require('../package.json');
const fs = require('node:fs');

test('package manifest is configured as a VS Code extension', () => {
  assert.equal(manifest.main, './src/extension.js');
  assert.ok(manifest.engines.vscode);
  assert.ok(manifest.activationEvents.includes('onLanguage:markdown'));
});

test('package manifest contributes one primary preview command and stop command', () => {
  const commands = manifest.contributes.commands.map((command) => command.command);

  assert.ok(commands.includes('mermaidMarkdownServer.openPreview'));
  assert.ok(commands.includes('mermaidMarkdownServer.stop'));
  assert.ok(!commands.includes('mermaidMarkdownServer.copyLanUrl'));
  assert.ok(!commands.includes('mermaidMarkdownServer.start'));
  assert.ok(!commands.includes('mermaidMarkdownServer.open'));
});

test('package manifest does not expose a standalone CLI entry', () => {
  assert.equal(manifest.bin, undefined);
  assert.equal(manifest.scripts.start, undefined);
});

test('package manifest contributes primary preview command to explorer markdown context menu', () => {
  const explorerMenu = manifest.contributes.menus['explorer/context'];

  assert.ok(explorerMenu.some((item) => item.command === 'mermaidMarkdownServer.openPreview'));
  assert.ok(explorerMenu.some((item) => item.when.includes('resourceExtname == .md')));
});

test('package manifest contributes primary preview command to editor markdown context menu', () => {
  const editorMenu = manifest.contributes.menus['editor/context'];

  assert.ok(editorMenu.some((item) => item.command === 'mermaidMarkdownServer.openPreview'));
  assert.ok(editorMenu.some((item) => item.when === 'resourceLangId == markdown'));
});

test('package manifest exposes auto-stop setting', () => {
  const setting = manifest.contributes.configuration.properties['mermaidMarkdownServer.autoStopAfterMinutes'];

  assert.equal(setting.type, 'number');
  assert.equal(setting.default, 30);
});

test('package manifest does not expose LAN host configuration', () => {
  assert.equal(manifest.contributes.configuration.properties['mermaidMarkdownServer.host'], undefined);
});

test('package manifest includes a packaged PNG icon', () => {
  assert.equal(manifest.icon, 'images/icon.png');
  assert.equal(fs.existsSync(manifest.icon), true);
});
