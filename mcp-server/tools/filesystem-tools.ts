/**
 * Filesystem Tools for MCP Server
 * 
 * 10 adet dosya sistemi aracı:
 * - open_files, create_file, delete_file, move_file
 * - expand_code_chunks, find_and_replace_code, grep
 * - expand_folder, bash, create_technical_plan
 */

import { readFile, writeFile, unlink, rename, mkdir, access } from "fs/promises";
import { spawn } from "child_process";
import { dirname } from "path";
import {
  readFileWithCollapse,
  expandLineRanges,
  expandSymbols,
  readFolderStructure,
  formatFolderStructure,
  grepDirectory,
  findAndReplace,
  addLineNumbers,
  getContextPreview,
} from "../utils/file-utils.js";
import { createProgress } from "../utils/progress.js";
import { FS_TIMEOUTS } from "../utils/timeouts.js";
import {
  moveToTrash,
  listTrash,
  restoreFromTrash,
  emptyTrash,
  createBackup,
  undoLastOperation,
  getOperationHistory,
} from "../utils/recycle-utils.js";
import {
  diffFiles,
  diffContent,
  showFileContent,
  getFileSummary,
} from "../utils/diff-utils.js";
import { logToolError } from "../utils/mcp-logger.js";
import type {
  FileContent,
  GrepResult,
  BashResult,
  TechnicalPlan,
  ReplaceResult,
} from "../types/index.js";

// ============================================
// Tool Implementations
// ============================================

/**
 * open_files - Bir veya daha fazla dosyayı aç
 * Büyük dosyalar collapsed view ile gösterilir
 */
export async function openFiles(filePaths: string[]): Promise<{ files: FileContent[] }> {
  const results: FileContent[] = [];
  
  for (const filePath of filePaths) {
    const result = await readFileWithCollapse(filePath);
    results.push(result);
  }
  
  return { files: results };
}

// İçerik boyutu limitleri
const MAX_CONTENT_SIZE = 500 * 1024; // 500KB - çok büyük içerikler chunk'lanmalı
const WARN_CONTENT_SIZE = 100 * 1024; // 100KB - uyarı eşiği
const BASH_THRESHOLD = 10 * 1024; // 10KB üzeri içerikler bash ile yazılır (token limit için)

/**
 * create_file - Yeni dosya oluştur
 * 
 * Büyük dosyalar (>10KB) için otomatik olarak bash heredoc kullanır.
 * Bu, LLM output token limitini aşmayı önler.
 */
export async function createFile(
  filePath: string,
  initialContent: string = "",
  overwrite: boolean = false,
  projectRoot?: string
): Promise<{ success: boolean; message: string }> {
  const progress = createProgress({ operation: "Dosya oluşturma", quiet: true });
  
  try {
    // İçerik boyutu kontrolü
    const contentSize = Buffer.byteLength(initialContent, "utf-8");
    progress.update(0, `${filePath} oluşturuluyor (${(contentSize / 1024).toFixed(1)}KB)...`);
    
    if (contentSize > MAX_CONTENT_SIZE) {
      progress.fail("İçerik çok büyük");
      return { 
        success: false, 
        message: `İçerik çok büyük (${(contentSize / 1024).toFixed(1)}KB). Maksimum: ${MAX_CONTENT_SIZE / 1024}KB. Dosyayı parçalar halinde oluşturun.` 
      };
    }
    
    // Dosya var mı kontrol et
    if (!overwrite) {
      try {
        await access(filePath);
        progress.fail("Dosya zaten var");
        return { success: false, message: `Dosya zaten var: ${filePath}. Üzerine yazmak için overwrite=true kullanın.` };
      } catch {
        // Dosya yok, devam et
      }
    }
    
    // Dizin yoksa oluştur
    progress.update(1, "Dizin kontrol ediliyor...");
    const dir = dirname(filePath);
    await mkdir(dir, { recursive: true });
    
    // Büyük içerikler için bash heredoc kullan (token limit aşımını önler)
    if (contentSize > BASH_THRESHOLD && projectRoot) {
      progress.update(2, "Bash heredoc ile yazılıyor...");
      const result = await createFileWithBash(filePath, initialContent, projectRoot);
      if (result.success) {
        progress.done(`${(contentSize / 1024).toFixed(1)}KB yazıldı (bash)`);
        return { success: true, message: `Dosya oluşturuldu: ${filePath} (${(contentSize / 1024).toFixed(1)}KB, bash mode)` };
      } else {
        // Bash başarısız olursa normal yönteme geri dön
        progress.update(2, "Normal yazma moduna geçiliyor...");
      }
    }
    
    // Dosyayı normal yöntemle yaz
    progress.update(2, "Dosya yazılıyor...");
    await writeFile(filePath, initialContent, "utf-8");
    
    let message = `Dosya oluşturuldu: ${filePath}`;
    if (contentSize > WARN_CONTENT_SIZE) {
      message += ` (${(contentSize / 1024).toFixed(1)}KB)`;
    }
    
    progress.done(`${(contentSize / 1024).toFixed(1)}KB yazıldı`);
    return { success: true, message };
  } catch (error) {
    const err = error as Error;
    progress.fail(err.message);
    logToolError("hev_fs_create_file", err, { filePath, contentSize: Buffer.byteLength(initialContent, "utf-8") });
    return { 
      success: false, 
      message: `Dosya oluşturma hatası: ${err.message}\nYol: ${filePath}\nİçerik boyutu: ${Buffer.byteLength(initialContent, "utf-8")} byte` 
    };
  }
}

