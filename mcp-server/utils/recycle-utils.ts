/**
 * Recycle Bin Utilities
 * 
 * Silinen dosyalar için çöp kutusu sistemi
 * - Dosyalar .rovodev/trash/ altına taşınır
 * - Timestamp ile saklanır
 * - Geri yükleme ve kalıcı silme desteği
 */

import { existsSync, mkdirSync, renameSync, readdirSync, statSync, unlinkSync, rmSync, readFileSync, writeFileSync, copyFileSync } from "fs";
import { join, basename, dirname, relative } from "path";

// ============================================
// Constants
// ============================================

const TRASH_DIR = ".rovodev/trash";
const OPERATION_LOG = ".rovodev/operation-log.json";
const MAX_OPERATIONS = 100; // Son 100 işlem saklanır

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

// ============================================
// Trash Operations
// ============================================

/**
 * Çöp kutusu dizinini hazırla
 */
export function ensureTrashDir(projectRoot: string): string {
  const trashPath = join(projectRoot, TRASH_DIR);
  if (!existsSync(trashPath)) {
    mkdirSync(trashPath, { recursive: true });
  }
  return trashPath;
}

/**
 * Dosyayı çöp kutusuna taşı
 */
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

  // Taşı
  renameSync(filePath, trashPath);

  const item: TrashItem = {
    originalPath: filePath,
    trashPath,
    deletedAt: new Date().toISOString(),
    size: isDirectory ? 0 : stats.size,
    isDirectory,
  };

  // Operation log'a kaydet
  logOperation(projectRoot, {
    id: generateId(),
    type: "delete",
    timestamp: item.deletedAt,
    files: [{ path: filePath, backupPath: trashPath }],
    canUndo: true,
  });

  return item;
}

/**
 * Çöp kutusundaki dosyaları listele
 */
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

/**
 * Çöp kutusundan geri yükle
 */
export function restoreFromTrash(projectRoot: string, trashPath: string): { success: boolean; restoredTo?: string; error?: string } {
  if (!existsSync(trashPath)) {
    return { success: false, error: "Dosya çöp kutusunda bulunamadı" };
  }

  const fileName = basename(trashPath);
  
  // Parse original path from filename
  const parts = fileName.split("__");
  const originalRelative = parts.slice(1).join("/");
  const originalPath = join(projectRoot, originalRelative);

  // Hedef dizini oluştur
  const targetDir = dirname(originalPath);
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  // Hedefte dosya varsa yeniden adlandır
  let finalPath = originalPath;
  if (existsSync(originalPath)) {
    const ext = originalPath.includes(".") ? "." + originalPath.split(".").pop() : "";
    const base = originalPath.replace(ext, "");
    finalPath = `${base}_restored_${Date.now()}${ext}`;
  }

  renameSync(trashPath, finalPath);

  return { success: true, restoredTo: finalPath };
}

/**
 * Çöp kutusunu boşalt
 */
export function emptyTrash(projectRoot: string, olderThanDays?: number): { deleted: number; freedBytes: number } {
  const trashDir = join(projectRoot, TRASH_DIR);
  if (!existsSync(trashDir)) {
    return { deleted: 0, freedBytes: 0 };
  }

  const files = readdirSync(trashDir);
  let deleted = 0;
  let freedBytes = 0;
  const cutoff = olderThanDays ? Date.now() - (olderThanDays * 24 * 60 * 60 * 1000) : 0;

  for (const file of files) {
    const trashPath = join(trashDir, file);
    const stats = statSync(trashPath);

    // Yaş kontrolü
    if (olderThanDays && stats.mtimeMs > cutoff) {
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

/**
 * Dosyanın yedeğini al
 */
export function createBackup(projectRoot: string, filePath: string, suffix?: string): { success: boolean; backupPath?: string; error?: string } {
  if (!existsSync(filePath)) {
    return { success: false, error: "Dosya bulunamadı" };
  }

  const timestamp = suffix || new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const ext = filePath.includes(".") ? "." + filePath.split(".").pop() : "";
  const base = filePath.replace(ext, "");
  const backupPath = `${base}.${timestamp}.bak${ext}`;

  copyFileSync(filePath, backupPath);

  // Operation log'a kaydet
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
// Operation Log (Undo desteği)
// ============================================

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function getOperationLog(projectRoot: string): OperationLog {
  const logPath = join(projectRoot, OPERATION_LOG);
  if (!existsSync(logPath)) {
    return { operations: [] };
  }
  try {
    return JSON.parse(readFileSync(logPath, "utf-8"));
  } catch {
    return { operations: [] };
  }
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

function getLastOperation(projectRoot: string): Operation | null {
  const log = getOperationLog(projectRoot);
  return log.operations.find(op => op.canUndo) || null;
}

export function getOperationHistory(projectRoot: string, limit: number = 20): Operation[] {
  const log = getOperationLog(projectRoot);
  return log.operations.slice(0, limit);
}

/**
 * Son işlemi geri al
 */
export function undoLastOperation(projectRoot: string): { success: boolean; message: string; operation?: Operation } {
  const log = getOperationLog(projectRoot);
  const opIndex = log.operations.findIndex(op => op.canUndo);
  
  if (opIndex === -1) {
    return { success: false, message: "Geri alınacak işlem yok" };
  }

  const operation = log.operations[opIndex];

  try {
    switch (operation.type) {
      case "delete": {
        // Çöp kutusundan geri yükle
        for (const file of operation.files) {
          if (file.backupPath && existsSync(file.backupPath)) {
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
        // Oluşturulan dosyayı sil
        for (const file of operation.files) {
          if (existsSync(file.path)) {
            moveToTrash(projectRoot, file.path);
          }
        }
        break;
      }
      case "replace": {
        // Orijinal içeriği geri yükle
        for (const file of operation.files) {
          if (file.originalContent !== undefined) {
            writeFileSync(file.path, file.originalContent, "utf-8");
          } else if (file.backupPath && existsSync(file.backupPath)) {
            copyFileSync(file.backupPath, file.path);
          }
        }
        break;
      }
      case "move": {
        // Taşımayı geri al
        for (const file of operation.files) {
          if (file.backupPath && existsSync(file.path)) {
            renameSync(file.path, file.backupPath);
          }
        }
        break;
      }
      case "backup": {
        // Backup dosyasını sil
        for (const file of operation.files) {
          if (file.backupPath && existsSync(file.backupPath)) {
            unlinkSync(file.backupPath);
          }
        }
        break;
      }
    }

    // İşlemi undo edildi olarak işaretle
    log.operations[opIndex].canUndo = false;
    saveOperationLog(projectRoot, log);

    return { success: true, message: `İşlem geri alındı: ${operation.type}`, operation };
  } catch (error) {
    return { success: false, message: `Geri alma hatası: ${(error as Error).message}` };
  }
}
