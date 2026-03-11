import { asNumber, asRecord, asString, parseRecord, stringifyValue } from "./shared.ts";
import { readElectronAppLanguageSync } from "../i18n/language-service.ts";
import { getBuiltInLanguagePack } from "../../shared/i18n/bundled-languages.ts";
import { translateCatalog } from "../../shared/i18n/catalog.ts";
import { DEFAULT_APP_LANGUAGE } from "../../src/types/i18n.ts";
import type {
  JsonRecord,
  MessageRow,
  OpencodeUiSessionMessage,
  OpencodeUiTodoItem,
  OpencodeUiToolCall,
  PartRow,
} from "./types.ts";

function opencodeUiParserT(key: string, params?: Record<string, string | number>): string {
  const locale = readElectronAppLanguageSync();
  const activeCatalog =
    getBuiltInLanguagePack(locale)?.catalog ??
    getBuiltInLanguagePack(DEFAULT_APP_LANGUAGE)?.catalog;
  const fallbackCatalog = getBuiltInLanguagePack(DEFAULT_APP_LANGUAGE)?.catalog;

  return translateCatalog(
    activeCatalog ?? fallbackCatalog ?? {},
    `opencodeUi.${key}`,
    params,
    fallbackCatalog
  );
}

function mergeText(current: string, next: string): string {
  if (next.trim() === "") {
    return current;
  }
  return current === "" ? next : `${current}\n${next}`;
}

function readTextPartContent(partData: JsonRecord | null): string {
  if (partData === null) {
    return "";
  }

  const directText = asString(partData["text"]).trim();
  if (directText !== "") {
    return directText;
  }

  const content = asString(partData["content"]).trim();
  if (content !== "") {
    return content;
  }

  return asString(partData["content_delta"]).trim();
}

function toCompactLabel(value: unknown): string {
  const raw = asString(value).trim();
  if (raw === "") {
    return "";
  }

  const slashParts = raw.split("/");
  const lastSlash = slashParts[slashParts.length - 1] ?? raw;
  const backslashParts = lastSlash.split("\\");
  return (backslashParts[backslashParts.length - 1] ?? lastSlash).trim();
}

function formatReasoningPart(partData: JsonRecord | null): string {
  if (partData === null) {
    return "";
  }

  const text = asString(partData["text"]).trim();
  if (text !== "") {
    return `${opencodeUiParserT("message.reasoningTitle")}\n${text}`;
  }

  const metadata = asRecord(partData["metadata"]);
  const openai = asRecord(metadata?.["openai"]);
  if (asString(openai?.["reasoningEncryptedContent"]).trim() !== "") {
    return `${opencodeUiParserT("message.reasoningTitle")}\n${opencodeUiParserT("message.reasoningUnavailable")}`;
  }

  return opencodeUiParserT("message.reasoningTitle");
}

function formatStepStartPart(partData: JsonRecord | null): string {
  if (partData === null) {
    return "";
  }

  const snapshot = asString(partData["snapshot"]).trim();
  if (snapshot === "") {
    return opencodeUiParserT("message.stepStartTitle");
  }

  return `${opencodeUiParserT("message.stepStartTitle")}\n${opencodeUiParserT(
    "message.stepSnapshotLabel",
    {
      snapshot: snapshot.slice(0, 12),
    }
  )}`;
}

function formatStepFinishPart(partData: JsonRecord | null): string {
  if (partData === null) {
    return "";
  }

  const lines = [opencodeUiParserT("message.stepFinishTitle")];
  const reason = asString(partData["reason"]).trim();
  if (reason !== "") {
    lines.push(opencodeUiParserT("message.stepReasonLabel", { reason }));
  }

  const tokens = asRecord(partData["tokens"]);
  const totalTokens = asNumber(tokens?.["total"]);
  if (totalTokens > 0) {
    lines.push(opencodeUiParserT("message.stepTokensLabel", { count: String(totalTokens) }));
  }

  return lines.join("\n");
}

function formatPatchPart(partData: JsonRecord | null): string {
  if (partData === null) {
    return "";
  }

  const filesRaw = partData["files"];
  if (!Array.isArray(filesRaw) || filesRaw.length === 0) {
    return opencodeUiParserT("message.patchTitle");
  }

  const files = filesRaw.map((item) => toCompactLabel(item)).filter((item) => item !== "");
  if (files.length === 0) {
    return opencodeUiParserT("message.patchTitle");
  }

  return `${opencodeUiParserT("message.patchTitle")}\n${opencodeUiParserT("message.patchFilesLabel")}\n- ${files.join("\n- ")}`;
}

