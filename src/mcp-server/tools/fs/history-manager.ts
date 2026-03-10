/**
 * Filesystem Tools - History Manager
 */

import { createMcpTranslatorSync } from "../../utils/i18n/index.js";
import { undoLastOperation, getOperationHistory } from "../../utils/recycle-utils.js";

const historyToolDefinitionTranslator = createMcpTranslatorSync();

function historyToolDefinitionT(key: string): string {
  return historyToolDefinitionTranslator(`mcpServer.fs.toolDefinitions.${key}`);
}

export function backupFile(
  _projectRoot: string,
  _filePath: string
): { success: boolean; message: string; backupPath?: string } {
  return { success: false, message: historyToolDefinitionT("history.backupNotImplemented") };
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
  description: historyToolDefinitionT("historyBackup.description"),
  inputSchema: {
    type: "object" as const,
    properties: {
      file_path: { type: "string", description: historyToolDefinitionT("historyBackup.filePath") },
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
  description: historyToolDefinitionT("historyUndo.description"),
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
  description: historyToolDefinitionT("historyList.description"),
  inputSchema: {
    type: "object" as const,
    properties: {
      limit: {
        type: "integer",
        description: historyToolDefinitionT("historyList.limit"),
        default: 20,
      },
    },
  },
  metadata: {
    category: "filesystem",
    subcategory: "backup-history",
  },
};
