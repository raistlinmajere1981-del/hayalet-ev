/**
 * LogUtils - MCP Server log yardımcı fonksiyonları
 */

import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

/**
 * En son session'ı bul
 * @param {string} logDir - Log dizini
 * @returns {Promise<string|null>}
 */
export async function findLatestSession(logDir) {
  try {
    if (!existsSync(logDir)) return null;
    
    const entries = await readdir(logDir, { withFileTypes: true });
    const sessions = entries
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .sort()
      .reverse();
    
    return sessions[0] || null;
  } catch {
    return null;
  }
}

/**
 * Session loglarını oku
 * @param {string} logDir - Log dizini
 * @param {string} sessionId - Session ID
 * @param {string} type - console, error, structured
 * @returns {Promise<string>}
 */
export async function readSessionLogs(logDir, sessionId, type = "console") {
  const sessionDir = join(logDir, sessionId);
  
  if (!existsSync(sessionDir)) {
    return `Session bulunamadı: ${sessionId}`;
  }
  
  try {
    if (type === "error") {
      const errorPath = join(sessionDir, "error.log");
      if (existsSync(errorPath)) {
        return await readFile(errorPath, "utf-8");
      }
      return "Error log dosyası bulunamadı";
    }
    
    if (type === "structured") {
      const structuredPath = join(sessionDir, "structured.jsonl");
      if (existsSync(structuredPath)) {
        return await readFile(structuredPath, "utf-8");
      }
      return "Structured log dosyası bulunamadı";
    }
    
    // Console logs (multiple chunks)
    const files = await readdir(sessionDir);
    const consoleFiles = files
      .filter(f => f.startsWith("console-") && f.endsWith(".log"))
      .sort();
    
    let content = "";
    for (const file of consoleFiles) {
      content += await readFile(join(sessionDir, file), "utf-8");
    }
    
    return content || "Console log dosyası bulunamadı";
  } catch (err) {
    return `Log okuma hatası: ${err.message}`;
  }
}

/**
 * Logları filtrele
 * @param {string} content - Log içeriği
 * @param {object} filters - Filtre parametreleri
 * @returns {string[]}
 */
export function filterLogs(content, filters = {}) {
  const { source, level, contains, correlationId, tail = 50 } = filters;
  
  let lines = content.split("\n").filter(l => l.trim());
  
  if (source) {
    const sourcePattern = source.replace(/\*/g, ".*");
    const sourceRegex = new RegExp(`\\[${sourcePattern}\\]`, "i");
    lines = lines.filter(l => sourceRegex.test(l));
  }
  
  if (level) {
    lines = lines.filter(l => l.includes(`[${level}]`));
  }
  
  if (contains) {
    const containsLower = contains.toLowerCase();
    lines = lines.filter(l => l.toLowerCase().includes(containsLower));
  }
  
  if (correlationId) {
    lines = lines.filter(l => l.includes(correlationId));
  }
  
  return lines.slice(-tail);
}

/**
 * Session meta ve summary bilgilerini oku
 * @param {string} logDir - Log dizini
 * @param {string} sessionId - Session ID
 * @returns {Promise<{meta: object|null, summary: object|null}>}
 */
export async function readSessionInfo(logDir, sessionId) {
  const sessionDir = join(logDir, sessionId);
  const metaPath = join(sessionDir, "meta.json");
  const summaryPath = join(sessionDir, "summary.json");
  
  let meta = null;
  let summary = null;
  
  try {
    if (existsSync(metaPath)) {
      meta = JSON.parse(await readFile(metaPath, "utf-8"));
    }
    if (existsSync(summaryPath)) {
      summary = JSON.parse(await readFile(summaryPath, "utf-8"));
    }
  } catch {
    // Parse error
  }
  
  return { meta, summary };
}
