import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

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

export interface OpencodeUiSessionDetail {
  id: string;
  title: string;
  workspace_path: string;
  usage: Record<string, unknown>;
  messages: OpencodeUiSessionMessage[];
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

function sessionTableHasWorkspaceId(db: DatabaseSync): boolean {
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

      if (partType === "text") {
        text = mergeText(text, asString(partData?.["text"]));
        continue;
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

export function listOpencodeUiSessions(
  options?: OpencodeUiStoreOptions
): OpencodeUiListSessionsResult {
  const dbPath = resolveDbPath(options);
  if (!existsSync(dbPath)) {
    return { success: false, error: `OpenCode session database not found: ${dbPath}` };
  }

  const db = new DatabaseSync(dbPath);

  try {
    const rows = db
      .prepare(
        `SELECT id, title, directory, time_created, time_updated, project_id, version, workspace_id
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
      });
    }

    return { success: true, sessions };
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

  const db = new DatabaseSync(dbPath);

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

  const db = new DatabaseSync(dbPath);

  try {
    const sessionRow = db
      .prepare(
        `SELECT id, title, directory, time_created, time_updated, project_id, version, workspace_id
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
        usage: {},
        messages,
      },
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  } finally {
    db.close();
  }
}
