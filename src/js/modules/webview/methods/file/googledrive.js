/**
 * Google Drive upload service
 * Provider-agnostic implementation
 */

import { validateFiles, createErrorResponse } from "../shared/file-utils.js";
import { isServiceAvailable } from "../shared/upload-services.js";

export async function attachFiles(webview, { files }) {
  console.log("[attachFiles-googledrive] called", files && files.length);

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

    console.debug(
      "[attachFiles-googledrive] payloadFiles preview",
      payloadFiles.map((p) => ({ name: p.name, hasBase64: !!p.base64 })),
    );

    if (!window.electronAPI?.googledriveUpload) {
      throw new Error("electronAPI.googledriveUpload not available");
    }
    const result = await window.electronAPI.googledriveUpload({
      files: payloadFiles,
    });
    console.debug("[attachFiles-googledrive] ipc response", result);

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
    console.debug(
      "[attachFiles-googledrive] normalized uploaded links",
      uploaded,
    );

    return {
      success: true,
      message: `${uploaded.length} dosya Google Drive'a yüklendi`,
      uploadedLinks: Array.isArray(uploaded) ? uploaded : [],
      errors: result.errors,
      injected: false,
    };
  } catch (err) {
    console.error("[attachFiles-googledrive] error", err);
    const errorMsg = err instanceof Error ? err.message : "Google Drive hatası";
    return createErrorResponse(
      errorMsg,
      [],
      "Google Drive",
    );
  }
}
