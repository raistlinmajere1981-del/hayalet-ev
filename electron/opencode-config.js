/**
 * OpenCode Server Configuration (Electron Main Process)
 * 
 * Bu dosya electron main process'te kullanılır.
 * Renderer tarafındaki config: src/js/modules/webview/providers/opencode/config.ts
 */

export const OPENCODE_DEFAULTS = {
  port: 4096,
  cors: "http://localhost:5173",
  command: "opencode",
};