/**
 * Bash heredoc ile dosya oluştur
 * Token limit sorunlarını aşmak için kullanılır
 */
async function createFileWithBash(
  filePath: string,
  content: string,
  projectRoot: string
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    // Benzersiz bir EOF marker oluştur (içerikte olmamasını garanti et)
    let eofMarker = "HAYALET_EOF";
    let counter = 0;
    while (content.includes(eofMarker)) {
      counter++;
      eofMarker = `HAYALET_EOF_${counter}`;
    }
    
    // Heredoc komutu oluştur
    const command = `cat << '${eofMarker}' > "${filePath}"
${content}
${eofMarker}`;
    
    const child = spawn("bash", ["-c", command], {
      cwd: projectRoot,
      env: { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
    });
    
    let stderr = "";
    
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        resolve({ success: false, error: stderr || `Exit code: ${code}` });
      }
    });
    
    child.on("error", (err) => {
      resolve({ success: false, error: err.message });
    });
    
    // Bash heredoc timeout
    setTimeout(() => {
      child.kill("SIGTERM");
      resolve({ success: false, error: "Timeout" });
    }, FS_TIMEOUTS.BASH_HEREDOC);
  });
}

/**
 * fs_create_chunked - Büyük dosyaları parçalar halinde oluştur
 * LLM response limitlerini aşmak için chunk-based yaklaşım
 */
export async function createChunkedFile(
  filePath: string,
  chunks: string[],
  projectRoot: string,
  overwrite: boolean = false
): Promise<{ success: boolean; message: string; chunkCount: number }> {
  const progress = createProgress({ operation: "hev_fs_create_chunked", total: 100 });
  const tempDir = `${projectRoot}/.tmp_chunks`;
  const tempFiles: string[] = [];
  
  try {
    progress.log(`${chunks.length} parça birleştiriliyor...`);
    
    // Hedef dosya kontrolü
    if (!overwrite) {
      try {
        await access(filePath);
        return { success: false, message: `Dosya zaten var: ${filePath}`, chunkCount: 0 };
      } catch { /* dosya yok, devam */ }
    }
    
    // Temp dizini oluştur
    await mkdir(tempDir, { recursive: true });
    
    // Her chunk'ı temp dosyaya yaz
    for (let i = 0; i < chunks.length; i++) {
      const tempPath = `${tempDir}/chunk_${String(i).padStart(4, "0")}.tmp`;
      await writeFile(tempPath, chunks[i], "utf-8");
      tempFiles.push(tempPath);
      progress.update(Math.round(((i + 1) / chunks.length) * 50), `Parça ${i + 1}/${chunks.length} yazıldı`);
    }
    
    // Hedef dizini oluştur
    await mkdir(dirname(filePath), { recursive: true });
    
    // Tüm chunk'ları birleştir
    progress.update(60, "Parçalar birleştiriliyor...");
    let fullContent = "";
    for (const tempPath of tempFiles) {
      const chunk = await readFile(tempPath, "utf-8");
      fullContent += chunk;
    }
    
    // Hedef dosyaya yaz
    progress.update(80, "Dosya yazılıyor...");
    await writeFile(filePath, fullContent, "utf-8");
    
    // Temp dosyaları temizle
    progress.update(90, "Temp dosyalar temizleniyor...");
    for (const tempPath of tempFiles) {
      try { await unlink(tempPath); } catch { /* ignore */ }
    }
    
    const finalSize = Buffer.byteLength(fullContent, "utf-8");
    progress.done(`${filePath} oluşturuldu (${chunks.length} parça, ${finalSize} byte)`);
    
    return {
      success: true,
      message: `Dosya oluşturuldu: ${filePath}\nParça sayısı: ${chunks.length}\nToplam boyut: ${finalSize} byte`,
      chunkCount: chunks.length,
    };
  } catch (error) {
    // Hata durumunda temp dosyaları temizle
    for (const tempPath of tempFiles) {
      try { await unlink(tempPath); } catch { /* ignore */ }
    }
    const err = error as Error;
    progress.fail(err.message);
    logToolError("hev_fs_create_chunked", err, { filePath, chunkCount: chunks.length });
    return { success: false, message: `Chunk dosya oluşturma hatası: ${err.message}`, chunkCount: 0 };
  }
}

