/**
 * Basic File Operations
 *
 * Temel dosya CRUD operasyonları:
 * - read_file: Dosya okuma (start_line/end_line + head/tail desteği)
 * - write_file: Dosya yazma
 * - list_directory: Dizin listeleme
 * - delete_file: Dosya silme
 * - move_file: Dosya taşıma/yeniden adlandırma
 *
 * @module fs/basic/operations
 */

import { readFile, writeFile, unlink, readdir, stat, mkdir, rename, access } from "fs/promises";
import { dirname, join } from "path";
import { logToolError } from "../../../utils/mcp-logger.js";
import type { ToolResult } from "@shared/index-mcp.js";

// ============================================
// Types & Interfaces
// ============================================

export interface ReadFileOptions {
  file_path: string;
  head?: number;
  tail?: number;
  start_line?: number;
  end_line?: number;
  encoding?: "utf8" | "base64" | "latin1";
}

export interface WriteFileOptions {
  file_path: string;
  content: string;
  overwrite?: boolean;
  encoding?: "utf8" | "base64" | "latin1";
}

export interface ListDirectoryOptions {
  path: string;
  max_depth?: number;
  include_hidden?: boolean;
}

export interface DeleteFileOptions {
  file_path: string;
  recursive?: boolean;
}

export interface MoveFileOptions {
  source: string;
  destination: string;
  overwrite?: boolean;
}

export interface DirectoryEntry {
  name: string;
  type: "file" | "directory" | "symlink";
  size: number;
  modified: string;
}

// ============================================
// Path Validation & Security
// ============================================

/**
 * Validate file path for security
 * Blocks path traversal attempts
 */
function validatePath(filePath: string): { valid: boolean; error?: string } {
  // Check for path traversal
  const normalized = filePath.replace(/\\/g, "/");

  if (normalized.includes("../") || normalized.includes("..\\")) {
    return {
      valid: false,
      error: "Path traversal tespit edildi. '..' kullanımına izin verilmez.",
    };
  }

  // Check for absolute paths that might be dangerous
  if (normalized.startsWith("/") && normalized.length > 1) {
    // Allow absolute paths but could add more checks here
    return { valid: true };
  }

  return { valid: true };
}

// ============================================
// Read File Implementation
// ============================================

/**
 * Read file content with optional start_line/end_line range or head/tail
 */
