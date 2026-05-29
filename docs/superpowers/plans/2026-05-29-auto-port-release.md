# Auto Port Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let separate VS Code windows start the preview server without colliding on a fixed port, then publish a new release with the version bump and release notes.

**Architecture:** Keep `src/extensionController.js` responsible for port selection and server lifecycle. Add a small sequential port probe that starts at the configured port and advances only when the bind error is `EADDRINUSE`. Keep the actual port used as the source of truth for the preview URL and status bar text.

**Tech Stack:** Node.js, VS Code extension API, built-in `http` server, `node:test`, `vsce`, Git tags, GitHub Actions release workflow.

---

### Task 1: Add auto-port fallback coverage

**Files:**
- Modify: `test/extensionController.test.js`

- [ ] **Step 1: Write the failing test**

```js
test('openPreview falls back to the next port when the configured port is already in use', async () => {
  const opened = [];
  const attempts = [];
  const controller = createExtensionController(fakeRuntimeVscode(opened), {
    createMarkdownServer: () => ({
      once(event, handler) {
        if (event === 'error') {
          this.errorHandler = handler;
        }
      },
      off() {},
      listen(port, host, callback) {
        attempts.push({ port, host });
        if (port === 3000) {
          const error = new Error('bind EADDRINUSE');
          error.code = 'EADDRINUSE';
          this.errorHandler(error);
          return;
        }
        callback();
      },
      close(callback) {
        callback();
      }
    })
  });

  await controller.openPreview({ fsPath: 'E:/notes/plan.md' });

  assert.deepEqual(attempts, [
    { port: 3000, host: '0.0.0.0' },
    { port: 3001, host: '0.0.0.0' }
  ]);
  assert.deepEqual(opened, ['http://localhost:3001']);
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `node --test test/extensionController.test.js -t "falls back to the next port"`

Expected: fail because the controller still stops on `EADDRINUSE`.

### Task 2: Implement sequential port probing

**Files:**
- Modify: `src/extensionController.js`

- [ ] **Step 1: Add a helper that probes the configured port and a small fallback range**
- [ ] **Step 2: Use the actual bound port when building the preview URL and status text**
- [ ] **Step 3: Keep non-port bind errors failing fast**
- [ ] **Step 4: Run the focused test and confirm it passes**

Run: `node --test test/extensionController.test.js`

Expected: the new fallback test passes and the existing reuse/stop tests still pass.

### Task 3: Bump release metadata

**Files:**
- Modify: `package.json`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Update the extension version to `1.0.13`**
- [ ] **Step 2: Add a changelog entry describing the multi-window port fallback**
- [ ] **Step 3: Run the package and test commands**

Run: `npm test`
Run: `npm run package -- --out mermaid-markdown-server.vsix`

Expected: tests pass and packaging succeeds with the new version.

### Task 4: Tag and publish the release

**Files:**
- No source file changes

- [ ] **Step 1: Create the release tag `v1.0.13`**
- [ ] **Step 2: Push the branch and tag to `origin`**
- [ ] **Step 3: Verify the `release.yml` workflow will create the GitHub Release from the pushed tag**

Run: `git push -u origin main --tags`

Expected: GitHub Actions receives the tag push and creates the release from `.github/workflows/release.yml`.
