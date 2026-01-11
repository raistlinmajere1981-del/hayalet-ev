/**
 * Uguu.se upload service
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
  console.log("[attachFiles-uguu] called", files && files.length);

  const validation = validateFiles(files);
  if (!validation.valid) {
    return createErrorResponse(validation.message);
  }

  if (!isServiceAvailable("UGUU")) {
    return createErrorResponse("Uguu servisi mevcut değil");
  }

  try {
    console.log(
      "[attachFiles-uguu] ipcAvailable:",
      !!window?.electronAPI?.uguuUpload,
    );
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.warn(
      "[attachFiles-uguu] ipcAvailable check failed",
      errorMsg,
    );
  }

  try {
    const { uploadedLinks, uploadErrors } = await uploadMultipleFiles(
      "UGUU",
      files,
    );

    console.log(
      `[attachFiles-uguu] Upload completed: ${uploadedLinks.length} successful, ${uploadErrors.length} errors`,
    );

    return formatUploadResponse(uploadedLinks, uploadErrors, "Uguu");
  } catch (err) {
    console.error("[attachFiles-uguu] general error", err);
    const errorMsg = err instanceof Error ? err.message : String(err);
    return createErrorResponse(errorMsg, [], "Uguu");
  }
}
