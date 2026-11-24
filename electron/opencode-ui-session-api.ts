import type {
  OpencodeUiSessionSummary,
  OpencodeUiSessionDetail,
  OpencodeUiSessionMessage,
  OpencodeUiTodoItem,
} from "./opencode-ui-session/types.ts";

export type SessionApi = (method: string, path: string, body?: unknown) => Promise<unknown>;
function record(v: unknown): Record<string, unknown> {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return {};
  return v as Record<string, unknown>;
}
function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}
export function data(v: unknown): unknown {
  return record(v)["data"];
}
async function pages(api: SessionApi, path: string): Promise<unknown[]> {
  const items: unknown[] = [];
  const seen = new Set<string>();
  let cursor = "";
  for (;;) {
    const sep = path.includes("?") ? "&" : "?";
    const response = record(
      // Pagination is sequential: the next cursor is only known after this page.
      // eslint-disable-next-line no-await-in-loop
      await api(
        "GET",
        path + sep + "limit=100" + (cursor !== "" ? "&cursor=" + encodeURIComponent(cursor) : "")
      )
    );
    const batch = response["data"];
    if (!Array.isArray(batch)) throw new Error("Invalid OpenCode session response");
    items.push(...(batch as unknown[]));
    cursor = str(record(response["cursor"])["next"]);
    if (cursor === "" || batch.length === 0) break;
    if (seen.has(cursor)) throw new Error("Repeated OpenCode pagination cursor");
    seen.add(cursor);
  }
  return items;
}
function summary(value: unknown): OpencodeUiSessionSummary {
  const v = record(value),
    time = record(v["time"]);
  const id = str(v["id"]);
  if (id === "") throw new Error("Invalid OpenCode session ID");
  const title = str(v["title"]);
  const archived = num(time["archived"]);
  return {
    id,
    title: title !== "" ? title : "Untitled",
    workspace_path: str(record(v["location"])["directory"]),
    updated_at: num(time["updated"]),
    created_at: num(time["created"]),
    archived_at: archived === 0 ? null : archived,
  };
}
export async function listApiSessions(api: SessionApi): Promise<OpencodeUiSessionSummary[]> {
  const items = await pages(api, "/api/session?parentID=null");
  return items.map(summary).sort((a, b) => b.updated_at - a.updated_at);
}
function message(value: unknown): OpencodeUiSessionMessage | null {
  const v = record(value),
    type = v["type"];
  if (type !== "user" && type !== "assistant") return null;
  const m: OpencodeUiSessionMessage = {
    role: type,
    text: str(v["text"]),
    files: [],
    notices: [],
    blocks: [],
    toolCalls: [],
  };
  if (type === "user") {
    for (const f of Array.isArray(v["files"]) ? v["files"] : []) {
      const r = record(f),
        mime = str(r["mime"]),
        bytes = str(r["data"]),
        name = str(r["name"]);
      m.files.push({
        name: name !== "" ? name : "Attachment",
        media_type: mime,
        ...(bytes !== "" ? { base64: bytes } : {}),
        source: "history",
      });
    }
    return m;
  }
  for (const c of Array.isArray(v["content"]) ? v["content"] : []) {
    const p = record(c),
      text = str(p["text"]);
    if (p["type"] === "text") {
      m.text += (m.text !== "" ? "\n" : "") + text;
      m.blocks.push({ kind: "markdown", text });
    }
    if (p["type"] === "reasoning") m.blocks.push({ kind: "reasoning", text });
    if (p["type"] === "tool") {
      const s = record(p["state"]),
        status = str(s["type"] ?? s["status"]);
      m.toolCalls.push({
        name: str(p["name"]),
        args: JSON.stringify(s["input"] ?? s["args"] ?? {}),
        result: Array.isArray(s["content"])
          ? s["content"]
              .map((item) => {
                const text = str(record(item)["text"]);
                return text !== "" ? text : JSON.stringify(item);
              })
              .join("\n")
          : JSON.stringify(s["error"] ?? ""),
        status: status === "completed" ? "done" : status === "error" ? "error" : "running",
      });
    }
  }
  if (v["error"] != null) {
    const detail = str(record(v["error"])["message"]);
    m.notices.push({
      tone: "error",
      title: "OpenCode",
      detail: detail !== "" ? detail : "Provider request failed",
    });
  }
  return m;
}
export async function readApiSession(
  api: SessionApi,
  id: string
): Promise<OpencodeUiSessionDetail> {
  const path = "/api/session/" + encodeURIComponent(id);
  const raw = record(data(await api("GET", path)));
  const s = summary(raw);
  // API pages are newest-first by default. Order by message creation before rendering.
  const rows = await pages(api, path + "/message");
  rows.sort(
    (a, b) => num(record(record(a)["time"])["created"]) - num(record(record(b)["time"])["created"])
  );
  const tokens = record(raw["tokens"]);
  const files = new Set<string>();
  let todos: OpencodeUiTodoItem[] = [];
  for (const row of rows) {
    const message = record(row);
    const list = record(message["snapshot"])["files"];
    if (Array.isArray(list)) for (const f of list) if (typeof f === "string") files.add(f);
    for (const item of Array.isArray(message["content"]) ? message["content"] : []) {
      const part = record(item),
        state = record(part["state"]);
      if (part["name"] !== "todowrite" || state["status"] !== "completed") continue;
      const input = record(state["input"])["todos"];
      if (Array.isArray(input))
        todos = input
          .map((todo) => {
            const t = record(todo);
            return {
              content: str(t["content"]),
              status: str(t["status"]),
              priority: str(t["priority"]),
            };
          })
          .filter((todo) => todo.content !== "");
    }
  }
  return {
    id: s.id,
    title: s.title,
    workspace_path: s.workspace_path,
    usage: {
      prompt_tokens: num(tokens["input"]),
      completion_tokens: num(tokens["output"]),
      reasoning_tokens: num(tokens["reasoning"]),
    },
    messages: rows.map(message).filter((v): v is OpencodeUiSessionMessage => v !== null),
    todos,
    changed_files: [...files],
  };
}
export async function archiveApiSession(
  api: SessionApi,
  id: string,
  archived: boolean
): Promise<void> {
  await api("PATCH", "/api/session/" + encodeURIComponent(id), { archived });
}
