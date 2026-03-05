/**
 * Validate files array
 * @param {Array} files - Files to validate
 * @returns {Object} Validation result
 */
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

export function validateFiles(files: FilePayload[]): { valid: boolean; message?: string } {
  if (files.length === 0) {
    return { valid: false, message: "Aktarılacak dosya bulunamadı" };
  }

  for (const file of files) {
    if (file.name === "" || file.base64 === "") {
      return {
        valid: false,
        message: `Geçersiz dosya: ${file.name}`,
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
    message: serviceName !== "" ? `${serviceName} hatası: ${message}` : message,
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
    console.warn("[Hayalet-FileUtils] waitForDomReady failed", e);
  }
}