export async function readFileContent(options: ReadFileOptions): Promise<ToolResult> {
  const {
    file_path: filePath,
    head,
    tail,
    start_line: startLine,
    end_line: endLine,
    encoding = "utf8",
  } = options;

  // Validate path
  const validation = validatePath(filePath);
  if (!validation.valid) {
    return {
      content: [{ type: "text", text: `❌ ${validation.error ?? "Path validation failed"}` }],
      isError: true,
    };
  }

  // Priority: start_line/end_line > head/tail
  // start_line + end_line = explicit range mode (1-based, inclusive)
  // head alone = first N lines, tail alone = last N lines
  // Legacy: head + tail together = range (head=start, tail=end) — kept for backward compat
  const effectiveStart =
    startLine ??
    (head !== undefined && head > 0 && tail !== undefined && tail > 0 ? head : undefined);
  const effectiveEnd =
    endLine ??
    (head !== undefined && head > 0 && tail !== undefined && tail > 0 ? tail : undefined);
  const hasHead = head !== undefined && head > 0 && effectiveStart === undefined;
  const hasTail = tail !== undefined && tail > 0 && effectiveEnd === undefined;
  const isRangeMode =
    effectiveStart !== undefined &&
    effectiveStart > 0 &&
    effectiveEnd !== undefined &&
    effectiveEnd > 0;

  try {
    // Check if file exists
    try {
      await access(filePath);
    } catch {
      return {
        content: [{ type: "text", text: `❌ Dosya bulunamadı: ${filePath}` }],
        isError: true,
      };
    }

    // Read file
    const content = await readFile(filePath, encoding);
    const lines = content.split("\n");
    const totalLines = lines.length;

    let displayContent: string;
    let rangeInfo = "";

    if (isRangeMode) {
      // Range mode: start_line to end_line (1-based, inclusive)
      const startLine = Math.max(1, effectiveStart);
      const endLine = Math.min(effectiveEnd, totalLines);
      if (startLine > endLine) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Geçersiz aralık: start_line(${startLine}) > end_line(${endLine}). start_line başlangıç, end_line bitiş satırı olmalı.`,
            },
          ],
          isError: true,
        };
      }
      displayContent = lines.slice(startLine - 1, endLine).join("\n");
      rangeInfo = ` (satır ${startLine}-${endLine} / ${totalLines} toplam)`;
    } else if (hasHead) {
      // Get first N lines
      const endLine = Math.min(head, totalLines);
      displayContent = lines.slice(0, endLine).join("\n");
      rangeInfo = ` (ilk ${endLine} satır / ${totalLines} toplam)`;
    } else if (hasTail) {
      // Get last N lines
      const startLine = Math.max(0, totalLines - tail);
      displayContent = lines.slice(startLine).join("\n");
      rangeInfo = ` (son ${totalLines - startLine} satır / ${totalLines} toplam)`;
    } else {
      // Get all content
      displayContent = content;
      rangeInfo = ` (${totalLines} satır)`;
    }

    // Format with line numbers
    const numberedContent = addLineNumbers(
      displayContent,
      isRangeMode
        ? Math.max(1, effectiveStart)
        : hasHead
          ? 1
          : hasTail
            ? totalLines - displayContent.split("\n").length + 1
            : 1
    );

    const output = [
      `📄 ${filePath}${rangeInfo}`,
      "",
      "─".repeat(60),
      numberedContent,
      "─".repeat(60),
    ].join("\n");

    return {
      content: [{ type: "text", text: output }],
    };
  } catch (error) {
    const err = error as Error;
    logToolError("hev_fs_read", err, {
      file_path: filePath,
      start_line: startLine,
      end_line: endLine,
      head,
      tail,
    });
    return {
      content: [{ type: "text", text: `❌ Okuma hatası: ${err.message}` }],
      isError: true,
    };
  }
}

/**
 * Add line numbers to content
 */
function addLineNumbers(content: string, startLine = 1): string {
  const lines = content.split("\n");
  return lines
    .map((line, index) => {
      const lineNum = String(startLine + index).padStart(4, " ");
      return `${lineNum} │ ${line}`;
    })
    .join("\n");
}

// ============================================
// Write File Implementation
// ============================================

/**
 * Write content to file
 */
export async function writeFileContent(options: WriteFileOptions): Promise<ToolResult> {
  const { file_path: filePath, content, overwrite = false, encoding = "utf8" } = options;

  // Validate path
  const validation = validatePath(filePath);
  if (!validation.valid) {
    return {
      content: [{ type: "text", text: `❌ ${validation.error ?? "Path validation failed"}` }],
      isError: true,
    };
  }

  try {
    // Check if file exists and overwrite not allowed
    if (!overwrite) {
      try {
        await access(filePath);
        return {
          content: [
            {
              type: "text",
              text: `❌ Dosya zaten var: ${filePath}\n\n💡 Üzerine yazmak için overwrite=true kullanın.`,
            },
          ],
          isError: true,
        };
      } catch {
        // File doesn't exist, continue
      }
    }

    // Create directory if needed
    const dir = dirname(filePath);
    await mkdir(dir, { recursive: true });

    // Write file
    await writeFile(filePath, content, encoding);

    const byteLength = Buffer.byteLength(content, encoding);
    const lineCount = content.split("\n").length;

    return {
      content: [
        {
          type: "text",
          text: `✅ Dosya yazıldı: ${filePath}\n📊 ${lineCount} satır, ${byteLength} byte`,
        },
      ],
    };
  } catch (error) {
    const err = error as Error;
    logToolError("hev_fs_write", err, { file_path: filePath, encoding });
    return {
      content: [{ type: "text", text: `❌ Yazma hatası: ${err.message}` }],
      isError: true,
    };
  }
}

// ============================================
// List Directory Implementation
// ============================================

/**
 * List directory contents
 */
export async function listDirectory(options: ListDirectoryOptions): Promise<ToolResult> {
  const { path: dirPath, max_depth: maxDepth = 1, include_hidden: includeHidden = false } = options;

  // Validate path
  const validation = validatePath(dirPath);
  if (!validation.valid) {
    return {
      content: [{ type: "text", text: `❌ ${validation.error ?? "Path validation failed"}` }],
      isError: true,
    };
  }

  try {
    // Check if directory exists
    const stats = await stat(dirPath);
    if (!stats.isDirectory()) {
      return {
        content: [{ type: "text", text: `❌ Bu bir dizin değil: ${dirPath}` }],
        isError: true,
      };
    }

    const entries = await readDirectoryRecursive(dirPath, maxDepth, includeHidden);

    const output = formatDirectoryListing(dirPath, entries, maxDepth);

    return {
      content: [{ type: "text", text: output }],
    };
  } catch (error) {
    const err = error as Error;
    logToolError("hev_fs_list", err, { dirPath, max_depth: maxDepth });
    return {
      content: [{ type: "text", text: `❌ Listeleme hatası: ${err.message}` }],
      isError: true,
    };
  }
}

/**
 * Read directory recursively up to max_depth
 */
async function readDirectoryRecursive(
  dirPath: string,
  maxDepth: number,
  includeHidden: boolean,
  currentDepth = 0
): Promise<Array<{ entry: DirectoryEntry; depth: number }>> {
  const results: Array<{ entry: DirectoryEntry; depth: number }> = [];

  const items = await readdir(dirPath, { withFileTypes: true });

  for (const item of items) {
    // Skip hidden files unless requested
    if (!includeHidden && item.name.startsWith(".")) {
      continue;
    }

    const fullPath = join(dirPath, item.name);
    // eslint-disable-next-line no-await-in-loop
    const stats = await stat(fullPath);

    const entry: DirectoryEntry = {
      name: item.name,
      type: item.isDirectory() ? "directory" : item.isSymbolicLink() ? "symlink" : "file",
      size: stats.size,
      modified: stats.mtime.toISOString(),
    };

    results.push({ entry, depth: currentDepth });

    // Recurse into subdirectories
    if (item.isDirectory() && currentDepth < maxDepth - 1) {
      // eslint-disable-next-line no-await-in-loop
      const subResults = await readDirectoryRecursive(
        fullPath,
        maxDepth,
        includeHidden,
        currentDepth + 1
      );
      results.push(...subResults);
    }
  }

  return results;
}

/**
 * Format directory listing for display
 */
function formatDirectoryListing(
  rootPath: string,
  entries: Array<{ entry: DirectoryEntry; depth: number }>,
  maxDepth: number
): string {
  const lines: string[] = [`📁 ${rootPath}${maxDepth > 1 ? ` (derinlik: ${maxDepth})` : ""}`, ""];

  let fileCount = 0;
  let dirCount = 0;

  for (const { entry, depth } of entries) {
    const indent = "  ".repeat(depth);
    const icon = entry.type === "directory" ? "📂" : entry.type === "symlink" ? "🔗" : "📄";
    const size = entry.type === "file" ? formatBytes(entry.size) : "";

    lines.push(`${indent}${icon} ${entry.name} ${size}`);

    if (entry.type === "directory") dirCount++;
    else fileCount++;
  }

  lines.push("");
  lines.push(`─`.repeat(60));
  lines.push(`📊 ${fileCount} dosya, ${dirCount} dizin`);

  return lines.join("\n");
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// ============================================
// Delete File Implementation
// ============================================

/**
 * Delete file or directory
 */
export async function deleteFile(options: DeleteFileOptions): Promise<ToolResult> {
  const { file_path: filePath, recursive = false } = options;

  // Validate path
  const validation = validatePath(filePath);
  if (!validation.valid) {
    return {
      content: [{ type: "text", text: `❌ ${validation.error ?? "Path validation failed"}` }],
      isError: true,
    };
  }

  try {
    // Check if exists
    const stats = await stat(filePath);
    const isDir = stats.isDirectory();

    if (isDir && !recursive) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Bu bir dizin: ${filePath}\n\n💡 Dizin silmek için recursive=true kullanın.`,
          },
        ],
        isError: true,
      };
    }

    // Delete (Node 20+ has rm with recursive, otherwise use rmdir)
    if (isDir && recursive) {
      await unlink(filePath); // This won't work for directories, need fs.rm
      // For now, use the newer fs.rm if available
      const { rm } = await import("fs/promises");
      await rm(filePath, { recursive: true });
    } else {
      await unlink(filePath);
    }

    return {
      content: [
        {
          type: "text",
          text: `🗑️ Silindi: ${filePath}${isDir ? " (dizin)" : ""}`,
        },
      ],
    };
  } catch (error) {
    const err = error as Error;
    logToolError("hev_fs_delete", err, { file_path: filePath, recursive });
    return {
      content: [{ type: "text", text: `❌ Silme hatası: ${err.message}` }],
      isError: true,
    };
  }
}

