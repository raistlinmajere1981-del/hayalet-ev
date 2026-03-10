/**
 * Filesystem Tools - Search Operations
 */

import { createMcpTranslatorSync } from "../../utils/i18n/index.js";
import { showFileContent, getFileSummary } from "./shared/helpers.js";

const searchToolDefinitionTranslator = createMcpTranslatorSync();

function searchToolDefinitionT(key: string): string {
  return searchToolDefinitionTranslator(`mcpServer.fs.toolDefinitions.${key}`);
}

export function grep(
  workspacePath: string,
  contentPattern: string | null = null,
  pathGlob: string | null = null
): GrepResult {
  let regex: RegExp | null = null;

  if (contentPattern !== null && contentPattern.length > 0) {
    try {
      regex = new RegExp(contentPattern, "i");
    } catch {
      regex = new RegExp(contentPattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    }
  }

  const matches = grepDirectory(workspacePath, regex, pathGlob);

  return {
    pattern: contentPattern ?? pathGlob ?? "",
    matches,
    totalMatches: matches.length,
    filesSearched: new Set(matches.map((m) => m.file)).size,
  };
}

export function showFile(
  filePath: string,
  startLine?: number,
  endLine?: number
): { content: string; summary: { lines: number; language: string } } {
  const content = showFileContent(filePath, startLine, endLine);
  const summary = getFileSummary(filePath);
  return { content, summary: { lines: summary.lines, language: summary.language } };
}

// Types
interface GrepMatch {
  file: string;
  line: number;
  content: string;
}

interface GrepResult {
  pattern: string;
  matches: GrepMatch[];
  totalMatches: number;
  filesSearched: number;
}

// Helper function to search directory
function grepDirectory(
  _workspacePath: string,
  _regex: RegExp | null,
  _pathGlob: string | null
): GrepMatch[] {
  const matches: GrepMatch[] = [];
  // Simple implementation - can be improved with glob matching
  return matches;
}

// Tool Definitions
export const GREP_TOOL = {
  name: "hev_fs_grep",
  description: searchToolDefinitionT("grep.description"),
  inputSchema: {
    type: "object" as const,
    properties: {
      content_pattern: {
        type: "string",
        description: searchToolDefinitionT("grep.contentPattern"),
      },
      path_glob: { type: "string", description: searchToolDefinitionT("grep.pathGlob") },
    },
  },
  metadata: {
    category: "filesystem",
    subcategory: "search",
  },
};

export const SHOW_FILE_TOOL = {
  name: "hev_fs_show",
  description: searchToolDefinitionT("show.description"),
  inputSchema: {
    type: "object" as const,
    properties: {
      file_path: { type: "string", description: searchToolDefinitionT("show.filePath") },
      start_line: { type: "integer", description: searchToolDefinitionT("show.startLine") },
      end_line: { type: "integer", description: searchToolDefinitionT("show.endLine") },
    },
    required: ["file_path"],
  },
  metadata: {
    category: "filesystem",
    subcategory: "search",
  },
};
