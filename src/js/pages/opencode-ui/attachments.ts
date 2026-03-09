import { escapeHtml } from "./chat-utils.js";
import { t } from "./i18n.js";
import type { ComposerAttachment } from "./types.js";

function sanitizeAttachmentName(name: string, fallback: string): string {
  const withoutReservedChars = name.trim().replace(/[<>:"/\\|?*]+/g, "_");
  const cleaned = Array.from(withoutReservedChars, (char) => {
    return char.charCodeAt(0) <= 0x1f ? "_" : char;
  }).join("");
  return cleaned !== "" ? cleaned : fallback;
}

export function extensionFromMime(mimeType: string): string {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "text/plain":
      return "txt";
    case "application/pdf":
      return "pdf";
    default:
      return "bin";
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function textToBase64(text: string): string {
  return bytesToBase64(new TextEncoder().encode(text));
}

export function buildDataUrl(mimeType: string, base64: string): string {
  const safeMimeType = mimeType.trim() !== "" ? mimeType : "application/octet-stream";
  return `data:${safeMimeType};base64,${base64}`;
}

export function formatAttachmentSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) {
    return "";
  }
  if (size < 1024) {
    return `${String(size)} B`;
  }
  if (size < 1024 * 1024) {
    return `${String(Math.max(1, Math.round(size / 1024)))} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function attachmentKindLabel(attachment: ComposerAttachment): string {
  if (attachment.mimeType.startsWith("image/")) {
    return "IMG";
  }
  if (attachment.mimeType.startsWith("text/")) {
    return "TXT";
  }
  if (attachment.mimeType === "application/pdf") {
    return "PDF";
  }
  return "FILE";
}

function createAttachmentId(): string {
  return `att_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function fileToComposerAttachment(
  file: File,
  source: ComposerAttachment["source"]
): Promise<ComposerAttachment> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const hasMimeType = file.type.trim() !== "";
  const mimeType = hasMimeType ? file.type : "application/octet-stream";
  const inferredExtension = hasMimeType ? extensionFromMime(file.type) : "bin";
  return {
    id: createAttachmentId(),
    name: sanitizeAttachmentName(file.name, `attachment.${inferredExtension}`),
    mimeType,
    base64: bytesToBase64(bytes),
    size: file.size,
    source,
  };
}

export function createClipboardTextAttachment(text: string): ComposerAttachment | null {
  const normalized = text.trim();
  if (normalized === "") {
    return null;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return {
    id: createAttachmentId(),
    name: `clipboard-${timestamp}.txt`,
    mimeType: "text/plain",
    base64: textToBase64(normalized),
    size: new TextEncoder().encode(normalized).length,
    source: "clipboard",
  };
}

export function dedupeComposerAttachments(
  current: ComposerAttachment[],
  incoming: ComposerAttachment[]
): ComposerAttachment[] {
  const seen = new Set(
    current.map(
      (attachment) => `${attachment.name}:${attachment.size}:${attachment.base64.slice(0, 32)}`
    )
  );
  const next = [...current];
  for (const attachment of incoming) {
    const key = `${attachment.name}:${attachment.size}:${attachment.base64.slice(0, 32)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    next.push(attachment);
  }
  return next;
}

export function buildOutgoingAttachmentPreview(
  attachments: ComposerAttachment[]
): Array<{ name: string; fileName: string }> {
  return attachments.map((attachment) => ({
    name: attachment.name,
    fileName: attachment.name,
  }));
}

export function renderAttachmentTrayHtml(attachments: ComposerAttachment[]): string {
  return attachments
    .map((attachment) => {
      const sizeText = formatAttachmentSize(attachment.size);
      const detail = [attachmentKindLabel(attachment), sizeText]
        .filter((item) => item !== "")
        .join(" • ");
      const sourceLabel =
        attachment.source === "clipboard"
          ? t("chat.attachmentSourceClipboard")
          : t("chat.attachmentSourceFile");
      return (
        '<div class="ds-attachment-chip" title="' +
        escapeHtml(`${attachment.name}\n${sourceLabel}`) +
        '">' +
        '<span class="ds-attachment-chip__meta">' +
        escapeHtml(detail) +
        "</span>" +
        '<span class="ds-attachment-chip__name">' +
        escapeHtml(attachment.name) +
        "</span>" +
        '<button type="button" class="ds-attachment-chip__remove" data-attachment-remove="' +
        escapeHtml(attachment.id) +
        '" aria-label="' +
        escapeHtml(t("chat.removeAttachmentAria", { name: attachment.name })) +
        '">×</button>' +
        "</div>"
      );
    })
    .join("");
}
