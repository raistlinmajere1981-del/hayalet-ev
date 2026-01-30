/**
 * File utility functions shared across all upload methods
 * Provider-agnostic and reusable
 */

/**
 * Validate files array
 * @param {Array} files - Files to validate
 * @returns {Object} Validation result
 */
interface FilePayload {
  name: string;
  base64?: string;
  path?: string;
  mimeType?: string;
}

interface UploadError {
  file: string;
  error: string;
}

export function validateFiles(files: FilePayload[]): { valid: boolean; message?: string } {
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function formatUploadResponse(
  uploadedLinks: string[],
  errors: UploadError[] = [],
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
export function createErrorResponse(message: string, errors: UploadError[] = [], serviceName = "") {
  return {
    success: false,
    message: serviceName ? `${serviceName} hatası: ${message}` : message,
    errors,
    injected: false,
  };
}

