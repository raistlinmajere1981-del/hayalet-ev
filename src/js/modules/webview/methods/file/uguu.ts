/**
 * Uguu.se upload service
 * Provider-agnostic implementation
 */

import { UploadManager } from "../../../upload-manager.js";
import { LogManager } from "../../../log-manager.js";

interface FilePayload {
  name: string;
  path?: string;
  base64?: string;
  mimeType?: string;
}

export async function attachFiles(_webview: HTMLElement, { files }: { files: FilePayload[] }) {
  const validation = UploadManager.validateFiles(files);
  if (!validation.valid) {
    return UploadManager.createError(validation.message || "Validation failed");
  }

  if (!UploadManager.isServiceAvailable("UGUU")) {
    return UploadManager.createError("Uguu servisi mevcut değil");
  }

  try {
    const { uploadedLinks, uploadErrors } = await UploadManager.uploadMultipleFiles("UGUU", files);

    LogManager.addEvent(
      "file-upload",
      "info",
      `Uguu upload tamamlandı: ${uploadedLinks.length} başarılı, ${uploadErrors.length} hata`
    );

    return UploadManager.formatResponse(uploadedLinks, uploadErrors, "Uguu");
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    LogManager.addEvent("file-upload", "error", `Uguu upload hatası: ${errorMsg}`);
    return UploadManager.createError(errorMsg, [], "Uguu");
  }
}