/**
 * fs_append_chunk - Mevcut dosyaya chunk ekle (streaming write)
 */
export async function appendChunk(
  filePath: string,
  content: string,
  createIfMissing: boolean = true
): Promise<{ success: boolean; message: string }> {
  try {
    // Dosya var mı kontrol et
    let existingContent = "";
    try {
      existingContent = await readFile(filePath, "utf-8");
    } catch {
      if (!createIfMissing) {
        return { success: false, message: `Dosya bulunamadı: ${filePath}` };
      }
      // Dizini oluştur
      await mkdir(dirname(filePath), { recursive: true });
    }
    
    // İçeriği ekle
    await writeFile(filePath, existingContent + content, "utf-8");
    return { success: true, message: `Chunk eklendi: ${filePath} (+${Buffer.byteLength(content, "utf-8")} byte)` };
  } catch (error) {
    const err = error as Error;
    logToolError("hev_fs_append_chunk", err, { filePath });
    return { success: false, message: `Append hatası: ${err.message}` };
  }
}

/**
 * delete_file - Dosya sil (çöp kutusuna taşır)
 */
export async function deleteFile(filePath: string, projectRoot: string, permanent: boolean = false): Promise<{ success: boolean; message: string }> {
  try {
    if (permanent) {
      await unlink(filePath);
      return { success: true, message: `Dosya kalıcı olarak silindi: ${filePath}` };
    }
    
    const trashItem = moveToTrash(projectRoot, filePath);
    if (trashItem) {
      return { success: true, message: `Dosya çöp kutusuna taşındı: ${filePath}\nGeri yüklemek için: fs_restore` };
    }
    return { success: false, message: `Dosya bulunamadı: ${filePath}` };
  } catch (error) {
    logToolError("hev_fs_delete_file", error as Error, { filePath });
    return { success: false, message: `Hata: ${(error as Error).message}` };
  }
}

/**
 * move_file - Dosya taşı veya yeniden adlandır
 */
export async function moveFile(
  filePath: string,
  newPath: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Hedef dizin yoksa oluştur
    const dir = dirname(newPath);
    await mkdir(dir, { recursive: true });
    
    await rename(filePath, newPath);
    return { success: true, message: `Dosya taşındı: ${filePath} → ${newPath}` };
  } catch (error) {
    logToolError("hev_fs_move_file", error as Error, { filePath, newPath });
    return { success: false, message: `Hata: ${(error as Error).message}` };
  }
}

/**
 * expand_code_chunks - Dosyada belirli satır aralıklarını veya sembolleri genişlet
 */
export async function expandCodeChunks(
  filePath: string,
  lineRanges: [number, number][] = [],
  patterns: string[] = []
): Promise<{ content: string; error?: string }> {
  try {
    // Önce patterns ile ara
    if (patterns.length > 0) {
      const content = await expandSymbols(filePath, patterns);
      return { content };
    }
    
    // Line ranges ile genişlet
    if (lineRanges.length > 0) {
      const content = await expandLineRanges(filePath, lineRanges);
      return { content };
    }
    
    // Hiçbiri verilmediyse tüm dosyayı göster
    const fileContent = await readFile(filePath, "utf-8");
    return { content: addLineNumbers(fileContent) };
  } catch (error) {
    logToolError("hev_fs_expand_code_chunks", error as Error, { filePath, lineRanges, patterns });
    return { content: "", error: (error as Error).message };
  }
}

