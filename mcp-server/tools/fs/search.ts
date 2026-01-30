/**
 * Filesystem Tools - Search Operations
 */

import { execSync } from "child_process";
import { readFileSync } from "fs";
import { logToolError } from "../../utils/mcp-logger.js";
import { showFileContent, getFileSummary } from "./shared/helpers.js";

export async function grep(
  workspacePath: string,
  contentPattern: string | null = null,
  pathGlob: string | null = null
): Promise<GrepResult> {
  let regex: RegExp | null = null;
  
  if (contentPattern) {
    try {
      regex = new RegExp(contentPattern, "i");
    } catch {
      regex = new RegExp(contentPattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    }
  }
  
  const matches = await grepDirectory(workspacePath, regex, pathGlob);
  
  return {
    pattern: contentPattern || pathGlob || "",
    matches,
    totalMatches: matches.length,
    filesSearched: new Set(matches.map(m => m.file)).size,
  };
}

export function showFile(filePath: string, startLine?: number, endLine?: number): { content: string; summary: { lines: number; language: string } } {
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
async function grepDirectory(
  workspacePath: string,
  regex: RegExp | null,
  pathGlob: string | null
): Promise<GrepMatch[]> {
  const matches: GrepMatch[] = [];
  // Simple implementation - can be improved with glob matching
  return matches;
}


// Tool Definitions
export const GREP_TOOL = {
  name: "hev_fs_grep",
  description: "Dosyalarda pattern ara",
  inputSchema: {
    type: "object" as const,
    properties: {
      content_pattern: { type: "string", description: "Aranacak regex pattern" },
      path_glob: { type: "string", description: "Dosya yolu glob pattern" }
    }
  }
};

export const SHOW_FILE_TOOL = {
  name: "hev_fs_show",
  description: "Dosya içeriğini satır numaralarıyla göster",
  inputSchema: {
    type: "object" as const,
    properties: {
      file_path: { type: "string", description: "Dosya yolu" },
      start_line: { type: "integer", description: "Başlangıç satırı" },
      end_line: { type: "integer", description: "Bitiş satırı" }
    },
    required: ["file_path"]
  }
};
