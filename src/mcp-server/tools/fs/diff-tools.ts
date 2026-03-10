/**
 * Filesystem Tools - Diff Tools
 */

import { createMcpTranslatorSync } from "../../utils/i18n/index.js";
import { diffFiles, diffContent } from "../../utils/diff-utils.js";

const diffToolDefinitionTranslator = createMcpTranslatorSync();

function diffToolDefinitionT(key: string): string {
  return diffToolDefinitionTranslator(`mcpServer.fs.toolDefinitions.${key}`);
}

export function fileDiff(file1: string, file2: string): { identical: boolean; summary: string } {
  const result = diffFiles(file1, file2);
  return { identical: result.identical, summary: result.summary };
}

export function contentDiff(
  content1: string,
  content2: string,
  label1?: string,
  label2?: string
): { identical: boolean; unified: string; additions: number; deletions: number } {
  const result = diffContent(content1, content2, label1, label2);
  return {
    identical: result.identical,
    unified: result.unified,
    additions: result.additions,
    deletions: result.deletions,
  };
}

// Tool Definitions
export const FILE_DIFF_TOOL = {
  name: "hev_fs_diff",
  description: diffToolDefinitionT("diffFile.description"),
  inputSchema: {
    type: "object" as const,
    properties: {
      file1: { type: "string", description: diffToolDefinitionT("diffFile.file1") },
      file2: { type: "string", description: diffToolDefinitionT("diffFile.file2") },
    },
    required: ["file1", "file2"],
  },
  metadata: {
    category: "filesystem",
    subcategory: "diff-compare",
  },
};

export const CONTENT_DIFF_TOOL = {
  name: "hev_fs_diff_content",
  description: diffToolDefinitionT("diffContent.description"),
  inputSchema: {
    type: "object" as const,
    properties: {
      content1: { type: "string", description: diffToolDefinitionT("diffContent.content1") },
      content2: { type: "string", description: diffToolDefinitionT("diffContent.content2") },
      label1: {
        type: "string",
        description: diffToolDefinitionT("diffContent.label1"),
        default: "a",
      },
      label2: {
        type: "string",
        description: diffToolDefinitionT("diffContent.label2"),
        default: "b",
      },
    },
    required: ["content1", "content2"],
  },
  metadata: {
    category: "filesystem",
    subcategory: "diff-compare",
  },
};
