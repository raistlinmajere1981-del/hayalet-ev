/**
 * OpenCode Server Configuration (Electron Main Process)
 *
 * Bu dosya electron main process'te kullanılır.
 * Renderer tarafındaki config: src/js/modules/webview/providers/opencode/config.ts
 */

export interface OpencodeModel {
  providerID: string;
  modelID: string;
}

export interface OpencodeDefaults {
  port: number;
  cors: string;
  command: string;
  defaultModel: OpencodeModel;
  defaultAgent?: string;
}

export const OPENCODE_DEFAULTS: OpencodeDefaults = {
  port: 4096,
  cors: "http://localhost:5173",
  command: "opencode",
  // Default model: GLM-4.7 (zai provider)
  defaultModel: {
    providerID: "zai",
    modelID: "glm-4.7",
  },
  // Default agent: build (OpenCode'un ana coding agent'ı)
  defaultAgent: "build",
};
