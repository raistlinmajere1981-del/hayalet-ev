/**
 * Filesystem Tools - Trash Manager
 */

import { restoreFromTrash, emptyTrash } from "../../utils/recycle-utils.js";
import { formatBytes } from "./shared/helpers.js";

export function trashList(projectRoot: string): { items: Array<{ path: string; deletedAt: string; size: string }>; total: number } {
  // Stub implementation - listTrash not implemented yet
  const items: any[] = [];
  return {
    items: items.map(item => ({
      path: item.originalPath,
      deletedAt: item.deletedAt,
      size: item.isDirectory ? "DIR" : formatBytes(item.size),
    })),
    total: items.length,
  };
}

export function restoreFile(projectRoot: string, index?: number): { success: boolean; message: string } {
  const items: any[] = [];
  
  if (items.length === 0) {
    return { success: false, message: "Çöp kutusu boş" };
  }
  
  const targetIndex = index ?? 0; // Default: en son silinen
  if (targetIndex < 0 || targetIndex >= items.length) {
    return { success: false, message: `Geçersiz index. 0-${items.length - 1} arasında olmalı` };
  }
  
  const item = items[targetIndex];
  if (!item) {
    return { success: false, message: "Item bulunamadı" };
  }
  const result = restoreFromTrash(projectRoot, item.trashPath);
  
  if (result.success) {
    return { success: true, message: `✅ Geri yüklendi: ${result.restoredTo}` };
  }
  return { success: false, message: result.error || "Bilinmeyen hata" };
}

export function trashEmpty(projectRoot: string, olderThanDays?: number): { success: boolean; message: string } {
  const result = emptyTrash(projectRoot, olderThanDays);
  const freedStr = formatBytes(result.freedBytes);
  
  if (olderThanDays) {
    return { success: true, message: `🗑️ ${result.deleted} dosya silindi (${olderThanDays} günden eski), ${freedStr} boşaltıldı` };
  }
  return { success: true, message: `🗑️ Çöp kutusu boşaltıldı: ${result.deleted} dosya, ${freedStr}` };
}

// Tool Definitions
export const TRASH_LIST_TOOL = {
  name: "hev_fs_trash_list",
  description: "Çöp kutusundaki dosyaları listele",
  inputSchema: {
    type: "object" as const,
    properties: {}
  }
};

export const RESTORE_FILE_TOOL = {
  name: "hev_fs_restore",
  description: "Çöp kutusundan geri yükle",
  inputSchema: {
    type: "object" as const,
    properties: {
      index: { type: "integer", description: "Geri yüklenecek dosyanın indexi" }
    }
  }
};

export const TRASH_EMPTY_TOOL = {
  name: "hev_fs_trash_empty",
  description: "Çöp kutusunu boşalt",
  inputSchema: {
    type: "object" as const,
    properties: {
      older_than_days: { type: "integer", description: "Belirtilen günden eski dosyaları sil" }
    }
  }
};
