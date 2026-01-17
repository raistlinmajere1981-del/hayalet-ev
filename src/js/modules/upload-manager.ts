/**
 * UploadManager - Centralized Upload Management
 *
 * Bu modül tüm dosya yükleme işlemlerini ve servis kontrollerini yönetir.
 * webview/methods/shared altındaki dağınık yapıyı replace eder.
 */

interface FilePayload {
  name: string;
  path?: string;
  base64?: string;
  mimeType?: string;
}

interface UploadError {
  file: string;
  error: string;
}

type ServiceName = "CATBOX" | "UGUU" | "TMPFILE" | "GOOGLEDRIVE";

const UPLOAD_SERVICES: Record<ServiceName, { ipcMethod: string; available: () => boolean }> = {
  CATBOX: {
    ipcMethod: "catboxUpload",
    available: () => !!window?.electronAPI?.catboxUpload,
  },
  UGUU: {
    ipcMethod: "uguuUpload",
    available: () => !!window?.electronAPI?.uguuUpload,
  },
  TMPFILE: {
    ipcMethod: "tmpfileUpload",
    available: () => !!window?.electronAPI?.tmpfileUpload,
  },
  GOOGLEDRIVE: {
    ipcMethod: "googledriveUpload",
    available: () => !!window?.electronAPI?.googledriveUpload,
  },
};

export const UploadManager = {
  /**
   * Servis kullanılabilir mi kontrol et
   */
  isServiceAvailable(serviceName: ServiceName): boolean {
    const service = UPLOAD_SERVICES[serviceName];
    if (!service) return false;
    try {
      return service.available();
    } catch {
      return false;
    }
  },

  /**
   * Dosyaları validate et
   */
  validateFiles(files: FilePayload[]): { valid: boolean; message?: string } {
    if (!files?.length) {
      return { valid: false, message: "Aktarılacak dosya bulunamadı" };
    }

    for (const file of files) {
      if (!file.name || !file.base64) {
        return {
          valid: false,
          message: `Geçersiz dosya: ${file.name || "isimsiz"}`,
        };
      }
    }

    return { valid: true };
  },

  /**
   * Çoklu dosya yükle
   */
  async uploadMultipleFiles(serviceName: ServiceName, files: FilePayload[]): Promise<{ uploadedLinks: string[]; uploadErrors: UploadError[] }> {
    const service = UPLOAD_SERVICES[serviceName];
    if (!service) {
      throw new Error(`Unknown service: ${serviceName}`);
    }

    const api = window?.electronAPI;
    const ipcMethod = api?.[service.ipcMethod as keyof typeof api] as ((options: unknown) => Promise<{ success?: boolean; url?: string; message?: string }>) | undefined;
    if (!ipcMethod) {
      throw new Error(`IPC method not available: ${service.ipcMethod}`);
    }

    const uploadedLinks = [];
    const uploadErrors = [];

    for (const file of files) {
      try {
        const result = await ipcMethod({
          name: file.name,
          mimeType: file.mimeType,
          base64: file.base64,
        });

        if (result?.success && result?.url) {
          uploadedLinks.push(result.url);
        } else {
          uploadErrors.push({
            file: file.name,
            error: result?.message || "Upload failed",
          });
        }
      } catch (err) {
        uploadErrors.push({
          file: file.name,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { uploadedLinks, uploadErrors };
  },

  /**
   * Google Drive Upload (Batch)
   */
  async uploadGoogleDrive(files: FilePayload[]): Promise<{ uploadedLinks: string[]; errors: UploadError[] }> {
    if (!this.isServiceAvailable("GOOGLEDRIVE")) {
      throw new Error("Google Drive IPC servisi mevcut değil");
    }

    const payloadFiles = files.map((f) => ({
      name: f.name,
      mimeType: f.mimeType,
      base64: f.base64,
    }));

    if (!window.electronAPI?.googledriveUpload) {
      throw new Error("electronAPI.googledriveUpload not available");
    }

    const result = await window.electronAPI.googledriveUpload({
      files: payloadFiles,
    });

    if (!result?.success) {
      throw new Error(result?.message || "Google Drive yükleme başarısız");
    }

    const uploaded =
      result.uploadedLinks || result.uploaded || (result.data && result.data.uploadedLinks) || [];

    return {
      uploadedLinks: Array.isArray(uploaded) ? uploaded : [],
      errors: result.errors || [],
    };
  },

  /**
   * Response formatla
   */
  formatResponse(uploadedLinks: string[], errors: UploadError[] = [], serviceName = "") {
    if (!uploadedLinks.length) {
      return {
        success: false,
        message: `${serviceName} yükleme başarısız: ${errors.join("; ")}`,
        errors,
        injected: false,
      };
    }

    return {
      success: true,
      message: `${uploadedLinks.length} dosya yüklendi ve linki hazır`,
      uploadedLinks,
      errors: errors.length ? errors : undefined,
      injected: false,
    };
  },

  /**
   * Hata response oluştur
   */
  createError(message: string, errors: UploadError[] = [], serviceName = "") {
    return {
      success: false,
      message: serviceName ? `${serviceName} hatası: ${message}` : message,
      errors,
      injected: false,
    };
  },
};
