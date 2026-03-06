import type { OpencodeUiSessionMessage } from "./types.js";

export function normalizeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function toCompactLabel(value: unknown): string {
  const raw = normalizeString(value).trim();
  if (raw === "") {
    return "";
  }

  const slashParts = raw.split("/");
  const lastSlash = slashParts[slashParts.length - 1] ?? raw;
  const backslashParts = lastSlash.split("\\");
  return (backslashParts[backslashParts.length - 1] ?? lastSlash).trim();
}

export function toWorkspaceRelativePath(filePath: unknown, workspacePath: string): string {
  const raw = normalizeString(filePath).trim();
  if (raw === "") {
    return "";
  }

  const workspace = normalizeString(workspacePath)
    .trim()
    .replace(/[\\/]+$/, "");
  if (workspace === "") {
    return raw;
  }

  if (raw === workspace) {
    return ".";
  }

  if (raw.startsWith(`${workspace}/`) || raw.startsWith(`${workspace}\\`)) {
    return raw.slice(workspace.length + 1);
  }

  return raw;
}

export function buildMessageSnapshotToken(message: OpencodeUiSessionMessage | undefined): string {
  if (message == null) {
    return "";
  }

  const text = normalizeString(message.text);
  const tail = text.slice(-160);
  const toolCalls = Array.isArray(message.toolCalls) ? message.toolCalls : [];
  const files = Array.isArray(message.files) ? message.files : [];
  const toolTail = toolCalls
    .slice(-2)
    .map((item) => normalizeString(item.name))
    .join(",");
  return `${message.role}:${String(text.length)}:${tail}:${String(toolCalls.length)}:${toolTail}:${String(files.length)}`;
}

export function buildSessionSnapshotKey(messages: OpencodeUiSessionMessage[]): string {
  if (!Array.isArray(messages) || messages.length === 0) {
    return "0";
  }

  const last = messages[messages.length - 1];
  const prev = messages.length > 1 ? messages[messages.length - 2] : undefined;
  return `${String(messages.length)}|${buildMessageSnapshotToken(prev)}|${buildMessageSnapshotToken(last)}`;
}

export function normalizeSessionId(payload: unknown): string {
  if (typeof payload === "string") {
    return payload;
  }

  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    return "";
  }

  const record = payload as Record<string, unknown>;
  const directId =
    record["id"] ?? record["sessionID"] ?? record["sessionId"] ?? record["session_id"];
  if (typeof directId === "string" && directId !== "") {
    return directId;
  }

  const nestedSession = record["session"];
  if (nestedSession != null && typeof nestedSession === "object" && !Array.isArray(nestedSession)) {
    const nestedId = (nestedSession as Record<string, unknown>)["id"];
    if (typeof nestedId === "string" && nestedId !== "") {
      return nestedId;
    }
  }

  return "";
}

export function extractTextFromPart(part: unknown): string {
  if (part == null || typeof part !== "object" || Array.isArray(part)) {
    return "";
  }

  const record = part as Record<string, unknown>;
  const type = normalizeString(record["type"]);
  const partKind = normalizeString(record["part_kind"]);

  if (type === "text" || partKind === "text") {
    const text = normalizeString(record["text"]);
    if (text !== "") {
      return text;
    }

    const content = normalizeString(record["content"]);
    if (content !== "") {
      return content;
    }

    return normalizeString(record["content_delta"]);
  }

  if (type === "reasoning") {
    const text = normalizeString(record["text"]).trim();
    if (text !== "") {
      return `Reasoning\n${text}`;
    }

    const metadata =
      record["metadata"] != null &&
      typeof record["metadata"] === "object" &&
      !Array.isArray(record["metadata"])
        ? (record["metadata"] as Record<string, unknown>)
        : null;
    const openai =
      metadata?.["openai"] != null &&
      typeof metadata["openai"] === "object" &&
      !Array.isArray(metadata["openai"])
        ? (metadata["openai"] as Record<string, unknown>)
        : null;
    if (normalizeString(openai?.["reasoningEncryptedContent"]).trim() !== "") {
      return "Reasoning\nIcerik sifreli veya ozet bos.";
    }

    return "Reasoning";
  }

  if (type === "step-start") {
    const snapshot = normalizeString(record["snapshot"]).trim();
    return snapshot !== "" ? `Step start\nSnapshot: ${snapshot.slice(0, 12)}` : "Step start";
  }

  if (type === "step-finish") {
    const lines = ["Step finish"];
    const reason = normalizeString(record["reason"]).trim();
    if (reason !== "") {
      lines.push(`Reason: ${reason}`);
    }

    const tokens =
      record["tokens"] != null &&
      typeof record["tokens"] === "object" &&
      !Array.isArray(record["tokens"])
        ? (record["tokens"] as Record<string, unknown>)
        : null;
    const total = Number(tokens?.["total"] ?? 0);
    if (Number.isFinite(total) && total > 0) {
      lines.push(`Tokens: ${String(total)}`);
    }

    return lines.join("\n");
  }

  if (type === "patch") {
    const filesRaw = record["files"];
    if (!Array.isArray(filesRaw) || filesRaw.length === 0) {
      return "Patch";
    }

    const files = filesRaw.map((item) => toCompactLabel(item)).filter((item) => item !== "");
    return files.length > 0 ? `Patch\nFiles:\n- ${files.join("\n- ")}` : "Patch";
  }

  return "";
}

export function extractAssistantText(payload: unknown): string {
  if (payload == null) {
    return "";
  }

  if (Array.isArray(payload)) {
    const text = payload.map((item) => extractAssistantText(item)).filter((item) => item !== "");
    return text.join("\n").trim();
  }

  if (typeof payload === "object") {
    const record = payload as Record<string, unknown>;

    const directParts = record["parts"];
    if (Array.isArray(directParts)) {
      const text = directParts
        .map((part) => extractTextFromPart(part))
        .filter((partText) => partText !== "");
      if (text.length > 0) {
        return text.join("\n").trim();
      }
    }

    const nestedInfo = record["info"];
    if (nestedInfo != null && typeof nestedInfo === "object" && !Array.isArray(nestedInfo)) {
      const nestedContent = (nestedInfo as Record<string, unknown>)["content"];
      if (typeof nestedContent === "string" && nestedContent.trim() !== "") {
        return nestedContent.trim();
      }
    }
  }

  return "";
}