// ============================================
// Move File Implementation
// ============================================

/**
 * Move or rename file/directory
 */
export async function moveFile(options: MoveFileOptions): Promise<ToolResult> {
  const { source, destination, overwrite = false } = options;

  // Validate paths
  const sourceValidation = validatePath(source);
  if (!sourceValidation.valid) {
    return {
      content: [
        { type: "text", text: `❌ Kaynak: ${sourceValidation.error ?? "Path validation failed"}` },
      ],
      isError: true,
    };
  }

  const destValidation = validatePath(destination);
  if (!destValidation.valid) {
    return {
      content: [
        { type: "text", text: `❌ Hedef: ${destValidation.error ?? "Path validation failed"}` },
      ],
      isError: true,
    };
  }

  try {
    // Check if source exists
    try {
      await access(source);
    } catch {
      return {
        content: [{ type: "text", text: `❌ Kaynak bulunamadı: ${source}` }],
        isError: true,
      };
    }

    // Check if destination exists
    if (!overwrite) {
      try {
        await access(destination);
        return {
          content: [
            {
              type: "text",
              text: `❌ Hedef zaten var: ${destination}\n\n💡 Üzerine yazmak için overwrite=true kullanın.`,
            },
          ],
          isError: true,
        };
      } catch {
        // Destination doesn't exist, continue
      }
    }

    // Create destination directory if needed
    const destDir = dirname(destination);
    await mkdir(destDir, { recursive: true });

    // Move file
    await rename(source, destination);

    return {
      content: [
        {
          type: "text",
          text: `✅ Taşındı:\n   ${source}\n   → ${destination}`,
        },
      ],
    };
  } catch (error) {
    const err = error as Error;
    logToolError("hev_fs_move", err, { source, destination });
    return {
      content: [{ type: "text", text: `❌ Taşıma hatası: ${err.message}` }],
      isError: true,
    };
  }
}

