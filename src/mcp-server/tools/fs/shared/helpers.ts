/**
 * Filesystem Tools - Shared Helpers
 *
 * Internal utility functions
 */

import fs from "fs";
import path from "path";

// ============================================
// Content Sanitizer (JSON/LLM escape fix)
// ============================================

/**
 * Normalizes content strings sent by LLMs in MCP tool calls.
 *
 * PROBLEM: When sending content, LLMs sometimes:
 * - Escape single quotes: \' → ' (unnecessary in JSON)
 * - Send triple-escaped literal sequences such as \\\\n where \\n is expected
 * - Template literal backtick escape: \` → `
 * - Double-escape backslashes where \\\\ should really be \\
 *
 * This function fixes those malformed escape patterns.
 * It only cleans LLM artifacts and leaves valid escape sequences untouched.
 */
export function sanitizeContent(content: string): string {
  if (content === "") return content;

  let result = content;

  // 1. Remove unnecessary single-quote escapes: \' → '
  //    JSON does not escape single quotes,
  //    but LLMs sometimes emit \' out of JavaScript habit.
  result = result.replace(/\\'/g, "'");

  // 2. Remove unnecessary backtick escapes: \` → `
  //    Backticks are not escaped in JSON.
  result = result.replace(/\\`/g, "`");

  // 3. Fix double-escaped newline/tab/return sequences
  //    LLMs sometimes emit \\\\n where literal \\n is intended.
  //    Real \n newlines are already resolved during JSON parsing,
  //    so the remaining \\n values are literal backslash+n and stay untouched.
  //    Only \\\\n → \\n style over-escapes are normalized.
  result = result.replace(/\\\\\\n/g, "\\n");
  result = result.replace(/\\\\\\t/g, "\\t");
  result = result.replace(/\\\\\\r/g, "\\r");

  return result;
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Show file content with line numbers
 */
export function showFileContent(filePath: string, startLine?: number, endLine?: number): string {
  if (!fs.existsSync(filePath)) {
    return `❌ File not found: ${filePath}`;
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  const start = startLine !== undefined ? Math.max(0, startLine) : 0;
  const end = endLine !== undefined ? Math.min(lines.length, endLine) : lines.length;

  // Add header when showing specific range (hint to prevent collapse)
  let output = "";
  if (startLine !== undefined || endLine !== undefined) {
    const rangeInfo =
      startLine !== undefined && endLine !== undefined
        ? `lines ${startLine + 1}-${end}`
        : startLine !== undefined
          ? `from line ${startLine + 1}`
          : `up to line ${end}`;
    output += `🔍 Showing ${rangeInfo} (${end - start} lines, EXPANDED)\n`;
    output += "─".repeat(60) + "\n";
  }

  for (let i = start; i < end; i++) {
    const lineNum = String(i + 1).padStart(4, " ");
    output += `${lineNum} │ ${lines[i] ?? ""}\n`;
  }

  // Add footer
  if (startLine !== undefined || endLine !== undefined) {
    output += "─".repeat(60) + "\n";
    output += `📄 Displayed ${end - start} lines from ${path.basename(filePath)}\n`;
  }

  return output;
}

/**
 * Get file summary (lines count and language)
 */
export function getFileSummary(filePath: string): { lines: number; language: string } {
  if (!fs.existsSync(filePath)) {
    return { lines: 0, language: "unknown" };
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").length;
  const ext = path.extname(filePath).slice(1);

  const languageMap: Record<string, string> = {
    ts: "TypeScript",
    js: "JavaScript",
    tsx: "TypeScript React",
    jsx: "JavaScript React",
    json: "JSON",
    md: "Markdown",
    css: "CSS",
    html: "HTML",
    txt: "Text",
  };

  return {
    lines,
    language: languageMap[ext] ?? ext,
  };
}
