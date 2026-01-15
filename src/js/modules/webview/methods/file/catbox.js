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
import { LogManager } from "../../../log-manager.js";

export async function attachFiles(webview, { files }) {

  const validation = validateFiles(files);
  if (!validation.valid) {
    return createErrorResponse(validation.message);
  }

  if (!isServiceAvailable("CATBOX")) {
    return createErrorResponse("Catbox servisi mevcut değil");
  }


  try {
    const { uploadedLinks, uploadErrors } = await uploadMultipleFiles(
      "CATBOX",
      files,
    );

    LogManager.addEvent("file-upload", "info", `Catbox upload tamamlandı: ${uploadedLinks.length} başarılı, ${uploadErrors.length} hata`);

    return formatUploadResponse(uploadedLinks, uploadErrors, "Catbox");
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    LogManager.addEvent("file-upload", "error", `Catbox upload hatası: ${errorMsg}`);
    return createErrorResponse(errorMsg, [], "Catbox");
  }
}
