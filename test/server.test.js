const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getPreviewRoot,
  resolveRootRelativePath,
  contentTypeForPath
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
