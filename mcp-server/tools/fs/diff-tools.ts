/**
 * Filesystem Tools - Diff Tools
 */

import { diffLines } from "../../utils/diff-utils.js";

export function fileDiff(file1: string, file2: string): { identical: boolean; summary: string } {
  const result = diffFiles(file1, file2);
  return { identical: result.identical, summary: result.summary };
}

export function contentDiff(content1: string, content2: string, label1?: string, label2?: string): { identical: boolean; unified: string; additions: number; deletions: number } {
  const result = diffContent(content1, content2, label1, label2);
  return {
    identical: result.identical,
    unified: result.unified,
    additions: result.additions,
    deletions: result.deletions,
  };
}

// Tool Definitions
        file1: {
          type: "string",
          description: "Birinci dosya yolu",
        },
        file2: {
          type: "string",
          description: "İkinci dosya yolu",
        },
      },
      required: ["file1", "file2"],
    },
  },
  {
    name: "hev_fs_diff_content",
    description: "İki metin bloğunu karşılaştır",
    inputSchema: {
      type: "object" as const,
      properties: {
        content1: {
