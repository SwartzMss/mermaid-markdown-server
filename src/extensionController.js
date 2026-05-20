const os = require('node:os');
const { createMarkdownServer } = require('./server');

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

function displayHost(host) {
  return host === '0.0.0.0' || host === '::' ? 'localhost' : host;
}

function buildPreviewUrl(host, port) {
  return `http://${displayHost(host)}:${port}`;
}

function findLanHost() {
  let networks;

  try {
    networks = os.networkInterfaces();
  } catch (_error) {
    return 'localhost';
  }

  for (const interfaces of Object.values(networks)) {
    for (const details of interfaces || []) {
      if (details.family === 'IPv4' && !details.internal) {
        return details.address;
      }
    }
  }

  return 'localhost';
}

function buildLanUrl(host, port) {
  const lanHost = host === '0.0.0.0' || host === '::' ? findLanHost() : displayHost(host);
  return `http://${lanHost}:${port}`;
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
  let currentLanUrl = null;
  let currentAutoStopMs = 0;
  let autoStopTimer = null;
  let statusBarItem = null;

  function activate(context) {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'mermaidMarkdownServer.openPreview';
    statusBarItem.text = '$(markdown) Mermaid Preview';
    statusBarItem.tooltip = 'Open Mermaid Markdown preview';

    context.subscriptions.push(
      statusBarItem,
      vscode.commands.registerCommand('mermaidMarkdownServer.openPreview', openPreview),
      vscode.commands.registerCommand('mermaidMarkdownServer.stop', () => stop(true)),
      vscode.commands.registerCommand('mermaidMarkdownServer.copyLanUrl', copyLanUrl)
    );
  }

  async function start(resourceUri, optionsOverride = {}) {
    let file;
    let options;

    try {
      file = await resolveMarkdownPath(vscode, resourceUri);
      options = readConfiguration();
    } catch (error) {
      vscode.window.showErrorMessage(error.message);
      return;
    }

    await stop(false);

    try {
      server = serverFactory({ file });
      await listen(server, options.port, options.host);
      currentUrl = buildPreviewUrl(options.host, options.port);
      currentLanUrl = buildLanUrl(options.host, options.port);
      currentAutoStopMs = resolveAutoStopMs(options.autoStopAfterMinutes);
      resetAutoStopTimer();
      showRunningStatus(currentUrl);

      const action = optionsOverride.silent
        ? undefined
        : await vscode.window.showInformationMessage(
          `Mermaid Markdown Server started at ${currentUrl}`,
          'Copy LAN URL'
        );

      if (options.autoOpen || optionsOverride.openAfterStart) {
        await openCurrentUrl();
      }

      if (action === 'Copy LAN URL') {
        await copyLanUrl();
      }
    } catch (error) {
      const serverToClose = server;
      server = null;
      currentUrl = null;
      currentLanUrl = null;
      currentAutoStopMs = 0;
      clearAutoStopTimer();
      hideRunningStatus();
      await closeServer(serverToClose);
      vscode.window.showErrorMessage(`Failed to start Mermaid Markdown Server: ${error.message}`);
    }
  }

  async function stop(showMessage) {
    if (!server) {
      if (showMessage) {
        vscode.window.showInformationMessage('Mermaid Markdown Server is not running.');
      }
      return;
    }

    const serverToClose = server;
    server = null;
    currentUrl = null;
    currentLanUrl = null;
    currentAutoStopMs = 0;
    clearAutoStopTimer();
    hideRunningStatus();

    await new Promise((resolve, reject) => {
      serverToClose.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    if (showMessage) {
      vscode.window.showInformationMessage('Mermaid Markdown Server stopped.');
    }
  }

  async function openPreview(resourceUri) {
    if (!currentUrl || resourceUri) {
      await start(resourceUri, { openAfterStart: true, silent: true });
      return;
    }

    await openCurrentUrl();
  }

  async function openCurrentUrl() {
    if (!currentUrl) {
      vscode.window.showErrorMessage('Start the Mermaid Markdown Server before opening the preview.');
      return;
    }

    resetAutoStopTimer();
    await vscode.env.openExternal(vscode.Uri.parse(currentUrl));
  }

  async function copyLanUrl() {
    if (!currentLanUrl) {
      vscode.window.showErrorMessage('Start the Mermaid Markdown Server before copying the LAN URL.');
      return;
    }

    resetAutoStopTimer();
    await vscode.env.clipboard.writeText(currentLanUrl);
    vscode.window.showInformationMessage(`Copied LAN URL: ${currentLanUrl}`);
  }

  function readConfiguration() {
    const config = vscode.workspace.getConfiguration('mermaidMarkdownServer');
    return {
      port: config.get('port', 3000),
      host: config.get('host', '0.0.0.0'),
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
    openPreview,
    copyLanUrl
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

  return new Promise((resolve) => {
    server.close(() => {
      resolve();
    });
  });
}

module.exports = {
  getMarkdownPath,
  resolveMarkdownPath,
  isMarkdownPath,
  displayHost,
  buildPreviewUrl,
  buildLanUrl,
  resolveAutoStopMs,
  createExtensionController
};
