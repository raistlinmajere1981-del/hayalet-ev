import { join } from 'path';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

export async function whisperLoad(event, provider) {
  try {
    const baseDir = join(process.cwd(), 'archives', provider || '');
    const filePath = join(baseDir, 'whisper.json');
    if (!existsSync(filePath)) {
      return { pending: [], done: [] };
    }
    const data = await readFile(filePath, 'utf-8');
    return JSON.parse(data || '{"pending":[],"done":[]}');
  } catch (error) {
    return { pending: [], done: [] };
  }
}

export async function whisperSave(event, provider, payload) {
  try {
    const baseDir = join(process.cwd(), 'archives', provider || '');
    const filePath = join(baseDir, 'whisper.json');
    if (!existsSync(baseDir)) {
      await mkdir(baseDir, { recursive: true });
    }
    await writeFile(filePath, JSON.stringify(payload || { pending: [], done: [] }, null, 2), 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
}
