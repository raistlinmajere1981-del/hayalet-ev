import { expandCodeChunks } from "../../../tools/fs/code-operations.js";
import { createChunkedFile, appendChunk } from "../../../tools/fs/chunked-writer.js";
import { trashList, restoreFile, trashEmpty } from "../../../tools/fs/trash-manager.js";
import { backupFile, undoOperation, operationHistory } from "../../../tools/fs/history-manager.js";
import { fileDiff, contentDiff } from "../../../tools/fs/diff-tools.js";
import { createTechnicalPlan } from "../../../tools/fs/plan-creator.js";
import { executeBash } from "../../../tools/fs/bash-executor.js";
import { createMcpTranslator } from "../../../utils/i18n/index.js";
import {
  startChunkedSession,
  writeChunk,
  finalizeChunked,
  getSessionStatus,
  cancelSession,
  SAFE_CHUNK_TOOL_DEFINITIONS,
} from "../../../tools/safe-chunk-tools.js";
import { sanitizeContent } from "../../../tools/fs/shared/helpers.js";
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
} from "../../../tools/fs/index.js";
import type { TechnicalPlan } from "@shared/index-mcp.js";
import type { ToolEntry } from "../../registry.js";
import type { TranslationParams } from "../../../../types/i18n.js";

type McpTranslator = (key: string, params?: TranslationParams) => string;

function fsT(t: McpTranslator, key: string, params?: TranslationParams): string {
  return t(`mcpServer.fs.${key}`, params);
}