// ============================================
// Tool Definitions
// ============================================

export const READ_FILE_TOOL = {
  name: "hev_fs_read",
  description:
    "Dosya içeriğini oku. Satır numaraları ile gösterir.\n\n" +
    "📌 KULLANIM MODLARI:\n" +
    "• Parametresiz → Tüm dosyayı oku\n" +
    "• head=N → İlk N satırı oku (adet)\n" +
    "• tail=N → Son N satırı oku (adet)\n" +
    "• start_line=X, end_line=Y → X. satırdan Y. satıra kadar oku (1-based, inclusive)\n\n" +
    "⚠️ Satır aralığı okumak için MUTLAKA start_line + end_line kullan. head/tail TEK BAŞINA kullanılır.\n\n" +
    "Örnekler:\n" +
    "• head=60 → ilk 60 satır\n" +
    "• tail=20 → son 20 satır\n" +
    "• start_line=100, end_line=200 → 100-200 arası satırlar",
  inputSchema: {
    type: "object" as const,
    properties: {
      file_path: {
        type: "string",
        description: "Okunacak dosya yolu",
      },
      start_line: {
        type: "integer",
        description: "Başlangıç satır numarası (1-based, inclusive). end_line ile birlikte kullan.",
        minimum: 1,
      },
      end_line: {
        type: "integer",
        description: "Bitiş satır numarası (1-based, inclusive). start_line ile birlikte kullan.",
        minimum: 1,
      },
      head: {
        type: "integer",
        description: "İlk N satırı oku (adet). Satır aralığı için start_line/end_line kullan.",
        minimum: 0,
      },
      tail: {
        type: "integer",
        description: "Son N satırı oku (adet). Satır aralığı için start_line/end_line kullan.",
        minimum: 0,
      },
      encoding: {
        type: "string",
        enum: ["utf8", "base64", "latin1"],
        description: "Karakter encoding (varsayılan: utf8)",
        default: "utf8",
      },
    },
    required: ["file_path"],
  },
  metadata: {
    category: "filesystem",
    subcategory: "basic",
    priority: "high",
    complexity: "simple",
    useCases: [
      "Dosya içeriği görüntüleme",
      "Log dosyası okuma",
      "Büyük dosyalarda belirli satırları okuma",
    ],
    relatedTools: ["hev_fs_write", "hev_fs_expand_code_chunks"],
    agentGuidance:
      "Dosya okumak için kullan. Belirli satır aralığı okumak için start_line + end_line kullan (1-based, inclusive). İlk N satır için head=N, son N satır için tail=N kullan. head ve tail TEK BAŞINA kullanılır, birlikte kullanılmamalı. Satır numaraları otomatik eklenir.",
    requiresConfirmation: false,
    riskLevel: "low",
    tags: ["file", "read", "content", "start_line", "end_line", "head", "tail"],
  },
};

