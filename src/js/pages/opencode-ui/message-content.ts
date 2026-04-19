import type { OpencodeUiSessionMessage } from "./types.js";
import { t } from "./i18n.js";

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

export function buildSessionSnapshotKey(messages: OpencodeUiSessionMessage[] | undefined): string {
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
      return `${t("message.reasoningTitle")}\n${text}`;
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
      return `${t("message.reasoningTitle")}\n${t("message.reasoningUnavailable")}`;
    }

    return t("message.reasoningTitle");
  }

  if (type === "step-start") {
    const snapshot = normalizeString(record["snapshot"]).trim();
    return snapshot !== ""
      ? `${t("message.stepStartTitle")}\n${t("message.stepSnapshotLabel", { snapshot: snapshot.slice(0, 12) })}`
      : t("message.stepStartTitle");
  }

  if (type === "step-finish") {
    const lines = [t("message.stepFinishTitle")];
    const reason = normalizeString(record["reason"]).trim();
    if (reason !== "") {
      lines.push(t("message.stepReasonLabel", { reason }));
    }

    const tokens =
      record["tokens"] != null &&
      typeof record["tokens"] === "object" &&
      !Array.isArray(record["tokens"])
        ? (record["tokens"] as Record<string, unknown>)
        : null;
    const total = Number(tokens?.["total"] ?? 0);
    if (Number.isFinite(total) && total > 0) {
      lines.push(t("message.stepTokensLabel", { count: String(total) }));
    }

    return lines.join("\n");
  }

  if (type === "patch") {
    const filesRaw = record["files"];
    if (!Array.isArray(filesRaw) || filesRaw.length === 0) {
      return t("message.patchTitle");
    }

    const files = filesRaw.map((item) => toCompactLabel(item)).filter((item) => item !== "");
    return files.length > 0
      ? `${t("message.patchTitle")}\n${t("message.patchFilesLabel")}\n- ${files.join("\n- ")}`
      : t("message.patchTitle");
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

export function extractLatestAssistantTextPart(payload: unknown): string {
  if (payload == null) {
    return "";
  }

  if (Array.isArray(payload)) {
    for (let index = payload.length - 1; index >= 0; index -= 1) {
      const candidate = extractLatestAssistantTextPart(payload[index]);
      if (candidate !== "") {
        return candidate;
      }
    }
    return "";
  }

  if (typeof payload !== "object") {
    return "";
  }

  const record = payload as Record<string, unknown>;
  const directParts: unknown[] = Array.isArray(record["parts"]) ? record["parts"] : [];
  for (let index = directParts.length - 1; index >= 0; index -= 1) {
    const part = directParts[index];
    if (part == null || typeof part !== "object" || Array.isArray(part)) {
      continue;
    }

    const partRecord = part as Record<string, unknown>;
    const type = normalizeString(partRecord["type"]);
    const partKind = normalizeString(partRecord["part_kind"]);
    if (type !== "text" && partKind !== "text") {
      continue;
    }

    const content = normalizeString(partRecord["text"]).trim();
    if (content !== "") {
      return content;
    }

    const fallbackContent = normalizeString(partRecord["content"]).trim();
    if (fallbackContent !== "") {
      return fallbackContent;
    }

    const deltaContent = normalizeString(partRecord["content_delta"]).trim();
    if (deltaContent !== "") {
      return deltaContent;
    }
  }

  const nestedInfo = record["info"];
  if (nestedInfo != null && typeof nestedInfo === "object" && !Array.isArray(nestedInfo)) {
    const nestedContent = normalizeString(
      (nestedInfo as Record<string, unknown>)["content"]
    ).trim();
    if (nestedContent !== "") {
      return nestedContent;
    }
  }

  return "";
}
