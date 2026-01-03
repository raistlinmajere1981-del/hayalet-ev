/**
 * Generic upload service functions
 * Provider-agnostic upload implementations for different services
 */

import { extractUrlFromResponse } from "./file-utils.js";

/**
 * Upload service configurations
 */
export const UPLOAD_SERVICES = {
  UGUU: {
    url: "https://uguu.se/upload.php",
    method: "POST",
    field: "files[]",
    timeout: 30000,
  },
  CATBOX: {
    url: "https://catbox.moe/user/api.php",
    method: "POST",
    field: "fileToUpload",
    extraFields: { reqtype: "fileupload" },
    timeout: 30000,
  },
  TMPFILE: {
    url: "https://tmpfiles.org/api/v1/upload",
    method: "POST",
    field: "file",
    timeout: 30000,
  },
  GOOGLEDRIVE: {
    ipc: "googledriveUpload",
    isIPC: true,
  },
};

/**
 * Upload single file to specified service using HTTP
 * @param {string} serviceName - Service name from UPLOAD_SERVICES
 * @param {Object} file - File object with base64, name, mimeType
 * @returns {Promise<string>} Upload URL
 */
export async function uploadViaHTTP(serviceName, file) {
  const service = UPLOAD_SERVICES[serviceName];
  if (!service || !service.url) {
    throw new Error(`Unknown HTTP service: ${serviceName}`);
  }

  const base64Data = file.base64;
  if (!base64Data) {
    throw new Error("Base64 veri bulunamadı");
  }

  // Convert base64 to binary
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const blob = new Blob([bytes], {
    type: file.mimeType || "application/octet-stream",
  });
  const formData = new FormData();
  formData.append(service.field, blob, file.name);

  // Add extra fields if configured
  if (service.extraFields) {
    Object.entries(service.extraFields).forEach(([key, value]) => {
      formData.append(key, value);
    });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), service.timeout);

  try {
    const response = await fetch(service.url, {
      method: service.method,
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    let data;
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    const url = extractUrlFromResponse(data, serviceName.toLowerCase());
    if (!url) {
      throw new Error("API yanıtında geçerli URL bulunamadı");
    }

    return url;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Upload file using IPC (main process)
 * @param {string} ipcMethod - IPC method name
 * @param {Object} file - File object
 * @returns {Promise<string>} Upload URL
 */
export async function uploadViaIPC(ipcMethod, file) {
  if (!window?.electronAPI?.[ipcMethod]) {
    throw new Error(`${ipcMethod} IPC method'u bulunamadı`);
  }

  try {
    const result = await window.electronAPI[ipcMethod]({
      name: file.name,
      mimeType: file.mimeType || "application/octet-stream",
      base64: file.base64,
    });

    if (!result?.success) {
      throw new Error(result?.message || `IPC ${ipcMethod} failed`);
    }

    const url = extractUrlFromResponse(result.data, ipcMethod);
    if (!url) {
      throw new Error("IPC yanıtında geçerli URL bulunamadı");
    }

    return url;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    throw new Error(`IPC ${ipcMethod} hatası: ${errorMsg}`);
  }
}

/**
 * Upload single file to specified service
 * @param {string} serviceName - Service name
 * @param {Object} file - File object
 * @returns {Promise<string>} Upload URL
 */
export async function uploadToService(serviceName, file) {
  const service = UPLOAD_SERVICES[serviceName];
  if (!service) {
    throw new Error(`Unknown service: ${serviceName}`);
  }

  if (service.isIPC) {
    return await uploadViaIPC(service.ipc, file);
  } else {
    return await uploadViaHTTP(serviceName, file);
  }
}

/**
 * Upload multiple files to specified service
 * @param {string} serviceName - Service name
 * @param {Array} files - Array of file objects
 * @returns {Promise<Object>} Upload result with links and errors
 */
export async function uploadMultipleFiles(serviceName, files) {
  const uploadedLinks = [];
  const uploadErrors = [];

  for (const file of files) {
    try {
      console.log(`[${serviceName}] ${file.name} yükleniyor...`);
      const url = await uploadToService(serviceName, file);
      if (url) {
        uploadedLinks.push({
          name: file.name,
          url,
          size: file.size || 0,
        });
        console.log(`[${serviceName}] ${file.name} başarılı:`, url);
      } else {
        uploadErrors.push(`${file.name}: upload başarısız (URL yok)`);
      }
    } catch (err) {
      console.error(`[${serviceName}] ${file.name} hata:`, err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      uploadErrors.push(`${file.name}: ${errorMsg}`);
    }
  }

  return {
    uploadedLinks,
    uploadErrors,
  };
}

/**
 * Check if IPC service is available
 * @param {string} serviceName - Service name
 * @returns {boolean} Whether service is available
 */
export function isServiceAvailable(serviceName) {
  const service = UPLOAD_SERVICES[serviceName];
  if (!service) return false;

  if (service.isIPC) {
    return !!window?.electronAPI?.[service.ipc];
  }

  return true; // HTTP services are always available
}
