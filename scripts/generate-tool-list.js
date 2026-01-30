#!/usr/bin/env node
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync, writeFileSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CATEGORIES = {
  Filesystem: "hev_fs_*",
  Development: "hev_dev_*",
  Context: "hev_context_*",
  "Git/PR": "hev_git_*",
  Web: "hev_web_*",
  Workflow: "hev_run_*",
  "Electron/CDP": "hev_* (others)",
};

const MOCK_TOOLS = [
  {
    name: "hev_fs_show",
    description: "Read file content with line range support",
    category: "Filesystem",
  },
  {
    name: "hev_fs_open_files",
    description: "Open multiple files in collapsed view",
    category: "Filesystem",
  },
  { name: "hev_fs_create_file", description: "Create new file", category: "Filesystem" },
  {
    name: "hev_fs_delete_file",
    description: "Delete file (moves to trash)",
    category: "Filesystem",
  },
  { name: "hev_fs_move_file", description: "Move or rename file", category: "Filesystem" },
  { name: "hev_fs_backup", description: "Create file backup", category: "Filesystem" },
  { name: "hev_fs_restore", description: "Restore file from trash", category: "Filesystem" },
  { name: "hev_fs_undo", description: "Undo last file operation", category: "Filesystem" },
  { name: "hev_fs_history", description: "Show file operation history", category: "Filesystem" },
  { name: "hev_fs_diff", description: "Compare two files", category: "Filesystem" },
  {
    name: "hev_fs_diff_content",
    description: "Compare two content blocks",
    category: "Filesystem",
  },
  { name: "hev_fs_find_and_replace", description: "Safe find and replace", category: "Filesystem" },
  { name: "hev_fs_grep", description: "Search files with regex + glob", category: "Filesystem" },
  { name: "hev_fs_bash", description: "Execute shell command", category: "Filesystem" },
  { name: "hev_fs_expand_folder", description: "Show folder structure", category: "Filesystem" },
  {
    name: "hev_dev_analyze_project",
    description: "Analyze project statistics",
    category: "Development",
  },
  {
    name: "hev_dev_bootstrap_context",
    description: "Generate session context",
    category: "Development",
  },
  { name: "hev_dev_find_unused", description: "Find unused exports", category: "Development" },
  {
    name: "hev_dev_generate_diagram",
    description: "Generate dependency diagram",
    category: "Development",
  },
  { name: "hev_dev_update_cache", description: "Update project cache", category: "Development" },
  { name: "hev_dev_edit_lines", description: "Line-based file editing", category: "Development" },
  { name: "hev_dev_git_diff", description: "Show git changes", category: "Development" },
  { name: "hev_dev_lint_file", description: "Run ESLint on single file", category: "Development" },
  {
    name: "hev_dev_search_symbol",
    description: "Search symbol in project",
    category: "Development",
  },
  { name: "hev_dev_test_run", description: "Run tests", category: "Development" },
  { name: "hev_dev_check_syntax", description: "Check syntax errors", category: "Development" },
  {
    name: "hev_dev_visualize_structure",
    description: "Visualize file structure",
    category: "Development",
  },
  {
    name: "hev_dev_typescript_dashboard",
    description: "TypeScript error analytics dashboard",
    category: "Development",
  },
  {
    name: "hev_dev_fix_typescript_batch",
    description: "Auto-fix TypeScript errors in batch",
    category: "Development",
  },
  {
    name: "hev_dev_typescript_type_helper",
    description: "Type conflict analyzer",
    category: "Development",
  },
  { name: "hev_dev_ast_insert", description: "AST-based code insertion", category: "Development" },
  {
    name: "hev_dev_safe_batch_refactor",
    description: "Safe batch refactoring with rollback",
    category: "Development",
  },
  {
    name: "hev_dev_smart_insert",
    description: "Natural language code insertion",
    category: "Development",
  },
  {
    name: "hev_dev_register_tool",
    description: "Auto tool registration helper",
    category: "Development",
  },
  { name: "hev_context_generate", description: "Generate project context", category: "Context" },
  { name: "hev_context_status", description: "Show context status", category: "Context" },
  {
    name: "hev_context_module",
    description: "Generate module-specific context",
    category: "Context",
  },
  { name: "hev_context_read", description: "Read generated context", category: "Context" },
  {
    name: "hev_git_fork_setup",
    description: "Fork, clone and create feature branch",
    category: "Git/PR",
  },
  { name: "hev_git_create_pr", description: "Create pull request", category: "Git/PR" },
  {
    name: "hev_git_check_guidelines",
    description: "Check contribution guidelines",
    category: "Git/PR",
  },
  { name: "hev_git_pr_status", description: "Show git and PR status", category: "Git/PR" },
  { name: "hev_web_search", description: "Search with SearXNG", category: "Web" },
  { name: "hev_web_fetch", description: "Fetch web page content", category: "Web" },
  { name: "hev_web_search_and_fetch", description: "Search and fetch results", category: "Web" },
  { name: "hev_run_workflow", description: "Run predefined workflow", category: "Workflow" },
  { name: "hev_run_steps", description: "Run custom steps", category: "Workflow" },
  { name: "hev_list_workflows", description: "List predefined workflows", category: "Workflow" },
  { name: "hev_mcp_health", description: "MCP server health check", category: "Electron/CDP" },
  { name: "hev_test_electron", description: "Test Electron app", category: "Electron/CDP" },
  { name: "hev_list_tools", description: "List all tools", category: "Electron/CDP" },
  { name: "hev_read_electron_logs", description: "Read Electron logs", category: "Electron/CDP" },
  { name: "hev_list_log_sessions", description: "List log sessions", category: "Electron/CDP" },
  { name: "hev_get_session_summary", description: "Get session summary", category: "Electron/CDP" },
  {
    name: "hev_collect_error_context",
    description: "Collect error context",
    category: "Electron/CDP",
  },
  { name: "hev_get_error_hints", description: "Get AI debugging hints", category: "Electron/CDP" },
  {
    name: "hev_check_electron_connection",
    description: "Check CDP connection",
    category: "Electron/CDP",
  },
  {
    name: "hev_send_command_to_electron",
    description: "Send JS command to Electron",
    category: "Electron/CDP",
  },
  { name: "hev_take_cdp_screenshot", description: "Take CDP screenshot", category: "Electron/CDP" },
  {
    name: "hev_get_electron_window_info",
    description: "Get window info",
    category: "Electron/CDP",
  },
  {
    name: "hev_click_element_by_selector",
    description: "Click by CSS selector",
    category: "Electron/CDP",
  },
  {
    name: "hev_click_element_by_text",
    description: "Click by text content",
    category: "Electron/CDP",
  },
  { name: "hev_fill_input_field", description: "Fill input field", category: "Electron/CDP" },
  {
    name: "hev_get_page_dom_structure",
    description: "Get DOM structure",
    category: "Electron/CDP",
  },
  { name: "hev_inspect_element", description: "Inspect element details", category: "Electron/CDP" },
  { name: "hev_query_elements", description: "Query multiple elements", category: "Electron/CDP" },
  { name: "hev_send_key_press", description: "Send key press", category: "Electron/CDP" },
  { name: "hev_scroll_page", description: "Scroll page", category: "Electron/CDP" },
  {
    name: "hev_list_provider_webviews",
    description: "List provider webviews",
    category: "Electron/CDP",
  },
  {
    name: "hev_list_provider_selectors",
    description: "List provider selectors",
    category: "Electron/CDP",
  },
  {
    name: "hev_validate_provider_selectors",
    description: "Validate provider selectors",
    category: "Electron/CDP",
  },
  {
    name: "hev_inspect_provider_element",
    description: "Inspect provider element",
    category: "Electron/CDP",
  },
];

