import {
  tsGetTypeInfo,
  tsGetDefinition,
  tsGetReferences,
  tsGetCompletions,
  tsGetDiagnostics,
  tsGetRenameEdits,
  tsGetDocumentSymbols,
  tsGetSignatureHelp,
  tsGetStats,
  TS_TYPE_INFO_TOOL,
  TS_GO_TO_DEFINITION_TOOL,
  TS_FIND_REFERENCES_TOOL,
  TS_SAFE_RENAME_TOOL,
  TS_DIAGNOSTICS_TOOL,
  TS_DOCUMENT_SYMBOLS_TOOL,
  TS_COMPLETIONS_TOOL,
  TS_SIGNATURE_HELP_TOOL,
  TS_SERVICE_STATS_TOOL,
} from "../../../tools/dev/index.js";
import type { ToolEntry } from "../../registry.js";

export function createTsLanguageDevTools(projectRoot: string): ToolEntry[] {
  return [
    {
      definition: TS_TYPE_INFO_TOOL,
      handler: (args): unknown => {
        const a = args as Record<string, unknown>;
        const result = tsGetTypeInfo(
          projectRoot,
          a["file_path"] as string,
          a["line"] as number,
          a["column"] as number
        );
        return { content: [{ type: "text", text: result }] };
      },
    },
    {
      definition: TS_GO_TO_DEFINITION_TOOL,
      handler: (args): unknown => {
        const a = args as Record<string, unknown>;
        const result = tsGetDefinition(
          projectRoot,
          a["file_path"] as string,
          a["line"] as number,
          a["column"] as number
        );
        return { content: [{ type: "text", text: result }] };
      },
    },
    {
      definition: TS_FIND_REFERENCES_TOOL,
      handler: (args): unknown => {
        const a = args as Record<string, unknown>;
        const result = tsGetReferences(
          projectRoot,
          a["file_path"] as string,
          a["line"] as number,
          a["column"] as number
        );
        return { content: [{ type: "text", text: result }] };
      },
    },
    {
      definition: TS_SAFE_RENAME_TOOL,
      handler: (args): unknown => {
        const a = args as Record<string, unknown>;
        const result = tsGetRenameEdits(
          projectRoot,
          a["file_path"] as string,
          a["line"] as number,
          a["column"] as number,
          a["new_name"] as string
        );
        return { content: [{ type: "text", text: result }] };
      },
    },
    {
      definition: TS_DIAGNOSTICS_TOOL,
      handler: (args): unknown => {
        const a = args as Record<string, unknown>;
        const result = tsGetDiagnostics(projectRoot, a["file_path"] as string);
        return { content: [{ type: "text", text: result }] };
      },
    },
    {
      definition: TS_DOCUMENT_SYMBOLS_TOOL,
      handler: (args): unknown => {
        const a = args as Record<string, unknown>;
        const result = tsGetDocumentSymbols(projectRoot, a["file_path"] as string);
        return { content: [{ type: "text", text: result }] };
      },
    },
    {
      definition: TS_COMPLETIONS_TOOL,
      handler: (args): unknown => {
        const a = args as Record<string, unknown>;
        const result = tsGetCompletions(
          projectRoot,
          a["file_path"] as string,
          a["line"] as number,
          a["column"] as number,
          (a["max_items"] as number | undefined) ?? undefined
        );
        return { content: [{ type: "text", text: result }] };
      },
    },
    {
      definition: TS_SIGNATURE_HELP_TOOL,
      handler: (args): unknown => {
        const a = args as Record<string, unknown>;
        const result = tsGetSignatureHelp(
          projectRoot,
          a["file_path"] as string,
          a["line"] as number,
          a["column"] as number
        );
        return { content: [{ type: "text", text: result }] };
      },
    },
    {
      definition: TS_SERVICE_STATS_TOOL,
      handler: (): unknown => {
        const result = tsGetStats(projectRoot);
        return { content: [{ type: "text", text: result }] };
      },
    },
  ];
}