function formatStructuredAssistantPart(partData: JsonRecord | null): string {
  const partType = asString(partData?.["type"]).trim();
  switch (partType) {
    case "reasoning":
      return formatReasoningPart(partData);
    case "step-start":
      return formatStepStartPart(partData);
    case "step-finish":
      return formatStepFinishPart(partData);
    case "patch":
      return formatPatchPart(partData);
    default:
      return "";
  }
}

function normalizeTodoItems(value: unknown): OpencodeUiTodoItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const record = asRecord(item);
      if (record === null) {
        return null;
      }

      const content = asString(record["content"]).trim();
      if (content === "") {
        return null;
      }

      const status = asString(record["status"], "pending").trim().toLowerCase();
      const priority = asString(record["priority"], "medium").trim().toLowerCase();
      return {
        content,
        status: status !== "" ? status : "pending",
        priority: priority !== "" ? priority : "medium",
      };
    })
    .filter((item): item is OpencodeUiTodoItem => item !== null);
}

function parseTodoSource(value: unknown): { found: boolean; todos: OpencodeUiTodoItem[] } {
  if (Array.isArray(value)) {
    return { found: true, todos: normalizeTodoItems(value) };
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") {
      return { found: false, todos: [] };
    }

    try {
      return parseTodoSource(JSON.parse(trimmed));
    } catch {
      return { found: false, todos: [] };
    }
  }

  const record = asRecord(value);
  if (record === null) {
    return { found: false, todos: [] };
  }

  if ("todos" in record) {
    return parseTodoSource(record["todos"]);
  }

  return { found: false, todos: [] };
}

function extractTodoPayload(partData: JsonRecord | null): {
  matched: boolean;
  todos: OpencodeUiTodoItem[];
} {
  const toolName = asString(partData?.["tool"], asString(partData?.["name"])).trim().toLowerCase();
  if (toolName !== "todowrite") {
    return { matched: false, todos: [] };
  }

  const state = asRecord(partData?.["state"]);
  const input = asRecord(state?.["input"]);
  const metadata = asRecord(state?.["metadata"]) ?? asRecord(partData?.["metadata"]);
  const candidates = [input?.["todos"], metadata?.["todos"], state?.["output"]];

  for (const candidate of candidates) {
    const parsed = parseTodoSource(candidate);
    if (parsed.found) {
      return { matched: true, todos: parsed.todos };
    }
  }

  return { matched: true, todos: [] };
}

export function extractLatestTodos(partRows: PartRow[]): OpencodeUiTodoItem[] {
  let todos: OpencodeUiTodoItem[] = [];

  for (const part of partRows) {
    const parsed = extractTodoPayload(parseRecord(part.data));
    if (parsed.matched) {
      todos = parsed.todos;
    }
  }

  return todos;
}

