/**
 * Filesystem Tools - Folder Operations
 */

import { buildTree } from "../../utils/file-utils.js";
import { logToolError } from "../../utils/mcp-logger.js";

export async function expandFolder(
  folderPath: string,
  maxDepth: number = 3
): Promise<{ structure: string; error?: string }> {
  try {
    const entries = await readFolderStructure(folderPath, maxDepth);
    const structure = formatFolderStructure(entries);
    return { structure: `${folderPath}/\n${structure}` };
  } catch (error) {
    logToolError("hev_fs_expand_folder", error as Error, { folderPath, maxDepth });
    return { structure: "", error: (error as Error).message };
  }
}

// Tool Definition
    name: "hev_fs_create_plan",
    description: "Teknik plan oluştur ve doğrula.",
    inputSchema: {
      type: "object" as const,
      properties: {
        plan: {
          type: "object",
          description: "Teknik plan objesi { logicalChanges: [...] }",
          properties: {
            logicalChanges: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  summary: { type: "string" },
