/**
 * Filesystem Tools - Diff Tools
 */

import { diffFiles, diffContent } from "../../utils/diff-utils.js";

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
  description: "İki dosyayı karşılaştır",
  inputSchema: {
    type: "object" as const,
    properties: {
      file1: { type: "string", description: "Birinci dosya" },
      file2: { type: "string", description: "İkinci dosya" },
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
  description: "İki metin bloğunu karşılaştır",
  inputSchema: {
    type: "object" as const,
    properties: {
      content1: { type: "string", description: "Birinci içerik" },
      content2: { type: "string", description: "İkinci içerik" },
      label1: { type: "string", description: "Birinci etiket", default: "a" },
      label2: { type: "string", description: "İkinci etiket", default: "b" },
    },
    required: ["content1", "content2"],
  },
  metadata: {
    category: "filesystem",
    subcategory: "diff-compare",
  },
};
