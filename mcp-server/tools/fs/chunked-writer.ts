/**
 * Filesystem Tools - Chunked Writer
 * 
 * Large file handling with chunks
 */

import { writeFile, appendFile, access, readFile, unlink } from "fs/promises";
import { dirname } from "path";
import { mkdir } from "fs/promises";
import { logToolError } from "../../utils/mcp-logger.js";
import { createProgress } from "../../utils/progress.js";

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
      await writeFile(tempPath, chunks[i] || '', "utf-8");
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

// Tool Definitions
export const CREATE_CHUNKED_FILE_TOOL = {
  name: "hev_fs_create_chunked",
  description: "Büyük dosyaları parçalar halinde oluştur",
  inputSchema: {
    type: "object" as const,
    properties: {
      file_path: { type: "string", description: "Hedef dosya yolu" },
      chunks: { type: "array", items: { type: "string" }, description: "İçerik parçaları" },
      overwrite: { type: "boolean", description: "Üzerine yaz", default: false }
    },
    required: ["file_path", "chunks"]
  }
};

export const APPEND_CHUNK_TOOL = {
  name: "hev_fs_append_chunk",
  description: "Dosyaya içerik ekle (streaming)",
  inputSchema: {
    type: "object" as const,
    properties: {
      file_path: { type: "string", description: "Hedef dosya yolu" },
      content: { type: "string", description: "Eklenecek içerik" },
      create_if_missing: { type: "boolean", description: "Yoksa oluştur", default: true }
    },
    required: ["file_path", "content"]
  }
};
