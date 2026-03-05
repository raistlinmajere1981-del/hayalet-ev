/**
 * Development Tool Handlers
 * Project analysis, linting, testing, AST operations, refactoring
 *
 * Co-located: definition + handler in ToolEntry format
 * Tool definitions imported from modular dev/ files (single source of truth)
 */

import {
  analyzeProject,
  bootstrapContext,
  generateDiagram,
  updateCache,
  editLines,
  gitDiff,
  lintFile,
  lintProject,
  generateEslintDashboard,
  searchSymbol,
  testRun,
  checkSyntax,
  visualizeStructure,
  fixTypescriptErrors,
  generateTypescriptDashboard,
  analyzeTypeConflicts,
  insertCodeWithAST,
  safelyRefactorCode,
  smartInsertCode,
  registerNewTool,
  runCodemod,
  tsGetTypeInfo,
  tsGetDefinition,
  tsGetReferences,
  tsGetCompletions,
  tsGetDiagnostics,
  tsGetRenameEdits,
  tsGetDocumentSymbols,
  tsGetSignatureHelp,
  tsGetStats,
} from "../../tools/dev/index.js";

// Tool definitions from dev/ modules
import {
  PROJECT_ANALYZER_TOOL,
  CONTEXT_GENERATOR_TOOL,
  DIAGRAM_GENERATOR_TOOL,
  CACHE_MANAGER_TOOL,
  LINE_EDITOR_TOOL,
  GIT_DIFF_TOOL,
  LINTER_TOOL,
  LINT_PROJECT_TOOL,
  ESLINT_DASHBOARD_TOOL,
  SYMBOL_SEARCHER_TOOL,
  TEST_RUNNER_TOOL,
  SYNTAX_CHECKER_TOOL,
  STRUCTURE_VISUALIZER_TOOL,
  TYPESCRIPT_BATCH_FIXER_TOOL,
  TYPESCRIPT_DASHBOARD_TOOL,
  TYPESCRIPT_TYPE_HELPER_TOOL,
  AST_CODE_INSERTER_TOOL,
  SAFE_BATCH_REFACTOR_TOOL,
  SMART_SEARCH_INSERT_TOOL,
  TOOL_REGISTRATION_HELPER_TOOL,
  CODEMOD_TOOL,
  TS_TYPE_INFO_TOOL,
  TS_GO_TO_DEFINITION_TOOL,
  TS_FIND_REFERENCES_TOOL,
  TS_SAFE_RENAME_TOOL,
  TS_DIAGNOSTICS_TOOL,
  TS_DOCUMENT_SYMBOLS_TOOL,
  TS_COMPLETIONS_TOOL,
  TS_SIGNATURE_HELP_TOOL,
  TS_SERVICE_STATS_TOOL,
} from "../../tools/dev/index.js";

import type { ToolEntry, ToolContext } from "../registry.js";

