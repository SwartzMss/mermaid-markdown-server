const test = require('node:test');
const assert = require('node:assert/strict');
const { CLIENT_JS } = require('../src/assets');

test('client script rewrites markdown links through content endpoint', () => {
  assert.match(CLIENT_JS, /\/content\?path=/);
  assert.match(CLIENT_JS, /renderMarkdownPath/);
});

test('client script rewrites relative resource URLs through raw endpoint', () => {
  assert.match(CLIENT_JS, /\/raw\?path=/);
  assert.match(CLIENT_JS, /rewriteRelativeUrls/);
});
