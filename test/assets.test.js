const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { CLIENT_JS } = require('../src/assets');

test('client script is valid browser JavaScript', () => {
  assert.doesNotThrow(() => new vm.Script(CLIENT_JS));
});

test('client script loads renderer libraries from the local preview server', () => {
  assert.match(CLIENT_JS, /\/vendor\/marked\.min\.js/);
  assert.match(CLIENT_JS, /\/vendor\/mermaid\.min\.js/);
  assert.doesNotMatch(CLIENT_JS, /https:\/\/cdn\.jsdelivr\.net/);
  assert.doesNotMatch(CLIENT_JS, /https:\/\/unpkg\.com/);
});

test('client script rewrites markdown links through content endpoint', () => {
  assert.match(CLIENT_JS, /\/content\?path=/);
  assert.match(CLIENT_JS, /renderMarkdownPath/);
});

test('client script rewrites relative resource URLs through raw endpoint', () => {
  assert.match(CLIENT_JS, /\/raw\?path=/);
  assert.match(CLIENT_JS, /rewriteRelativeUrls/);
});
