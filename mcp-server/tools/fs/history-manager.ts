/**
 * Filesystem Tools - History Manager
 */

import { backupToHistory, undoLastOperation, getOperationHistory } from "../../utils/recycle-utils.js";

export function backupFile(projectRoot: string, filePath: string): { success: boolean; message: string; backupPath?: string } {
  const result = createBackup(projectRoot, filePath);
  if (result.success) {
    return { success: true, message: `✅ Yedek oluşturuldu: ${result.backupPath}`, backupPath: result.backupPath };
  }
  return { success: false, message: result.error || "Yedekleme başarısız" };
}

export function undoOperation(projectRoot: string): { success: boolean; message: string } {
  const result = undoLastOperation(projectRoot);
  return { success: result.success, message: result.message };
}

export function operationHistory(projectRoot: string, limit: number = 20): { operations: Array<{ id: string; type: string; timestamp: string; canUndo: boolean }> } {
  const history = getOperationHistory(projectRoot, limit);
  return {
    operations: history.map(op => ({
      id: op.id,
      type: op.type,
      timestamp: op.timestamp,
      canUndo: op.canUndo,
    })),
  };
}

// Tool Definitions
          type: "string",
          description: "Yedeklenecek dosya yolu",
        },
      },
      required: ["file_path"],
    },
  },
  {
    name: "hev_fs_undo",
    description: "Son dosya işlemini geri al (delete, create, replace)",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "hev_fs_history",
    description: "Dosya işlem geçmişini göster",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "integer",
          description: "Gösterilecek işlem sayısı",
          default: 20,
        },
      },
    },
  },
  // === Diff Tools ===
  {
    name: "hev_fs_diff",
    description: "İki dosyayı karşılaştır (unified diff formatı)",
    inputSchema: {
      type: "object" as const,
