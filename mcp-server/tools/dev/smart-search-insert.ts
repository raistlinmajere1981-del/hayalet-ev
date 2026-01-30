/**
 * Development Tools - Smart Search and Insert
 * 
 * Natural language ile pozisyon bulma ve kod ekleme
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { logToolError } from "../../utils/mcp-logger.js";

interface SmartInsertOptions {
  file_path: string;
  anchor: string; // Natural language: "last if block", "after function X", etc.
  position: "before" | "after" | "inside_start" | "inside_end";
  code: string;
  dry_run?: boolean;
}

interface SmartInsertResult {
  success: boolean;
  output: string;
  preview?: string;
  inserted_at?: number;
}

export async function smartInsertCode(
  options: SmartInsertOptions,
  projectRoot?: string
): Promise<SmartInsertResult> {
  const { file_path, anchor, position, code, dry_run = true } = options;

  const fullPath = projectRoot ? join(projectRoot, file_path) : file_path;

  try {
    const content = readFileSync(fullPath, "utf-8");
    const lines = content.split("\\n");

    // Parse anchor and find insertion point
    const insertionLine = findInsertionPoint(lines, anchor, position);

    if (!insertionLine) {
      return {
        success: false,
        output: `❌ Could not find anchor: ${anchor}`,
      };
    }

    // Insert code
    const indent = getIndentation(lines[insertionLine.targetLine] || "");
    const formattedCode = formatCodeWithIndent(code, indent);

    lines.splice(insertionLine.insertAt, 0, formattedCode);

    // Generate preview
    const preview = generatePreview(lines, insertionLine.insertAt, formattedCode);

    // Apply if not dry run
    if (!dry_run) {
      writeFileSync(fullPath, lines.join("\\n"), "utf-8");
    }

    return {
      success: true,
      output: formatOutput(file_path, insertionLine.insertAt, dry_run),
      preview,
      inserted_at: insertionLine.insertAt,
    };
  } catch (error) {
    logToolError("smart-search-insert", error as Error, {});
    return {
      success: false,
      output: `❌ Error: ${error}`,
    };
  }
}

// ============================================
// Helper Functions
// ============================================

function findInsertionPoint(
  lines: string[],
  anchor: string,
  position: string
): { targetLine: number; insertAt: number } | null {
  const lowerAnchor = anchor.toLowerCase();

  // Pattern: "last if block"
  if (lowerAnchor.includes("last if block") || lowerAnchor.includes("last if statement")) {
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i]?.trim().startsWith('if (')) {
        // Find the closing of this if block
        let braceCount = 0;
        for (let j = i; j < lines.length; j++) {
          braceCount += (lines[j]?.match(/{/g) || []).length;
          braceCount -= (lines[j]?.match(/}/g) || []).length;
          if (braceCount === 0 && j > i) {
            return { targetLine: j, insertAt: position === "after" ? j + 1 : i };
          }
        }
      }
    }
  }

  // Pattern: "after function X"
  const afterFunctionMatch = lowerAnchor.match(/after function (\\w+)/);
  if (afterFunctionMatch) {
    const funcName = afterFunctionMatch[1];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]?.includes(`function ${funcName}`) || lines[i]?.includes(`${funcName}(`)) {
        // Find end of function
        let braceCount = 0;
        for (let j = i; j < lines.length; j++) {
          braceCount += (lines[j]?.match(/{/g) || []).length;
          braceCount -= (lines[j]?.match(/}/g) || []).length;
          if (braceCount === 0 && j > i) {
            return { targetLine: j, insertAt: j + 1 };
          }
        }
      }
    }
  }

  // Pattern: "end of file"
  if (lowerAnchor.includes("end of file")) {
    return { targetLine: lines.length - 1, insertAt: lines.length };
  }

  // Pattern: exact line number
  const lineMatch = lowerAnchor.match(/line (\\d+)/);
  if (lineMatch) {
    const lineNum = parseInt(lineMatch[1] || '0', 10);
    return { targetLine: lineNum - 1, insertAt: position === "after" ? lineNum : lineNum - 1 };
  }

  return null;
}

function getIndentation(line: string): string {
  return line.match(/^\\s*/)?.[0] || "";
}

function formatCodeWithIndent(code: string, indent: string): string {
  return code.split("\\n").map((line) => `${indent}${line}`).join("\\n");
}

function generatePreview(lines: string[], insertAt: number, code: string): string {
  let preview = `🔍 Smart Insert - Preview\\n`;
  preview += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n`;
  preview += `Insertion Point: Line ${insertAt + 1}\\n\\n`;

  const start = Math.max(0, insertAt - 3);
  const end = Math.min(lines.length, insertAt + 3);

  for (let i = start; i < end; i++) {
    if (i === insertAt) {
      preview += `+ ${code}\\n`;
    }
    const marker = i === insertAt - 1 ? "→" : " ";
    preview += `${marker} ${i + 1} │ ${lines[i]}\\n`;
  }

  return preview;
}

function formatOutput(filePath: string, line: number, dryRun: boolean): string {
  let output = `🔍 Smart Search-and-Insert\\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n`;
  output += `📁 File: ${filePath}\\n`;
  output += `📍 Line: ${line + 1}\\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n\\n`;

  if (dryRun) {
    output += `⚠️  DRY RUN MODE - No changes applied\\n`;
  } else {
    output += `✅ Code inserted successfully\\n`;
  }

  return output;
}

// ============================================
// MCP Tool Definition
// ============================================

export const SMART_SEARCH_INSERT_TOOL = {
  name: "hev_dev_smart_insert",
  description:
    "Natural language ile pozisyon bulma ve kod ekleme ('last if block', 'after function X', 'end of file')",
  inputSchema: {
    type: "object",
    properties: {
      file_path: {
        type: "string",
        description: "Kod eklenecek dosya yolu",
      },
      anchor: {
        type: "string",
        description: "Natural language pozisyon ('last if block', 'after function X', 'line 123', 'end of file')",
      },
      position: {
        type: "string",
        enum: ["before", "after", "inside_start", "inside_end"],
        description: "Anchor'a göre pozisyon",
        default: "after",
      },
      code: {
        type: "string",
        description: "Eklenecek kod",
      },
      dry_run: {
        type: "boolean",
        description: "Sadece önizleme",
        default: true,
      },
    },
    required: ["file_path", "anchor", "code"],
  },
};
