/**
 * Filesystem Tools - Trash Manager
 */

import { restoreFromTrash, emptyTrash } from "../../utils/recycle-utils.js";
import { createMcpTranslator, createMcpTranslatorSync } from "../../utils/i18n/index.js";
import { formatBytes } from "./shared/helpers.js";
import type { TranslationParams } from "../../../types/i18n.js";

type McpTranslator = (key: string, params?: TranslationParams) => string;

function trashT(t: McpTranslator, key: string, params?: TranslationParams): string {
  return t(`mcpServer.fs.trash.${key}`, params);
}

const trashToolDefinitionTranslator = createMcpTranslatorSync();

function trashToolDefinitionT(key: string, params?: TranslationParams): string {
  return trashToolDefinitionTranslator(`mcpServer.fs.toolDefinitions.${key}`, params);
}

export function trashList(_projectRoot: string): {
  items: Array<{ path: string; deletedAt: string; size: string }>;
  total: number;
} {
  // Stub implementation. listTrash is not implemented yet.
  const items: Array<{ path: string; mtime: number; metadata?: Record<string, unknown> }> = [];
  return {
    items: items.map((item) => ({
      path: (item.metadata?.["originalPath"] as string | undefined) ?? item.path,
      deletedAt: new Date(item.mtime).toISOString(),
      size: (item.metadata?.["isDirectory"] as boolean)
        ? "DIR"
        : formatBytes(
            ((item.metadata?.["size"] as number | undefined) ?? 0) !== 0
              ? (item.metadata?.["size"] as number)
              : 0
          ),
    })),
    total: items.length,
  };
}

export async function restoreFile(
  projectRoot: string,
  index?: number
): Promise<{ success: boolean; message: string }> {
  const t = await createMcpTranslator();
  const items: Array<{ path: string; mtime: number; metadata?: Record<string, unknown> }> = [];

  if (items.length === 0) {
    return { success: false, message: trashT(t, "restore.empty") };
  }

  const targetIndex = index ?? 0;
  if (targetIndex < 0 || targetIndex >= items.length) {
    return {
      success: false,
      message: trashT(t, "restore.invalidIndex", { maxIndex: items.length - 1 }),
    };
  }

  const item = items[targetIndex];
  if (!item) {
    return { success: false, message: trashT(t, "restore.itemNotFound") };
  }
  const trashPath = (item.metadata?.["trashPath"] as string | undefined) ?? item.path;
  const result = restoreFromTrash(projectRoot, trashPath);

  if (result.success) {
    return {
      success: true,
      message: trashT(t, "restore.success", {
        restoredTo: result.restoredTo ?? trashT(t, "restore.unknown"),
      }),
    };
  }
  return { success: false, message: result.error ?? trashT(t, "restore.unknownError") };
}

export async function trashEmpty(
  projectRoot: string,
  olderThanDays?: number
): Promise<{ success: boolean; message: string }> {
  const t = await createMcpTranslator();
  const result = emptyTrash(projectRoot, olderThanDays);
  const freedStr = formatBytes(result.freedBytes);

  if (olderThanDays !== undefined) {
    return {
      success: true,
      message: trashT(t, "empty.olderThan", {
        deleted: result.deleted,
        olderThanDays,
        freed: freedStr,
      }),
    };
  }
  return {
    success: true,
    message: trashT(t, "empty.all", {
      deleted: result.deleted,
      freed: freedStr,
    }),
  };
}

// Tool Definitions
export const TRASH_LIST_TOOL = {
  name: "hev_fs_trash_list",
  description: trashToolDefinitionT("trashList.description"),
  inputSchema: {
    type: "object" as const,
    properties: {},
  },
  metadata: {
    category: "filesystem",
    subcategory: "trash-recovery",
  },
};

export const RESTORE_FILE_TOOL = {
  name: "hev_fs_restore",
  description: trashToolDefinitionT("trashRestore.description"),
  inputSchema: {
    type: "object" as const,
    properties: {
      index: { type: "integer", description: trashToolDefinitionT("trashRestore.index") },
    },
  },
  metadata: {
    category: "filesystem",
    subcategory: "trash-recovery",
  },
};

export const TRASH_EMPTY_TOOL = {
  name: "hev_fs_trash_empty",
  description: trashToolDefinitionT("trashEmpty.description"),
  inputSchema: {
    type: "object" as const,
    properties: {
      older_than_days: {
        type: "integer",
        description: trashToolDefinitionT("trashEmpty.olderThanDays"),
      },
    },
  },
  metadata: {
    category: "filesystem",
    subcategory: "trash-recovery",
  },
};
