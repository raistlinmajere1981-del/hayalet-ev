/**
 * File utility functions shared across all upload methods
 * Provider-agnostic and reusable
 */

/**
 * Convert base64 string to Uint8Array
 * Used across all file processing methods
 */
export function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Create File object from base64 data
 * @param {string} base64 - Base64 encoded file data
 * @param {string} name - File name
 * @param {string} mimeType - MIME type (optional)
 * @returns {File} File object
 */
export function createFileFromBase64(
  base64,
  name,
  mimeType = "application/octet-stream",
) {
  const bytes = base64ToUint8Array(base64);
  return new File([bytes], name, { type: mimeType });
}

/**
 * Create DataTransfer object with files
 * Used by file-injection and file-dragdrop methods
 * @param {Array} files - Array of file objects
 * @returns {DataTransfer} DataTransfer object
 */
export function createDataTransfer(files) {
  const dataTransfer = new DataTransfer();
  files.forEach((file) => {
    dataTransfer.items.add(file);
  });
  return dataTransfer;
}

/**
 * Validate files array
 * @param {Array} files - Files to validate
 * @returns {Object} Validation result
 */
export function validateFiles(files) {
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
}

/**
 * Format upload response consistently
 * @param {Array} uploadedLinks - Successfully uploaded files
 * @param {Array} errors - Error messages
 * @param {string} serviceName - Name of the upload service
 * @returns {Object} Formatted response
 */
export function formatUploadResponse(
  uploadedLinks,
  errors = [],
  serviceName = "",
) {
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
}

/**
 * Standardize error response
 * @param {string} message - Error message
 * @param {Array} errors - Additional errors (optional)
 * @param {string} serviceName - Service name (optional)
 * @returns {Object} Standardized error response
 */
export function createErrorResponse(message, errors = [], serviceName = "") {
  return {
    success: false,
    message: serviceName ? `${serviceName} hatası: ${message}` : message,
    errors,
    injected: false,
  };
}

/**
 * Extract URL from API response
 * Different services return different response formats
 * @param {any} data - API response data
 * @param {string} service - Service name for parsing logic
 * @returns {string|null} Extracted URL
 */
export function extractUrlFromResponse(data, service) {
  if (!data) return null;

  switch (service) {
    case "uguu":
      if (typeof data === "string") {
        try {
          const parsed = JSON.parse(data);
          if (parsed?.files?.length) {
            return parsed.files[0].url || parsed.files[0].link;
          }
        } catch (_) {
          // Not JSON, maybe plain URL
          if (data.startsWith("http")) return data;
        }
      } else if (data?.files?.length) {
        return data.files[0].url || data.files[0].link;
      } else if (data?.url) {
        return data.url;
      }
      break;

    case "catbox":
      if (typeof data === "string" && data.startsWith("http")) {
        return data;
      }
      break;

    case "tmpfile":
      if (data?.data?.url) {
        return data.data.url;
      }
      break;

    default:
      if (typeof data === "string" && data.startsWith("http")) {
        return data;
      } else if (data?.url) {
        return data.url;
      }
  }

  return null;
}
