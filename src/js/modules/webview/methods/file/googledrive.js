/**
 * Google Drive upload service
 * Provider-agnostic implementation
 */

import { validateFiles, createErrorResponse } from "../shared/file-utils.js";
import { isServiceAvailable } from "../shared/upload-services.js";
import { LogManager } from "../../../log-manager.js";

export async function attachFiles(webview, { files }) {

  const validation = validateFiles(files);
  if (!validation.valid) {
    return createErrorResponse(validation.message);
  }

  if (!isServiceAvailable("GOOGLEDRIVE")) {
    return createErrorResponse("Google Drive IPC servisi mevcut değil");
  }

  try {
    const payloadFiles = files.map((f) => ({
      name: f.name,
      mimeType: f.mimeType,
      base64: f.base64,
    }));

    LogManager.addEvent("file-upload", "debug", "Google Drive upload başlatılıyor", { 
      context: { fileCount: payloadFiles.length, files: payloadFiles.map((p) => ({ name: p.name, hasBase64: !!p.base64 })) } 
    });

    if (!window.electronAPI?.googledriveUpload) {
      throw new Error("electronAPI.googledriveUpload not available");
    }
    const result = await window.electronAPI.googledriveUpload({
      files: payloadFiles,
    });

    if (!result?.success) {
      return {
        success: false,
        message: result?.message || "Google Drive yükleme başarısız",
        errors: result?.errors,
        injected: false,
      };
    }

    const uploaded =
      result.uploadedLinks ||
      result.uploaded ||
      (result.data && result.data.uploadedLinks) ||
      [];
    LogManager.addEvent("file-upload", "info", `Google Drive upload tamamlandı: ${uploaded.length} dosya yüklendi`);

    return {
      success: true,
      message: `${uploaded.length} dosya Google Drive'a yüklendi`,
      uploadedLinks: Array.isArray(uploaded) ? uploaded : [],
      errors: result.errors,
      injected: false,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Google Drive hatası";
    LogManager.addEvent("file-upload", "error", `Google Drive upload hatası: ${errorMsg}`);
    return createErrorResponse(
      errorMsg,
      [],
      "Google Drive",
    );
  }
}
