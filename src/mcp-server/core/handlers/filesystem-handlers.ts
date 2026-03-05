/**
 * Filesystem Tool Handlers
 * File I/O, grep, bash, trash, diff, chunked operations
 *
 * Co-located: definition + handler in ToolEntry format
 * Tool definitions imported from modular fs/ files (single source of truth)
 */

import { expandCodeChunks } from "../../tools/fs/code-operations.js";
import { createChunkedFile, appendChunk } from "../../tools/fs/chunked-writer.js";
import { trashList, restoreFile, trashEmpty } from "../../tools/fs/trash-manager.js";
import { backupFile, undoOperation, operationHistory } from "../../tools/fs/history-manager.js";
import { fileDiff, contentDiff } from "../../tools/fs/diff-tools.js";
import { createTechnicalPlan } from "../../tools/fs/plan-creator.js";
import { executeBash } from "../../tools/fs/bash-executor.js";

import {
  startChunkedSession,
  writeChunk,
  finalizeChunked,
  getSessionStatus,
  cancelSession,
  SAFE_CHUNK_TOOL_DEFINITIONS,
} from "../../tools/safe-chunk-tools.js";

import { sanitizeContent } from "../../tools/fs/shared/helpers.js";

import {
  readFileContent,
  writeFileContent,
  listDirectory,
  deleteFile,
  moveFile,
} from "../../tools/fs/basic/operations.js";
import { editFileContent } from "../../tools/fs/basic/edit.js";

// Tool definitions from modular files
import {
  EXPAND_CODE_CHUNKS_TOOL,
  CREATE_PLAN_TOOL,
  TRASH_LIST_TOOL,
  RESTORE_FILE_TOOL,
  TRASH_EMPTY_TOOL,
  BACKUP_FILE_TOOL,
  UNDO_OPERATION_TOOL,
  OPERATION_HISTORY_TOOL,
  FILE_DIFF_TOOL,
  CONTENT_DIFF_TOOL,
  CREATE_CHUNKED_FILE_TOOL,
  APPEND_CHUNK_TOOL,
  BASH_EXECUTOR_TOOL,
} from "../../tools/fs/index.js";

import {
  READ_FILE_TOOL,
  WRITE_FILE_TOOL,
  LIST_DIRECTORY_TOOL,
  DELETE_FILE_TOOL,
  MOVE_FILE_TOOL,
} from "../../tools/fs/basic/operations.js";
import { EDIT_FILE_TOOL } from "../../tools/fs/basic/edit.js";

import type { TechnicalPlan } from "@shared/index-mcp.js";
import type { ToolEntry, ToolContext } from "../registry.js";

