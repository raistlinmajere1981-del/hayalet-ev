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
import { LogManager } from "../../../log-manager.js";

export async function attachFiles(webview, { files }) {

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

    LogManager.addEvent("file-upload", "info", `Tmpfile upload tamamlandı: ${uploadedLinks.length} başarılı, ${uploadErrors.length} hata`);

    return formatUploadResponse(uploadedLinks, uploadErrors, "Tmpfile");
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    LogManager.addEvent("file-upload", "error", `Tmpfile upload hatası: ${errorMsg}`);
    return createErrorResponse(errorMsg, [], "Tmpfile");
  }
}
