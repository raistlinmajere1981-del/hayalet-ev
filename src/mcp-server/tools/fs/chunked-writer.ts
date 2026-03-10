import { writeFile, access, readFile, unlink } from "fs/promises";
import { dirname } from "path";
import { mkdir } from "fs/promises";
import { logToolError } from "../../utils/mcp-logger.js";
import { createProgress } from "../../utils/progress.js";
import { createMcpTranslator, createMcpTranslatorSync } from "../../utils/i18n/index.js";
import type { TranslationParams } from "../../../types/i18n.js";

type McpTranslator = (key: string, params?: TranslationParams) => string;

function fsChunkT(t: McpTranslator, key: string, params?: TranslationParams): string {
  return t(`mcpServer.fs.chunked.${key}`, params);
}

const chunkedToolDefinitionTranslator = createMcpTranslatorSync();

function chunkedToolDefinitionT(key: string, params?: TranslationParams): string {
  return chunkedToolDefinitionTranslator(`mcpServer.fs.toolDefinitions.${key}`, params);
}

export async function createChunkedFile(
  filePath: string,
  chunks: string[],
  projectRoot: string,
  overwrite: boolean = false
): Promise<{ success: boolean; message: string; chunkCount: number }> {
  const progress = createProgress({ operation: "hev_fs_create_chunked", total: 100 });
  const tempDir = `${projectRoot}/.tmp_chunks`;
  const tempFiles: string[] = [];
  const t = await createMcpTranslator();

  try {
    progress.log(fsChunkT(t, "create.joiningChunks", { chunkCount: chunks.length }));

    if (!overwrite) {
      try {
        await access(filePath);
        return {
          success: false,
          message: fsChunkT(t, "create.fileExists", { filePath }),
          chunkCount: 0,
        };
      } catch {}
    }

    await mkdir(tempDir, { recursive: true });

    for (let i = 0; i < chunks.length; i++) {
      const tempPath = `${tempDir}/chunk_${String(i).padStart(4, "0")}.tmp`;
      // eslint-disable-next-line no-await-in-loop
      await writeFile(tempPath, chunks[i] ?? "", "utf-8");
      tempFiles.push(tempPath);
      progress.update(
        Math.round(((i + 1) / chunks.length) * 50),
        fsChunkT(t, "create.chunkWritten", {
          chunkIndex: i + 1,
          chunkCount: chunks.length,
        })
      );
    }

    await mkdir(dirname(filePath), { recursive: true });

    progress.update(60, fsChunkT(t, "create.mergingChunks"));
    let fullContent = "";

    for (const tempPath of tempFiles) {
      // eslint-disable-next-line no-await-in-loop
      const chunk = await readFile(tempPath, "utf-8");
      fullContent += chunk;
    }

    progress.update(80, fsChunkT(t, "create.writingFile"));
    await writeFile(filePath, fullContent, "utf-8");

    progress.update(90, fsChunkT(t, "create.cleaningTempFiles"));

    for (const tempPath of tempFiles) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await unlink(tempPath);
      } catch {}
    }

    const finalSize = Buffer.byteLength(fullContent, "utf-8");
    progress.done(
      fsChunkT(t, "create.successProgress", {
        filePath,
        chunkCount: chunks.length,
        finalSize,
      })
    );

    return {
      success: true,
      message: fsChunkT(t, "create.successMessage", {
        filePath,
        chunkCount: chunks.length,
        finalSize,
      }),
      chunkCount: chunks.length,
    };
  } catch (error) {
    for (const tempPath of tempFiles) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await unlink(tempPath);
      } catch {}
    }
    const err = error as Error;
    progress.fail(err.message);
    logToolError("hev_fs_create_chunked", err, { filePath, chunkCount: chunks.length });
    return {
      success: false,
      message: fsChunkT(t, "create.error", { message: err.message }),
      chunkCount: 0,
    };
  }
}

export async function appendChunk(
  filePath: string,
  content: string,
  createIfMissing: boolean = true
): Promise<{ success: boolean; message: string }> {
  const t = await createMcpTranslator();
  try {
    let existingContent = "";
    try {
      existingContent = await readFile(filePath, "utf-8");
    } catch {
      if (!createIfMissing) {
        return { success: false, message: fsChunkT(t, "append.fileNotFound", { filePath }) };
      }
      await mkdir(dirname(filePath), { recursive: true });
    }

    await writeFile(filePath, existingContent + content, "utf-8");
    return {
      success: true,
      message: fsChunkT(t, "append.success", {
        filePath,
        addedBytes: Buffer.byteLength(content, "utf-8"),
      }),
    };
  } catch (error) {
    const err = error as Error;
    logToolError("hev_fs_append_chunk", err, { filePath });
    return { success: false, message: fsChunkT(t, "append.error", { message: err.message }) };
  }
}

export const CREATE_CHUNKED_FILE_TOOL = {
  name: "hev_fs_create_chunked",
  description: chunkedToolDefinitionT("chunkedCreate.description"),
  inputSchema: {
    type: "object" as const,
    properties: {
      file_path: { type: "string", description: chunkedToolDefinitionT("chunkedCreate.filePath") },
      chunks: {
        type: "array",
        items: { type: "string" },
        description: chunkedToolDefinitionT("chunkedCreate.chunks"),
      },
      overwrite: {
        type: "boolean",
        description: chunkedToolDefinitionT("chunkedCreate.overwrite"),
        default: false,
      },
    },
    required: ["file_path", "chunks"],
  },
  metadata: {
    category: "filesystem",
    subcategory: "chunked-operations",
    priority: "medium",
    complexity: "medium",
    useCases: [
      chunkedToolDefinitionT("chunkedCreate.useCases.createLargeFiles"),
      chunkedToolDefinitionT("chunkedCreate.useCases.chunkBasedCreation"),
      chunkedToolDefinitionT("chunkedCreate.useCases.streamLargeContent"),
    ],
    relatedTools: ["hev_fs_create_chunked", "hev_fs_append_chunk"],
    agentGuidance: chunkedToolDefinitionT("chunkedCreate.agentGuidance"),
    requiresConfirmation: false,
    riskLevel: "low",
    tags: ["chunked", "large-files", "streaming", "token-limit-safe"],
  },
};

export const APPEND_CHUNK_TOOL = {
  name: "hev_fs_append_chunk",
  description: chunkedToolDefinitionT("chunkedAppend.description"),
  inputSchema: {
    type: "object" as const,
    properties: {
      file_path: { type: "string", description: chunkedToolDefinitionT("chunkedAppend.filePath") },
      content: { type: "string", description: chunkedToolDefinitionT("chunkedAppend.content") },
      create_if_missing: {
        type: "boolean",
        description: chunkedToolDefinitionT("chunkedAppend.createIfMissing"),
        default: true,
      },
    },
    required: ["file_path", "content"],
  },
  metadata: {
    category: "filesystem",
    subcategory: "chunked-operations",
  },
};
