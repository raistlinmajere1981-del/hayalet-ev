/**
 * Development Tools - Export Hub
 *
 * Central export hub for all development tools
 */

// Function exports
export { analyzeProject, PROJECT_ANALYZER_TOOL } from "./project-analyzer.js";
export { bootstrapContext, CONTEXT_GENERATOR_TOOL } from "./context-generator.js";
export { generateDiagram, DIAGRAM_GENERATOR_TOOL } from "./diagram-generator.js";
export { updateCache, CACHE_MANAGER_TOOL } from "./cache-manager.js";
export { editLines, LINE_EDITOR_TOOL } from "./line-editor.js";
export { gitDiff, GIT_DIFF_TOOL } from "./git-tools.js";
export { lintFile, LINTER_TOOL } from "./linter.js";
export { lintProject, LINT_PROJECT_TOOL } from "./eslint-project.js";
export { generateEslintDashboard, ESLINT_DASHBOARD_TOOL } from "./eslint-dashboard.js";
export { searchSymbol, SYMBOL_SEARCHER_TOOL } from "./symbol-searcher.js";
export { testRun, TEST_RUNNER_TOOL } from "./test-runner.js";
export { checkSyntax, SYNTAX_CHECKER_TOOL } from "./syntax-checker.js";
export { visualizeStructure, STRUCTURE_VISUALIZER_TOOL } from "./structure-visualizer.js";
export { fixTypescriptErrors, TYPESCRIPT_BATCH_FIXER_TOOL } from "./typescript-batch-fixer.js";
export { generateTypescriptDashboard, TYPESCRIPT_DASHBOARD_TOOL } from "./typescript-dashboard.js";
export { analyzeTypeConflicts, TYPESCRIPT_TYPE_HELPER_TOOL } from "./typescript-type-helper.js";
export { insertCodeWithAST, AST_CODE_INSERTER_TOOL } from "./ast-code-inserter.js";
export { safelyRefactorCode, SAFE_BATCH_REFACTOR_TOOL } from "./safe-batch-refactor.js";
export { smartInsertCode, SMART_SEARCH_INSERT_TOOL } from "./smart-search-insert.js";
export { registerNewTool, TOOL_REGISTRATION_HELPER_TOOL } from "./tool-registration-helper.js";
export { runCodemod, CODEMOD_TOOL } from "./codemod.js";
export { analyzeScopeImpact, validateBracketBalance } from "./scope-validator.js";
export {
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
  TS_LANGUAGE_TOOL_DEFINITIONS,
} from "./ts-language-tools.js";

// Import tool definitions
import { PROJECT_ANALYZER_TOOL } from "./project-analyzer.js";
import { CONTEXT_GENERATOR_TOOL } from "./context-generator.js";
import { DIAGRAM_GENERATOR_TOOL } from "./diagram-generator.js";
import { CACHE_MANAGER_TOOL } from "./cache-manager.js";
import { LINE_EDITOR_TOOL } from "./line-editor.js";
import { GIT_DIFF_TOOL } from "./git-tools.js";
import { LINTER_TOOL } from "./linter.js";
import { LINT_PROJECT_TOOL } from "./eslint-project.js";
import { ESLINT_DASHBOARD_TOOL } from "./eslint-dashboard.js";
import { SYMBOL_SEARCHER_TOOL } from "./symbol-searcher.js";
import { TEST_RUNNER_TOOL } from "./test-runner.js";
import { SYNTAX_CHECKER_TOOL } from "./syntax-checker.js";
import { STRUCTURE_VISUALIZER_TOOL } from "./structure-visualizer.js";
import { TYPESCRIPT_BATCH_FIXER_TOOL } from "./typescript-batch-fixer.js";
import { TYPESCRIPT_DASHBOARD_TOOL } from "./typescript-dashboard.js";
import { TYPESCRIPT_TYPE_HELPER_TOOL } from "./typescript-type-helper.js";
import { AST_CODE_INSERTER_TOOL } from "./ast-code-inserter.js";
import { SAFE_BATCH_REFACTOR_TOOL } from "./safe-batch-refactor.js";
import { SMART_SEARCH_INSERT_TOOL } from "./smart-search-insert.js";
import { TOOL_REGISTRATION_HELPER_TOOL } from "./tool-registration-helper.js";
import { CODEMOD_TOOL } from "./codemod.js";
import { TS_LANGUAGE_TOOL_DEFINITIONS } from "./ts-language-tools.js";

// Combined tool definitions array (for MCP registration)
export const DEV_TOOL_DEFINITIONS = [
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
  ...TS_LANGUAGE_TOOL_DEFINITIONS,
];

// Auto-generated metadata for listTools()
export const DEV_TOOL_METADATA = {
  category: "Development",
  emoji: "🔧",
  tools: DEV_TOOL_DEFINITIONS.map((t) => t.name),
};
