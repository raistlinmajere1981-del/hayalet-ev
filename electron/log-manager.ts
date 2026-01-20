/**
 * Main Process Log Manager
 *
 * Renderer LogManager'dan gelen structured logları dosyaya yazar.
 * Console-logger ile entegre çalışır.
 * Session bazlı dizin yapısı kullanır.
 */

import { join } from 'path';
import { appendFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { getSessionId, getSessionDir, getLogDir } from './console-logger.js';
import { matchErrorPattern } from './error-patterns.js';
import type { IpcMainInvokeEvent } from 'electron';

interface LogPayload {
  sessionId?: string;
  line?: string;
  context?: Record<string, unknown>;
}

interface AppendLogResult {
  success: boolean;
  message?: string;
  hint?: object | null;
}

/**
 * Renderer'dan gelen log girdisini dosyaya yaz
 */
export async function appendLog(
  _event: IpcMainInvokeEvent,
  payload: LogPayload
): Promise<AppendLogResult> {
  try {
    const { sessionId, line, context } = payload || {};
    
    if (!sessionId || !line) {
      return { success: false, message: 'Eksik parametre' };
    }
    
    let sessionDir = getSessionDir();
    const logDir = getLogDir() || join(process.cwd(), 'logs');
    
    if (sessionId !== getSessionId()) {
      sessionDir = join(logDir, sessionId);
    }
    
    if (!sessionDir) {
      return { success: false, message: 'Session dizini bulunamadı' };
    }
    
    if (!existsSync(sessionDir)) {
      await mkdir(sessionDir, { recursive: true });
    }
    
    const structuredLogPath = join(sessionDir, 'structured.jsonl');
    const consoleLogPath = join(sessionDir, 'console-001.log');
    
    let entry;
    try {
      entry = JSON.parse(line);
      
      if (entry.type === 'error' && entry.message) {
        const hint = matchErrorPattern(entry.message);
        if (hint) {
          entry.aiHint = hint;
        }
      }
      
      if (context) {
        entry.context = { ...entry.context, ...context };
      }
      
    } catch {
      entry = { raw: line, timestamp: new Date().toISOString() };
    }
    
    // Structured log (JSONL - detaylı analiz için)
    await appendFile(structuredLogPath, JSON.stringify(entry) + '\n', 'utf-8');
    
    // Console log (okunabilir format - birleşik log)
    const visibility = entry.visibility ? `[L${entry.visibility}]` : '';
    const source = entry.source || 'unknown';
    const type = entry.type || 'info';
    const message = entry.message || entry.raw || '';
    const timestamp = entry.isoTimestamp || new Date().toISOString();
    
    let consoleLine = `[${timestamp}] [${type.toUpperCase()}] ${visibility} [RENDERER] [${source}] ${message}`;
    
    if (entry.meta && Object.keys(entry.meta).length > 0) {
      consoleLine += ` | meta: ${JSON.stringify(entry.meta)}`;
    }
    
    await appendFile(consoleLogPath, consoleLine + '\n', 'utf-8');
    
    return { 
      success: true,
      hint: entry.aiHint || null,
    };
  } catch (error) {
    return { success: false, message: (error as Error).message };
  }
}

