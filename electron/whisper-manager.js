import { join } from 'path';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

/**
 * Account ID'den klasör yolunu oluştur
 * @param {string} accountId - Account ID (örn: chatgpt_user_at_gmail_com)
 * @returns {string}
 */
function getAccountPath(accountId) {
  return join(process.cwd(), 'data', accountId);
}

/**
 * Whisper verilerini yükle (hesap bazlı)
 * @param {Object} event - IPC event
 * @param {Object} params - { accountId }
 * @returns {Promise<{ pending: Array, done: Array }>}
 */
export async function whisperLoad(event, { accountId }) {
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
  } catch (error) {
    return { pending: [], done: [] };
  }
}

/**
 * Whisper verilerini kaydet (hesap bazlı)
 * @param {Object} event - IPC event
 * @param {Object} params - { accountId, payload }
 * @returns {Promise<{ success: boolean }>}
 */
export async function whisperSave(event, { accountId, payload }) {
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
  } catch (error) {
    return { success: false, message: error.message };
  }
}
