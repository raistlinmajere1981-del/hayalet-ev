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
    available: () => !!window.electronAPI?.catboxUpload,
  },
  UGUU: {
    ipcMethod: "uguuUpload",
    available: () => !!window.electronAPI?.uguuUpload,
  },
  TMPFILE: {
    ipcMethod: "tmpfileUpload",
    available: () => !!window.electronAPI?.["tmpfileUpload"],
  },
  GOOGLEDRIVE: {
    ipcMethod: "googledriveUpload",
    available: () => !!window.electronAPI?.googledriveUpload,
  },
};

type UploadResponse = {
  success: boolean;
  message: string;
  uploadedLinks?: string[];
  errors?: UploadError[];
  injected: boolean;
};

const uploadManager = {
  isServiceAvailable(serviceName: ServiceName): boolean {
    const service = UPLOAD_SERVICES[serviceName];
    try {
      return service.available();
    } catch {
      return false;
    }
  },

  validateFiles(files: FilePayload[]): { valid: boolean; message?: string } {
    if (files.length === 0) {
      return { valid: false, message: "Aktarılacak dosya bulunamadı" };
    }

    for (const file of files) {
      if (file.name === "" || file.base64 === undefined || file.base64 === "") {
        return {
          valid: false,
          message: `Geçersiz dosya: ${file.name !== "" ? file.name : "isimsiz"}`,
        };
      }
    }

    return { valid: true };
  },

  async uploadMultipleFiles(
    serviceName: ServiceName,
    files: FilePayload[]
  ): Promise<{ uploadedLinks: string[]; uploadErrors: UploadError[] }> {
    const service = UPLOAD_SERVICES[serviceName];

    const api = window.electronAPI;
    const ipcMethod = api?.[service.ipcMethod as keyof typeof api] as
      | ((options: unknown) => Promise<{ success?: boolean; url?: string; message?: string }>)
      | undefined;
    if (!ipcMethod) {
      throw new Error(`IPC method not available: ${service.ipcMethod}`);
    }

    const uploadResults = await Promise.all(
      files.map(async (file) => {
        try {
          const result = await ipcMethod({
            name: file.name,
            mimeType: file.mimeType,
            base64: file.base64,
          });

          if (result.success === true && result.url !== undefined && result.url !== "") {
            return { link: result.url };
          } else {
            return {
              error: {
                file: file.name,
                error: result.message ?? "Upload failed",
              },
            };
          }
        } catch (err) {
          return {
            error: {
              file: file.name,
              error: err instanceof Error ? err.message : String(err),
            },
          };
        }
      })
    );

    const uploadedLinks = uploadResults
      .map((result) => result.link)
      .filter((link): link is string => typeof link === "string" && link !== "");
    const uploadErrors = uploadResults
      .map((result) => result.error)
      .filter((error): error is UploadError => error !== undefined);

    return { uploadedLinks, uploadErrors };
  },

  async uploadGoogleDrive(
    files: FilePayload[]
  ): Promise<{ uploadedLinks: string[]; errors: UploadError[] }> {
    if (!this.isServiceAvailable("GOOGLEDRIVE")) {
      throw new Error("Google Drive IPC servisi mevcut değil");
    }

    const payloadFiles = files.map((f) => ({
      name: f.name,
      mimeType: f.mimeType,
      base64: f.base64,
    }));

    const googledriveUpload = window.electronAPI?.googledriveUpload;
    if (googledriveUpload === undefined) {
      throw new Error("Google Drive IPC servisi mevcut değil");
    }

    const resultRaw: unknown = await googledriveUpload({
      files: payloadFiles,
    });
    const result = resultRaw as {
      success?: boolean;
      message?: string;
      uploadedLinks?: string[];
      uploaded?: string[];
      data?: { uploadedLinks?: string[] };
      errors?: string[];
    };

    if (result.success !== true) {
      throw new Error(result.message ?? "Google Drive yükleme başarısız");
    }

    const uploaded = result.uploadedLinks ?? result.uploaded ?? result.data?.uploadedLinks ?? [];

    const rawErrors = result.errors ?? [];
    const mappedErrors: UploadError[] = Array.isArray(rawErrors)
      ? rawErrors.map((e: string) => ({ file: "", error: e }))
      : [];

    return {
      uploadedLinks: Array.isArray(uploaded) ? uploaded : [],
      errors: mappedErrors,
    };
  },

  formatResponse(
    uploadedLinks: string[],
    errors: UploadError[] = [],
    serviceName = ""
  ): UploadResponse {
    if (uploadedLinks.length === 0) {
      const errorSummary = errors
        .map((err) =>
          err.error !== "" ? `${err.file !== "" ? `${err.file}: ` : ""}${err.error}` : ""
        )
        .filter((entry) => entry !== "")
        .join("; ");
      return {
        success: false,
        message: `${serviceName} yükleme başarısız: ${errorSummary !== "" ? errorSummary : "bilinmeyen hata"}`,
        errors,
        injected: false,
      };
    }

    return {
      success: true,
      message: `${uploadedLinks.length} dosya yüklendi ve linki hazır`,
      uploadedLinks,
      ...(errors.length > 0 ? { errors } : {}),
      injected: false,
    };
  },

  createError(message: string, errors: UploadError[] = [], serviceName = ""): UploadResponse {
    return {
      success: false,
      message: serviceName !== "" ? `${serviceName} hatası: ${message}` : message,
      errors,
      injected: false,
    };
  },
};

export { uploadManager, uploadManager as UploadManager };
