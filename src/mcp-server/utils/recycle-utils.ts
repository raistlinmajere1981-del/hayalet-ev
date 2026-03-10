/**
 * Recycle Bin Utilities
 *
 * Trash system for deleted files.
 * - Files move under `.rovo/trash/`
 * - Entries are stored with timestamps
 * - Supports restore and permanent delete flows
 */

import {
  existsSync,
  mkdirSync,
  renameSync,
  readdirSync,
  statSync,
  unlinkSync,
  rmSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
} from "fs";
import { join, basename, dirname, relative } from "path";
import { createMcpTranslatorSync } from "./i18n/index.js";

// ============================================
// Constants
// ============================================

const TRASH_DIR = ".rovo/trash";
const OPERATION_LOG = ".rovo/operation-log.json";
const MAX_OPERATIONS = 100; // Keep the most recent 100 operations.
const mcpT = createMcpTranslatorSync();

// ============================================
// Types
// ============================================

export interface TrashItem {
  originalPath: string;
  trashPath: string;
  deletedAt: string;
  size: number;
  isDirectory: boolean;
}

export interface Operation {
  id: string;
  type: "create" | "delete" | "move" | "replace" | "backup";
  timestamp: string;
  files: Array<{
    path: string;
    backupPath?: string;
    originalContent?: string;
  }>;
  canUndo: boolean;
}

