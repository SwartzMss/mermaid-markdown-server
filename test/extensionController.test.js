const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getMarkdownPath,
  buildPreviewUrl,
  resolveMarkdownPath,
  resolveAutoStopMs,
  createExtensionController
} = require('../src/extensionController');

function fakeVscode(activeEditor) {
  return {
    window: {
      activeTextEditor: activeEditor
    }
  };
}

test('getMarkdownPath uses the markdown resource passed from context menu', () => {
  const markdownPath = getMarkdownPath(fakeVscode(), { fsPath: 'E:/notes/plan.md' });

  assert.equal(markdownPath, 'E:/notes/plan.md');
});

test('getMarkdownPath falls back to active markdown editor', () => {
  const markdownPath = getMarkdownPath(fakeVscode({
    document: {
      languageId: 'markdown',
      uri: { fsPath: 'E:/notes/current.md' }
    }
  }));

  assert.equal(markdownPath, 'E:/notes/current.md');
});

test('getMarkdownPath rejects non-markdown files', () => {
  assert.throws(
    () => getMarkdownPath(fakeVscode(), { fsPath: 'E:/notes/current.txt' }),
    /Open or select a Markdown file/
  );
});

test('buildPreviewUrl returns a browser friendly URL', () => {
  assert.equal(buildPreviewUrl(3000), 'http://localhost:3000');
});

test('resolveAutoStopMs converts minutes to milliseconds', () => {
  assert.equal(resolveAutoStopMs(30), 30 * 60 * 1000);
});

test('resolveAutoStopMs disables auto-stop for zero or negative values', () => {
  assert.equal(resolveAutoStopMs(0), 0);
  assert.equal(resolveAutoStopMs(-1), 0);
});

test('resolveMarkdownPath opens a picker when no markdown editor is active', async () => {
  const markdownPath = await resolveMarkdownPath({
    window: {
      activeTextEditor: undefined,
      showOpenDialog: async () => [{ fsPath: 'E:/notes/picked.md' }]
    }
  });

  assert.equal(markdownPath, 'E:/notes/picked.md');
});

test('resolveMarkdownPath rejects when the picker is cancelled', async () => {
  await assert.rejects(
    () => resolveMarkdownPath({
      window: {
        activeTextEditor: undefined,
        showOpenDialog: async () => undefined
      }
    }),
    /Open or select a Markdown file/
  );
});

test('openPreview starts the server before opening the browser when no server is running', async () => {
  let listened = false;
  const opened = [];
  const controller = createExtensionController(fakeRuntimeVscode(opened), {
    createMarkdownServer: () => ({
      once() {},
      off() {},
      listen(port, host, callback) {
        listened = port === 3000 && host === '0.0.0.0';
        callback();
      },
      close(callback) {
        callback();
      }
    })
  });

  await controller.openPreview({ fsPath: 'E:/notes/plan.md' });

  assert.equal(listened, true);
  assert.deepEqual(opened, ['http://localhost:3000']);
});

test('openPreview schedules idle auto-stop with configured minutes', async () => {
  const delays = [];
  const controller = createExtensionController(fakeRuntimeVscode([], {
    autoStopAfterMinutes: 2
  }), {
    createMarkdownServer: () => ({
      once() {},
      off() {},
      listen(_port, _host, callback) {
        callback();
      },
      close(callback) {
        callback();
      }
    }),
    setTimeout: (_callback, delay) => {
      delays.push(delay);
      return { unref() {} };
    },
    clearTimeout: () => {}
  });

  await controller.openPreview({ fsPath: 'E:/notes/plan.md' });

  assert.equal(delays.at(-1), 2 * 60 * 1000);
});

test('openPreview switches markdown files without rebinding the server on the same port', async () => {
  let listenCount = 0;
  let closeCount = 0;
  const updatedFiles = [];
  const opened = [];
  const controller = createExtensionController(fakeRuntimeVscode(opened), {
    createMarkdownServer: () => ({
      once() {},
      off() {},
      listen(_port, _host, callback) {
        listenCount += 1;
        callback();
      },
      close(callback) {
        closeCount += 1;
        callback();
      },
      setFile(file) {
        updatedFiles.push(file);
      }
    })
  });

  await controller.openPreview({ fsPath: 'E:/notes/first.md' });
  await controller.openPreview({ fsPath: 'E:/notes/second.md' });

  assert.equal(listenCount, 1);
  assert.equal(closeCount, 0);
  assert.deepEqual(updatedFiles, ['E:/notes/second.md']);
  assert.deepEqual(opened, ['http://localhost:3000', 'http://localhost:3000']);
});

test('openPreview serializes rapid file switches so the first port bind is reused', async () => {
  let serverCount = 0;
  let listenCount = 0;
  const listenCallbacks = [];
  const updatedFiles = [];
  const opened = [];
  const controller = createExtensionController(fakeRuntimeVscode(opened), {
    createMarkdownServer: () => {
      serverCount += 1;
      return {
        once() {},
        off() {},
        listen(_port, _host, callback) {
          listenCount += 1;
          listenCallbacks.push(callback);
        },
        close(callback) {
          callback();
        },
        setFile(file) {
          updatedFiles.push(file);
        }
      };
    }
  });

  const firstOpen = controller.openPreview({ fsPath: 'E:/notes/first.md' });
  await flushPromises();
  const secondOpen = controller.openPreview({ fsPath: 'E:/notes/second.md' });
  await flushPromises();

  for (const callback of [...listenCallbacks]) {
    callback();
  }
  await Promise.all([firstOpen, secondOpen]);

  assert.equal(serverCount, 1);
  assert.equal(listenCount, 1);
  assert.deepEqual(updatedFiles, ['E:/notes/second.md']);
  assert.deepEqual(opened, ['http://localhost:3000', 'http://localhost:3000']);
});

test('stop force-closes active HTTP connections so the port can be released', async () => {
  let closeCallback;
  let forceClosedConnections = false;
  const controller = createExtensionController(fakeRuntimeVscode([]), {
    createMarkdownServer: () => ({
      once() {},
      off() {},
      listen(_port, _host, callback) {
        callback();
      },
      close(callback) {
        closeCallback = callback;
      },
      closeAllConnections() {
        forceClosedConnections = true;
        closeCallback();
      }
    })
  });

  await controller.openPreview({ fsPath: 'E:/notes/plan.md' });
  const stopPromise = controller.stop(true);
  await Promise.resolve();

  assert.equal(forceClosedConnections, true);
  await stopPromise;
});

function fakeRuntimeVscode(opened, configuration = {}, errors = []) {
  return {
    StatusBarAlignment: { Right: 1 },
    Uri: {
      parse(value) {
        return value;
      }
    },
    commands: {
      registerCommand() {
        return { dispose() {} };
      }
    },
    env: {
      openExternal: async (uri) => {
        opened.push(uri);
      },
      clipboard: {
        writeText: async () => {}
      }
    },
    window: {
      activeTextEditor: undefined,
      createStatusBarItem: () => ({
        show() {},
        hide() {}
      }),
      showErrorMessage: (message) => {
        errors.push(message);
      },
      showInformationMessage: async () => undefined,
      showOpenDialog: async () => undefined
    },
    workspace: {
      getConfiguration: () => ({
        get(key, fallback) {
          return Object.hasOwn(configuration, key) ? configuration[key] : fallback;
        }
      })
    }
  };
}

async function flushPromises() {
  for (let index = 0; index < 5; index += 1) {
    await Promise.resolve();
  }
}
