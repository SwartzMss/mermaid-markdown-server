const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {
  CLIENT_JS,
  STYLES_CSS,
  pathDirectory,
  pathFromSearch,
  resolvePreviewPath,
  searchForPreviewPath
} = require('../src/assets');

test('client script is valid browser JavaScript', () => {
  assert.doesNotThrow(() => new vm.Script(CLIENT_JS));
});

test('client script loads renderer libraries from the local preview server', () => {
  assert.match(CLIENT_JS, /\/vendor\/marked\.min\.js/);
  assert.match(CLIENT_JS, /\/vendor\/mermaid\.min\.js/);
  assert.doesNotMatch(CLIENT_JS, /https:\/\/cdn\.jsdelivr\.net/);
  assert.doesNotMatch(CLIENT_JS, /https:\/\/unpkg\.com/);
});

test('client script fetches markdown through content endpoint and links previews through history URLs', () => {
  assert.match(CLIENT_JS, /\/content\?path=/);
  assert.match(CLIENT_JS, /renderMarkdownPath/);
  assert.match(CLIENT_JS, /previewUrlForPath\(relativePath\)/);
});

test('client script fetches and renders linked document navigation', () => {
  assert.match(CLIENT_JS, /\/documents/);
  assert.match(CLIENT_JS, /renderDocumentNavigation/);
  assert.match(CLIENT_JS, /data-preview-path/);
  assert.match(CLIENT_JS, /setActiveDocument/);
});

test('client script rewrites relative resource URLs through raw endpoint', () => {
  assert.match(CLIENT_JS, /\/raw\?path=/);
  assert.match(CLIENT_JS, /rewriteRelativeUrls/);
});

test('stylesheet includes responsive document navigation layout', () => {
  assert.match(STYLES_CSS, /\.preview-layout/);
  assert.match(STYLES_CSS, /\.document-nav/);
  assert.match(STYLES_CSS, /\.document-nav__link\[aria-current="page"\]/);
});

test('stylesheet balances navigation and reading proportions', () => {
  assert.match(STYLES_CSS, /grid-template-columns: clamp\(220px, 22vw, 300px\) minmax\(0, 1fr\)/);
  assert.match(STYLES_CSS, /width: min\(1320px, calc\(100% - clamp\(24px, 5vw, 72px\)\)\)/);
  assert.match(STYLES_CSS, /max-width: 860px/);
  assert.match(STYLES_CSS, /padding: clamp\(24px, 4vw, 48px\)/);
  assert.match(STYLES_CSS, /border-left: 3px solid var\(--accent\)/);
  assert.match(STYLES_CSS, /@media \(max-width: 900px\)/);
  assert.match(STYLES_CSS, /max-height: 32vh/);
});

test('resolvePreviewPath resolves links relative to the current markdown path', () => {
  assert.equal(resolvePreviewPath('./next.md', 'docs/guide/index.md'), 'docs/guide/next.md');
  assert.equal(resolvePreviewPath('../intro.md', 'docs/guide/index.md'), 'docs/intro.md');
  assert.equal(resolvePreviewPath('/root.md', 'docs/guide/index.md'), 'root.md');
  assert.equal(resolvePreviewPath('../../secret.md', 'docs/guide/index.md'), 'secret.md');
  assert.equal(resolvePreviewPath('../../../secret.md', 'docs/guide/index.md'), '../secret.md');
});

test('pathDirectory returns the containing markdown folder', () => {
  assert.equal(pathDirectory('docs/guide/index.md'), 'docs/guide');
  assert.equal(pathDirectory('README.md'), '');
});

test('searchForPreviewPath and pathFromSearch round trip markdown navigation state', () => {
  const search = searchForPreviewPath('docs/guide/next.md');

  assert.equal(search, '?path=docs%2Fguide%2Fnext.md');
  assert.equal(pathFromSearch(search), 'docs/guide/next.md');
  assert.equal(searchForPreviewPath(''), '');
  assert.equal(pathFromSearch(''), '');
});

test('client script integrates markdown navigation with browser history', () => {
  assert.match(CLIENT_JS, /history\.pushState/);
  assert.match(CLIENT_JS, /history\.replaceState/);
  assert.match(CLIENT_JS, /popstate/);
  assert.match(CLIENT_JS, /pathFromSearch\(window\.location\.search\)/);
});
