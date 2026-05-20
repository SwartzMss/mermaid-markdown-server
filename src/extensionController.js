const { createMarkdownServer } = require('./server');

const PREVIEW_HOST = '127.0.0.1';

function getMarkdownPath(vscode, resourceUri) {
  if (resourceUri && isMarkdownPath(resourceUri.fsPath)) {
    return resourceUri.fsPath;
  }

  const editor = vscode.window.activeTextEditor;
  const document = editor && editor.document;

  if (document && document.languageId === 'markdown' && document.uri && document.uri.fsPath) {
    return document.uri.fsPath;
  }

  throw new Error('Open or select a Markdown file before starting the preview server.');
}

async function resolveMarkdownPath(vscode, resourceUri) {
  try {
    return getMarkdownPath(vscode, resourceUri);
  } catch (error) {
    const picked = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: {
        Markdown: ['md', 'markdown']
      },
      title: 'Select a Markdown file to preview'
    });

    if (picked && picked[0] && isMarkdownPath(picked[0].fsPath)) {
      return picked[0].fsPath;
    }

    throw error;
  }
}

function isMarkdownPath(filePath) {
  return typeof filePath === 'string' && /\.(md|markdown)$/i.test(filePath);
}

function buildPreviewUrl(port) {
  return `http://localhost:${port}`;
}

function resolveAutoStopMs(minutes) {
  const value = Number(minutes);
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return value * 60 * 1000;
}

function createExtensionController(vscode, dependencies = {}) {
  const serverFactory = dependencies.createMarkdownServer || createMarkdownServer;
  const setTimer = dependencies.setTimeout || setTimeout;
  const clearTimer = dependencies.clearTimeout || clearTimeout;
  let server = null;
  let currentUrl = null;
  let currentPort = null;
  let currentAutoStopMs = 0;
  let autoStopTimer = null;
  let statusBarItem = null;
  let operationQueue = Promise.resolve();

  function activate(context) {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'mermaidMarkdownServer.openPreview';
    statusBarItem.text = '$(markdown) Mermaid Preview';
    statusBarItem.tooltip = 'Open Mermaid Markdown preview';

    context.subscriptions.push(
      statusBarItem,
      vscode.commands.registerCommand('mermaidMarkdownServer.openPreview', openPreview),
      vscode.commands.registerCommand('mermaidMarkdownServer.stop', () => stop(true))
    );
  }

  function start(resourceUri, optionsOverride = {}) {
    return enqueueOperation(() => startNow(resourceUri, optionsOverride));
  }

  async function startNow(resourceUri, optionsOverride = {}) {
    let file;
    let options;

    try {
      file = await resolveMarkdownPath(vscode, resourceUri);
      options = readConfiguration();
    } catch (error) {
      vscode.window.showErrorMessage(error.message);
      return;
    }

    if (server && currentPort === options.port && typeof server.setFile === 'function') {
      server.setFile(file);
      currentUrl = buildPreviewUrl(options.port);
      currentAutoStopMs = resolveAutoStopMs(options.autoStopAfterMinutes);
      resetAutoStopTimer();
      showRunningStatus(currentUrl);

      if (!optionsOverride.silent) {
        await vscode.window.showInformationMessage(`Mermaid Markdown Server started at ${currentUrl}`);
      }

      if (options.autoOpen || optionsOverride.openAfterStart) {
        await openCurrentUrlNow();
      }
      return;
    }

    await stopNow(false);

    try {
      server = serverFactory({ file });
      await listen(server, options.port, PREVIEW_HOST);
      currentUrl = buildPreviewUrl(options.port);
      currentPort = options.port;
      currentAutoStopMs = resolveAutoStopMs(options.autoStopAfterMinutes);
      resetAutoStopTimer();
      showRunningStatus(currentUrl);

      if (!optionsOverride.silent) {
        await vscode.window.showInformationMessage(`Mermaid Markdown Server started at ${currentUrl}`);
      }

      if (options.autoOpen || optionsOverride.openAfterStart) {
        await openCurrentUrlNow();
      }
    } catch (error) {
      const serverToClose = server;
      server = null;
      currentUrl = null;
      currentPort = null;
      currentAutoStopMs = 0;
      clearAutoStopTimer();
      hideRunningStatus();
      await closeServer(serverToClose);
      vscode.window.showErrorMessage(`Failed to start Mermaid Markdown Server: ${error.message}`);
    }
  }

  function stop(showMessage) {
    return enqueueOperation(() => stopNow(showMessage));
  }

  async function stopNow(showMessage) {
    if (!server) {
      if (showMessage) {
        vscode.window.showInformationMessage('Mermaid Markdown Server is not running.');
      }
      return;
    }

    const serverToClose = server;
    server = null;
    currentUrl = null;
    currentPort = null;
    currentAutoStopMs = 0;
    clearAutoStopTimer();
    hideRunningStatus();

    await closeServer(serverToClose);

    if (showMessage) {
      vscode.window.showInformationMessage('Mermaid Markdown Server stopped.');
    }
  }

  function openPreview(resourceUri) {
    return enqueueOperation(() => openPreviewNow(resourceUri));
  }

  async function openPreviewNow(resourceUri) {
    if (!currentUrl || resourceUri) {
      await startNow(resourceUri, { openAfterStart: true, silent: true });
      return;
    }

    await openCurrentUrlNow();
  }

  async function openCurrentUrlNow() {
    if (!currentUrl) {
      vscode.window.showErrorMessage('Start the Mermaid Markdown Server before opening the preview.');
      return;
    }

    resetAutoStopTimer();
    await vscode.env.openExternal(vscode.Uri.parse(currentUrl));
  }

  function enqueueOperation(operation) {
    const nextOperation = operationQueue.then(operation, operation);
    operationQueue = nextOperation.catch(() => {});
    return nextOperation;
  }

  function readConfiguration() {
    const config = vscode.workspace.getConfiguration('mermaidMarkdownServer');
    return {
      port: config.get('port', 3000),
      autoOpen: config.get('autoOpen', true),
      autoStopAfterMinutes: config.get('autoStopAfterMinutes', 30)
    };
  }

  function resetAutoStopTimer() {
    clearAutoStopTimer();

    if (!server || currentAutoStopMs <= 0) {
      return;
    }

    autoStopTimer = setTimer(async () => {
      await stop(false);
    }, currentAutoStopMs);
    if (typeof autoStopTimer.unref === 'function') {
      autoStopTimer.unref();
    }
  }

  function clearAutoStopTimer() {
    if (!autoStopTimer) {
      return;
    }

    clearTimer(autoStopTimer);
    autoStopTimer = null;
  }

  function showRunningStatus(url) {
    if (!statusBarItem) {
      return;
    }

    statusBarItem.text = '$(radio-tower) Mermaid Preview';
    statusBarItem.tooltip = `Mermaid Markdown Server: ${url}`;
    statusBarItem.show();
  }

  function hideRunningStatus() {
    if (!statusBarItem) {
      return;
    }

    statusBarItem.hide();
  }

  return {
    activate,
    start,
    stop,
    openPreview
  };
}

function listen(server, port, host) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });
}

function closeServer(server) {
  if (!server) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });

    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    }
  });
}

module.exports = {
  getMarkdownPath,
  resolveMarkdownPath,
  isMarkdownPath,
  buildPreviewUrl,
  resolveAutoStopMs,
  createExtensionController
};
