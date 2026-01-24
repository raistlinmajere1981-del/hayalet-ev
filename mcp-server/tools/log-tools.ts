/**
 * LogTools - Log okuma ve sorgulama araçları
 */

import { readdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { findLatestSession, readSessionLogs, filterLogs, readSessionInfo } from "../utils/log-utils.js";
import { logToolError } from "../utils/mcp-logger.js";
import type { ToolResult } from "../types/index.js";

/** Log read arguments */
interface LogReadArgs {
  type?: "all" | "console" | "error" | "structured";
  tail?: number;
  source?: string;
  level?: string;
  contains?: string;
  correlationId?: string;
  sessionId?: string;
}

/**
 * read_electron_logs handler
 * 
 * NOT: Default olarak "console" logları okur - artık tüm loglar (main + renderer) birleşik.
 * Structured loglar JSON analizi için hâlâ mevcut.
 */
export async function readElectronLogs(
  logDir: string, 
  args?: LogReadArgs
): Promise<ToolResult> {
  const { 
    type = "console",  // Default: console (birleşik log - main + renderer)
    tail = 50, 
    source, 
    level, 
    contains, 
    correlationId,
    sessionId: requestedSessionId,
  } = args || {};
  
  const sessionId = requestedSessionId || await findLatestSession(logDir);
  
  if (!sessionId) {
    return {
      content: [{ type: "text", text: "Log session bulunamadı. Uygulama hiç çalıştırılmamış olabilir." }],
      isError: true,
    };
  }
  
  // Error logs
  if (type === "error") {
    const content = await readSessionLogs(logDir, sessionId, "error");
    const filtered = filterLogs(content, { tail });
    return {
      content: [{ 
        type: "text", 
        text: `📕 Error Logs (Session: ${sessionId})\n\n${filtered.join("\n") || "Hata yok ✅"}`,
      }],
    };
  }
  
  // Structured logs (default - en detaylı log kaynağı)
  if (type === "structured") {
    const content = await readSessionLogs(logDir, sessionId, "structured");
    let lines = content.split("\n").filter(l => l.trim());
    
    // Filtreleme
    if (source) {
      lines = lines.filter(l => {
        try {
          const json = JSON.parse(l);
          return json.source?.toLowerCase().includes(source.toLowerCase());
        } catch { return false; }
      });
    }
    if (level) {
      lines = lines.filter(l => {
        try {
          const json = JSON.parse(l);
          return json.type === level;
        } catch { return false; }
      });
    }
    if (contains) {
      lines = lines.filter(l => l.toLowerCase().includes(contains.toLowerCase()));
    }
    if (correlationId) {
      lines = lines.filter(l => l.includes(correlationId));
    }
    
    // Son N satır
    lines = lines.slice(-tail);
    
    // Okunabilir format
    const formatted = lines.map(l => {
      try {
        const json = JSON.parse(l);
        const vis = json.visibility ? `[L${json.visibility}]` : '';
        return `[${json.timestamp}] ${vis} [${json.source}] ${json.message}`;
      } catch { return l; }
    });
    
    const filterInfo = [
      source && `source=${source}`,
      level && `level=${level}`,
      contains && `contains="${contains}"`,
      correlationId && `correlationId=${correlationId}`,
    ].filter(Boolean).join(", ");
    
    return {
      content: [{ 
        type: "text", 
        text: `📗 Structured Logs (Session: ${sessionId})${filterInfo ? `\nFiltre: ${filterInfo}` : ""}\n\n${formatted.join("\n") || "Log bulunamadı"}`,
      }],
    };
  }
  
  // Console logs (default - birleşik main + renderer)
  const content = await readSessionLogs(logDir, sessionId, "console");
  let lines = content.split("\n").filter(l => l.trim());
  
  // Filtreleme
  if (source) {
    lines = lines.filter(l => l.toLowerCase().includes(`[${source.toLowerCase()}]`));
  }
  if (level) {
    lines = lines.filter(l => l.toLowerCase().includes(`[${level.toLowerCase()}]`));
  }
  if (contains) {
    lines = lines.filter(l => l.toLowerCase().includes(contains.toLowerCase()));
  }
  if (correlationId) {
    lines = lines.filter(l => l.includes(correlationId));
  }
  
  // Son N satır
  lines = lines.slice(-tail);
  
  const filterInfo = [
    source && `source=${source}`,
    level && `level=${level}`,
    contains && `contains="${contains}"`,
    correlationId && `correlationId=${correlationId}`,
  ].filter(Boolean).join(", ");
  
  return {
    content: [{ 
      type: "text", 
      text: `📘 Birleşik Loglar (Session: ${sessionId})${filterInfo ? `\nFiltre: ${filterInfo}` : ""}\n\n${lines.join("\n") || "Log bulunamadı"}`,
    }],
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
  args?: { limit?: number }
): Promise<ToolResult> {
  const limit = args?.limit || 10;
  
  if (!existsSync(logDir)) {
    return {
      content: [{ type: "text", text: "Log dizini bulunamadı" }],
      isError: true,
    };
  }
  
  try {
    const entries = await readdir(logDir, { withFileTypes: true });
    const sessions: SessionListItem[] = entries
      .filter(e => e.isDirectory())
      .map(e => ({
        id: e.name,
        hasErrors: existsSync(join(logDir, e.name, "error.log")),
        hasSummary: existsSync(join(logDir, e.name, "summary.json")),
      }))
      .sort((a, b) => b.id.localeCompare(a.id))
      .slice(0, limit);
    
    const output = sessions.map(s => {
      const status = s.hasErrors ? "⚠️" : "✅";
      const state = s.hasSummary ? "tamamlandı" : "aktif/tamamlanmamış";
      return `${status} ${s.id} (${state})`;
    }).join("\n");
    
    return {
      content: [{ 
        type: "text", 
        text: `📂 Log Session'ları (son ${limit}):\n\n${output}`,
      }],
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
  args?: { sessionId?: string }
): Promise<ToolResult> {
  const sessionId = args?.sessionId || await findLatestSession(logDir);
  
  if (!sessionId) {
    return {
      content: [{ type: "text", text: "Session bulunamadı" }],
      isError: true,
    };
  }
  
  const { meta, summary } = await readSessionInfo(logDir, sessionId);
  
  if (!meta && !summary) {
    return {
      content: [{ type: "text", text: `❌ Session dosyaları okunamadı: ${sessionId}` }],
      isError: true,
    };
  }
  
  const output = `📊 Session Özeti: ${sessionId}

📅 Başlangıç: ${(meta?.startTime as string) || "unknown"}
📅 Bitiş: ${(summary?.endTime as string) || "active (devam ediyor)"}
🏁 Durum: ${(summary?.endReason as string) || "active"}

💻 Platform: ${(meta?.platform as string) || "unknown"}
📦 Electron: ${(meta?.electronVersion as string) || "unknown"}
🟢 Node: ${(meta?.nodeVersion as string) || "unknown"}

📈 İstatistikler:
- Toplam Log: ${(summary?.stats as Record<string, unknown>)?.totalLogs || "N/A"}
- Hatalar: ${(summary?.stats as Record<string, unknown>)?.errors || 0}
- Uyarılar: ${(summary?.stats as Record<string, unknown>)?.warnings || 0}
- Chunk Sayısı: ${(summary?.stats as Record<string, unknown>)?.chunks || 1}`;
  
  return {
    content: [{ type: "text", text: output }],
  };
}
