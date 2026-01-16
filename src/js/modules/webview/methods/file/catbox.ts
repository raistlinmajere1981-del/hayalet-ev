/**
 * Catbox.moe upload service
 * Provider-agnostic implementation
 */

import { UploadManager } from "../../../upload-manager.js";
import { LogManager } from "../../../log-manager.js";

export async function attachFiles(webview, { files }) {
  const validation = UploadManager.validateFiles(files);
  if (!validation.valid) {
    return UploadManager.createError(validation.message);
  }

  if (!UploadManager.isServiceAvailable("CATBOX")) {
    return UploadManager.createError("Catbox servisi mevcut değil");
  }

  try {
    const { uploadedLinks, uploadErrors } = await UploadManager.uploadMultipleFiles(
      "CATBOX",
      files
    );

    LogManager.addEvent(
      "file-upload",
      "info",
      `Catbox upload tamamlandı: ${uploadedLinks.length} başarılı, ${uploadErrors.length} hata`
    );

    return UploadManager.formatResponse(uploadedLinks, uploadErrors, "Catbox");
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    LogManager.addEvent("file-upload", "error", `Catbox upload hatası: ${errorMsg}`);
    return UploadManager.createError(errorMsg, [], "Catbox");
  }
}
