import { join } from 'path';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import type { IpcMainInvokeEvent } from 'electron';

interface WhisperData {
  pending: unknown[];
  done: unknown[];
}

/**
 * Account ID'den klasör yolunu oluştur
 */
function getAccountPath(accountId: string): string {
  return join(process.cwd(), 'data', accountId);
}

/**
 * Whisper verilerini yükle (hesap bazlı)
 */
export async function whisperLoad(
  _event: IpcMainInvokeEvent,
  { accountId }: { accountId: string }
): Promise<WhisperData> {
  try {
    if (!accountId) {
      return { pending: [], done: [] };
    }
    
    const baseDir = getAccountPath(accountId);
    const filePath = join(baseDir, 'whisper.json');
    
    if (!existsSync(filePath)) {
      return { pending: [], done: [] };
    }
    
    const data = await readFile(filePath, 'utf-8');
    return JSON.parse(data || '{"pending":[],"done":[]}');
  } catch (error: unknown) {
    return { pending: [], done: [] };
  }
}

/**
 * Whisper verilerini kaydet (hesap bazlı)
 */
export async function whisperSave(
  _event: IpcMainInvokeEvent,
  { accountId, payload }: { accountId: string; payload?: WhisperData }
): Promise<{ success: boolean; message?: string }> {
  try {
    if (!accountId) {
      return { success: false, message: 'Account ID gerekli' };
    }
    
    const baseDir = getAccountPath(accountId);
    const filePath = join(baseDir, 'whisper.json');
    
    if (!existsSync(baseDir)) {
      await mkdir(baseDir, { recursive: true });
    }
    
    await writeFile(filePath, JSON.stringify(payload || { pending: [], done: [] }, null, 2), 'utf-8');
    return { success: true };
  } catch (error: unknown) {
    return { success: false, message: (error as Error).message };
  }
}
