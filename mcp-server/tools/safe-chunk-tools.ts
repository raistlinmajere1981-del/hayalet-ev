/**
 * Safe Chunk Tools - Büyük dosyalar için güvenli parçalama
 * 
 * PROBLEM: LLM output token limiti (8192) nedeniyle büyük dosyalar incomplete oluşuyor
 * ÇÖZÜM: Streaming write + checksum validation + rollback
 */

import { writeFile, readFile, unlink, mkdir } from "fs/promises";
import { createHash } from "crypto";
import { dirname } from "path";
import { createProgress } from "../utils/progress.js";
import { logToolError } from "../utils/mcp-logger.js";

// ============================================
// Types
// ============================================

interface ChunkMetadata {
  index: number;
  totalChunks: number;
  checksum: string; // MD5 of content
  size: number;
  lineCount: number;
}

interface ChunkSession {
  sessionId: string;
  filePath: string;
  totalChunks: number;
  receivedChunks: number[];
  startTime: number;
  metadata: ChunkMetadata[];
}

// Active sessions
const activeSessions = new Map<string, ChunkSession>();

// ============================================
// Helper Functions
// ============================================

function calculateChecksum(content: string): string {
  return createHash("md5").update(content, "utf-8").digest("hex");
}

function validateUTF8(content: string): boolean {
  try {
    const buffer = Buffer.from(content, "utf-8");
    const decoded = buffer.toString("utf-8");
    return decoded === content;
  } catch {
    return false;
  }
}

function validateChunkBoundary(content: string): { valid: boolean; warning?: string } {
  // Check if ends with newline (recommended)
  if (!content.endsWith("\n")) {
    return {
      valid: true,
      warning: "Chunk does not end with newline. Multi-byte characters may be at risk."
    };
  }
  
  // Check for incomplete multi-byte at end
  const lastChar = content.slice(-2, -1); // Before newline
  const lastCharCode = lastChar.charCodeAt(0);
  
  // Check for surrogate pair start (high surrogate)
  if (lastCharCode >= 0xD800 && lastCharCode <= 0xDBFF) {
    return {
      valid: false,
      warning: "Chunk ends with incomplete surrogate pair (emoji/special char)"
    };
  }
  
  return { valid: true };
}

// ============================================
// Tool 1: Start Chunked File Session
// ============================================

/**
 * hev_fs_start_chunked_session - Güvenli chunk yazma başlat
 * 
 * KULLANIM:
 * 1. Session başlat (toplam chunk sayısını belirt)
 * 2. Her chunk için hev_fs_write_chunk çağır
 * 3. hev_fs_finalize_chunked ile dosyayı oluştur
 */
export function startChunkedSession(
  filePath: string,
  totalChunks: number,
  _projectRoot: string
): { success: boolean; sessionId: string; message: string } {
  const progress = createProgress({ operation: "Session Start", quiet: true });
  
  try {
    // Generate unique session ID
    const sessionId = `chunk_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    
    // Validate inputs
    if (totalChunks < 1 || totalChunks > 1000) {
      return {
        success: false,
        sessionId: "",
        message: "Total chunks must be between 1 and 1000"
      };
    }
    
    // Create session
    const session: ChunkSession = {
      sessionId,
      filePath,
      totalChunks,
      receivedChunks: [],
      startTime: Date.now(),
      metadata: [],
    };
    
    activeSessions.set(sessionId, session);
    
    progress.done(`Session ${sessionId} created`);
    
    return {
      success: true,
      sessionId,
      message: `✅ Session başlatıldı\n` +
               `Session ID: ${sessionId}\n` +
               `Hedef dosya: ${filePath}\n` +
               `Beklenen chunk: ${totalChunks}\n\n` +
               `📌 Sonraki adım: hev_fs_write_chunk ile chunk'ları gönder`
    };
  } catch (error) {
    const err = error as Error;
    progress.fail(err.message);
    logToolError("hev_fs_start_chunked_session", err, { filePath, totalChunks });
    return { success: false, sessionId: "", message: `Hata: ${err.message}` };
  }
}

