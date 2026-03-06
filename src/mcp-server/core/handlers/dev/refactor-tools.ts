import {
  insertCodeWithAST,
  safelyRefactorCode,
  smartInsertCode,
  registerNewTool,
  runCodemod,
  AST_CODE_INSERTER_TOOL,
  SAFE_BATCH_REFACTOR_TOOL,
  SMART_SEARCH_INSERT_TOOL,
  TOOL_REGISTRATION_HELPER_TOOL,
  CODEMOD_TOOL,
} from "../../../tools/dev/index.js";
import type { ToolEntry } from "../../registry.js";

export function createRefactorDevTools(projectRoot: string): ToolEntry[] {
  return [
    {
      definition: AST_CODE_INSERTER_TOOL,
      handler: (args): unknown => {
        const a = args as Record<string, unknown>;
        const result = insertCodeWithAST({
          file_path: a["file_path"] as string,
          after_pattern: a["after_pattern"] as string,
          insert_type: a["insert_type"] as "function" | "method" | "import" | "export" | "if_block",
          code: a["code"] as string,
          ...((a["dry_run"] as boolean | undefined) !== undefined
            ? { dry_run: a["dry_run"] as boolean }
            : {}),
        });
        return {
          content: [{ type: "text", text: result.success ? "✅ Inserted" : "❌ Failed" }],
        };
      },
    },
    {
      definition: SAFE_BATCH_REFACTOR_TOOL,
      handler: async (args): Promise<unknown> => {
        const a = args as Record<string, unknown>;
        const operations = (a["operations"] as Array<Record<string, unknown>>).map((op) => ({
          pattern: op["pattern"] as string,
          replace_with: op["replace_with"] as string,
          ...((op["target_lines"] as number[] | undefined) !== undefined
            ? { target_lines: op["target_lines"] as number[] }
            : {}),
          ...((op["mode"] as "string" | "ast" | undefined) !== undefined
            ? { mode: op["mode"] as "string" | "ast" }
            : {}),
          ...((op["ast_type"] as "function_call" | "variable" | "import" | undefined) !== undefined
            ? { ast_type: op["ast_type"] as "function_call" | "variable" | "import" }
            : {}),
        }));
        const result = await safelyRefactorCode(
          {
            file_path: a["file_path"] as string,
            operations,
            ...((a["verify_after_each"] as boolean | undefined) !== undefined
              ? { verify_after_each: a["verify_after_each"] as boolean }
              : {}),
            ...((a["auto_rollback_on_error"] as boolean | undefined) !== undefined
              ? { auto_rollback_on_error: a["auto_rollback_on_error"] as boolean }
              : {}),
            ...((a["dry_run"] as boolean | undefined) !== undefined
              ? { dry_run: a["dry_run"] as boolean }
              : {}),
          },
          projectRoot
        );
        return {
          content: [{ type: "text", text: result.success ? "✅ Refactored" : "❌ Failed" }],
        };
      },
    },
    {
      definition: SMART_SEARCH_INSERT_TOOL,
      handler: (args): unknown => {
        const a = args as Record<string, unknown>;
        const result = smartInsertCode({
          file_path: a["file_path"] as string,
          anchor: a["anchor"] as string,
          position: a["position"] as "before" | "after" | "inside_start" | "inside_end",
          code: a["code"] as string,
          ...((a["dry_run"] as boolean | undefined) !== undefined
            ? { dry_run: a["dry_run"] as boolean }
            : {}),
        });
        return {
          content: [{ type: "text", text: result.success ? "✅ Inserted" : "❌ Failed" }],
        };
      },
    },
    {
      definition: TOOL_REGISTRATION_HELPER_TOOL,
      handler: (args): unknown => {
        const a = args ?? {};
        const result = registerNewTool(
          {
            tool_name: a["tool_name"] as string,
            description: a["description"] as string,
            function_name: a["function_name"] as string,
            tool_constant: a["tool_constant"] as string,
            ...((a["auto_add_to"] as string | undefined) !== undefined
              ? { auto_add_to: (a["auto_add_to"] as string).split(",") }
              : {}),
            ...((a["test_immediately"] as boolean | undefined) !== undefined
              ? { test_immediately: a["test_immediately"] as boolean }
              : {}),
            ...((a["dry_run"] as boolean | undefined) !== undefined
              ? { dry_run: a["dry_run"] as boolean }
              : {}),
          },
          projectRoot
        );
        return {
          content: [{ type: "text", text: result.success ? "✅ Registered" : "❌ Failed" }],
        };
      },
    },
    {
      definition: CODEMOD_TOOL,
      handler: async (args): Promise<unknown> => {
        const a = args as Record<string, unknown>;
        const transformation = a["transformation"] as Record<string, unknown>;
        const result = await runCodemod({
          file_path: a["file_path"] as string,
          transformation: {
            type: transformation["type"] as
              | "variable"
              | "import"
              | "batch"
              | "function_call"
              | "add_import"
              | "remove_unused",
            ...((transformation["old_name"] as string | undefined) !== undefined
              ? { old_name: transformation["old_name"] as string }
              : {}),
            ...((transformation["new_name"] as string | undefined) !== undefined
              ? { new_name: transformation["new_name"] as string }
              : {}),
            ...((transformation["old_source"] as string | undefined) !== undefined
              ? { old_source: transformation["old_source"] as string }
              : {}),
            ...((transformation["new_source"] as string | undefined) !== undefined
              ? { new_source: transformation["new_source"] as string }
              : {}),
            ...((transformation["imports"] as string[] | undefined) !== undefined
              ? { imports: transformation["imports"] as string[] }
              : {}),
            ...((transformation["source"] as string | undefined) !== undefined
              ? { source: transformation["source"] as string }
              : {}),
            ...(Array.isArray(transformation["operations"])
              ? {
                  operations: (transformation["operations"] as Array<Record<string, unknown>>).map(
                    (op) => ({
                      type: op["type"] as "variable" | "import" | "function_call",
                      ...((op["old_name"] as string | undefined) !== undefined
                        ? { old_name: op["old_name"] as string }
                        : {}),
                      ...((op["new_name"] as string | undefined) !== undefined
                        ? { new_name: op["new_name"] as string }
                        : {}),
                      ...((op["old_source"] as string | undefined) !== undefined
                        ? { old_source: op["old_source"] as string }
                        : {}),
                      ...((op["new_source"] as string | undefined) !== undefined
                        ? { new_source: op["new_source"] as string }
                        : {}),
                    })
                  ),
                }
              : {}),
          },
          ...((a["dry_run"] as boolean | undefined) !== undefined
            ? { dry_run: a["dry_run"] as boolean }
            : {}),
          ...((a["validate_syntax"] as boolean | undefined) !== undefined
            ? { validate_syntax: a["validate_syntax"] as boolean }
            : {}),
        });
        return {
          content: [{ type: "text", text: result.success ? "✅ Codemod applied" : "❌ Failed" }],
        };
      },
    },
  ];
}
