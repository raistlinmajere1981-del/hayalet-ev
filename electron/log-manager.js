import { join } from 'path';
import { appendFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

export async function appendLog(event, payload) {
  try {
    const { sessionId, line } = payload || {};
    if (!sessionId || !line) {
      return { success: false, message: 'Eksik parametre' };
    }
    const baseDir = join(process.cwd(), 'logs');
    if (!existsSync(baseDir)) {
      await mkdir(baseDir, { recursive: true });
    }
    const logPath = join(baseDir, `${sessionId}.log`);
    await appendFile(logPath, line + '\n', 'utf-8');
    return { success: true };
  } catch (error) {
    console.error('append-log error:', error);
    return { success: false, message: error.message };
  }
}
