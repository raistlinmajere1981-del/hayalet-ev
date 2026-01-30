/**
 * Filesystem Tools - Basic I/O Operations
 * 
 * Core file operations: read, create, delete, move
 */

import { access, writeFile, mkdir, unlink, rename } from "fs/promises";
import { dirname } from "path";
import { spawn } from "child_process";
import { readFileWithCollapse } from "../../utils/file-utils.js";
import type { FileContent } from "../../types/index.js";
import { moveToTrash, logOperation } from "../../utils/recycle-utils.js";
import { logToolError } from "../../utils/mcp-logger.js";
import { createProgress } from "../../utils/progress.js";
import { FS_TIMEOUTS } from "../../utils/timeouts.js";

// Content size limits
const MAX_CONTENT_SIZE = 500 * 1024; // 500KB
const WARN_CONTENT_SIZE = 100 * 1024; // 100KB
const BASH_THRESHOLD = 10 * 1024; // 10KB

export async function openFiles(filePaths: string[]): Promise<{ files: FileContent[] }> {
  const results: FileContent[] = [];
  
  for (const filePath of filePaths) {
    const result = await readFileWithCollapse(filePath);
    results.push(result);
  }
  
  return { files: results };
}

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

export const OPEN_FILES_TOOL = {
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
};

export const CREATE_FILE_TOOL = {
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
};
export const DELETE_FILE_TOOL = {
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
};
export const MOVE_FILE_TOOL = {
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
};