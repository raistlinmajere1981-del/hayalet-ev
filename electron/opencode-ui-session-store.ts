import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";

type JsonRecord = Record<string, unknown>;

export interface OpencodeUiStoreOptions {
  dbPath?: string;
  now?: () => number;
}

export interface OpencodeUiSessionSummary {
  id: string;
  title: string;
  workspace_path: string;
  updated_at: number;
  created_at: number;
  archived_at: number | null;
}

export interface OpencodeUiToolCall {
  name: string;
  args: string;
  result: string;
}

export interface OpencodeUiSessionMessage {
  role: "user" | "assistant";
  text: string;
  files: Array<{ name: string; media_type: string }>;
  toolCalls: OpencodeUiToolCall[];
}

export interface OpencodeUiTodoItem {
  content: string;
  status: string;
  priority: string;
}

export interface OpencodeUiSessionDetail {
  id: string;
  title: string;
  workspace_path: string;
  usage: Record<string, unknown>;
  messages: OpencodeUiSessionMessage[];
  todos: OpencodeUiTodoItem[];
  changed_files: string[];
}

export interface OpencodeUiListSessionsResult {
  success: boolean;
  sessions?: OpencodeUiSessionSummary[];
  error?: string;
}

export interface OpencodeUiEnsureSessionResult {
  success: boolean;
  created?: boolean;
  error?: string;
}

export interface OpencodeUiArchiveSessionResult {
  success: boolean;
  archived?: boolean;
  error?: string;
}

export interface OpencodeUiReadSessionResult {
  success: boolean;
  session?: OpencodeUiSessionDetail;
  error?: string;
}

interface SessionRow {
  id: string;
  title: string;
  directory: string;
  time_created: number;
  time_updated: number;
  time_archived?: number | null;
  project_id: string;
  version: string;
  workspace_id?: string | null;
}

interface MessageRow {
  id: string;
  data: string;
  time_created: number;
}

interface PartRow {
  message_id: string;
  data: string;
  time_created: number;
}

const DEFAULT_OPENCODE_DB_PATH = join(homedir(), ".local", "share", "opencode", "opencode.db");

function asRecord(value: unknown): JsonRecord | null {
  if (value !== null && value !== undefined && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonRecord;
  }
  return null;
}

function parseRecord(raw: string): JsonRecord | null {
  try {
    return asRecord(JSON.parse(raw));
  } catch {
    return null;
  }
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asNullableTimestamp(value: unknown): number | null {
  const normalized = asNumber(value, Number.NaN);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
}

function stringifyValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (value === undefined || value === null) {
    return "";
  }

  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
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
    return `Reasoning\n${text}`;
  }

  const metadata = asRecord(partData["metadata"]);
  const openai = asRecord(metadata?.["openai"]);
  if (asString(openai?.["reasoningEncryptedContent"]).trim() !== "") {
    return "Reasoning\nIcerik sifreli veya ozet bos.";
  }

  return "Reasoning";
}

function formatStepStartPart(partData: JsonRecord | null): string {
  if (partData === null) {
    return "";
  }

  const snapshot = asString(partData["snapshot"]).trim();
  if (snapshot === "") {
    return "Step start";
  }

  return `Step start\nSnapshot: ${snapshot.slice(0, 12)}`;
}

function formatStepFinishPart(partData: JsonRecord | null): string {
  if (partData === null) {
    return "";
  }

  const lines = ["Step finish"];
  const reason = asString(partData["reason"]).trim();
  if (reason !== "") {
    lines.push(`Reason: ${reason}`);
  }

  const tokens = asRecord(partData["tokens"]);
  const totalTokens = asNumber(tokens?.["total"]);
  if (totalTokens > 0) {
    lines.push(`Tokens: ${String(totalTokens)}`);
  }

  return lines.join("\n");
}

