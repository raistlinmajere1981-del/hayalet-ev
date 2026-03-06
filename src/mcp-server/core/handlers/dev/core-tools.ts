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
} from "../../../tools/dev/index.js";
import type { ToolEntry } from "../../registry.js";

export function createCoreDevTools(projectRoot: string): ToolEntry[] {
  return [
    {
      definition: PROJECT_ANALYZER_TOOL,
      handler: async (args): Promise<unknown> => {
        const result = await analyzeProject(projectRoot, args as Record<string, unknown>);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      },
    },
    {
      definition: CONTEXT_GENERATOR_TOOL,
      handler: async (args): Promise<unknown> => {
        const result = await bootstrapContext(projectRoot, args as Record<string, unknown>);
        return {
          content: [{ type: "text", text: `✅ Bootstrap completed: ${result.stats.lines} lines` }],
        };
      },
    },
    {
      definition: DIAGRAM_GENERATOR_TOOL,
      handler: async (args): Promise<unknown> => {
        const result = await generateDiagram(projectRoot, args as Record<string, unknown>);
        return { content: [{ type: "text", text: result.diagram }] };
      },
    },
    {
      definition: CACHE_MANAGER_TOOL,
      handler: async (args): Promise<unknown> => {
        await updateCache(projectRoot, args as Record<string, unknown>);
        return { content: [{ type: "text", text: "✅ Cache updated" }] };
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
        const result = await editLines(a["file_path"] as string, options, projectRoot);
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
        const result = gitDiff(projectRoot, args as Record<string, unknown>);
        return { content: [{ type: "text", text: result.diff }] };
      },
    },
    {
      definition: LINTER_TOOL,
      handler: (args): unknown => {
        const a = args as Record<string, unknown>;
        const result = lintFile(
          projectRoot,
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
              ? { format: a["format"] as "json" | "stylish" | "compact" | "codeframe" }
              : {}),
          },
          projectRoot
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
          projectRoot
        );
        return { content: [{ type: "text", text: result.output }] };
      },
    },
    {
      definition: SYMBOL_SEARCHER_TOOL,
      handler: async (args): Promise<unknown> => {
        const a = args as Record<string, unknown>;
        const result = await searchSymbol(projectRoot, a["symbol"] as string, {
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
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      },
    },
    {
      definition: TEST_RUNNER_TOOL,
      handler: (args): unknown => {
        const a = args as Record<string, unknown>;
        const result = testRun(projectRoot, {
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
        const result = await visualizeStructure(projectRoot, filePath, options);
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
          projectRoot
        );
        return { content: [{ type: "text", text: result.output }] };
      },
    },
    {
      definition: TYPESCRIPT_DASHBOARD_TOOL,
      handler: (args): unknown => {
        const result = generateTypescriptDashboard(args ?? {}, projectRoot);
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
          projectRoot
        );
        return { content: [{ type: "text", text: result.output }] };
      },
    },
  ];
}
