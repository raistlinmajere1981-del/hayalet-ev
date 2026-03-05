/**
 * LogTools - Log okuma ve sorgulama araçları
 */

import { readFile, readdir } from "fs/promises";
import { basename, dirname, join } from "path";
import { existsSync } from "fs";
import {
  findLatestSession,
  readSessionLogs,
  filterLogs,
  readSessionInfo,
} from "../utils/log-utils.js";
import { logToolError } from "../utils/mcp-logger.js";
import type { ToolResult } from "@shared/index-mcp.js";

interface StructuredLine {
  source?: string;
  type?: string;
  level?: string;
  visibility?: string | number;
  timestamp?: string;
  message?: string;
}

function parseStructuredLine(line: string): StructuredLine | null {
  try {
    const parsed: unknown = JSON.parse(line);
    return typeof parsed === "object" && parsed !== null ? (parsed as StructuredLine) : null;
  } catch {
    return null;
  }
}

/** Log read arguments */
interface LogReadArgs {
  app?: "hayalet-ev" | "mcp-server" | "ghost-agent";
  type?: "all" | "console" | "error" | "structured";
  tail?: number;
  source?: string;
  level?: string;
  contains?: string;
  correlationId?: string;
  sessionId?: string;
}

function resolveAppLogDir(
  logDir: string,
  app: "hayalet-ev" | "mcp-server" | "ghost-agent" = "hayalet-ev"
): string {
  const baseLogsDir = basename(logDir) === "logs" ? logDir : dirname(logDir);
  return join(baseLogsDir, app);
}

/**
 * read_electron_logs handler
 *
 * NOT: Default olarak "console" logları okur - artık tüm loglar (main + renderer) birleşik.
 * Structured loglar JSON analizi için hâlâ mevcut.
 */
export async function readElectronLogs(logDir: string, args?: LogReadArgs): Promise<ToolResult> {
  const {
    app = "hayalet-ev",
    type = "console", // Default: console (birleşik log - main + renderer)
    tail = 50,
    source,
    level,
    contains,
    correlationId,
    sessionId: requestedSessionId,
  } = args ?? {};

  const targetLogDir = resolveAppLogDir(logDir, app);

  const sessionId = requestedSessionId ?? (await findLatestSession(targetLogDir));

  if (sessionId == null) {
    return {
      content: [
        { type: "text", text: "Log session bulunamadı. Uygulama hiç çalıştırılmamış olabilir." },
      ],
      isError: true,
    };
  }

  // Error logs
  if (type === "error") {
    const content = await readSessionLogs(targetLogDir, sessionId, "error");
    const filtered = filterLogs(content, { tail });
    return {
      content: [
        {
          type: "text",
          text: `📕 Error Logs (Session: ${sessionId})\n\n${filtered.length > 0 ? filtered.join("\n") : "Hata yok ✅"}`,
        },
      ],
    };
  }

  // Structured logs (default - en detaylı log kaynağı)
  if (type === "structured") {
    const content = await readSessionLogs(targetLogDir, sessionId, "structured");
    let lines = content.split("\n").filter((l) => l.trim() !== "");

    // Filtreleme
    if (source != null) {
      lines = lines.filter((l) => {
        const json = parseStructuredLine(l);
        return (
          typeof json?.source === "string" &&
          json.source.toLowerCase().includes(source.toLowerCase())
        );
      });
    }
    if (level != null) {
      lines = lines.filter((l) => {
        const json = parseStructuredLine(l);
        const entryLevel =
          typeof json?.level === "string"
            ? json.level
            : typeof json?.type === "string"
              ? json.type
              : "";
        return entryLevel.toLowerCase() === level.toLowerCase();
      });
    }
    if (contains != null) {
      lines = lines.filter((l) => l.toLowerCase().includes(contains.toLowerCase()));
    }
    if (correlationId != null) {
      lines = lines.filter((l) => l.includes(correlationId));
    }

    // Son N satır
    lines = lines.slice(-tail);

    // Okunabilir format
    const formatted = lines.map((l) => {
      const json = parseStructuredLine(l);
      if (!json) return l;
      const vis = json.visibility != null ? `[L${String(json.visibility)}]` : "";
      return `[${json.timestamp ?? ""}] ${vis} [${json.source ?? ""}] ${json.message ?? ""}`;
    });

    const filterInfo = [
      source != null && `source=${source}`,
      level != null && `level=${level}`,
      contains != null && `contains="${contains}"`,
      correlationId != null && `correlationId=${correlationId}`,
    ]
      .filter(Boolean)
      .join(", ");

    return {
      content: [
        {
          type: "text",
          text: `📗 Structured Logs (Session: ${sessionId})${filterInfo.length > 0 ? `\nFiltre: ${filterInfo}` : ""}\n\n${formatted.length > 0 ? formatted.join("\n") : "Log bulunamadı"}`,
        },
      ],
    };
  }

  // Console logs (default - birleşik main + renderer)
  const content = await readSessionLogs(targetLogDir, sessionId, "console");
  let lines = content.split("\n").filter((l) => l.trim() !== "");

  // Filtreleme
  if (source != null) {
    lines = lines.filter((l) => l.toLowerCase().includes(`[${source.toLowerCase()}]`));
  }
  if (level != null) {
    lines = lines.filter((l) => l.toLowerCase().includes(`[${level.toLowerCase()}]`));
  }
  if (contains != null) {
    lines = lines.filter((l) => l.toLowerCase().includes(contains.toLowerCase()));
  }
  if (correlationId != null) {
    lines = lines.filter((l) => l.includes(correlationId));
  }

  // Son N satır
  lines = lines.slice(-tail);

  const filterInfo = [
    source != null && `source=${source}`,
    level != null && `level=${level}`,
    contains != null && `contains="${contains}"`,
    correlationId != null && `correlationId=${correlationId}`,
  ]
    .filter(Boolean)
    .join(", ");

  return {
    content: [
      {
        type: "text",
        text: `📘 Birleşik Loglar (Session: ${sessionId})${filterInfo.length > 0 ? `\nFiltre: ${filterInfo}` : ""}\n\n${lines.length > 0 ? lines.join("\n") : "Log bulunamadı"}`,
      },
    ],
  };
}

