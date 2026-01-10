/**
 * LogTools - Log okuma ve sorgulama araçları
 */

import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { findLatestSession, readSessionLogs, filterLogs, readSessionInfo } from "../utils/log-utils.js";

/**
 * read_electron_logs handler
 */
export async function readElectronLogs(logDir, args) {
  const { 
    type = "all", 
    tail = 50, 
    source, 
    level, 
    contains, 
    correlationId,
    sessionId: requestedSessionId,
  } = args || {};
  
  // Session bul
  const sessionId = requestedSessionId || await findLatestSession(logDir);
  
  if (!sessionId) {
    return {
      content: [
        {
          type: "text",
          text: "❌ Henüz log session'ı yok. Electron uygulamasını çalıştırdıktan sonra loglar burada görünecek.\n\nLog dizini: " + logDir,
        },
      ],
    };
  }
  
  let output = `📋 Session: ${sessionId}\n${"=".repeat(60)}\n\n`;
  
  // Console logs
  if (type === "console" || type === "all") {
    const consoleLogs = await readSessionLogs(logDir, sessionId, "console");
    const filtered = filterLogs(consoleLogs, { source, level, contains, correlationId, tail });
    output += `📝 Console Logs (son ${filtered.length} satır):\n${"-".repeat(40)}\n${filtered.join("\n")}\n\n`;
  }
  
  // Error logs
  if (type === "error" || type === "all") {
    const errorLogs = await readSessionLogs(logDir, sessionId, "error");
    const filtered = filterLogs(errorLogs, { source, level: level || "ERROR", contains, correlationId, tail });
    output += `❌ Error Logs (son ${filtered.length} satır):\n${"-".repeat(40)}\n${filtered.join("\n")}\n\n`;
  }
  
  // Structured logs
  if (type === "structured") {
    const structuredLogs = await readSessionLogs(logDir, sessionId, "structured");
    const lines = structuredLogs.split("\n").filter(l => l.trim()).slice(-tail);
    
    // JSON formatla
    const formatted = lines.map(l => {
      try {
        const obj = JSON.parse(l);
        return `[${obj.timestamp}] [${obj.source}] [${obj.type}] ${obj.message}${obj.correlationId ? ` [${obj.correlationId}]` : ""}`;
      } catch {
        return l;
      }
    });
    
    output += `📊 Structured Logs (son ${formatted.length} satır):\n${"-".repeat(40)}\n${formatted.join("\n")}\n`;
  }
  
  return {
    content: [{ type: "text", text: output }],
  };
}

/**
 * list_log_sessions handler
 */
export async function listLogSessions(logDir, args) {
  const { limit = 10 } = args || {};
  
  if (!existsSync(logDir)) {
    return {
      content: [
        {
          type: "text",
          text: "❌ Log dizini bulunamadı. Henüz hiç log oluşturulmamış.\n\nLog dizini: " + logDir,
        },
      ],
    };
  }
  
  const entries = await readdir(logDir, { withFileTypes: true });
  const sessions = [];
  
  for (const entry of entries.filter(e => e.isDirectory())) {
    const { meta, summary } = await readSessionInfo(logDir, entry.name);
    
    sessions.push({
      id: entry.name,
      startTime: meta?.startTime || "unknown",
      endTime: summary?.endTime || "active",
      endReason: summary?.endReason || "active",
      errors: summary?.stats?.errors || 0,
      warnings: summary?.stats?.warnings || 0,
    });
  }
  
  // Tarihe göre sırala
  sessions.sort((a, b) => {
    if (a.startTime === "unknown") return 1;
    if (b.startTime === "unknown") return -1;
    return new Date(b.startTime) - new Date(a.startTime);
  });
  
  const limited = sessions.slice(0, limit);
  
  const output = limited.map(s => {
    const status = s.endReason === "active" ? "🟢" : s.endReason === "normal" ? "✅" : "❌";
    return `${status} ${s.id}\n   Başlangıç: ${s.startTime}\n   Durum: ${s.endReason}\n   Hatalar: ${s.errors}, Uyarılar: ${s.warnings}`;
  }).join("\n\n");
  
  return {
    content: [
      {
        type: "text",
        text: `📁 Log Session'ları (${limited.length}/${sessions.length}):\n\n${output}`,
      },
    ],
  };
}

/**
 * get_session_summary handler
 */
export async function getSessionSummary(logDir, args) {
  const { sessionId: requestedSessionId } = args || {};
  const sessionId = requestedSessionId || await findLatestSession(logDir);
  
  if (!sessionId) {
    return {
      content: [{ type: "text", text: "❌ Session bulunamadı" }],
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

📅 Başlangıç: ${meta?.startTime || "unknown"}
📅 Bitiş: ${summary?.endTime || "active (devam ediyor)"}
🏁 Durum: ${summary?.endReason || "active"}

💻 Platform: ${meta?.platform || "unknown"}
📦 Electron: ${meta?.electronVersion || "unknown"}
🟢 Node: ${meta?.nodeVersion || "unknown"}

📈 İstatistikler:
- Toplam Log: ${summary?.stats?.totalLogs || "N/A"}
- Hatalar: ${summary?.stats?.errors || 0}
- Uyarılar: ${summary?.stats?.warnings || 0}
- Chunk Sayısı: ${summary?.stats?.chunks || 1}`;
  
  return {
    content: [{ type: "text", text: output }],
  };
}