/**
 * find_and_replace_code - Dosyada bul ve değiştir
 */
export async function findAndReplaceCode(
  filePath: string,
  find: string,
  replace: string,
  ignoreWhitespace?: boolean,
  dryRun?: boolean
): Promise<ReplaceResult> {
  const progress = createProgress({ operation: "Find & Replace", quiet: true });
  progress.update(0, `${filePath} işleniyor...`);
  
  const result = await findAndReplace(filePath, find, replace, {
    ignoreWhitespace,
    dryRun
  });
  
  // Context preview oluştur (değişiklik yapıldıysa)
  let contextPreview: string | undefined;
  if (result.success && result.replacements > 0) {
    try {
      // İlk değişikliğin olduğu satırı bul
      const content = await readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      let firstChangeLineIndex = -1;
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(replace)) {
          firstChangeLineIndex = i;
          break;
        }
      }
      
      if (firstChangeLineIndex >= 0) {
        // Değişiklik yapılan ilk satır etrafında context preview
        contextPreview = await getContextPreview(
          filePath,
          firstChangeLineIndex,
          firstChangeLineIndex + 1,
          5
        );
      }
    } catch (err) {
      // Context preview oluşturulamazsa sessizce devam et
    }
  }
  
  if (result.success) {
    if (dryRun) {
      progress.done(`Preview: ${result.replacements} değişiklik`);
    } else {
      progress.done(`${result.replacements} değişiklik yapıldı`);
    }
  } else {
    progress.fail(result.error || "Bilinmeyen hata");
  }
  
  return {
    file: filePath,
    replacements: result.replacements,
    success: result.success,
    error: result.error,
    preview: result.preview,
    contextPreview
  };
}

/**
 * grep - Dosyalarda pattern ara
 */
