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
import { LogManager } from "../../../log-manager.js";

export async function attachFiles(webview, { files }) {

  const validation = validateFiles(files);
  if (!validation.valid) {
    return createErrorResponse(validation.message);
  }

  if (!isServiceAvailable("UGUU")) {
    return createErrorResponse("Uguu servisi mevcut değil");
  }

  try {
    LogManager.addEvent("file-upload", "debug", "Uguu upload başlatılıyor", { context: { ipcAvailable: !!window?.electronAPI?.uguuUpload, fileCount: files.length } });
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    LogManager.addEvent("file-upload", "warning", `Uguu IPC check failed: ${errorMsg}`);
  }

  try {
    const { uploadedLinks, uploadErrors } = await uploadMultipleFiles(
      "UGUU",
      files,
    );

    LogManager.addEvent("file-upload", "info", `Uguu upload tamamlandı: ${uploadedLinks.length} başarılı, ${uploadErrors.length} hata`);

    return formatUploadResponse(uploadedLinks, uploadErrors, "Uguu");
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    LogManager.addEvent("file-upload", "error", `Uguu upload hatası: ${errorMsg}`);
    return createErrorResponse(errorMsg, [], "Uguu");
  }
}
