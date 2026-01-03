# Hayalet-ev Development Guidelines

> **Important:** This file is automatically read by Rovodev when working in this workspace.

## Quick Reference
For detailed behavioral protocols and coding standards, see [ultrathink.md](./ultrathink.md).

## Project-Specific Rules

### Technology Stack
- **Runtime:** Electron (Node.js + Chromium)
- **Frontend:** Vanilla JavaScript (no framework)
- **Styling:** Custom CSS (minimal, intentional design)
- **State Management:** Event-driven architecture

### Critical Patterns
1. **Webview Management:** Use `webview-manager.js` for all webview operations
2. **IPC Communication:** Use established IPC channels in `preload.cjs`
3. **File Operations:** Use `file-manager.js` for all file I/O
4. **Settings:** Use `settings-manager.js` for persistence

### Code Quality Standards
- Follow Electron security best practices (contextIsolation, nodeIntegration: false)
- Use async/await for all asynchronous operations
- Maintain separation between main and renderer processes
- Document complex logic inline

### Plugin System
- Plugins in `plugins/` directory
- Each plugin must have a manifest
- Use plugin API defined in `plugins/README.md`

### Performance Guidelines
- Lazy-load webviews when needed
- Clean up event listeners on component destruction
- Minimize main process operations
- Use requestIdleCallback for non-critical tasks

## Ultrathink Mode
When user types **"ULTRATHINK"**, engage deep analysis mode as defined in `ultrathink.md`.

---
**Last Updated:** 2026-01-03
