import { AppI18n } from "../../../i18n/index.js";

interface FilePayload {
  name: string;
  base64?: string;
  path?: string;
  mimeType?: string;
}

interface UploadError {
  file: string;
  error: string;
}

function uploadT(key: string, params?: Record<string, string | number>): string {
  return AppI18n.t(`app.upload.${key}`, params);
}

export function validateFiles(files: FilePayload[]): { valid: boolean; message?: string } {
  if (files.length === 0) {
    return { valid: false, message: uploadT("noFiles") };
  }

  for (const file of files) {
    if (file.name === "" || file.base64 === "") {
      return {
        valid: false,
        message: uploadT("invalidFile", {
          name: file.name !== "" ? file.name : uploadT("untitledFile"),
        }),
      };
    }
  }

  return { valid: true };
}

export function createErrorResponse(
  message: string,
  errors: UploadError[] = [],
  serviceName = ""
): { success: boolean; message: string; errors: UploadError[]; injected: boolean } {
  return {
    success: false,
    message:
      serviceName !== "" ? uploadT("serviceError", { service: serviceName, message }) : message,
    errors,
    injected: false,
  };
}

export async function waitForDomReady(
  webview: {
    addEventListener?: (
      event: string,
      cb: (...args: unknown[]) => void,
      options?: { once?: boolean }
    ) => void;
    removeEventListener?: (event: string, cb: (...args: unknown[]) => void) => void;
    isLoading?: () => boolean;
  },
  timeoutMs = 15_000
): Promise<void> {
  // A SPA can finish loading without emitting another dom-ready. Never hold a
  // sync lock indefinitely waiting for that event.
  if (typeof webview.isLoading !== "function" || webview.isLoading() === false) return;
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error): void => {
      if (settled) return;
      settled = true;
      clearInterval(poll);
      clearTimeout(timer);
      webview.removeEventListener?.("dom-ready", onReady);
      webview.removeEventListener?.("did-stop-loading", onReady);
      if (error) reject(error);
      else resolve();
    };
    const onReady = (): void => {
      finish();
    };
    const check = (): void => {
      try {
        if (webview.isLoading?.() === false) finish();
      } catch (error) {
        finish(error instanceof Error ? error : new Error(String(error)));
      }
    };
    const poll = setInterval(check, 100);
    const timer = setTimeout(() => {
      finish(new Error("Timed out waiting for webview DOM readiness"));
    }, timeoutMs);
    webview.addEventListener?.("dom-ready", onReady, { once: true });
    webview.addEventListener?.("did-stop-loading", onReady, { once: true });
    check();
  });
}