export function extractChangedFiles(partRows: PartRow[]): string[] {
  const seen = new Set<string>();
  const files: string[] = [];

  for (let index = partRows.length - 1; index >= 0; index -= 1) {
    const partData = parseRecord(partRows[index]?.data ?? "");
    if (asString(partData?.["type"]).trim() !== "patch") {
      continue;
    }

    const patchFiles = partData?.["files"];
    if (!Array.isArray(patchFiles)) {
      continue;
    }

    for (const file of patchFiles) {
      const normalized = asString(file).trim();
      if (normalized === "" || seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      files.push(normalized);
    }
  }

  return files;
}

export function parseMessages(
  messageRows: MessageRow[],
  partRows: PartRow[]
): OpencodeUiSessionMessage[] {
  const partsByMessage = new Map<string, PartRow[]>();
  for (const part of partRows) {
    const list = partsByMessage.get(part.message_id);
    if (list === undefined) {
      partsByMessage.set(part.message_id, [part]);
    } else {
      list.push(part);
    }
  }

  const messages: OpencodeUiSessionMessage[] = [];

  for (const row of messageRows) {
    const messageData = parseRecord(row.data);
    const role = asString(messageData?.["role"]).trim();
    if (role !== "user" && role !== "assistant") {
      continue;
    }

    const parts = partsByMessage.get(row.id) ?? [];
    let text = "";
    const files: Array<{ name: string; media_type: string }> = [];
    const toolCalls: OpencodeUiToolCall[] = [];

    for (const part of parts) {
      const partData = parseRecord(part.data);
      const partType = asString(partData?.["type"]).trim();
      const partKind = asString(partData?.["part_kind"]).trim();

      if (partType === "text" || partKind === "text") {
        text = mergeText(text, readTextPartContent(partData));
        continue;
      }

      if (role === "assistant") {
        const structuredText = formatStructuredAssistantPart(partData);
        if (structuredText !== "") {
          text = mergeText(text, structuredText);
          continue;
        }
      }

      if (partType === "file" && role === "user") {
        const fileName = asString(
          partData?.["filename"],
          asString(partData?.["name"], opencodeUiParserT("chat.attachmentFallbackName"))
        );
        const mediaType = asString(
          partData?.["mime"],
          asString(partData?.["media_type"], "application/octet-stream")
        );
        files.push({ name: fileName, media_type: mediaType });
        continue;
      }

      if (partType === "tool" && role === "assistant") {
        const state = asRecord(partData?.["state"]);
        const metadata = asRecord(state?.["metadata"]);
        const args = stringifyValue(state?.["input"]);
        const outputValue = state?.["output"] ?? metadata?.["output"];
        const result = stringifyValue(outputValue);

        toolCalls.push({
          name: asString(partData?.["tool"], asString(partData?.["name"], "unknown")),
          args,
          result,
        });
      }
    }

    if (role === "user") {
      if (text.trim() === "" && files.length === 0) {
        continue;
      }
      messages.push({ role: "user", text: text.trim(), files, toolCalls: [] });
      continue;
    }

    if (text.trim() === "" && toolCalls.length === 0) {
      continue;
    }

    messages.push({ role: "assistant", text: text.trim(), files: [], toolCalls });
  }

  return messages;
}

function readUsageTokens(value: JsonRecord | null): {
  input: number;
  output: number;
  reasoning: number;
} {
  if (value === null) {
    return { input: 0, output: 0, reasoning: 0 };
  }

  const inputCandidates = [
    asNumber(value["input"]),
    asNumber(value["prompt_tokens"]),
    asNumber(value["inputTokens"]),
    asNumber(value["promptTokens"]),
  ];
  const input = inputCandidates.find((tokenCount) => tokenCount > 0) ?? 0;

  const outputCandidates = [
    asNumber(value["output"]),
    asNumber(value["completion_tokens"]),
    asNumber(value["outputTokens"]),
    asNumber(value["completionTokens"]),
  ];
  const outputBase = outputCandidates.find((tokenCount) => tokenCount > 0) ?? 0;

  const reasoningCandidates = [asNumber(value["reasoning"]), asNumber(value["reasoning_tokens"])];
  const reasoning = reasoningCandidates.find((tokenCount) => tokenCount > 0) ?? 0;

  return {
    input,
    output: outputBase,
    reasoning,
  };
}

export function aggregateUsage(
  messageRows: MessageRow[],
  partRows: PartRow[]
): Record<string, unknown> {
  let messagePromptTokens = 0;
  let messageCompletionTokens = 0;
  let messageReasoningTokens = 0;

  for (const message of messageRows) {
    const messageData = parseRecord(message.data);
    if (messageData === null) {
      continue;
    }

    const role = asString(messageData["role"]).trim();
    if (role !== "assistant") {
      continue;
    }

    const fromTokens = readUsageTokens(asRecord(messageData["tokens"]));
    const fromUsage = readUsageTokens(asRecord(messageData["usage"]));

    messagePromptTokens += fromTokens.input > 0 ? fromTokens.input : fromUsage.input;
    messageCompletionTokens += fromTokens.output > 0 ? fromTokens.output : fromUsage.output;
    messageReasoningTokens += fromTokens.reasoning > 0 ? fromTokens.reasoning : fromUsage.reasoning;
  }

  if (messagePromptTokens > 0 || messageCompletionTokens > 0 || messageReasoningTokens > 0) {
    return {
      prompt_tokens: messagePromptTokens,
      completion_tokens: messageCompletionTokens,
      total_tokens: messagePromptTokens + messageCompletionTokens,
      reasoning_tokens: messageReasoningTokens,
    };
  }

  let promptTokens = 0;
  let completionTokens = 0;
  let reasoningTokens = 0;

  for (const part of partRows) {
    const partData = parseRecord(part.data);
    if (partData === null) {
      continue;
    }

    const metadata =
      asRecord(partData["metadata"]) ?? asRecord(asRecord(partData["state"])?.["metadata"]);
    if (metadata === null) {
      continue;
    }

    const usage = readUsageTokens(asRecord(metadata["usage"]));
    if (usage.input === 0 && usage.output === 0) {
      continue;
    }

    promptTokens += usage.input;
    completionTokens += usage.output;
    reasoningTokens += usage.reasoning;
  }

  if (promptTokens === 0 && completionTokens === 0 && reasoningTokens === 0) {
    return {};
  }

  return {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: promptTokens + completionTokens,
    reasoning_tokens: reasoningTokens,
  };
}
