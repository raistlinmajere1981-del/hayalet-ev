/**
 * Console Logger for Hayalet-ev
 * 
 * Tüm console output'larını (main + renderer process) dosyaya yazar.
 * AI'ların runtime hatalarını görmesini sağlar.
 */

import { appendFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { app } from 'electron';
import { existsSync } from 'fs';

const LOG_DIR = join(app.getPath('userData'), 'logs');
const CONSOLE_LOG = join(LOG_DIR, 'console.log');
const ERROR_LOG = join(LOG_DIR, 'error.log');

// Log dizinini oluştur
async function ensureLogDir() {
    if (!existsSync(LOG_DIR)) {
        await mkdir(LOG_DIR, { recursive: true });
    }
}

// Log mesajını formatla
function formatLog(level, args) {
    const timestamp = new Date().toISOString();
    const message = args.map(arg => {
        if (typeof arg === 'object') {
            try {
                return JSON.stringify(arg, null, 2);
            } catch {
                return String(arg);
            }
        }
        return String(arg);
    }).join(' ');
    
    return `[${timestamp}] [${level}] ${message}\n`;
}

// Dosyaya yaz
async function writeLog(file, level, args) {
    try {
        await ensureLogDir();
        const logMessage = formatLog(level, args);
        await appendFile(file, logMessage);
    } catch (err) {
        // Log yazma başarısız olursa sessizce geç
        // (sonsuz loop'tan kaçınmak için)
    }
}

// Main process console'unu intercept et
export function interceptMainConsole() {
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    const originalInfo = console.info;
    const originalDebug = console.debug;

    console.log = (...args) => {
        originalLog(...args);
        writeLog(CONSOLE_LOG, 'LOG', args);
    };

    console.warn = (...args) => {
        originalWarn(...args);
        writeLog(CONSOLE_LOG, 'WARN', args);
    };

    console.error = (...args) => {
        originalError(...args);
        writeLog(ERROR_LOG, 'ERROR', args);
    };

    console.info = (...args) => {
        originalInfo(...args);
        writeLog(CONSOLE_LOG, 'INFO', args);
    };

    console.debug = (...args) => {
        originalDebug(...args);
        writeLog(CONSOLE_LOG, 'DEBUG', args);
    };
}

// Renderer process loglarını dinle
export function setupRendererLogger(webContents) {
    // Console mesajlarını yakala
    webContents.on('console-message', (event, level, message, line, sourceId) => {
        const levelMap = {
            0: 'LOG',
            1: 'WARN',
            2: 'ERROR',
            3: 'DEBUG',
            4: 'INFO'
        };
        
        const levelName = levelMap[level] || 'LOG';
        const source = sourceId ? ` (${sourceId}:${line})` : '';
        const fullMessage = `[RENDERER] ${message}${source}`;
        
        const file = level === 2 ? ERROR_LOG : CONSOLE_LOG;
        writeLog(file, levelName, [fullMessage]);
    });

    // JavaScript hataları (uncaught exceptions)
    webContents.on('render-process-gone', (event, details) => {
        writeLog(ERROR_LOG, 'FATAL', [
            'Renderer process crashed:',
            details
        ]);
    });

    // Preload script hataları
    webContents.on('preload-error', (event, preloadPath, error) => {
        writeLog(ERROR_LOG, 'PRELOAD-ERROR', [
            `Preload script error: ${preloadPath}`,
            error.stack || error
        ]);
    });
}

// Log dosyalarını temizle (opsiyonel)
export async function clearLogs() {
    try {
        const { unlink } = await import('fs/promises');
        if (existsSync(CONSOLE_LOG)) await unlink(CONSOLE_LOG);
        if (existsSync(ERROR_LOG)) await unlink(ERROR_LOG);
    } catch (err) {
        console.error('Failed to clear logs:', err);
    }
}

// Log dosyalarını oku
export async function readConsoleLogs() {
    try {
        const { readFile } = await import('fs/promises');
        if (existsSync(CONSOLE_LOG)) {
            return await readFile(CONSOLE_LOG, 'utf-8');
        }
        return 'No console logs found';
    } catch (err) {
        return `Failed to read logs: ${err.message}`;
    }
}

export async function readErrorLogs() {
    try {
        const { readFile } = await import('fs/promises');
        if (existsSync(ERROR_LOG)) {
            return await readFile(ERROR_LOG, 'utf-8');
        }
        return 'No error logs found';
    } catch (err) {
        return `Failed to read error logs: ${err.message}`;
    }
}

export { CONSOLE_LOG, ERROR_LOG };
