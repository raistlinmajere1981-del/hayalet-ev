/**
 * Extract the extension from a file path.
 * @param {string} filePath - File path
 * @returns {string} Extension (lowercase, no dot)
 */
export function getExtension(filePath: string): string {
  if (filePath === "") return "";
  return filePath.split(".").pop()?.toLowerCase() ?? "";
}

/**
 * Extract the file name from a path.
 * @param {string} filePath - File path
 * @returns {string} File name
 */
export function getFilename(filePath: string): string {
  if (filePath === "") return "";
  return filePath.split(/[/\\]/).pop() ?? "";
}

/**
 * Resolve the MIME type from an extension.
 * @param {string} ext - Extension (png, jpg, etc.)
 * @returns {string} MIME type
 */
export function getMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    bmp: "image/bmp",
    ico: "image/x-icon",
    pdf: "application/pdf",
    txt: "text/plain",
    json: "application/json",
    js: "text/javascript",
    css: "text/css",
    html: "text/html",
    xml: "application/xml",
    zip: "application/zip",
    mp3: "audio/mpeg",
    mp4: "video/mp4",
    wav: "audio/wav",
  };
  return mimeTypes[ext.toLowerCase()] ?? "application/octet-stream";
}

/**
 * Resolve the MIME type from a file path.
 * @param {string} filePath - File path
 * @returns {string} MIME type
 */
export function getMimeTypeFromPath(filePath: string): string {
  const ext = getExtension(filePath);
  return getMimeType(ext);
}

/**
 * Generate a unique ID.
 * @param {string} prefix - ID prefix (for example: "cmd", "relay", "whisper")
 * @returns {string} Unique ID
 */
export function generateUniqueId(prefix = "id"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Convert an email address into a file/folder-safe representation.
 * @param {string} email - Email address
 * @returns {string} Sanitized email (for example: "user_at_gmail_com")
 */
export function sanitizeEmail(email: string): string {
  if (email === "") return "";
  return email.toLowerCase().trim().replace(/@/g, "_at_").replace(/\./g, "_");
}

/**
 * Build a deterministic account ID from email and provider.
 * The same email+provider pair always produces the same ID.
 * @param {string} email - User email address
 * @param {string} provider - AI provider (chatgpt, grok, gemini, opencode)
 * @returns {string} Account ID (for example: "chatgpt_user_at_gmail_com")
 */
export function generateAccountId(email: string, provider: string): string {
  if (email === "" || provider === "") return "";
  return `${provider}_${sanitizeEmail(email)}`;
}

/**
 * Decode a Base64 string into UTF-8 text.
 * @param {string} base64 - Base64 encoded string
 * @returns {string} Decoded UTF-8 text
 */
export function decodeBase64(base64: string): string {
  if (base64 === "") return "";
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const decoder = new TextDecoder("utf-8");
    return decoder.decode(bytes);
  } catch (_err) {
    return "";
  }
}
