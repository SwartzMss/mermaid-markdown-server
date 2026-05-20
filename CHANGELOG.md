# Changelog

## 1.0.5

- Removed the standalone CLI entry and its related configuration files.
- Removed the LAN URL command and LAN host settings from the extension.
- Added a packaged PNG icon and removed outdated README sections.

## 1.0.4

- Added browser history support for Markdown-to-Markdown navigation.
- Restored Markdown previews from `?path=` URLs after refresh or direct open.
- Resolved relative links and resources from the currently viewed Markdown file.
- Kept Markdown links as preview URLs so new tabs open the rendered preview page.

## 1.0.3

- Bundled Markdown and Mermaid browser libraries for offline preview.
- Served renderer libraries from the local preview server instead of external CDNs.
- Added tests for local vendor script URLs and installed vendor asset paths.

## 1.0.2

- Fixed a generated client script syntax error in external URL detection.
- Added a test that parses the generated browser script before release.

## 1.0.1

- Fixed preview startup when LAN address detection is unavailable.
- Cleaned up preview server state if startup fails after binding a port.
- Avoided blocking the preview page on remote Markdown and Mermaid library scripts.
- Added fallback CDN loading and timeout handling for browser renderer libraries.

## 1.0.0

- Initial VS Code extension scaffold.
- Added one primary command to open or start the Markdown preview server.
- Added commands to stop and copy the LAN URL for a Markdown preview server.
- Added idle auto-stop configuration with a 30 minute default.
- Added root-relative Markdown links and local resource loading based on the opened Markdown file directory.
- Added GitHub Actions workflows for CI packaging and release publishing.
- Added local Markdown and Mermaid browser rendering.
- Kept a standalone CLI preview command for development.
