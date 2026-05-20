const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createMarkdownServer,
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

test('createMarkdownServer reads the updated markdown file without rebinding', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mermaid-markdown-server-'));
  const firstFile = path.join(tempRoot, 'first.md');
  const secondFile = path.join(tempRoot, 'second.md');
  fs.writeFileSync(firstFile, '# First\n');
  fs.writeFileSync(secondFile, '# Second\n');

  const server = createMarkdownServer({ file: firstFile });

  try {
    assert.deepEqual(await requestServer(server, '/content.md'), {
      statusCode: 200,
      body: '# First\n'
    });

    server.setFile(secondFile);

    assert.deepEqual(await requestServer(server, '/content.md'), {
      statusCode: 200,
      body: '# Second\n'
    });
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

function requestServer(server, url) {
  const requestHandler = server.listeners('request')[0];

  return new Promise((resolve, reject) => {
    const response = {
      statusCode: undefined,
      writeHead(statusCode) {
        this.statusCode = statusCode;
      },
      end(body) {
        resolve({
          statusCode: this.statusCode,
          body: String(body || '')
        });
      }
    };

    Promise.resolve(requestHandler({ method: 'GET', url }, response)).catch(reject);
  });
}
