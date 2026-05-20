const path = require('node:path');
const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getPreviewRoot,
  resolveRootRelativePath,
  contentTypeForPath,
  vendorAssetForPath
} = require('../src/server');

test('getPreviewRoot uses the selected markdown file directory as root', () => {
  const markdownPath = path.join('E:', 'docs', 'guide', 'index.md');

  assert.equal(getPreviewRoot(markdownPath), path.dirname(path.resolve(markdownPath)));
});

test('resolveRootRelativePath resolves relative links under the markdown root', () => {
  const root = path.resolve('E:/docs/guide');
  const resolved = resolveRootRelativePath(root, './chapter-1.md');

  assert.equal(resolved, path.join(root, 'chapter-1.md'));
});

test('resolveRootRelativePath rejects paths outside the markdown root', () => {
  const root = path.resolve('E:/docs/guide');

  assert.throws(
    () => resolveRootRelativePath(root, '../secret.md'),
    /Path is outside the preview root/
  );
});

test('contentTypeForPath returns markdown and image content types', () => {
  assert.equal(contentTypeForPath('notes.md'), 'text/markdown; charset=utf-8');
  assert.equal(contentTypeForPath('images/diagram.png'), 'image/png');
});

test('vendorAssetForPath maps browser libraries to local package files', () => {
  assert.equal(vendorAssetForPath('/vendor/marked.min.js').contentType, 'application/javascript; charset=utf-8');
  assert.equal(vendorAssetForPath('/vendor/marked.min.js').packageName, 'marked');
  assert.equal(vendorAssetForPath('/vendor/mermaid.min.js').contentType, 'application/javascript; charset=utf-8');
  assert.equal(vendorAssetForPath('/vendor/mermaid.min.js').packageName, 'mermaid');
  assert.equal(vendorAssetForPath('/vendor/unknown.js'), undefined);
});

test('vendorAssetForPath resolves files installed with package dependencies', () => {
  assert.equal(fs.existsSync(vendorAssetForPath('/vendor/marked.min.js').filePath), true);
  assert.equal(fs.existsSync(vendorAssetForPath('/vendor/mermaid.min.js').filePath), true);
});