export async function grep(
  workspacePath: string,
  contentPattern: string | null = null,
  pathGlob: string | null = null
): Promise<GrepResult> {
  let regex: RegExp | null = null;
  
  if (contentPattern) {
    try {
      regex = new RegExp(contentPattern, "i");
    } catch {
      regex = new RegExp(contentPattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    }
  }
  
  const matches = await grepDirectory(workspacePath, regex, pathGlob);
  
  return {
    pattern: contentPattern || pathGlob || "",
    matches,
    totalMatches: matches.length,
    filesSearched: new Set(matches.map(m => m.file)).size,
  };
}

/**
 * expand_folder - Klasör yapısını göster
 */
export async function expandFolder(
  folderPath: string,
  maxDepth: number = 3
): Promise<{ structure: string; error?: string }> {
  try {
    const entries = await readFolderStructure(folderPath, maxDepth);
    const structure = formatFolderStructure(entries);
    return { structure: `${folderPath}/\n${structure}` };
  } catch (error) {
    logToolError("hev_fs_expand_folder", error as Error, { folderPath, maxDepth });
    return { structure: "", error: (error as Error).message };
  }
}

/**
 * bash - Shell komutu çalıştır
 */
export async function executeBash(
  command: string | number,
  workspacePath: string,
  timeout: number = FS_TIMEOUTS.BASH_DEFAULT
): Promise<BashResult> {
  return new Promise((resolve) => {
    // PID ile log alma (şimdilik desteklenmiyor)
    if (typeof command === "number") {
      resolve({
        stdout: "",
        stderr: "PID ile log alma henüz desteklenmiyor",
        exitCode: 1,
      });
      return;
    }
    
    const isBackground = command.trim().endsWith("&");
    const actualCommand = isBackground ? command.slice(0, -1).trim() : command;
    
    const child = spawn("bash", ["-c", actualCommand], {
      cwd: workspacePath,
      env: { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
    });
    
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    
    const timeoutId = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeout);
    
    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    
    child.on("close", (code) => {
      clearTimeout(timeoutId);
      
      // Output limitlenmesi (çok büyük çıktılar için)
      const maxOutput = 50000;
      if (stdout.length > maxOutput) {
        stdout = stdout.slice(0, maxOutput) + `\n... (${stdout.length - maxOutput} karakter kesildi)`;
      }
      if (stderr.length > maxOutput) {
        stderr = stderr.slice(0, maxOutput) + `\n... (${stderr.length - maxOutput} karakter kesildi)`;
      }
      
      resolve({
        stdout,
        stderr,
        exitCode: code ?? (timedOut ? 124 : 1),
        pid: child.pid,
        timedOut,
      });
    });
    
    child.on("error", (err) => {
      clearTimeout(timeoutId);
      resolve({
        stdout,
        stderr: err.message,
        exitCode: 1,
      });
    });
    
    // Background process için hemen dön
    if (isBackground) {
      clearTimeout(timeoutId);
      setTimeout(() => {
        resolve({
          stdout: `Background process başlatıldı`,
          stderr: "",
          exitCode: 0,
          pid: child.pid,
        });
      }, 100);
    }
  });
}

// ============================================
// Recycle Bin & Backup Tools
// ============================================

/**
 * fs_trash_list - Çöp kutusunu listele
 */
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * fs_restore - Çöp kutusundan geri yükle
 */
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

/**
 * fs_trash_empty - Çöp kutusunu boşalt
 */
export function trashEmpty(projectRoot: string, olderThanDays?: number): { success: boolean; message: string } {
  const result = emptyTrash(projectRoot, olderThanDays);
  const freedStr = formatBytes(result.freedBytes);
  
  if (olderThanDays) {
    return { success: true, message: `🗑️ ${result.deleted} dosya silindi (${olderThanDays} günden eski), ${freedStr} boşaltıldı` };
  }
  return { success: true, message: `🗑️ Çöp kutusu boşaltıldı: ${result.deleted} dosya, ${freedStr}` };
}

/**
 * fs_backup - Dosya yedeği al
 */
export function backupFile(projectRoot: string, filePath: string): { success: boolean; message: string; backupPath?: string } {
  const result = createBackup(projectRoot, filePath);
  if (result.success) {
    return { success: true, message: `✅ Yedek oluşturuldu: ${result.backupPath}`, backupPath: result.backupPath };
  }
  return { success: false, message: result.error || "Yedekleme başarısız" };
}

/**
 * fs_undo - Son işlemi geri al
 */
export function undoOperation(projectRoot: string): { success: boolean; message: string } {
  const result = undoLastOperation(projectRoot);
  return { success: result.success, message: result.message };
}

/**
 * fs_history - İşlem geçmişini göster
 */
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

// ============================================
// Diff Tools
// ============================================

/**
 * fs_diff - İki dosyayı karşılaştır
 */
export function fileDiff(file1: string, file2: string): { identical: boolean; summary: string } {
  const result = diffFiles(file1, file2);
  return { identical: result.identical, summary: result.summary };
}

/**
 * fs_diff_content - İki içeriği karşılaştır
 */
export function contentDiff(content1: string, content2: string, label1?: string, label2?: string): { identical: boolean; unified: string; additions: number; deletions: number } {
  const result = diffContent(content1, content2, label1, label2);
  return {
    identical: result.identical,
    unified: result.unified,
    additions: result.additions,
    deletions: result.deletions,
  };
}

/**
 * fs_show - Dosya içeriğini göster
 */
export function showFile(filePath: string, startLine?: number, endLine?: number): { content: string; summary: { lines: number; language: string } } {
  const content = showFileContent(filePath, startLine, endLine);
  const summary = getFileSummary(filePath);
  return { content, summary: { lines: summary.lines, language: summary.language } };
}

/**
 * create_technical_plan - Teknik plan oluştur
 */
export function createTechnicalPlan(
  plan: TechnicalPlan
): { success: boolean; summary: string } {
  // Plan validasyonu
  if (!plan.logicalChanges || plan.logicalChanges.length === 0) {
    return { success: false, summary: "Plan boş olamaz" };
  }
  
  // Özet oluştur
  const summaryLines: string[] = ["# Teknik Plan\n"];
  
  for (let i = 0; i < plan.logicalChanges.length; i++) {
    const change = plan.logicalChanges[i];
    summaryLines.push(`## ${i + 1}. ${change.summary}\n`);
    
    for (const file of change.filesToChange) {
      summaryLines.push(`- **${file.filePath}**: ${file.descriptionOfChange}`);
      if (file.clarifyingQuestionIfAny) {
        summaryLines.push(`  - ❓ ${file.clarifyingQuestionIfAny}`);
      }
    }
    summaryLines.push("");
  }
  
  return { success: true, summary: summaryLines.join("\n") };
}

// ============================================
// Tool Definitions (for MCP registration)
// ============================================

export const FILESYSTEM_TOOL_DEFINITIONS = [
  {
    name: "hev_fs_open_files",
    description: "Bir veya daha fazla dosyayı aç. Büyük dosyalar collapsed view ile gösterilir (fonksiyon gövdeleri gizli).",
    inputSchema: {
      type: "object" as const,
      properties: {
        file_paths: {
          type: "array",
          items: { type: "string" },
          description: "Açılacak dosya yollarının listesi",
        },
      },
      required: ["file_paths"],
    },
  },
  {
    name: "hev_fs_create_file",
    description: "Yeni dosya oluştur. Dizin yoksa otomatik oluşturulur.",
    inputSchema: {
      type: "object" as const,
      properties: {
        file_path: {
          type: "string",
          description: "Oluşturulacak dosya yolu",
        },
        initial_content: {
          type: "string",
          description: "Dosyanın başlangıç içeriği",
          default: "",
        },
        overwrite: {
          type: "boolean",
          description: "Dosya varsa üzerine yaz",
          default: false,
        },
      },
      required: ["file_path"],
    },
  },
  {
    name: "hev_fs_delete_file",
    description: "Dosya sil (çöp kutusuna taşır, geri alınabilir). permanent=true ile kalıcı siler.",
    inputSchema: {
      type: "object" as const,
      properties: {
        file_path: {
          type: "string",
          description: "Silinecek dosya yolu",
        },
        permanent: {
          type: "boolean",
          description: "Kalıcı silme (çöp kutusuna taşımadan)",
          default: false,
        },
      },
      required: ["file_path"],
    },
  },
  {
    name: "hev_fs_move_file",
    description: "Dosya taşı veya yeniden adlandır.",
    inputSchema: {
      type: "object" as const,
      properties: {
        file_path: {
          type: "string",
          description: "Taşınacak dosya yolu",
        },
        new_path: {
          type: "string",
          description: "Yeni dosya yolu",
        },
      },
      required: ["file_path", "new_path"],
    },
  },
  {
    name: "hev_fs_expand_code_chunks",
    description: "Dosyada belirli satır aralıklarını veya kod sembollerini genişlet. Pattern örnekleri: 'MyClass', 'my_function', 'def my_function', 'MyClass/myMethod'",
    inputSchema: {
      type: "object" as const,
      properties: {
        file_path: {
          type: "string",
          description: "Dosya yolu",
        },
        line_ranges: {
          type: "array",
          items: {
            type: "array",
            items: { type: "integer" },
          },
          description: "Genişletilecek satır aralıkları [[start, end], ...]. Tüm dosya için [[0, -1]]",
          default: [],
        },
        patterns: {
          type: "array",
          items: { type: "string" },
          description: "Aranacak sembol patternleri (fonksiyon, class isimleri vb.)",
          default: [],
        },
      },
      required: ["file_path"],
    },
  },
  {
    name: "hev_fs_find_and_replace",
    description: "Dosyada bul ve değiştir. ignoreWhitespace=true ile whitespace farkları ignore edilir. dryRun=true ile önizleme modunda çalışır.",
    inputSchema: {
      type: "object" as const,
      properties: {
        file_path: {
          type: "string",
          description: "Dosya yolu",
        },
        find: {
          type: "string",
          description: "Bulunacak metin",
        },
        replace: {
          type: "string",
          description: "Yerine konacak metin",
        },
        ignore_whitespace: {
          type: "boolean",
          description: "Whitespace farklarını ignore et (boşluk, tab, newline sayısı fark etmez)",
          default: false,
        },
        dry_run: {
          type: "boolean",
          description: "Önizleme modu - değişiklikleri göster ama dosyaya yazma",
          default: false,
        },
      },
      required: ["file_path", "find", "replace"],
    },
  },
  {
    name: "hev_fs_grep",
    description: "Dosyalarda pattern ara. 3 mod: 1) Sadece content_pattern: içerik ara, 2) Sadece path_glob: dosya yolu ara, 3) Her ikisi: filtrelenmiş dosyalarda ara",
    inputSchema: {
      type: "object" as const,
      properties: {
        content_pattern: {
          type: "string",
          description: "Aranacak regex pattern (içerik için)",
        },
        path_glob: {
          type: "string",
          description: "Dosya yolu glob pattern (örn: '*.ts', '**/test/*.js')",
        },
      },
    },
  },
  {
    name: "hev_fs_expand_folder",
    description: "Klasör yapısını göster (tree view).",
    inputSchema: {
      type: "object" as const,
      properties: {
        folder_path: {
          type: "string",
          description: "Klasör yolu",
        },
        max_depth: {
          type: "integer",
          description: "Maksimum derinlik",
          default: 3,
        },
      },
      required: ["folder_path"],
    },
  },
  {
    name: "hev_fs_bash",
    description: "Shell komutu çalıştır. Komut workspace dizininde çalışır. & ile biten komutlar arka planda çalışır.",
    inputSchema: {
      type: "object" as const,
      properties: {
        command: {
          type: "string",
          description: "Çalıştırılacak bash komutu",
        },
        timeout: {
          type: "integer",
          description: "Timeout (ms)",
          default: 120000,
        },
      },
      required: ["command"],
    },
  },
  {
    name: "hev_fs_create_plan",
    description: "Teknik plan oluştur ve doğrula.",
    inputSchema: {
      type: "object" as const,
      properties: {
        plan: {
          type: "object",
          description: "Teknik plan objesi { logicalChanges: [...] }",
          properties: {
            logicalChanges: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  summary: { type: "string" },
                  filesToChange: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        filePath: { type: "string" },
                        descriptionOfChange: { type: "string" },
                        clarifyingQuestionIfAny: { type: "string" },
                      },
                      required: ["filePath", "descriptionOfChange"],
                    },
                  },
                },
                required: ["summary", "filesToChange"],
              },
            },
          },
          required: ["logicalChanges"],
        },
      },
      required: ["plan"],
    },
  },
  // === Recycle Bin Tools ===
  {
    name: "hev_fs_trash_list",
    description: "Çöp kutusundaki dosyaları listele",
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
        file_path: {
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
      properties: {
        file1: {
          type: "string",
          description: "Birinci dosya yolu",
        },
        file2: {
          type: "string",
          description: "İkinci dosya yolu",
        },
      },
      required: ["file1", "file2"],
    },
  },
  {
    name: "hev_fs_diff_content",
    description: "İki metin bloğunu karşılaştır",
    inputSchema: {
      type: "object" as const,
      properties: {
        content1: {
          type: "string",
          description: "Birinci içerik",
        },
        content2: {
          type: "string",
          description: "İkinci içerik",
        },
        label1: {
          type: "string",
          description: "Birinci içeriğin etiketi",
          default: "a",
        },
        label2: {
          type: "string",
          description: "İkinci içeriğin etiketi",
          default: "b",
        },
      },
      required: ["content1", "content2"],
    },
  },
  {
    name: "hev_fs_show",
    description: "Dosya içeriğini satır numaralarıyla göster",
    inputSchema: {
      type: "object" as const,
      properties: {
        file_path: {
          type: "string",
          description: "Dosya yolu",
        },
        start_line: {
          type: "integer",
          description: "Başlangıç satırı (1-indexed)",
        },
        end_line: {
          type: "integer",
          description: "Bitiş satırı",
        },
      },
      required: ["file_path"],
    },
  },
  {
    name: "hev_fs_create_chunked",
    description: "Büyük dosyaları parçalar halinde oluştur. LLM response limitlerini aşmak için chunk-based yaklaşım kullanır.",
    inputSchema: {
      type: "object" as const,
      properties: {
        file_path: {
          type: "string",
          description: "Oluşturulacak dosya yolu",
        },
        chunks: {
          type: "array",
          items: { type: "string" },
          description: "Dosya içeriğinin parçaları (sırayla birleştirilecek)",
        },
        overwrite: {
          type: "boolean",
          description: "Dosya varsa üzerine yaz",
          default: false,
        },
      },
      required: ["file_path", "chunks"],
    },
  },
  {
    name: "hev_fs_append_chunk",
    description: "Mevcut dosyaya içerik ekle (streaming write). Büyük dosyaları parça parça oluşturmak için kullanılır.",
    inputSchema: {
      type: "object" as const,
      properties: {
        file_path: {
          type: "string",
          description: "Hedef dosya yolu",
        },
        content: {
          type: "string",
          description: "Eklenecek içerik",
        },
        create_if_missing: {
          type: "boolean",
          description: "Dosya yoksa oluştur",
          default: true,
        },
      },
      required: ["file_path", "content"],
    },
  },
];
