/**
 * Filesystem Tools - Trash Manager
 */

import { getTrashItems, restoreFromTrash, emptyTrash } from "../../utils/recycle-utils.js";
import { formatBytes } from "./shared/helpers.js";

export function trashList(projectRoot: string): { items: Array<{ path: string; deletedAt: string; size: string }>; total: number } {
  const items = listTrash(projectRoot);
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
  const items = listTrash(projectRoot);
  
  if (items.length === 0) {
    return { success: false, message: "Çöp kutusu boş" };
  }
  
  const targetIndex = index ?? 0; // Default: en son silinen
  if (targetIndex < 0 || targetIndex >= items.length) {
    return { success: false, message: `Geçersiz index. 0-${items.length - 1} arasında olmalı` };
  }
  
  const item = items[targetIndex];
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
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "hev_fs_restore",
    description: "Çöp kutusundan dosya geri yükle. Index verilmezse en son silinen geri yüklenir.",
    inputSchema: {
      type: "object" as const,
      properties: {
        index: {
          type: "integer",
          description: "Geri yüklenecek dosyanın index'i (fs_trash_list ile görüntüle)",
        },
      },
    },
  },
  {
    name: "hev_fs_trash_empty",
    description: "Çöp kutusunu boşalt",
    inputSchema: {
      type: "object" as const,
      properties: {
        older_than_days: {
          type: "integer",
          description: "Sadece belirtilen günden eski dosyaları sil",
        },
      },
    },
  },
  {
    name: "hev_fs_backup",
    description: "Dosyanın yedeğini al (timestamp ile .bak uzantılı)",
    inputSchema: {
      type: "object" as const,
      properties: {
