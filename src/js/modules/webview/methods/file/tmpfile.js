/**
 * Tmpfiles.org upload service
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
  console.log("[attachFiles-tmpfile] called", files && files.length);

  const validation = validateFiles(files);
  if (!validation.valid) {
    return createErrorResponse(validation.message);
  }

  if (!isServiceAvailable("TMPFILE")) {
    return createErrorResponse("Tmpfiles servisi mevcut değil");
  }

  try {
    const { uploadedLinks, uploadErrors } = await uploadMultipleFiles(
      "TMPFILE",
      files,
    );

    console.log(
      `[attachFiles-tmpfile] Upload completed: ${uploadedLinks.length} successful, ${uploadErrors.length} errors`,
    );

    return formatUploadResponse(uploadedLinks, uploadErrors, "Tmpfile");
  } catch (err) {
    console.error("[attachFiles-tmpfile] error", err);
    const errorMsg = err instanceof Error ? err.message : String(err);
    return createErrorResponse(errorMsg, [], "Tmpfile");
  }
}