interface OperationLog {
  operations: Operation[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseOperationLog(raw: string): OperationLog {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return { operations: [] };
    const operations = parsed["operations"];
    return {
      operations: Array.isArray(operations) ? (operations as Operation[]) : [],
    };
  } catch {
    return { operations: [] };
  }
}

// ============================================
// Trash Operations
// ============================================

/** Ensure that the trash directory exists. */
export function ensureTrashDir(projectRoot: string): string {
  const trashPath = join(projectRoot, TRASH_DIR);
  if (!existsSync(trashPath)) {
    mkdirSync(trashPath, { recursive: true });
  }
  return trashPath;
}

/** Move a file or directory into the trash. */
export function moveToTrash(projectRoot: string, filePath: string): TrashItem | null {
  if (!existsSync(filePath)) {
    return null;
  }

  const trashDir = ensureTrashDir(projectRoot);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const relativePath = relative(projectRoot, filePath).replace(/[/]/g, "__");
  const trashName = `${timestamp}__${relativePath}`;
  const trashPath = join(trashDir, trashName);

  const stats = statSync(filePath);
  const isDirectory = stats.isDirectory();

  // Move the file into the trash location.
  renameSync(filePath, trashPath);

  const item: TrashItem = {
    originalPath: filePath,
    trashPath,
    deletedAt: new Date().toISOString(),
    size: isDirectory ? 0 : stats.size,
    isDirectory,
  };

  // Record the action for undo support.
  logOperation(projectRoot, {
    id: generateId(),
    type: "delete",
    timestamp: item.deletedAt,
    files: [{ path: filePath, backupPath: trashPath }],
    canUndo: true,
  });

  return item;
}

/** List files currently stored in the trash. */
export function listTrash(projectRoot: string): TrashItem[] {
  const trashDir = join(projectRoot, TRASH_DIR);
  if (!existsSync(trashDir)) {
    return [];
  }

  const items: TrashItem[] = [];
  const files = readdirSync(trashDir);

  for (const file of files) {
    const trashPath = join(trashDir, file);
    const stats = statSync(trashPath);

    // Parse filename: timestamp__original__path
    const parts = file.split("__");
    if (parts[0] == null || parts[0] === "") continue; // Skip invalid entries
    const timestamp = parts[0].replace(/-/g, ":").replace(/T/g, " ").slice(0, 19);
    const originalRelative = parts.slice(1).join("/");
    const originalPath = join(projectRoot, originalRelative);

    items.push({
      originalPath,
      trashPath,
      deletedAt: timestamp,
      size: stats.isDirectory() ? 0 : stats.size,
      isDirectory: stats.isDirectory(),
    });
  }

  return items.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}

/** Restore a file from the trash. */
export function restoreFromTrash(
  projectRoot: string,
  trashPath: string
): { success: boolean; restoredTo?: string; error?: string } {
  if (!existsSync(trashPath)) {
    return { success: false, error: mcpT("mcpServer.fs.recycle.fileNotInTrash") };
  }

  const fileName = basename(trashPath);

  // Parse the original path from the trash filename.
  const parts = fileName.split("__");
  const originalRelative = parts.slice(1).join("/");
  const originalPath = join(projectRoot, originalRelative);

  // Recreate the destination directory when needed.
  const targetDir = dirname(originalPath);
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  // Rename the restored file if the destination already exists.
  let finalPath = originalPath;
  if (existsSync(originalPath)) {
    const ext = originalPath.includes(".") ? "." + originalPath.split(".").pop() : "";
    const base = originalPath.replace(ext, "");
    finalPath = `${base}_restored_${Date.now()}${ext}`;
  }

  renameSync(trashPath, finalPath);

  return { success: true, restoredTo: finalPath };
}

/** Empty the trash directory. */
export function emptyTrash(
  projectRoot: string,
  olderThanDays?: number
): { deleted: number; freedBytes: number } {
  const trashDir = join(projectRoot, TRASH_DIR);
  if (!existsSync(trashDir)) {
    return { deleted: 0, freedBytes: 0 };
  }

  const files = readdirSync(trashDir);
  let deleted = 0;
  let freedBytes = 0;
  const cutoff =
    olderThanDays != null && olderThanDays > 0
      ? Date.now() - olderThanDays * 24 * 60 * 60 * 1000
      : 0;

  for (const file of files) {
    const trashPath = join(trashDir, file);
    const stats = statSync(trashPath);

    // Skip entries newer than the retention cutoff.
    if (olderThanDays != null && olderThanDays > 0 && stats.mtimeMs > cutoff) {
      continue;
    }

    freedBytes += stats.isDirectory() ? 0 : stats.size;
    rmSync(trashPath, { recursive: true, force: true });
    deleted++;
  }

  return { deleted, freedBytes };
}

// ============================================
// Backup Operations
// ============================================

/** Create a backup copy for a file. */
export function createBackup(
  projectRoot: string,
  filePath: string,
  suffix?: string
): { success: boolean; backupPath?: string; error?: string } {
  if (!existsSync(filePath)) {
    return { success: false, error: mcpT("mcpServer.fs.recycle.fileNotFound") };
  }

  const timestamp = suffix ?? new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const ext = filePath.includes(".") ? "." + filePath.split(".").pop() : "";
  const base = filePath.replace(ext, "");
  const backupPath = `${base}.${timestamp}.bak${ext}`;

  copyFileSync(filePath, backupPath);

  // Record the backup for undo support.
  logOperation(projectRoot, {
    id: generateId(),
    type: "backup",
    timestamp: new Date().toISOString(),
    files: [{ path: filePath, backupPath }],
    canUndo: true,
  });

  return { success: true, backupPath };
}

// ============================================
// Operation Log (undo support)
// ============================================

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function getOperationLog(projectRoot: string): OperationLog {
  const logPath = join(projectRoot, OPERATION_LOG);
  if (!existsSync(logPath)) {
    return { operations: [] };
  }
  return parseOperationLog(readFileSync(logPath, "utf-8"));
}

function saveOperationLog(projectRoot: string, log: OperationLog): void {
  const logPath = join(projectRoot, OPERATION_LOG);
  const dir = dirname(logPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(logPath, JSON.stringify(log, null, 2), "utf-8");
}

export function logOperation(projectRoot: string, operation: Operation): void {
  const log = getOperationLog(projectRoot);
  log.operations.unshift(operation);

  // Max limit
  if (log.operations.length > MAX_OPERATIONS) {
    log.operations = log.operations.slice(0, MAX_OPERATIONS);
  }

  saveOperationLog(projectRoot, log);
}

export function getOperationHistory(projectRoot: string, limit: number = 20): Operation[] {
  const log = getOperationLog(projectRoot);
  return log.operations.slice(0, limit);
}

/** Undo the latest undoable operation. */
export function undoLastOperation(projectRoot: string): {
  success: boolean;
  message: string;
  operation?: Operation;
} {
  const log = getOperationLog(projectRoot);
  const opIndex = log.operations.findIndex((op) => op.canUndo);

  if (opIndex === -1) {
    return { success: false, message: mcpT("mcpServer.fs.recycle.noUndoableOperation") };
  }

  const operation = log.operations[opIndex];
  if (!operation) {
    return { success: false, message: mcpT("mcpServer.fs.recycle.operationNotFound") };
  }

  try {
    switch (operation.type) {
      case "delete": {
        for (const file of operation.files) {
          if (file.backupPath != null && file.backupPath !== "" && existsSync(file.backupPath)) {
            const targetDir = dirname(file.path);
            if (!existsSync(targetDir)) {
              mkdirSync(targetDir, { recursive: true });
            }
            renameSync(file.backupPath, file.path);
          }
        }
        break;
      }
      case "create": {
        for (const file of operation.files) {
          if (existsSync(file.path)) {
            moveToTrash(projectRoot, file.path);
          }
        }
        break;
      }
      case "replace": {
        for (const file of operation.files) {
          if (file.originalContent !== undefined) {
            writeFileSync(file.path, file.originalContent, "utf-8");
          } else if (
            file.backupPath != null &&
            file.backupPath !== "" &&
            existsSync(file.backupPath)
          ) {
            copyFileSync(file.backupPath, file.path);
          }
        }
        break;
      }
      case "move": {
        for (const file of operation.files) {
          if (file.backupPath != null && file.backupPath !== "" && existsSync(file.path)) {
            renameSync(file.path, file.backupPath);
          }
        }
        break;
      }
      case "backup": {
        for (const file of operation.files) {
          if (file.backupPath != null && file.backupPath !== "" && existsSync(file.backupPath)) {
            unlinkSync(file.backupPath);
          }
        }
        break;
      }
    }

    // Mark the operation as no longer undoable.
    const op = log.operations[opIndex];
    if (op) op.canUndo = false;
    saveOperationLog(projectRoot, log);

    return {
      success: true,
      message: mcpT("mcpServer.fs.recycle.undoSuccess", { operationType: operation.type }),
      operation,
    };
  } catch (error) {
    return {
      success: false,
      message: mcpT("mcpServer.fs.recycle.undoError", { message: (error as Error).message }),
    };
  }
}