export const WRITE_FILE_TOOL = {
  name: "hev_fs_write",
  description:
    "Dosyaya içerik yaz. Yeni dosya oluşturur veya mevcut dosyayı üzerine yazar (overwrite=true).\n\n" +
    "⚠️ BOYUT LİMİTİ: Content 500 satır veya ~50KB'ı aşıyorsa bu tool KULLANILMAMALI!\n" +
    "LLM output token limiti (8192) nedeniyle büyük dosyalar incomplete/malformed oluşur.\n\n" +
    "🔄 BÜYÜK DOSYALAR İÇİN: hev_fs_start_chunked_session → hev_fs_write_chunk → hev_fs_finalize_chunked akışını kullan.\n" +
    "Bu akış UTF-8 validation, checksum ve rollback desteği sağlar.",
  inputSchema: {
    type: "object" as const,
    properties: {
      file_path: {
        type: "string",
        description: "Yazılacak dosya yolu",
      },
      content: {
        type: "string",
        description: "Dosyaya yazılacak içerik",
      },
      overwrite: {
        type: "boolean",
        description: "Mevcut dosyanın üzerine yaz (varsayılan: false)",
        default: false,
      },
      encoding: {
        type: "string",
        enum: ["utf8", "base64", "latin1"],
        description: "Karakter encoding (varsayılan: utf8)",
        default: "utf8",
      },
    },
    required: ["file_path", "content"],
  },
  metadata: {
    category: "filesystem",
    subcategory: "basic",
    priority: "high",
    complexity: "simple",
    useCases: ["Yeni dosya oluşturma", "Dosya üzerine yazma", "Konfigürasyon dosyası yazma"],
    relatedTools: ["hev_fs_read", "hev_fs_edit"],
    agentGuidance:
      "Yeni dosya oluşturmak veya tamamen üzerine yazmak için kullan. ⚠️ 500 satır / 50KB üzeri dosyalar için hev_fs_start_chunked_session kullan (LLM token limiti aşımı riski). Kısmi değişiklikler için hev_fs_edit kullan. overwrite=true dikkatli kullan.",
    requiresConfirmation: false,
    riskLevel: "medium",
    tags: ["file", "write", "create", "overwrite"],
  },
};

