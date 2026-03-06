export interface MessageItem {
  id: string;
  role: string;
  content?: string;
  text?: string;
  author?: string;
  createdAt?: number;
}

export interface AttachmentData {
  messageId: string;
  originalName?: string;
  storedName?: string;
  storedPath?: string;
}

export interface DbMessagesResult {
  data?: MessageItem[];
}

export interface DbAttachmentsResult {
  data?: AttachmentData[];
  success?: boolean;
}

export interface OpenPathResult {
  success?: boolean;
  message?: string;
}

export function isMessageItem(value: unknown): value is MessageItem {
  if (value === null || value === undefined || typeof value !== "object") {
    return false;
  }
  const maybe = value as Record<string, unknown>;
  return (
    typeof maybe["id"] === "string" &&
    typeof maybe["role"] === "string" &&
    (maybe["content"] === undefined || typeof maybe["content"] === "string") &&
    (maybe["text"] === undefined || typeof maybe["text"] === "string") &&
    (maybe["author"] === undefined || typeof maybe["author"] === "string") &&
    (maybe["createdAt"] === undefined || typeof maybe["createdAt"] === "number")
  );
}

export function isAttachmentData(value: unknown): value is AttachmentData {
  if (value === null || value === undefined || typeof value !== "object") {
    return false;
  }
  const maybe = value as Record<string, unknown>;
  return (
    typeof maybe["messageId"] === "string" &&
    (maybe["originalName"] === undefined || typeof maybe["originalName"] === "string") &&
    (maybe["storedName"] === undefined || typeof maybe["storedName"] === "string") &&
    (maybe["storedPath"] === undefined || typeof maybe["storedPath"] === "string")
  );
}

export function isDbMessagesResult(value: unknown): value is DbMessagesResult {
  if (value === null || value === undefined || typeof value !== "object") {
    return false;
  }
  const maybe = value as Record<string, unknown>;
  return maybe["data"] === undefined || Array.isArray(maybe["data"]);
}

export function isDbAttachmentsResult(value: unknown): value is DbAttachmentsResult {
  if (value === null || value === undefined || typeof value !== "object") {
    return false;
  }
  const maybe = value as Record<string, unknown>;
  const dataValid = maybe["data"] === undefined || Array.isArray(maybe["data"]);
  const successValid = maybe["success"] === undefined || typeof maybe["success"] === "boolean";
  return dataValid && successValid;
}

export function isOpenPathResult(value: unknown): value is OpenPathResult {
  if (value === null || value === undefined || typeof value !== "object") {
    return false;
  }
  const maybe = value as Record<string, unknown>;
  const successValid = maybe["success"] === undefined || typeof maybe["success"] === "boolean";
  const messageValid = maybe["message"] === undefined || typeof maybe["message"] === "string";
  return successValid && messageValid;
}