export function createFilesystemMiscTools(projectRoot: string): ToolEntry[] {
  return [
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
    {
      definition: TRASH_LIST_TOOL,
      handler: async (): Promise<unknown> => {
        const t = await createMcpTranslator();
        const result = trashList(projectRoot);
        if (result.total === 0) {
          return { content: [{ type: "text", text: fsT(t, "trash.listEmpty") }] };
        }
        let output = `${fsT(t, "trash.listTitle", { total: result.total })}\n\n`;
        result.items.forEach((item, i) => {
          output += `${i}. ${item.path} (${item.size}) - ${item.deletedAt}\n`;
        });
        return { content: [{ type: "text", text: output }] };
      },
    },
    {
      definition: RESTORE_FILE_TOOL,
      handler: async (args): Promise<unknown> => {
        const result = await restoreFile(projectRoot, (args as { index?: number }).index);
        return { content: [{ type: "text", text: result.message }] };
      },
    },
    {
      definition: TRASH_EMPTY_TOOL,
      handler: async (args): Promise<unknown> => {
        const result = await trashEmpty(
          projectRoot,
          (args as { older_than_days?: number }).older_than_days
        );
        return { content: [{ type: "text", text: result.message }] };
      },
    },
    {
      definition: BACKUP_FILE_TOOL,
      handler: (args): unknown => {
        const result = backupFile(projectRoot, (args as { file_path: string }).file_path);
        return { content: [{ type: "text", text: result.message }] };
      },
    },
    {
      definition: UNDO_OPERATION_TOOL,
      handler: (): unknown => {
        const result = undoOperation(projectRoot);
        return { content: [{ type: "text", text: result.message }] };
      },
    },
    {
      definition: OPERATION_HISTORY_TOOL,
      handler: async (args): Promise<unknown> => {
        const t = await createMcpTranslator();
        const result = operationHistory(projectRoot, (args as { limit?: number }).limit ?? 20);
        if (result.operations.length === 0) {
          return { content: [{ type: "text", text: fsT(t, "misc.operationHistoryEmpty") }] };
        }
        let output = `${fsT(t, "misc.operationHistoryTitle", {
          count: result.operations.length,
        })}\n\n`;
        result.operations.forEach((op, i) => {
          const undoIcon = op.canUndo ? "↩️" : "✓";
          output += `${i + 1}. ${undoIcon} ${op.type} - ${op.timestamp}\n`;
        });
        return { content: [{ type: "text", text: output }] };
      },
    },
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
      handler: async (args): Promise<unknown> => {
        const t = await createMcpTranslator();
        const result = contentDiff(
          (args as { content1: string }).content1,
          (args as { content2: string }).content2,
          (args as { label1?: string }).label1,
          (args as { label2?: string }).label2
        );
        if (result.identical) {
          return { content: [{ type: "text", text: fsT(t, "misc.contentIdentical") }] };
        }
        return {
          content: [
            {
              type: "text",
              text: `${fsT(t, "misc.contentDiffSummary", {
                additions: result.additions,
                deletions: result.deletions,
              })}\n\n${result.unified}`,
            },
          ],
        };
      },
    },
    {
      definition: CREATE_CHUNKED_FILE_TOOL,
      handler: async (args): Promise<unknown> => {
        const rawChunks = (args as { chunks: string[] }).chunks;
        const sanitizedChunks = rawChunks.map((chunk) => sanitizeContent(chunk));
        const result = await createChunkedFile(
          (args as { file_path: string }).file_path,
          sanitizedChunks,
          projectRoot,
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
    {
      definition: SAFE_CHUNK_TOOL_DEFINITIONS[0],
      handler: (args): unknown => {
        const result = startChunkedSession(
          (args as { file_path: string }).file_path,
          (args as { total_chunks: number }).total_chunks,
          projectRoot
        );
        return { content: [{ type: "text", text: result.message }] };
      },
    },
    {
      definition: SAFE_CHUNK_TOOL_DEFINITIONS[1],
      handler: async (args): Promise<unknown> => {
        const t = await createMcpTranslator();
        const result = await writeChunk(
          (args as { session_id: string }).session_id,
          (args as { chunk_index: number }).chunk_index,
          sanitizeContent((args as { content: string }).content),
          projectRoot
        );
        let msg = result.message;
        if (result.warnings && result.warnings.length > 0) {
          msg += `\n\n${fsT(t, "misc.warningsTitle")}\n${result.warnings.join("\n")}`;
        }
        return { content: [{ type: "text", text: msg }] };
      },
    },
    {
      definition: SAFE_CHUNK_TOOL_DEFINITIONS[2],
      handler: async (args): Promise<unknown> => {
        const result = await finalizeChunked(
          (args as { session_id: string }).session_id,
          projectRoot,
          (args as { verify_checksum?: string }).verify_checksum
        );
        return { content: [{ type: "text", text: result.message }] };
      },
    },
    {
      definition: SAFE_CHUNK_TOOL_DEFINITIONS[3],
      handler: (args): unknown => {
        const result = getSessionStatus((args as { session_id: string }).session_id);
        return { content: [{ type: "text", text: result.message }] };
      },
    },
    {
      definition: SAFE_CHUNK_TOOL_DEFINITIONS[4],
      handler: async (args): Promise<unknown> => {
        const result = await cancelSession(
          (args as { session_id: string }).session_id,
          projectRoot
        );
        return { content: [{ type: "text", text: result.message }] };
      },
    },
    {
      definition: BASH_EXECUTOR_TOOL,
      handler: async (args): Promise<unknown> => {
        const t = await createMcpTranslator();
        const result = await executeBash(
          (args as { command: string }).command,
          projectRoot,
          (args as { timeout?: number }).timeout
        );
        let output = "";
        if (typeof result.stdout === "string" && result.stdout.length > 0) output += result.stdout;
        if (typeof result.stderr === "string" && result.stderr.length > 0) {
          output +=
            (output.length > 0 ? "\n" : "") + `${fsT(t, "misc.stderrTitle")}\n${result.stderr}`;
        }
        if (output.length === 0) {
          output = fsT(t, "misc.commandCompleted", { exitCode: result.exitCode });
        }
        if (result.timedOut === true) output = `${fsT(t, "misc.commandTimedOut")}\n${output}`;
        if (typeof result.pid === "number")
          output += `\n${fsT(t, "misc.pidLine", { pid: result.pid })}`;
        return {
          content: [{ type: "text", text: output }],
          isError: result.exitCode !== 0,
        };
      },
    },
  ];
}