export function createFilesystemTools(context: ToolContext): ToolEntry[] {
  const { PROJECT_ROOT } = context;

  return [
    // ─── Code Operations ─────────────────────────────────
    {
      definition: EXPAND_CODE_CHUNKS_TOOL,
      handler: async (args): Promise<unknown> => {
        const result = await expandCodeChunks(
          (args as { file_path: string }).file_path,
          (args as { line_ranges?: [number, number][] }).line_ranges ?? [],
          (args as { patterns?: string[] }).patterns ?? []
        );
        return { content: [{ type: "text", text: result.error ?? result.content }] };
      },
    },

    // ─── Plan Creator ────────────────────────────────────
    {
      definition: CREATE_PLAN_TOOL,
      handler: (args): unknown => {
        const rawPlan = (args as { plan: TechnicalPlan | string }).plan;
        const technicalPlan =
          typeof rawPlan === "string" ? (JSON.parse(rawPlan) as TechnicalPlan) : rawPlan;
        const result = createTechnicalPlan(technicalPlan);
        return { content: [{ type: "text", text: result.summary }] };
      },
    },

    // ─── Trash Management ────────────────────────────────
    {
      definition: TRASH_LIST_TOOL,
      handler: (): unknown => {
        const result = trashList(PROJECT_ROOT);
        if (result.total === 0) {
          return { content: [{ type: "text", text: "🗑️ Çöp kutusu boş" }] };
        }
        let output = `🗑️ Çöp Kutusu (${result.total} dosya)\n\n`;
        result.items.forEach((item, i) => {
          output += `${i}. ${item.path} (${item.size}) - ${item.deletedAt}\n`;
        });
        return { content: [{ type: "text", text: output }] };
      },
    },
    {
      definition: RESTORE_FILE_TOOL,
      handler: (args): unknown => {
        const result = restoreFile(PROJECT_ROOT, (args as { index?: number }).index);
        return { content: [{ type: "text", text: result.message }] };
      },
    },
    {
      definition: TRASH_EMPTY_TOOL,
      handler: (args): unknown => {
        const result = trashEmpty(
          PROJECT_ROOT,
          (args as { older_than_days?: number }).older_than_days
        );
        return { content: [{ type: "text", text: result.message }] };
      },
    },

    // ─── History & Backup ────────────────────────────────
    {
      definition: BACKUP_FILE_TOOL,
      handler: (args): unknown => {
        const result = backupFile(PROJECT_ROOT, (args as { file_path: string }).file_path);
        return { content: [{ type: "text", text: result.message }] };
      },
    },
    {
      definition: UNDO_OPERATION_TOOL,
      handler: (): unknown => {
        const result = undoOperation(PROJECT_ROOT);
        return { content: [{ type: "text", text: result.message }] };
      },
    },
    {
      definition: OPERATION_HISTORY_TOOL,
      handler: (args): unknown => {
        const result = operationHistory(PROJECT_ROOT, (args as { limit?: number }).limit ?? 20);
        if (result.operations.length === 0) {
          return { content: [{ type: "text", text: "📋 İşlem geçmişi boş" }] };
        }
        let output = `📋 Son ${result.operations.length} İşlem\n\n`;
        result.operations.forEach((op, i) => {
          const undoIcon = op.canUndo ? "↩️" : "✓";
          output += `${i + 1}. ${undoIcon} ${op.type} - ${op.timestamp}\n`;
        });
        return { content: [{ type: "text", text: output }] };
      },
    },

    // ─── Diff Tools ──────────────────────────────────────
    {
      definition: FILE_DIFF_TOOL,
      handler: (args): unknown => {
        const result = fileDiff(
          (args as { file1: string }).file1,
          (args as { file2: string }).file2
        );
        return { content: [{ type: "text", text: result.summary }] };
      },
    },
    {
      definition: CONTENT_DIFF_TOOL,
      handler: (args): unknown => {
        const result = contentDiff(
          (args as { content1: string }).content1,
          (args as { content2: string }).content2,
          (args as { label1?: string }).label1,
          (args as { label2?: string }).label2
        );
        if (result.identical) {
          return { content: [{ type: "text", text: "✅ İçerikler aynı" }] };
        }
        return {
          content: [
            {
              type: "text",
              text: `📊 ${result.additions} ekleme, ${result.deletions} silme\n\n${result.unified}`,
            },
          ],
        };
      },
    },

    // ─── Chunked Write ───────────────────────────────────
    {
      definition: CREATE_CHUNKED_FILE_TOOL,
      handler: async (args): Promise<unknown> => {
        const rawChunks = (args as { chunks: string[] }).chunks;
        const sanitizedChunks = rawChunks.map((chunk) => sanitizeContent(chunk));
        const result = await createChunkedFile(
          (args as { file_path: string }).file_path,
          sanitizedChunks,
          PROJECT_ROOT,
          (args as { overwrite?: boolean }).overwrite
        );
        return { content: [{ type: "text", text: result.message }] };
      },
    },
    {
      definition: APPEND_CHUNK_TOOL,
      handler: async (args): Promise<unknown> => {
        const result = await appendChunk(
          (args as { file_path: string }).file_path,
          sanitizeContent((args as { content: string }).content),
          (args as { create_if_missing?: boolean }).create_if_missing
        );
        return { content: [{ type: "text", text: result.message }] };
      },
    },

    // ─── Safe Chunked Session ────────────────────────────
    {
      definition: SAFE_CHUNK_TOOL_DEFINITIONS[0], // hev_fs_start_chunked_session
      handler: (args): unknown => {
        const result = startChunkedSession(
          (args as { file_path: string }).file_path,
          (args as { total_chunks: number }).total_chunks,
          PROJECT_ROOT
        );
        return { content: [{ type: "text", text: result.message }] };
      },
    },
    {
      definition: SAFE_CHUNK_TOOL_DEFINITIONS[1], // hev_fs_write_chunk
      handler: async (args): Promise<unknown> => {
        const result = await writeChunk(
          (args as { session_id: string }).session_id,
          (args as { chunk_index: number }).chunk_index,
          sanitizeContent((args as { content: string }).content),
          PROJECT_ROOT
        );
        let msg = result.message;
        if (result.warnings && result.warnings.length > 0) {
          msg += "\n\n⚠️ Uyarılar:\n" + result.warnings.join("\n");
        }
        return { content: [{ type: "text", text: msg }] };
      },
    },
    {
      definition: SAFE_CHUNK_TOOL_DEFINITIONS[2], // hev_fs_finalize_chunked
      handler: async (args): Promise<unknown> => {
        const result = await finalizeChunked(
          (args as { session_id: string }).session_id,
          PROJECT_ROOT,
          (args as { verify_checksum?: string }).verify_checksum
        );
        return { content: [{ type: "text", text: result.message }] };
      },
    },
    {
      definition: SAFE_CHUNK_TOOL_DEFINITIONS[3], // hev_fs_chunk_session_status
      handler: (args): unknown => {
        const result = getSessionStatus((args as { session_id: string }).session_id);
        return { content: [{ type: "text", text: result.message }] };
      },
    },
    {
      definition: SAFE_CHUNK_TOOL_DEFINITIONS[4], // hev_fs_cancel_chunk_session
      handler: async (args): Promise<unknown> => {
        const result = await cancelSession(
          (args as { session_id: string }).session_id,
          PROJECT_ROOT
        );
        return { content: [{ type: "text", text: result.message }] };
      },
    },

    // ─── Bash Executor ──────────────────────────────────
    {
      definition: BASH_EXECUTOR_TOOL,
      handler: async (args): Promise<unknown> => {
        const result = await executeBash(
          (args as { command: string }).command,
          PROJECT_ROOT,
          (args as { timeout?: number }).timeout
        );
        let output = "";
        if (typeof result.stdout === "string" && result.stdout.length > 0) output += result.stdout;
        if (typeof result.stderr === "string" && result.stderr.length > 0) {
          output += (output.length > 0 ? "\n" : "") + "⚠️ stderr:\n" + result.stderr;
        }
        if (output.length === 0) output = `✅ Komut tamamlandı (exit code: ${result.exitCode})`;
        if (result.timedOut === true) output = `⏰ Komut zaman aşımına uğradı\n` + output;
        if (typeof result.pid === "number") output += `\n(PID: ${result.pid})`;
        return {
          content: [{ type: "text", text: output }],
          isError: result.exitCode !== 0,
        };
      },
    },

    // ─── Basic File Operations ───────────────────────────
    {
      definition: READ_FILE_TOOL,
      handler: async (args): Promise<unknown> => {
        return await readFileContent({
          file_path: (args as { file_path: string }).file_path,
          ...((args as { start_line?: number }).start_line !== undefined
            ? { start_line: (args as { start_line?: number }).start_line as number }
            : {}),
          ...((args as { end_line?: number }).end_line !== undefined
            ? { end_line: (args as { end_line?: number }).end_line as number }
            : {}),
          ...((args as { head?: number }).head !== undefined
            ? { head: (args as { head?: number }).head as number }
            : {}),
          ...((args as { tail?: number }).tail !== undefined
            ? { tail: (args as { tail?: number }).tail as number }
            : {}),
          encoding: (args as { encoding?: "utf8" | "base64" | "latin1" }).encoding ?? "utf8",
        });
      },
    },
    {
      definition: WRITE_FILE_TOOL,
      handler: async (args): Promise<unknown> => {
        return await writeFileContent({
          file_path: (args as { file_path: string }).file_path,
          content: sanitizeContent((args as { content: string }).content),
          overwrite: (args as { overwrite?: boolean }).overwrite ?? false,
          encoding: (args as { encoding?: "utf8" | "base64" | "latin1" }).encoding ?? "utf8",
        });
      },
    },
    {
      definition: LIST_DIRECTORY_TOOL,
      handler: async (args): Promise<unknown> => {
        return await listDirectory({
          path: (args as { path: string }).path,
          max_depth: (args as { max_depth?: number }).max_depth ?? 1,
          include_hidden: (args as { include_hidden?: boolean }).include_hidden ?? false,
        });
      },
    },
    {
      definition: DELETE_FILE_TOOL,
      handler: async (args): Promise<unknown> => {
        return await deleteFile({
          file_path: (args as { file_path: string }).file_path,
          recursive: (args as { recursive?: boolean }).recursive ?? false,
        });
      },
    },
    {
      definition: MOVE_FILE_TOOL,
      handler: async (args): Promise<unknown> => {
        return await moveFile({
          source: (args as { source: string }).source,
          destination: (args as { destination: string }).destination,
          overwrite: (args as { overwrite?: boolean }).overwrite ?? false,
        });
      },
    },
    {
      definition: EDIT_FILE_TOOL,
      handler: async (args): Promise<unknown> => {
        const a = args as {
          file_path: string;
          edits: Array<{ old_text?: string; new_text?: string; find?: string; replace?: string }>;
          dry_run?: boolean;
          ignore_whitespace?: boolean;
          all_or_nothing?: boolean;
          match_scope?: "first" | "last" | "all" | number[];
          normalize_eol?: "lf" | "crlf" | "auto" | "preserve";
        };
        // Normalize: accept both old_text/new_text and find/replace field names
        const normalizedEdits = a.edits.map((e) => ({
          old_text: e.old_text ?? e.find ?? "",
          new_text: e.new_text ?? e.replace ?? "",
        }));
        return await editFileContent({
          file_path: a.file_path,
          edits: normalizedEdits,
          dry_run: a.dry_run ?? false,
          ignore_whitespace: a.ignore_whitespace ?? false,
          all_or_nothing: a.all_or_nothing ?? false,
          match_scope: a.match_scope ?? "all",
          normalize_eol: a.normalize_eol ?? "auto",
        });
      },
    },
  ];
}
