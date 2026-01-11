/**
 * Catbox.moe upload service
 * Provider-agnostic implementation
 */

import {
  validateFiles,
  formatUploadResponse,
  createErrorResponse,
} from "../shared/file-utils.js";
import {
  uploadMultipleFiles,
  isServiceAvailable,
} from "../shared/upload-services.js";

export async function attachFiles(webview, { files }) {

  const validation = validateFiles(files);
  if (!validation.valid) {
    return createErrorResponse(validation.message);
  }

  if (!isServiceAvailable("CATBOX")) {
    return createErrorResponse("Catbox servisi mevcut değil");
  }

  try {
    console.log(
      "[attachFiles-catbox] ipcAvailable:",
      !!window?.electronAPI?.catboxUpload,
    );
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.warn(
      "[attachFiles-catbox] ipcAvailable check failed",
      errorMsg,
    );
  }

  try {
    const { uploadedLinks, uploadErrors } = await uploadMultipleFiles(
      "CATBOX",
      files,
    );

    console.log(
      `[attachFiles-catbox] Upload completed: ${uploadedLinks.length} successful, ${uploadErrors.length} errors`,
    );

    return formatUploadResponse(uploadedLinks, uploadErrors, "Catbox");
  } catch (err) {
    console.error("[attachFiles-catbox] general error", err);
    const errorMsg = err instanceof Error ? err.message : String(err);
    return createErrorResponse(errorMsg, [], "Catbox");
  }
}
