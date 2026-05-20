const test = require('node:test');
const assert = require('node:assert/strict');
const { buildHtml } = require('../src/page');

test('buildHtml includes the viewer shell and configured title', () => {
  const html = buildHtml({ title: 'Architecture Notes' });

  assert.match(html, /<title>Architecture Notes<\/title>/);
  assert.match(html, /id="markdown-root"/);
  assert.match(html, /\/assets\/client.js/);
});

test('buildHtml does not block startup on remote markdown libraries', () => {
  const html = buildHtml({ title: 'Architecture Notes' });

  assert.doesNotMatch(html, /marked\.min\.js/);
  assert.doesNotMatch(html, /mermaid\.min\.js/);
});

test('buildHtml escapes title text', () => {
  const html = buildHtml({ title: '<script>alert(1)</script>' });

  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<title><script>/);
});