/** Session list item */
interface SessionListItem {
  id: string;
  hasErrors: boolean;
  hasSummary: boolean;
}

/**
 * list_log_sessions handler
 */
export async function listLogSessions(
  logDir: string,
  args?: { app?: "hayalet-ev" | "mcp-server" | "ghost-agent"; limit?: number }
): Promise<ToolResult> {
  const app = args?.app ?? "hayalet-ev";
  const targetLogDir = resolveAppLogDir(logDir, app);
  const limit = args?.limit ?? 10;

  if (!existsSync(targetLogDir)) {
    return {
      content: [{ type: "text", text: "Log dizini bulunamadı" }],
      isError: true,
    };
  }

  try {
    const entries = await readdir(targetLogDir, { withFileTypes: true });
    const sessions: SessionListItem[] = entries
      .filter((e) => e.isDirectory())
      .map((e) => ({
        id: e.name,
        hasErrors: existsSync(join(targetLogDir, e.name, "error.log")),
        hasSummary: existsSync(join(targetLogDir, e.name, "summary.json")),
      }))
      .sort((a, b) => b.id.localeCompare(a.id))
      .slice(0, limit);

    const output = sessions
      .map((s) => {
        const status = s.hasErrors ? "⚠️" : "✅";
        const state = s.hasSummary ? "tamamlandı" : "aktif/tamamlanmamış";
        return `${status} ${s.id} (${state})`;
      })
      .join("\n");

    return {
      content: [
        {
          type: "text",
          text: `📂 Log Session'ları (${app}, son ${limit}):\n\n${output}`,
        },
      ],
    };
  } catch (err) {
    const error = err as Error;
    logToolError("hev_list_log_sessions", error, { limit });
    return {
      content: [{ type: "text", text: `❌ Session listesi okunamadı: ${error.message}` }],
      isError: true,
    };
  }
}

/**
 * get_session_summary handler
 */