function generateMarkdown() {
  let md = "# 🔧 Complete Tool List\n\n";
  md += "> **Generated:** " + new Date().toISOString() + "\n";
  md += "> **Total Tools:** " + MOCK_TOOLS.length + "\n\n";
  md += "> **Auto-generated by:** `scripts/generate-tool-list.js`\n\n";
  md += "---\n\n";

  const grouped = {};
  MOCK_TOOLS.forEach((tool) => {
    if (!grouped[tool.category]) grouped[tool.category] = [];
    grouped[tool.category].push(tool);
  });

  for (const [category, tools] of Object.entries(grouped)) {
    md += `## ${category} (${tools.length} tools)\n\n`;

    md += "| Tool | Description |\n";
    md += "|------|-------------|\n";
    tools.forEach((tool) => {
      md += `| \`${tool.name}\` | ${tool.description} |\n`;
    });

    md += "\n";

    md += "### Detailed Tools\n\n";
    tools.forEach((tool) => {
      md += `#### \`${tool.name}\`\n\n`;
      md += `**Description:** ${tool.description}\n\n`;
      md += `**Category:** ${category}\n\n`;
      md += `**Prefix:** \`${CATEGORIES[category]}\`\n\n`;
      md += "---\n\n";
    });
  }

  md += "## Usage Examples\n\n";
  md += "### List all tools\n```bash\nhev_list_tools()\n```\n\n";
  md +=
    '### Get tool schema\n```bash\nmcp__hayalet_ev__get_tool_schema({ tool_name: "hev_dev_typescript_dashboard" })\n```\n\n';

  return md;
}

function main() {
  const outputPath = join(__dirname, "..", ".rovo", "_metadata", "TOOL-LIST.md");
  const markdown = generateMarkdown();

  writeFileSync(outputPath, markdown, "utf-8");
  console.log("✅ Tool list generated: " + outputPath);
  console.log("📊 Total tools: " + MOCK_TOOLS.length);
}

main();