export function createDevTools(context: ToolContext): ToolEntry[] {
  const { PROJECT_ROOT } = context;

  return [
    {
      definition: PROJECT_ANALYZER_TOOL,
      handler: async (args): Promise<unknown> => {
        const result = await analyzeProject(PROJECT_ROOT, args as Record<string, unknown>);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      },
    },
    {
      definition: CONTEXT_GENERATOR_TOOL,
      handler: async (args): Promise<unknown> => {
        const result = await bootstrapContext(PROJECT_ROOT, args as Record<string, unknown>);
        return {
          content: [{ type: "text", text: `✅ Bootstrap completed: ${result.stats.lines} lines` }],
        };
      },
    },
    {
      definition: DIAGRAM_GENERATOR_TOOL,
      handler: async (args): Promise<unknown> => {
        const result = await generateDiagram(PROJECT_ROOT, args as Record<string, unknown>);
        return { content: [{ type: "text", text: result.diagram }] };
      },
    },
    {
      definition: CACHE_MANAGER_TOOL,
      handler: async (args): Promise<unknown> => {
        await updateCache(PROJECT_ROOT, args as Record<string, unknown>);
        return { content: [{ type: "text", text: `✅ Cache updated` }] };
      },
    },
    {
      definition: LINE_EDITOR_TOOL,
      handler: async (args): Promise<unknown> => {
        const a = args as Record<string, unknown>;
        const options = {
          operation: a["operation"] as
            | "replace"
            | "delete"
            | "insert"
            | "insert_after"
            | "insert_before"
            | "show",
          startLine: a["start_line"] as number,
          ...((a["end_line"] as number | undefined) !== undefined
            ? { endLine: a["end_line"] as number }
            : {}),
          ...((a["content"] as string | undefined) !== undefined
            ? { content: a["content"] as string }
            : {}),
          ...((a["dry_run"] as boolean | undefined) !== undefined
            ? { dryRun: a["dry_run"] as boolean }
            : {}),
          ...((a["validate_syntax"] as boolean | undefined) !== undefined
            ? { validateSyntax: a["validate_syntax"] as boolean }
            : {}),
          ...((a["validate_brackets"] as boolean | undefined) !== undefined
            ? { validateBrackets: a["validate_brackets"] as boolean }
            : {}),
          ...((a["safe_mode"] as boolean | undefined) !== undefined
            ? { safeMode: a["safe_mode"] as boolean }
            : {}),
          ...((a["auto_indent"] as boolean | undefined) !== undefined
            ? { autoIndent: a["auto_indent"] as boolean }
            : {}),
          ...((a["force"] as boolean | undefined) !== undefined
            ? { force: a["force"] as boolean }
            : {}),
        };
        const result = await editLines(a["file_path"] as string, options, PROJECT_ROOT);
        let output = result.message;
        if (result.scopeWarnings && result.scopeWarnings.length > 0) {
          output += "\n\nScope Warnings:\n" + result.scopeWarnings.join("\n");
        }
        if (result.bracketIssues && result.bracketIssues.length > 0) {
          output += "\n\nBracket Issues:\n" + result.bracketIssues.join("\n");
        }
        if (typeof result.contextPreview === "string" && result.contextPreview.length > 0) {
          output += "\n\n" + result.contextPreview;
        }
        return { content: [{ type: "text", text: output }] };
      },
    },
    {
      definition: GIT_DIFF_TOOL,
      handler: (args): unknown => {
        const result = gitDiff(PROJECT_ROOT, args as Record<string, unknown>);
        return { content: [{ type: "text", text: result.diff }] };
      },
    },
    {
      definition: LINTER_TOOL,
      handler: (args): unknown => {
        const a = args as Record<string, unknown>;
        const result = lintFile(
          PROJECT_ROOT,
          a["file_path"] as string,
          a["fix"] as boolean | undefined
        );
        return { content: [{ type: "text", text: result.output }] };
      },
    },
    {
      definition: LINT_PROJECT_TOOL,
      handler: (args): unknown => {
        const a = args ?? {};
        const result = lintProject(
          {
            ...((a["pattern"] as string | undefined) !== undefined
              ? { pattern: a["pattern"] as string }
              : {}),
            ...((a["fix"] as boolean | undefined) !== undefined
              ? { fix: a["fix"] as boolean }
              : {}),
            ...((a["max_warnings"] as number | undefined) !== undefined
              ? { max_warnings: a["max_warnings"] as number }
              : {}),
            ...((a["cache"] as boolean | undefined) !== undefined
              ? { cache: a["cache"] as boolean }
              : {}),
            ...((a["format"] as "json" | "stylish" | "compact" | "codeframe" | undefined) !==
            undefined
              ? {
                  format: a["format"] as "json" | "stylish" | "compact" | "codeframe",
                }
              : {}),
          },
          PROJECT_ROOT
        );
        return { content: [{ type: "text", text: result.output }] };
      },
    },
    {
      definition: ESLINT_DASHBOARD_TOOL,
      handler: (args): unknown => {
        const a = args ?? {};
        const result = generateEslintDashboard(
          {
            ...((a["pattern"] as string | undefined) !== undefined
              ? { pattern: a["pattern"] as string }
              : {}),
            ...((a["sort_by"] as "count" | "severity" | "file" | undefined) !== undefined
              ? { sort_by: a["sort_by"] as "count" | "severity" | "file" }
              : {}),
            ...((a["group_by"] as "file" | "rule" | "category" | undefined) !== undefined
              ? { group_by: a["group_by"] as "file" | "rule" | "category" }
              : {}),
            ...((a["limit"] as number | undefined) !== undefined
              ? { limit: a["limit"] as number }
              : {}),
            ...((a["show_fixable"] as boolean | undefined) !== undefined
              ? { show_fixable: a["show_fixable"] as boolean }
              : {}),
          },
          PROJECT_ROOT
        );
        return { content: [{ type: "text", text: result.output }] };
      },
    },
    {
      definition: SYMBOL_SEARCHER_TOOL,
      handler: async (args): Promise<unknown> => {
        const a = args as Record<string, unknown>;
        const result = await searchSymbol(PROJECT_ROOT, a["symbol"] as string, {
          ...((a["type"] as
            | "function"
            | "class"
            | "interface"
            | "type"
            | "const"
            | "all"
            | undefined) !== undefined
            ? {
                type: a["type"] as "function" | "class" | "interface" | "type" | "const" | "all",
              }
            : {}),
        });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      },
    },
    {
      definition: TEST_RUNNER_TOOL,
      handler: (args): unknown => {
        const a = args as Record<string, unknown>;
        const result = testRun(PROJECT_ROOT, {
          ...((a["file"] as string | undefined) !== undefined ? { file: a["file"] as string } : {}),
          ...((a["grep"] as string | undefined) !== undefined ? { grep: a["grep"] as string } : {}),
          ...((a["timeout"] as number | undefined) !== undefined
            ? { timeout: a["timeout"] as number }
            : {}),
        });
        return { content: [{ type: "text", text: result.output }] };
      },
    },
    {
      definition: SYNTAX_CHECKER_TOOL,
      handler: async (args): Promise<unknown> => {
        const a = args as Record<string, unknown>;
        const result = await checkSyntax(a["file_path"] as string, {
          ...((a["check_brackets"] as boolean | undefined) !== undefined
            ? { checkBrackets: a["check_brackets"] as boolean }
            : {}),
          ...((a["check_eslint"] as boolean | undefined) !== undefined
            ? { checkEslint: a["check_eslint"] as boolean }
            : {}),
          ...((a["check_ts"] as boolean | undefined) !== undefined
            ? { checkTs: a["check_ts"] as boolean }
            : {}),
        });
        return { content: [{ type: "text", text: result.output }] };
      },
    },
    {
      definition: STRUCTURE_VISUALIZER_TOOL,
      handler: async (args): Promise<unknown> => {
        const a = args as Record<string, unknown>;
        const filePath = a["file_path"] as string;
        const options = {
          ...((a["show_scopes"] as boolean | undefined) !== undefined
            ? { showScopes: a["show_scopes"] as boolean }
            : {}),
          ...((a["show_brackets"] as boolean | undefined) !== undefined
            ? { showBrackets: a["show_brackets"] as boolean }
            : {}),
          ...((a["show_comments"] as boolean | undefined) !== undefined
            ? { showComments: a["show_comments"] as boolean }
            : {}),
          ...((a["show_strings"] as boolean | undefined) !== undefined
            ? { showStrings: a["show_strings"] as boolean }
            : {}),
          ...((a["max_depth"] as number | undefined) !== undefined
            ? { maxDepth: a["max_depth"] as number }
            : {}),
        };
        const result = await visualizeStructure(PROJECT_ROOT, filePath, options);
        return { content: [{ type: "text", text: result.output }] };
      },
    },
    {
      definition: TYPESCRIPT_BATCH_FIXER_TOOL,
      handler: (args): unknown => {
        const a = args ?? {};
        const result = fixTypescriptErrors(
          {
            file_path: a["file_path"] as string,
            ...((a["error_codes"] as string[] | undefined) !== undefined
              ? { error_codes: a["error_codes"] as string[] }
              : {}),
            ...((a["fix_strategy"] as
              | "add_guards"
              | "add_assertions"
              | "strict_null_check"
              | undefined) !== undefined
              ? {
                  fix_strategy: a["fix_strategy"] as
                    | "add_guards"
                    | "add_assertions"
                    | "strict_null_check",
                }
              : {}),
            ...((a["dry_run"] as boolean | undefined) !== undefined
              ? { dry_run: a["dry_run"] as boolean }
              : {}),
            ...((a["auto_apply"] as boolean | undefined) !== undefined
              ? { auto_apply: a["auto_apply"] as boolean }
              : {}),
          },
          PROJECT_ROOT
        );
        return { content: [{ type: "text", text: result.output }] };
      },
    },
    {
      definition: TYPESCRIPT_DASHBOARD_TOOL,
      handler: (args): unknown => {
        const result = generateTypescriptDashboard(args ?? {}, PROJECT_ROOT);
        return { content: [{ type: "text", text: result.output }] };
      },
    },
    {
      definition: TYPESCRIPT_TYPE_HELPER_TOOL,
      handler: (args): unknown => {
        const a = args ?? {};
        const result = analyzeTypeConflicts(
          {
            file_path: a["file_path"] as string,
            ...((a["show_interfaces"] as boolean | undefined) !== undefined
              ? { show_interfaces: a["show_interfaces"] as boolean }
              : {}),
            ...((a["suggest_fixes"] as boolean | undefined) !== undefined
              ? { suggest_fixes: a["suggest_fixes"] as boolean }
              : {}),
            ...((a["analyze_conflicts"] as boolean | undefined) !== undefined
              ? { analyze_conflicts: a["analyze_conflicts"] as boolean }
              : {}),
          },
          PROJECT_ROOT
        );
        return { content: [{ type: "text", text: result.output }] };
      },
    },
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
          PROJECT_ROOT
        );
        return {
          content: [
            {
              type: "text",
              text: result.success ? "✅ Refactored" : "❌ Failed",
            },
          ],
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
          PROJECT_ROOT
        );
        return {
          content: [
            {
              type: "text",
              text: result.success ? "✅ Registered" : "❌ Failed",
            },
          ],
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
          content: [
            {
              type: "text",
              text: result.success ? "✅ Codemod applied" : "❌ Failed",
            },
          ],
        };
      },
    },
    // ─── TS Language Service Tools ─────────────────────
    {
      definition: TS_TYPE_INFO_TOOL,
      handler: (args): unknown => {
        const a = args as Record<string, unknown>;
        const result = tsGetTypeInfo(
          PROJECT_ROOT,
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
          PROJECT_ROOT,
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
          PROJECT_ROOT,
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
          PROJECT_ROOT,
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
        const result = tsGetDiagnostics(PROJECT_ROOT, a["file_path"] as string);
        return { content: [{ type: "text", text: result }] };
      },
    },
    {
      definition: TS_DOCUMENT_SYMBOLS_TOOL,
      handler: (args): unknown => {
        const a = args as Record<string, unknown>;
        const result = tsGetDocumentSymbols(PROJECT_ROOT, a["file_path"] as string);
        return { content: [{ type: "text", text: result }] };
      },
    },
    {
      definition: TS_COMPLETIONS_TOOL,
      handler: (args): unknown => {
        const a = args as Record<string, unknown>;
        const result = tsGetCompletions(
          PROJECT_ROOT,
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
          PROJECT_ROOT,
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
        const result = tsGetStats(PROJECT_ROOT);
        return { content: [{ type: "text", text: result }] };
      },
    },
  ];
}
