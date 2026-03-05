/**
 * Filesystem Tools - History Manager
 */

import { undoLastOperation, getOperationHistory } from "../../utils/recycle-utils.js";

export function backupFile(
  _projectRoot: string,
  _filePath: string
): { success: boolean; message: string; backupPath?: string } {
  // Stub implementation - createBackup not implemented yet
  return { success: false, message: "Not implemented" };
}

export function undoOperation(projectRoot: string): { success: boolean; message: string } {
  const result = undoLastOperation(projectRoot);
  return { success: result.success, message: result.message };
}

export function operationHistory(
  projectRoot: string,
  limit: number = 20
): { operations: Array<{ id: string; type: string; timestamp: string; canUndo: boolean }> } {
  const history = getOperationHistory(projectRoot, limit);
  return {
    operations: history.map((op) => ({
      id: op.id,
      type: op.type,
      timestamp: op.timestamp,
      canUndo: op.canUndo,
    })),
  };
}

// Tool Definitions
export const BACKUP_FILE_TOOL = {
  name: "hev_fs_backup",
  description: "Dosyanın yedeğini al",
  inputSchema: {
    type: "object" as const,
    properties: {
      file_path: { type: "string", description: "Yedeklenecek dosya" },
    },
    required: ["file_path"],
  },
  metadata: {
    category: "filesystem",
    subcategory: "backup-history",
  },
};

export const UNDO_OPERATION_TOOL = {
  name: "hev_fs_undo",
  description: "Son işlemi geri al",
  inputSchema: {
    type: "object" as const,
    properties: {},
  },
  metadata: {
    category: "filesystem",
    subcategory: "backup-history",
  },
};

export const OPERATION_HISTORY_TOOL = {
  name: "hev_fs_history",
  description: "İşlem geçmişini göster",
  inputSchema: {
    type: "object" as const,
    properties: {
      limit: { type: "integer", description: "Gösterilecek kayıt", default: 20 },
    },
  },
  metadata: {
    category: "filesystem",
    subcategory: "backup-history",
  },
};
