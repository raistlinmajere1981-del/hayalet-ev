/**
 * Electron API Fallback
 *
 * Electron ortamı dışında (web/dev) çalışırken
 * window.electronAPI'nin mock implementasyonunu sağlar.
 */

import { getFilename } from "../constants/index.js";

export function ensureElectronApiFallback(): void {
  if (window.electronAPI) return;
  const storageKey = "hayalet-settings-v1";
  /**
   * @param {Response} resp
   * @returns {Promise<string|null>}
   */
  const toBase64 = async (resp: Response): Promise<string | null> => {
    try {
      const buf = await resp.arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buf);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        const byte = bytes[i];
        if (byte !== undefined) binary += String.fromCharCode(byte);
      }
      return btoa(binary);
    } catch {
      return null;
    }
  };

  const fallbackApi = {
    loadSettings: async (): Promise<Record<string, unknown>> => {
      try {
        const raw = localStorage.getItem(storageKey);
        return await Promise.resolve(
          raw !== null ? (JSON.parse(raw) as Record<string, unknown>) : {}
        );
      } catch {
        return await Promise.resolve({} as Record<string, unknown>);
      }
    },
    saveSettings: async (settings: Record<string, unknown>): Promise<boolean> => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(settings));
        return await Promise.resolve(true);
      } catch {
        return await Promise.resolve(false);
      }
    },

    readFile: async (path: string): Promise<string | null> => {
      try {
        const resp = await fetch(path);
        if (!resp.ok) return null;
        const b64 = await toBase64(resp);
        return b64;
      } catch {
        return null;
      }
    },
    openPath: async (_path: string): Promise<{ success: boolean }> =>
      await Promise.resolve({ success: true }),

    fmEnsureDirs: async (): Promise<{ success: boolean; paths: { commands: string } }> =>
      await Promise.resolve({
        success: true,
        paths: { commands: "commands" },
      }),
    fmTempPath: async (prefix: string, ext: string): Promise<{ path: string }> =>
      await Promise.resolve({
        path: `${prefix}-${Date.now()}.${ext}`,
      }),
    fmWriteFileAtomic: async (
      payload: Record<string, unknown>
    ): Promise<{ success: boolean; path: string }> => {
      const rawPath = payload["path"];
      return await Promise.resolve({
        success: true,
        path: typeof rawPath === "string" ? rawPath : "",
      });
    },

    commandInit: async (): Promise<{ success: boolean; jobs: unknown[] }> =>
      await Promise.resolve({ success: true, jobs: [] }),
    commandWrite: async (): Promise<{ success: boolean }> =>
      await Promise.resolve({ success: true }),
    commandMove: async (): Promise<{ success: boolean }> =>
      await Promise.resolve({ success: true }),
    commandStageAttachments: async (payload: {
      files?: string[];
    }): Promise<{
      success: boolean;
      staged: Array<{ name: string; path: string }>;
      temp: string[];
      commandDir: string;
    }> =>
      await Promise.resolve({
        success: true,
        staged: (payload.files ?? []).map((p: string) => ({
          name: getFilename(p),
          path: p,
        })),
        temp: [] as string[],
        commandDir: "commands",
      }),
    commandArchiveCopy: async (): Promise<{ success: boolean }> =>
      await Promise.resolve({ success: true }),
    commandCleanupJob: async (): Promise<{ success: boolean }> =>
      await Promise.resolve({ success: true }),
    commandMoveFailed: async (): Promise<{ success: boolean }> =>
      await Promise.resolve({ success: true }),

    whisperLoad: async (
      _params: unknown
    ): Promise<{
      success: boolean;
      pending: Array<Record<string, unknown>>;
      done: Array<Record<string, unknown>>;
    }> =>
      await Promise.resolve({
        success: true,
        pending: [] as Array<Record<string, unknown>>,
        done: [] as Array<Record<string, unknown>>,
      }),
    whisperSave: async (_params: unknown): Promise<{ success: boolean }> =>
      await Promise.resolve({ success: true }),

    getPreloadPath: async (): Promise<string> => await Promise.resolve(""),
    showOpenDialog: async (): Promise<{ canceled: boolean; filePaths: string[] }> =>
      await Promise.resolve({ canceled: true, filePaths: [] }),
    copyToAssets: async (p: string): Promise<{ success: boolean; path: string }> =>
      await Promise.resolve({ success: true, path: String(p) }),
    capturePage: async (): Promise<{ success: boolean }> =>
      await Promise.resolve({ success: false }),
    screenshotCapture: async (): Promise<{ success: boolean }> =>
      await Promise.resolve({ success: false }),
    windowMinimize: (): void => {},
    windowToggleFullscreen: (): void => {},
    windowClose: (): void => {},
    appRestart: async (): Promise<{ success: boolean; message?: string }> =>
      await Promise.resolve({ success: true, message: "fallback" }),
    generateTree: async (): Promise<{ success: boolean }> =>
      await Promise.resolve({ success: false }),
    fetchUrl: async (): Promise<{ success: boolean; url: string }> =>
      await Promise.resolve({ success: false, url: "" }),
    catboxUpload: async (): Promise<{ success: boolean; url: string }> =>
      await Promise.resolve({ success: false, url: "" }),
    uguuUpload: async (): Promise<{
      success: boolean;
      url: string;
      uploadedLinks: unknown[];
      uploaded: number;
      errors: unknown[];
    }> =>
      await Promise.resolve({
        success: false,
        url: "",
        uploadedLinks: [],
        uploaded: 0,
        errors: [],
      }),
    googledriveUpload: async (): Promise<{ success: boolean; authUrl: string }> =>
      await Promise.resolve({ success: false, authUrl: "" }),
    googledriveStartAuth: async (): Promise<{ success: boolean }> =>
      await Promise.resolve({ success: false }),
    googledriveExchangeCode: async (): Promise<{ success: boolean }> =>
      await Promise.resolve({ success: false }),
    googledriveDisconnect: async (): Promise<{ success: boolean }> =>
      await Promise.resolve({ success: false }),
  };

  const electronApi = {} as ElectronAPI;
  Object.assign(electronApi, fallbackApi);
  window.electronAPI = electronApi;
}