function formatPatchPart(partData: JsonRecord | null): string {
  if (partData === null) {
    return "";
  }

  const filesRaw = partData["files"];
  if (!Array.isArray(filesRaw) || filesRaw.length === 0) {
    return "Patch";
  }

  const files = filesRaw.map((item) => toCompactLabel(item)).filter((item) => item !== "");
  if (files.length === 0) {
    return "Patch";
  }

  return `Patch\nFiles:\n- ${files.join("\n- ")}`;
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

function extractLatestTodos(partRows: PartRow[]): OpencodeUiTodoItem[] {
  let todos: OpencodeUiTodoItem[] = [];

  for (const part of partRows) {
    const parsed = extractTodoPayload(parseRecord(part.data));
    if (parsed.matched) {
      todos = parsed.todos;
    }
  }

  return todos;
}

function extractChangedFiles(partRows: PartRow[]): string[] {
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

function normalizeSlug(sessionId: string, title: string): string {
  const fromTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .trim();

  if (fromTitle !== "") {
    return fromTitle.slice(0, 64);
  }

  const fromId = sessionId
    .toLowerCase()
    .replace(/^ses_/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .trim();

  return fromId === "" ? `session-${Date.now().toString(36)}` : fromId.slice(0, 64);
}

function resolveDbPath(options?: OpencodeUiStoreOptions): string {
  const candidate = options?.dbPath;
  if (typeof candidate === "string" && candidate.trim() !== "") {
    const trimmed = candidate.trim();
    if (trimmed === "~") {
      return homedir();
    }
    if (trimmed.startsWith("~/")) {
      return join(homedir(), trimmed.slice(2));
    }
    return trimmed;
  }
  return DEFAULT_OPENCODE_DB_PATH;
}

function sessionTableHasWorkspaceId(db: Database.Database): boolean {
  try {
    const rows = db.prepare("PRAGMA table_info(session)").all() as Array<{ name?: unknown }>;
    return rows.some((row) => asString(row.name) === "workspace_id");
  } catch {
    return false;
  }
}

function parseMessages(messageRows: MessageRow[], partRows: PartRow[]): OpencodeUiSessionMessage[] {
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
          asString(partData?.["name"], "attachment")
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

function aggregateUsage(messageRows: MessageRow[], partRows: PartRow[]): Record<string, unknown> {
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

export function listOpencodeUiSessions(
  options?: OpencodeUiStoreOptions
): OpencodeUiListSessionsResult {
  const dbPath = resolveDbPath(options);
  if (!existsSync(dbPath)) {
    return { success: false, error: `OpenCode session database not found: ${dbPath}` };
  }

  const db = new Database(dbPath);

  try {
    const rows = db
      .prepare(
        `SELECT id, title, directory, time_created, time_updated, time_archived, project_id, version, workspace_id
         FROM session
         ORDER BY time_updated DESC`
      )
      .all() as unknown as SessionRow[];

    const sessions: OpencodeUiSessionSummary[] = [];
    for (const row of rows) {
      if (typeof row.id !== "string" || row.id.trim() === "") {
        continue;
      }

      sessions.push({
        id: row.id,
        title: asString(row.title, "Untitled"),
        workspace_path: asString(row.directory),
        updated_at: asNumber(row.time_updated),
        created_at: asNumber(row.time_created),
        archived_at: asNullableTimestamp(row.time_archived),
      });
    }

    return { success: true, sessions };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  } finally {
    db.close();
  }
}

export function archiveOpencodeUiSession(
  sessionId: string,
  archived = true,
  options?: OpencodeUiStoreOptions
): OpencodeUiArchiveSessionResult {
  const normalizedSessionId = sessionId.trim();
  if (normalizedSessionId === "") {
    return { success: false, error: "Session ID is required" };
  }

  const dbPath = resolveDbPath(options);
  if (!existsSync(dbPath)) {
    return { success: false, error: `OpenCode session database not found: ${dbPath}` };
  }

  const db = new Database(dbPath);

  try {
    const now = options?.now?.() ?? Date.now();
    const result = db
      .prepare(
        `UPDATE session
         SET time_archived = ?, time_updated = ?
         WHERE id = ?`
      )
      .run(archived ? now : null, now, normalizedSessionId);

    if (Number(result.changes) < 1) {
      return { success: false, error: `Session not found: ${normalizedSessionId}` };
    }

    return { success: true, archived };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  } finally {
    db.close();
  }
}

export function ensureOpencodeUiSession(
  sessionId: string,
  title?: string,
  options?: OpencodeUiStoreOptions
): OpencodeUiEnsureSessionResult {
  const normalizedSessionId = sessionId.trim();
  if (normalizedSessionId === "") {
    return { success: false, error: "Session ID is required" };
  }

  const dbPath = resolveDbPath(options);
  if (!existsSync(dbPath)) {
    return { success: false, error: `OpenCode session database not found: ${dbPath}` };
  }

  const db = new Database(dbPath);

  try {
    const existing = db
      .prepare("SELECT id FROM session WHERE id = ? LIMIT 1")
      .get(normalizedSessionId);
    if (existing !== undefined) {
      return { success: true, created: false };
    }

    const seedSession = db
      .prepare(
        `SELECT project_id, directory, version, workspace_id
         FROM session
         ORDER BY time_updated DESC
         LIMIT 1`
      )
      .get() as
      | {
          project_id?: unknown;
          directory?: unknown;
          version?: unknown;
          workspace_id?: unknown;
        }
      | undefined;

    const fallbackProject = db
      .prepare(
        `SELECT id, worktree
         FROM project
         ORDER BY time_updated DESC
         LIMIT 1`
      )
      .get() as
      | {
          id?: unknown;
          worktree?: unknown;
        }
      | undefined;

    const projectId = asString(seedSession?.project_id, asString(fallbackProject?.id));
    if (projectId === "") {
      return { success: false, error: "OpenCode project information not found in session DB" };
    }

    const directory = asString(
      seedSession?.directory,
      asString(fallbackProject?.worktree, homedir())
    );
    const version = asString(seedSession?.version, "1.0.0");
    const normalizedTitle =
      typeof title === "string" && title.trim() !== "" ? title.trim() : "Untitled";
    const now = options?.now?.() ?? Date.now();
    const slug = normalizeSlug(normalizedSessionId, normalizedTitle);

    if (sessionTableHasWorkspaceId(db)) {
      const workspaceId = asString(seedSession?.workspace_id, "");

      db.prepare(
        `INSERT INTO session (
          id,
          project_id,
          slug,
          directory,
          title,
          version,
          time_created,
          time_updated,
          workspace_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        normalizedSessionId,
        projectId,
        slug,
        directory,
        normalizedTitle,
        version,
        now,
        now,
        workspaceId === "" ? null : workspaceId
      );
    } else {
      db.prepare(
        `INSERT INTO session (
          id,
          project_id,
          slug,
          directory,
          title,
          version,
          time_created,
          time_updated
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(normalizedSessionId, projectId, slug, directory, normalizedTitle, version, now, now);
    }

    return { success: true, created: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  } finally {
    db.close();
  }
}

export function readOpencodeUiSession(
  sessionId: string,
  options?: OpencodeUiStoreOptions
): OpencodeUiReadSessionResult {
  const normalizedSessionId = sessionId.trim();
  if (normalizedSessionId === "") {
    return { success: false, error: "Session ID is required" };
  }

  const dbPath = resolveDbPath(options);
  if (!existsSync(dbPath)) {
    return { success: false, error: `OpenCode session database not found: ${dbPath}` };
  }

  const db = new Database(dbPath);

  try {
    const sessionRow = db
      .prepare(
        `SELECT id, title, directory, time_created, time_updated, time_archived, project_id, version, workspace_id
         FROM session
         WHERE id = ?
         LIMIT 1`
      )
      .get(normalizedSessionId) as SessionRow | undefined;

    if (sessionRow === undefined) {
      return { success: false, error: `Session not found: ${normalizedSessionId}` };
    }

    const messageRows = db
      .prepare(
        `SELECT id, data, time_created
         FROM message
         WHERE session_id = ?
         ORDER BY time_created ASC, time_updated ASC`
      )
      .all(normalizedSessionId) as unknown as MessageRow[];

    const partRows = db
      .prepare(
        `SELECT message_id, data, time_created
         FROM part
         WHERE session_id = ?
         ORDER BY time_created ASC, time_updated ASC`
      )
      .all(normalizedSessionId) as unknown as PartRow[];

    const messages = parseMessages(messageRows, partRows);

    return {
      success: true,
      session: {
        id: sessionRow.id,
        title: asString(sessionRow.title, "Untitled"),
        workspace_path: asString(sessionRow.directory),
        usage: aggregateUsage(messageRows, partRows),
        messages,
        todos: extractLatestTodos(partRows),
        changed_files: extractChangedFiles(partRows),
      },
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  } finally {
    db.close();
  }
}
