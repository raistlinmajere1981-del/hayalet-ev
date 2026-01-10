/**
 * Main Process Log Manager
 * 
 * Renderer LogManager'dan gelen structured logları dosyaya yazar.
 * Console-logger ile entegre çalışır.
 * Session bazlı dizin yapısı kullanır.
 */

import { join } from 'path';
import { appendFile, mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { getSessionId, getSessionDir, getLogDir, initLogSystem } from './console-logger.js';
import { matchErrorPattern } from './error-patterns.js';

/**
 * Renderer'dan gelen log girdisini dosyaya yaz
 * @param {Electron.IpcMainInvokeEvent} event
 * @param {object} payload - { sessionId, line, context }
 * @returns {Promise<{ success: boolean, message?: string, hint?: object }>}
 */
export async function appendLog(event, payload) {
  try {
    const { sessionId, line, context } = payload || {};
    
    if (!sessionId || !line) {
      return { success: false, message: 'Eksik parametre' };
    }
    
    // Session dizinini al veya oluştur
    let sessionDir = getSessionDir();
    const logDir = getLogDir() || join(process.cwd(), 'logs');
    
    // Eğer farklı bir session ID gelirse, o session için dizin oluştur
    if (sessionId !== getSessionId()) {
      sessionDir = join(logDir, sessionId);
    }
    
    if (!existsSync(sessionDir)) {
      await mkdir(sessionDir, { recursive: true });
    }
    
    const logPath = join(sessionDir, 'structured.jsonl');
    
    // JSON parse edip hint ekle
    let entry;
    try {
      entry = JSON.parse(line);
      
      // Error pattern matching - AI debugging için hint ekle
      if (entry.type === 'error' && entry.message) {
        const hint = matchErrorPattern(entry.message);
        if (hint) {
          entry.aiHint = hint;
        }
      }
      
      // Context bilgisini ekle
      if (context) {
        entry.context = { ...entry.context, ...context };
      }
      
    } catch {
      // JSON parse başarısız, raw olarak yaz
      entry = { raw: line, timestamp: new Date().toISOString() };
    }
    
    await appendFile(logPath, JSON.stringify(entry) + '\n', 'utf-8');
    
    return { 
      success: true,
      hint: entry.aiHint || null,
    };
  } catch (error) {
    // Silent failure - logging sistem çökerse uygulamayı etkilemez
    return { success: false, message: error.message };
  }
}

/**
 * Structured log entry yaz (direkt object olarak)
 * @param {object} entry - Log girdisi
 * @param {string} [targetSessionId] - Hedef session
 * @returns {Promise<{ success: boolean }>}
 */
export async function writeStructuredEntry(entry, targetSessionId = null) {
  try {
    const sessionId = targetSessionId || getSessionId();
    const logDir = getLogDir() || join(process.cwd(), 'logs');
    const sessionDir = join(logDir, sessionId);
    
    if (!existsSync(sessionDir)) {
      await mkdir(sessionDir, { recursive: true });
    }
    
    const logPath = join(sessionDir, 'structured.jsonl');
    
    const enrichedEntry = {
      ...entry,
      timestamp: entry.timestamp || new Date().toISOString(),
      sessionId,
    };
    
    // Error pattern matching
    if (enrichedEntry.type === 'error' && enrichedEntry.message) {
      const hint = matchErrorPattern(enrichedEntry.message);
      if (hint) {
        enrichedEntry.aiHint = hint;
      }
    }
    
    await appendFile(logPath, JSON.stringify(enrichedEntry) + '\n', 'utf-8');
    
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * Batch log yaz (performans için)
 * @param {object[]} entries - Log girdileri dizisi
 * @param {string} [targetSessionId] - Hedef session
 * @returns {Promise<{ success: boolean, written: number }>}
 */
export async function writeBatchLogs(entries, targetSessionId = null) {
  try {
    if (!Array.isArray(entries) || entries.length === 0) {
      return { success: true, written: 0 };
    }
    
    const sessionId = targetSessionId || getSessionId();
    const logDir = getLogDir() || join(process.cwd(), 'logs');
    const sessionDir = join(logDir, sessionId);
    
    if (!existsSync(sessionDir)) {
      await mkdir(sessionDir, { recursive: true });
    }
    
    const logPath = join(sessionDir, 'structured.jsonl');
    
    const lines = entries.map(entry => {
      const enrichedEntry = {
        ...entry,
        timestamp: entry.timestamp || new Date().toISOString(),
        sessionId,
      };
      
      // Error pattern matching
      if (enrichedEntry.type === 'error' && enrichedEntry.message) {
        const hint = matchErrorPattern(enrichedEntry.message);
        if (hint) {
          enrichedEntry.aiHint = hint;
        }
      }
      
      return JSON.stringify(enrichedEntry);
    });
    
    await appendFile(logPath, lines.join('\n') + '\n', 'utf-8');
    
    return { success: true, written: entries.length };
  } catch (error) {
    return { success: false, written: 0, message: error.message };
  }
}

/**
 * Event log - özel olay kaydı (milestone'lar için)
 * @param {string} eventType - Olay tipi
 * @param {string} message - Mesaj
 * @param {object} [data] - Ek veri
 */
export async function logEvent(eventType, message, data = null) {
  const entry = {
    type: 'event',
    eventType,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
  
  await writeStructuredEntry(entry);
}

/**
 * Metrik log - performans metrikleri için
 * @param {string} metricName - Metrik adı
 * @param {number} value - Değer
 * @param {string} [unit] - Birim
 * @param {object} [tags] - Etiketler
 */
export async function logMetric(metricName, value, unit = null, tags = null) {
  const entry = {
    type: 'metric',
    metric: metricName,
    value,
    unit,
    tags,
    timestamp: new Date().toISOString(),
  };
  
  await writeStructuredEntry(entry);
}
