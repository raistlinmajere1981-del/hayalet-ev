import { LogCategory } from "@shared/logging-core";
import { UploadManager } from "../../../upload-manager.js";
import { Logger } from "../../../logger/index.js";

interface FilePayload {
  name: string;
  path?: string;
  base64?: string;
  mimeType?: string;
}

export async function attachFiles(
  _webview: HTMLElement,
  { files }: { files: FilePayload[] }
): Promise<{
  success: boolean;
  message: string;
  injected: boolean;
  uploadedLinks?: string[];
  errors?: { file: string; error: string }[];
}> {
  const validation = UploadManager.validateFiles(files);
  if (!validation.valid) {
    return UploadManager.createError(validation.message ?? "Validation failed");
  }

  try {
    const { uploadedLinks, errors } = await UploadManager.uploadGoogleDrive(files);

    return UploadManager.formatResponse(uploadedLinks, errors, "Drive");
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Google Drive hatası";
    Logger.error(LogCategory.WEBVIEW, "Google Drive upload failed", { error: errorMsg });
    return UploadManager.createError(errorMsg, [], "Google Drive");
  }
}