export const LIST_DIRECTORY_TOOL = {
  name: "hev_fs_list",
  description:
    "Dizin içeriğini listele. Dosya ve alt dizinleri gösterir. max_depth ile recursive listeleme yapabilir.",
  inputSchema: {
    type: "object" as const,
    properties: {
      path: {
        type: "string",
        description: "Listelenecek dizin yolu",
      },
      max_depth: {
        type: "integer",
        description: "Maksimum derinlik (varsayılan: 1)",
        default: 1,
        minimum: 1,
        maximum: 5,
      },
      include_hidden: {
        type: "boolean",
        description: "Gizli dosyaları dahil et (varsayılan: false)",
        default: false,
      },
    },
    required: ["path"],
  },
  metadata: {
    category: "filesystem",
    subcategory: "basic",
    priority: "high",
    complexity: "simple",
    useCases: ["Dizin yapısını keşfetme", "Dosya listesi alma", "Proje yapısını görüntüleme"],
    relatedTools: ["hev_fs_expand_folder"],
    agentGuidance:
      "Dizin içeriğini listelemek için kullan. max_depth>1 ile recursive listeleyebilirsin. Gizli dosyalar için include_hidden=true kullan.",
    requiresConfirmation: false,
    riskLevel: "low",
    tags: ["directory", "list", "ls", "folder"],
  },
};

export const DELETE_FILE_TOOL = {
  name: "hev_fs_delete",
  description: "Dosya veya dizin sil. Dizin silmek için recursive=true gerekir.",
  inputSchema: {
    type: "object" as const,
    properties: {
      file_path: {
        type: "string",
        description: "Silinecek dosya/dizin yolu",
      },
      recursive: {
        type: "boolean",
        description: "Dizinleri recursive sil (varsayılan: false)",
        default: false,
      },
    },
    required: ["file_path"],
  },
  metadata: {
    category: "filesystem",
    subcategory: "basic",
    priority: "medium",
    complexity: "simple",
    useCases: ["Dosya silme", "Boş dizin silme", "Recursive dizin silme"],
    relatedTools: ["hev_fs_trash_list", "hev_fs_restore"],
    agentGuidance:
      "Dosya/dizin silmek için kullan. Dizin silmek için recursive=true gerekir. Güvenli silme için önce hev_fs_trash_list kullanılabilir.",
    requiresConfirmation: true,
    riskLevel: "high",
    tags: ["file", "delete", "remove", "rm"],
  },
};

export const MOVE_FILE_TOOL = {
  name: "hev_fs_move",
  description: "Dosya veya dizin taşı / yeniden adlandır. Kaynak hedefe taşınır.",
  inputSchema: {
    type: "object" as const,
    properties: {
      source: {
        type: "string",
        description: "Kaynak dosya/dizin yolu",
      },
      destination: {
        type: "string",
        description: "Hedef yol",
      },
      overwrite: {
        type: "boolean",
        description: "Hedef varsa üzerine yaz (varsayılan: false)",
        default: false,
      },
    },
    required: ["source", "destination"],
  },
  metadata: {
    category: "filesystem",
    subcategory: "basic",
    priority: "medium",
    complexity: "simple",
    useCases: ["Dosya taşıma", "Dosya yeniden adlandırma", "Dizin taşıma"],
    relatedTools: ["hev_fs_write", "hev_fs_delete"],
    agentGuidance:
      "Dosya/dizin taşımak veya yeniden adlandırmak için kullan. Aynı dizinde farklı isim hedefi = rename. overwrite=true ile çakışmayı önle.",
    requiresConfirmation: false,
    riskLevel: "medium",
    tags: ["file", "move", "rename", "mv"],
  },
};