export async function getSessionSummary(
  logDir: string,
  args?: { app?: "hayalet-ev" | "mcp-server" | "ghost-agent"; sessionId?: string }
): Promise<ToolResult> {
  const app = args?.app ?? "hayalet-ev";
  const targetLogDir = resolveAppLogDir(logDir, app);
  const sessionId = args?.sessionId ?? (await findLatestSession(targetLogDir));

  if (sessionId == null) {
    return {
      content: [{ type: "text", text: "Session bulunamadı" }],
      isError: true,
    };
  }

  const { meta, summary } = await readSessionInfo(targetLogDir, sessionId);

  let fallbackSummary: Record<string, unknown> | null = null;

  if (!meta && !summary) {
    const structuredPath = join(targetLogDir, sessionId, "structured.jsonl");

    if (!existsSync(structuredPath)) {
      return {
        content: [{ type: "text", text: `❌ Session dosyaları okunamadı: ${sessionId}` }],
        isError: true,
      };
    }

    try {
      const structured = await readFile(structuredPath, "utf-8");
      const entries = structured
        .split("\n")
        .map((line) => parseStructuredLine(line))
        .filter((line): line is StructuredLine => line !== null);

      const byLevel: Record<string, number> = {};
      let errorCount = 0;
      let warningCount = 0;

      entries.forEach((entry) => {
        const levelRaw =
          typeof entry.level === "string"
            ? entry.level
            : typeof entry.type === "string"
              ? entry.type
              : "unknown";
        const normalized = levelRaw.toLowerCase();
        byLevel[normalized] = (byLevel[normalized] ?? 0) + 1;
        if (normalized === "error") errorCount += 1;
        if (normalized === "warning" || normalized === "warn") warningCount += 1;
      });

      const firstEntry = entries[0];
      const lastEntry = entries.length > 0 ? entries[entries.length - 1] : undefined;

      const firstTs = typeof firstEntry?.timestamp === "string" ? firstEntry.timestamp : undefined;
      const lastTs = typeof lastEntry?.timestamp === "string" ? lastEntry.timestamp : undefined;

      const duration =
        firstTs !== undefined && lastTs !== undefined
          ? Math.max(0, new Date(lastTs).getTime() - new Date(firstTs).getTime())
          : undefined;

      fallbackSummary = {
        startTime: firstTs,
        endTime: lastTs,
        endReason: "from-structured",
        ...(duration !== undefined ? { duration } : {}),
        stats: {
          totalLogs: entries.length,
          errorCount,
          warningCount,
          byLevel,
        },
      };
    } catch {
      return {
        content: [{ type: "text", text: `❌ Session dosyaları okunamadı: ${sessionId}` }],
        isError: true,
      };
    }
  }

  const resolvedSummary = summary ?? fallbackSummary ?? {};

  const stats =
    (resolvedSummary["stats"] as
      | {
          totalLogs?: number;
          errorCount?: number;
          errors?: number;
          warningCount?: number;
          warnings?: number;
        }
      | undefined) ?? {};
  const startTime =
    (meta?.["startTime"] as string | undefined) ??
    (resolvedSummary["startTime"] as string | undefined) ??
    "unknown";
  const endTime = resolvedSummary["endTime"] as string | undefined;
  const endReason = resolvedSummary["endReason"] as string | undefined;
  const duration =
    typeof resolvedSummary["duration"] === "number"
      ? Math.round(resolvedSummary["duration"] / 1000)
      : undefined;
  const isActive = endTime == null;

  const output = `📊 Session Özeti: ${sessionId}

📅 Başlangıç: ${startTime}
📅 Bitiş: ${isActive ? "🟢 active (devam ediyor)" : endTime}
🏁 Durum: ${isActive ? "active" : (endReason ?? "completed")}
⏱️  Süre: ${duration != null ? `${duration}s` : isActive ? "devam ediyor" : "N/A"}

💻 Platform: ${(meta?.["platform"] as string | undefined) ?? "unknown"}
📦 Electron: ${(meta?.["electronVersion"] as string | undefined) ?? "unknown"}
🟢 Node: ${(meta?.["nodeVersion"] as string | undefined) ?? "unknown"}
🔢 PID: ${(meta?.["pid"] as number | undefined) ?? "unknown"}

📈 İstatistikler:
- Toplam Log: ${stats.totalLogs ?? "N/A"}
- Hatalar: ${stats.errorCount ?? stats.errors ?? 0}
- Uyarılar: ${stats.warningCount ?? stats.warnings ?? 0}`;

  return {
    content: [{ type: "text", text: output }],
  };
}
