const vscode = require('vscode');
const { createExtensionController } = require('./extensionController');

let controller;

function activate(context) {
  controller = createExtensionController(vscode);
  controller.activate(context);
}

function deactivate() {
  if (controller) {
    return controller.stop(false);
  }
  return undefined;
}

module.exports = { activate, deactivate };
