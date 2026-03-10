/**
 * Validate files array
 * @param {Array} files - Files to validate
 * @returns {Object} Validation result
 */
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

/**
 * Standardize error response
 * @param {string} message - Error message
 * @param {Array} errors - Additional errors (optional)
 * @param {string} serviceName - Service name (optional)
 * @returns {Object} Standardized error response
 */
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

/**
 * Wait for webview dom-ready event
 * @param {HTMLElement} webview - Webview element
 */
export async function waitForDomReady(webview: {
  addEventListener?: (
    event: string,
    cb: (...args: unknown[]) => void,
    options?: { once?: boolean }
  ) => void;
  isLoading?: () => boolean;
}): Promise<void> {
  try {
    if (typeof webview.isLoading === "function" && webview.isLoading() === false) return;
    const addEventListener = webview.addEventListener;
    if (typeof addEventListener !== "function") return;
    await new Promise((resolve) => {
      addEventListener("dom-ready", resolve, { once: true });
    });
  } catch (e) {
    console.warn(
      uploadT("waitForDomReadyFailed", {
        message: e instanceof Error ? e.message : String(e),
      }),
      e
    );
  }
}
