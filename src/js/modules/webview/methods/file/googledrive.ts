/**
 * Google Drive upload service
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
    return UploadManager.createError(validation.message);
  }

  try {
    LogManager.addEvent("file-upload", "debug", "Google Drive upload başlatılıyor", {
      context: {
        fileCount: files.length,
        files: files.map((p: FilePayload) => ({ name: p.name, hasBase64: !!p.base64 })),
      },
    });

    const { uploadedLinks, errors } = await UploadManager.uploadGoogleDrive(files);

    LogManager.addEvent(
      "file-upload",
      "info",
      `Google Drive upload tamamlandı: ${uploadedLinks.length} dosya yüklendi`
    );

    return UploadManager.formatResponse(uploadedLinks, errors, "Drive");
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Google Drive hatası";
    LogManager.addEvent("file-upload", "error", `Google Drive upload hatası: ${errorMsg}`);
    return UploadManager.createError(errorMsg, [], "Google Drive");
  }
}
