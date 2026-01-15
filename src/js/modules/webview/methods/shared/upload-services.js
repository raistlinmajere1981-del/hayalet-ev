/**
 * Upload service utilities
 * Shared across file upload methods
 */

const UPLOAD_SERVICES = {
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

export function isServiceAvailable(serviceName) {
  const service = UPLOAD_SERVICES[serviceName];
  if (!service) return false;
  try {
    return service.available();
  } catch {
    return false;
  }
}

export async function uploadMultipleFiles(serviceName, files) {
  const service = UPLOAD_SERVICES[serviceName];
  if (!service) {
    throw new Error(`Unknown service: ${serviceName}`);
  }

  const ipcMethod = window?.electronAPI?.[service.ipcMethod];
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
}
