# Changelog

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
