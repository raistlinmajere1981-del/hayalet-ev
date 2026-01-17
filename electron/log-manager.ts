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
    
    if (!existsSync(sessionDir)) {
      await mkdir(sessionDir, { recursive: true });
    }
    
    const logPath = join(sessionDir, 'structured.jsonl');
    
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
    
    await appendFile(logPath, JSON.stringify(entry) + '\n', 'utf-8');
    
    return { 
      success: true,
      hint: entry.aiHint || null,
    };
  } catch (error) {
    return { success: false, message: (error as Error).message };
  }
}