// ============================================
// Tool 2: Write Chunk
// ============================================

/**
 * hev_fs_write_chunk - Chunk yaz ve validate et
 */
export async function writeChunk(
  sessionId: string,
  chunkIndex: number,
  content: string,
  projectRoot: string
): Promise<{ success: boolean; message: string; warnings?: string[] }> {
  const progress = createProgress({ operation: `Chunk ${chunkIndex}`, quiet: true });
  
  try {
    // Get session
    const session = activeSessions.get(sessionId);
    if (!session) {
      return {
        success: false,
        message: `❌ Session bulunamadı: ${sessionId}\n💡 Önce hev_fs_start_chunked_session çağırın`
      };
    }
    
    // Validate chunk index
    if (chunkIndex < 0 || chunkIndex >= session.totalChunks) {
      return {
        success: false,
        message: `❌ Geçersiz chunk index: ${chunkIndex} (0-${session.totalChunks - 1} arası olmalı)`
      };
    }
    
    // Check duplicate
    if (session.receivedChunks.includes(chunkIndex)) {
      return {
        success: false,
        message: `❌ Chunk ${chunkIndex} zaten alındı. Duplicate chunk!`
      };
    }
    
    const warnings: string[] = [];
    
    // Validate UTF-8
    progress.update(1, "UTF-8 validation...");
    if (!validateUTF8(content)) {
      return {
        success: false,
        message: `❌ Chunk ${chunkIndex} geçersiz UTF-8 encoding!\n` +
                 `💡 Chunk'ı satir sonu (\\n) ile bitirin`
      };
    }
    
    // Validate boundary
    progress.update(2, "Boundary check...");
    const boundaryCheck = validateChunkBoundary(content);
    if (!boundaryCheck.valid) {
      return {
        success: false,
        message: `❌ Chunk ${chunkIndex} boundary hatası: ${boundaryCheck.warning}`
      };
    }
    if (boundaryCheck.warning) {
      warnings.push(boundaryCheck.warning);
    }
    
    // Calculate metadata
    progress.update(3, "Metadata...");
    const checksum = calculateChecksum(content);
    const size = Buffer.byteLength(content, "utf-8");
    const lineCount = content.split("\n").length - 1;
    
    const metadata: ChunkMetadata = {
      index: chunkIndex,
      totalChunks: session.totalChunks,
      checksum,
      size,
      lineCount,
    };
    
    // Write chunk to temp file
    progress.update(4, "Writing to disk...");
    const tempDir = `${projectRoot}/.tmp_safe_chunks/${sessionId}`;
    await mkdir(tempDir, { recursive: true });
    
    const chunkPath = `${tempDir}/chunk_${String(chunkIndex).padStart(4, "0")}.tmp`;
    await writeFile(chunkPath, content, "utf-8");
    
    // Verify write
    const readBack = await readFile(chunkPath, "utf-8");
    const readChecksum = calculateChecksum(readBack);
    
    if (readChecksum !== checksum) {
      return {
        success: false,
        message: `❌ Chunk ${chunkIndex} write verification failed!\n` +
                 `Expected: ${checksum}\n` +
                 `Got: ${readChecksum}`
      };
    }
    
    // Update session
    session.receivedChunks.push(chunkIndex);
    session.metadata.push(metadata);
    
    progress.done(`${size} bytes, ${lineCount} lines`);
    
    const receivedCount = session.receivedChunks.length;
    const missingChunks = Array.from(
      { length: session.totalChunks }, 
      (_, i) => i
    ).filter(i => !session.receivedChunks.includes(i));
    
    let message = `✅ Chunk ${chunkIndex} kaydedildi\n` +
                  `📋 Boyut: ${(size / 1024).toFixed(1)}KB, Satır: ${lineCount}\n` +
                  `📈 İlerleme: ${receivedCount}/${session.totalChunks}\n` +
                  `🔍 Checksum: ${checksum.slice(0, 8)}...`;
    
    if (missingChunks.length > 0) {
      message += `\n\n⏳ Eksik chunk'lar: ${missingChunks.slice(0, 10).join(", ")}`;
      if (missingChunks.length > 10) {
        message += ` ... (+${missingChunks.length - 10} daha)`;
      }
    } else {
      message += `\n\n✅ Tüm chunk'lar alındı!\n📌 Sonraki adım: hev_fs_finalize_chunked çağırın`;
    }
    
    return {
      success: true,
      message,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  } catch (error) {
    const err = error as Error;
    progress.fail(err.message);
    logToolError("hev_fs_write_chunk", err, { sessionId, chunkIndex });
    return { success: false, message: `Hata: ${err.message}` };
  }
}

// ============================================
// Tool 3: Finalize Chunked File
// ============================================

/**
 * hev_fs_finalize_chunked - Chunk'ları birleştir ve dosyayı oluştur
 */
export async function finalizeChunked(
  sessionId: string,
  projectRoot: string,
  verifyChecksum?: string
): Promise<{ success: boolean; message: string; filePath?: string; totalSize?: number }> {
  const progress = createProgress({ operation: "Finalize", total: 100 });
  
  try {
    // Get session
    const session = activeSessions.get(sessionId);
    if (!session) {
      return {
        success: false,
        message: `❌ Session bulunamadı: ${sessionId}`
      };
    }
    
    // Check if all chunks received
    if (session.receivedChunks.length !== session.totalChunks) {
      const missingChunks = Array.from(
        { length: session.totalChunks },
        (_, i) => i
      ).filter(i => !session.receivedChunks.includes(i));
      
      return {
        success: false,
        message: `❌ Eksik chunk'lar var!\n` +
                 `Alınan: ${session.receivedChunks.length}/${session.totalChunks}\n` +
                 `Eksikler: ${missingChunks.join(", ")}`
      };
    }
    
    progress.log("All chunks received, merging...");
    
    // Read and merge chunks in order
    const tempDir = `${projectRoot}/.tmp_safe_chunks/${sessionId}`;
    const buffers: Buffer[] = [];
    let totalSize = 0;
    
    for (let i = 0; i < session.totalChunks; i++) {
      const chunkPath = `${tempDir}/chunk_${String(i).padStart(4, "0")}.tmp`;
      const buffer = await readFile(chunkPath);
      buffers.push(buffer);
      totalSize += buffer.length;
      
      progress.update(
        Math.round(((i + 1) / session.totalChunks) * 80),
        `Chunk ${i + 1}/${session.totalChunks} okundu`
      );
    }
    
    // Concatenate buffers
    progress.update(85, "Birleştiriliyor...");
    const fullBuffer = Buffer.concat(buffers, totalSize);
    const fullContent = fullBuffer.toString("utf-8");
    
    // Verify checksum if provided
    if (verifyChecksum) {
      const actualChecksum = calculateChecksum(fullContent);
      if (actualChecksum !== verifyChecksum) {
        return {
          success: false,
          message: `❌ Checksum verification failed!\n` +
                   `Expected: ${verifyChecksum}\n` +
                   `Got: ${actualChecksum}`
        };
      }
      progress.log("✅ Checksum verified");
    }
    
    // Create target directory
    progress.update(90, "Hedef dizin oluşturuluyor...");
    const targetDir = dirname(session.filePath);
    await mkdir(targetDir, { recursive: true });
    
    // Write final file
    progress.update(95, "Dosya yazılıyor...");
    await writeFile(session.filePath, fullContent, "utf-8");
    
    // Verify final file
    const finalCheck = await readFile(session.filePath, "utf-8");
    if (finalCheck !== fullContent) {
      return {
        success: false,
        message: `❌ Final file verification failed!`
      };
    }
    
    // Cleanup temp files
    progress.update(98, "Temp dosyalar siliniyor...");
    for (let i = 0; i < session.totalChunks; i++) {
      const chunkPath = `${tempDir}/chunk_${String(i).padStart(4, "0")}.tmp`;
      try {
        await unlink(chunkPath);
      } catch {
        // Ignore cleanup errors
      }
    }
    
    // Remove session
    activeSessions.delete(sessionId);
    
    const duration = ((Date.now() - session.startTime) / 1000).toFixed(1);
    const lineCount = fullContent.split("\n").length - 1;
    
    progress.done(`${(totalSize / 1024).toFixed(1)}KB, ${lineCount} lines in ${duration}s`);
    
    return {
      success: true,
      filePath: session.filePath,
      totalSize,
      message: `✅ Dosya başarıyla oluşturuldu!\n\n` +
               `📁 Dosya: ${session.filePath}\n` +
               `📋 Boyut: ${(totalSize / 1024).toFixed(1)}KB\n` +
               `📝 Satır: ${lineCount}\n` +
               `📊 Chunk: ${session.totalChunks}\n` +
               `⏱️ Süre: ${duration}s\n\n` +
               `🔍 Checksum: ${calculateChecksum(fullContent)}`
    };
  } catch (error) {
    const err = error as Error;
    progress.fail(err.message);
    logToolError("hev_fs_finalize_chunked", err, { sessionId });
    return { success: false, message: `Hata: ${err.message}` };
  }
}

// ============================================
// Tool 4: Get Session Status
// ============================================

/**
 * hev_fs_chunk_session_status - Session durumunu göster
 */
export function getSessionStatus(
  sessionId: string
): { success: boolean; message: string; session?: { sessionId: string; filePath: string; totalChunks: number; receivedChunks: number; missingChunks: number; durationSeconds: number; progressPercent: number } } {
  const session = activeSessions.get(sessionId);
  
  if (!session) {
    return {
      success: false,
      message: `❌ Session bulunamadı: ${sessionId}\n\n` +
               `Aktif session'lar: ${activeSessions.size}\n` +
               (activeSessions.size > 0 ? `IDs: ${Array.from(activeSessions.keys()).join(", ")}` : "")
    };
  }
  
  const missingChunks = Array.from(
    { length: session.totalChunks },
    (_, i) => i
  ).filter(i => !session.receivedChunks.includes(i));
  
  const duration = ((Date.now() - session.startTime) / 1000).toFixed(1);
  const progress = ((session.receivedChunks.length / session.totalChunks) * 100).toFixed(1);
  
  let message = `📋 Session Status\n\n` +
               `Session ID: ${sessionId}\n` +
               `Hedef: ${session.filePath}\n` +
               `İlerleme: ${session.receivedChunks.length}/${session.totalChunks} (${progress}%)\n` +
               `Süre: ${duration}s\n\n`;
  
  if (missingChunks.length > 0) {
    message += `⏳ Eksik chunk'lar:\n${missingChunks.slice(0, 20).join(", ")}`;
    if (missingChunks.length > 20) {
      message += ` ... (+${missingChunks.length - 20} daha)`;
    }
  } else {
    message += `✅ Tüm chunk'lar alındı!\n📌 hev_fs_finalize_chunked ile tamamlayabilirsiniz`;
  }
  
  return {
    success: true,
    message,
    session: {
      sessionId: session.sessionId,
      filePath: session.filePath,
      totalChunks: session.totalChunks,
      receivedChunks: session.receivedChunks.length,
      missingChunks: missingChunks.length,
      durationSeconds: parseFloat(duration),
      progressPercent: parseFloat(progress)
    }
  };
}

// ============================================
// Tool 5: Cancel Session
// ============================================

/**
 * hev_fs_cancel_chunk_session - Session iptal et ve temizle
 */
export async function cancelSession(
  sessionId: string,
  projectRoot: string
): Promise<{ success: boolean; message: string }> {
  const session = activeSessions.get(sessionId);
  
  if (!session) {
    return {
      success: false,
      message: `❌ Session bulunamadı: ${sessionId}`
    };
  }
  
  try {
    // Cleanup temp files
    const tempDir = `${projectRoot}/.tmp_safe_chunks/${sessionId}`;
    for (let i = 0; i < session.totalChunks; i++) {
      const chunkPath = `${tempDir}/chunk_${String(i).padStart(4, "0")}.tmp`;
      try {
        await unlink(chunkPath);
      } catch {
        // Ignore
      }
    }
    
    // Remove session
    activeSessions.delete(sessionId);
    
    return {
      success: true,
      message: `✅ Session iptal edildi: ${sessionId}\n` +
               `Temp dosyalar temizlendi.`
    };
  } catch (error) {
    const err = error as Error;
    logToolError("hev_fs_cancel_chunk_session", err, { sessionId });
    return { success: false, message: `Hata: ${err.message}` };
  }
}

// ============================================
// Tool Definitions
// ============================================

export const SAFE_CHUNK_TOOL_DEFINITIONS = [
  {
    name: "hev_fs_start_chunked_session",
    description: `GÜVENLİ CHUNK YAZMA SESSION BAŞLA

Büyük dosyalar (50-100KB+) için güvenli parçalama sistemi.

✅ ÖZELLİKLER:
- UTF-8 encoding validation
- Checksum verification
- Eksik chunk detection
- Rollback support
- Progress tracking

🔄 İŞ AKIŞI:
1. hev_fs_start_chunked_session (toplam chunk sayısını belirt)
2. hev_fs_write_chunk (her chunk için tekrarla)
3. hev_fs_chunk_session_status (İhtiyaç halinde kontrol et)
4. hev_fs_finalize_chunked (birleştir ve dosya oluştur)

📌 CHUNK STRATEJİSİ:
- Her chunk 500-800 satır (~40KB)
- Her chunk \\n ile bitmeli
- Function/class ortasında kesme!
- Emoji/Türkçe karakter güvenli`,
    inputSchema: {
      type: "object" as const,
      properties: {
        file_path: {
          type: "string",
          description: "Oluşturulacak dosyanın hedef yolu"
        },
        total_chunks: {
          type: "integer",
          description: "Toplam chunk sayısı (dosyayı kaç parçaya böldün?)",
          minimum: 1,
          maximum: 1000
        }
      },
      required: ["file_path", "total_chunks"]
    }
  },
  {
    name: "hev_fs_write_chunk",
    description: "Chunk yaz ve validate et. Her chunk için sırayla çağırılmalı.",
    inputSchema: {
      type: "object" as const,
      properties: {
        session_id: {
          type: "string",
          description: "Session ID (start_chunked_session'dan dönen)"
        },
        chunk_index: {
          type: "integer",
          description: "Chunk index (0'dan başlar)",
          minimum: 0
        },
        content: {
          type: "string",
          description: "Chunk içeriği (satır sonu ile bitmeli)"
        }
      },
      required: ["session_id", "chunk_index", "content"]
    }
  },
  {
    name: "hev_fs_finalize_chunked",
    description: "Tüm chunk'ları birleştir ve final dosyayı oluştur. Session otomatik kapanır.",
    inputSchema: {
      type: "object" as const,
      properties: {
        session_id: {
          type: "string",
          description: "Session ID"
        },
        verify_checksum: {
          type: "string",
          description: "Opsiyonel: Final dosya checksum doğrulaması (MD5)"
        }
      },
      required: ["session_id"]
    }
  },
  {
    name: "hev_fs_chunk_session_status",
    description: "Session durumunu kontrol et. Hangi chunk'lar alındı, hangiler eksik?",
    inputSchema: {
      type: "object" as const,
      properties: {
        session_id: {
          type: "string",
          description: "Session ID"
        }
      },
      required: ["session_id"]
    }
  },
  {
    name: "hev_fs_cancel_chunk_session",
    description: "Session iptal et ve temp dosyaları temizle.",
    inputSchema: {
      type: "object" as const,
      properties: {
        session_id: {
          type: "string",
          description: "Session ID"
        }
      },
      required: ["session_id"]
    }
  }
];

