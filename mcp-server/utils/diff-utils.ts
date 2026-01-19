/**
 * Diff Utilities
 * 
 * Dosya ve içerik karşılaştırma araçları
 * - Unified diff formatı
 * - Satır bazlı karşılaştırma
 * - Değişiklik özeti
 */

import { readFileSync, existsSync } from "fs";

// ============================================
// Types
// ============================================

export interface DiffLine {
  type: "added" | "removed" | "unchanged" | "header";
  lineNumber?: { old?: number; new?: number };
  content: string;
}

export interface DiffResult {
  file1: string;
  file2: string;
  identical: boolean;
  additions: number;
  deletions: number;
  changes: DiffLine[];
  summary: string;
}

export interface ContentDiffResult {
  identical: boolean;
  additions: number;
  deletions: number;
  changes: DiffLine[];
  unified: string;
}

// ============================================
// Core Diff Algorithm (Myers-like simplified)
// ============================================

/**
 * İki string array'ini karşılaştır
 */
function computeDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  // LCS (Longest Common Subsequence) tabanlı basit diff
  const oldLen = oldLines.length;
  const newLen = newLines.length;
  
  // DP matrix
  const dp: number[][] = Array(oldLen + 1).fill(null).map(() => Array(newLen + 1).fill(0));
  
  for (let i = 1; i <= oldLen; i++) {
    for (let j = 1; j <= newLen; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  
  // Backtrack to find diff
  let i = oldLen;
  let j = newLen;
  const tempResult: DiffLine[] = [];
  
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      tempResult.unshift({
        type: "unchanged",
        lineNumber: { old: i, new: j },
        content: oldLines[i - 1],
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      tempResult.unshift({
        type: "added",
        lineNumber: { new: j },
        content: newLines[j - 1],
      });
      j--;
    } else if (i > 0) {
      tempResult.unshift({
        type: "removed",
        lineNumber: { old: i },
        content: oldLines[i - 1],
      });
      i--;
    }
  }
  
  return tempResult;
}

/**
 * Diff'i unified format'a çevir
 */
function toUnifiedFormat(diff: DiffLine[], contextLines: number = 3): string {
  if (!diff || diff.length === 0) {
    return "";
  }
  
  const lines: string[] = [];
  let currentHunk: DiffLine[] = [];
  let lastChangeIndex = -contextLines - 1;
  
  for (let i = 0; i < diff.length; i++) {
    const line = diff[i];
    if (!line) continue;
    
    if (line.type !== "unchanged") {
      // Değişiklik var, context ile birlikte ekle
      const contextStart = Math.max(lastChangeIndex + 1, i - contextLines);
      
      // Önceki context satırlarını ekle
      for (let c = contextStart; c < i; c++) {
        const contextLine = diff[c];
        if (contextLine && contextLine.type === "unchanged" && !currentHunk.includes(contextLine)) {
          currentHunk.push(contextLine);
        }
      }
      
      currentHunk.push(line);
      lastChangeIndex = i;
    } else if (i - lastChangeIndex <= contextLines) {
      // Değişiklikten sonraki context
      currentHunk.push(line);
    } else if (currentHunk.length > 0) {
      // Hunk'ı bitir
      lines.push(...formatHunk(currentHunk));
      lines.push("");
      currentHunk = [];
    }
  }
  
  // Son hunk
  if (currentHunk.length > 0) {
    lines.push(...formatHunk(currentHunk));
  }
  
  return lines.join("\n");
}

function formatHunk(hunk: DiffLine[]): string[] {
  const lines: string[] = [];
  
  if (!hunk || hunk.length === 0) {
    return lines;
  }
  
  // Hunk header
  const oldStart = hunk.find(l => l.lineNumber?.old)?.lineNumber?.old || 1;
  const newStart = hunk.find(l => l.lineNumber?.new)?.lineNumber?.new || 1;
  const oldCount = hunk.filter(l => l.type !== "added").length;
  const newCount = hunk.filter(l => l.type !== "removed").length;
  
  lines.push(`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`);
  
  for (const line of hunk) {
    if (!line || !line.type) continue;
    
    switch (line.type) {
      case "added":
        lines.push(`+ ${line.content ?? ""}`);
        break;
      case "removed":
        lines.push(`- ${line.content ?? ""}`);
        break;
      case "unchanged":
        lines.push(`  ${line.content ?? ""}`);
        break;
      default:
        lines.push(`  ${line.content ?? ""}`);
    }
  }
  
  return lines;
}

// ============================================
// Public API
// ============================================

/**
 * İki dosyayı karşılaştır
 */
export function diffFiles(file1: string, file2: string): DiffResult {
  if (!existsSync(file1)) {
    return {
      file1,
      file2,
      identical: false,
      additions: 0,
      deletions: 0,
      changes: [],
      summary: `Hata: ${file1} bulunamadı`,
    };
  }
  
  if (!existsSync(file2)) {
    return {
      file1,
      file2,
      identical: false,
      additions: 0,
      deletions: 0,
      changes: [],
      summary: `Hata: ${file2} bulunamadı`,
    };
  }
  
  const content1 = readFileSync(file1, "utf-8");
  const content2 = readFileSync(file2, "utf-8");
  
  const lines1 = content1.split("\n");
  const lines2 = content2.split("\n");
  
  const diff = computeDiff(lines1, lines2);
  const additions = diff.filter(d => d.type === "added").length;
  const deletions = diff.filter(d => d.type === "removed").length;
  const identical = additions === 0 && deletions === 0;
  
  let summary = "";
  if (identical) {
    summary = "✅ Dosyalar aynı";
  } else {
    summary = `📊 ${additions} ekleme, ${deletions} silme\n\n`;
    summary += toUnifiedFormat(diff);
  }
  
  return {
    file1,
    file2,
    identical,
    additions,
    deletions,
    changes: diff.filter(d => d.type !== "unchanged"),
    summary,
  };
}

/**
 * İki metin bloğunu karşılaştır
 */
export function diffContent(content1: string, content2: string, label1: string = "a", label2: string = "b"): ContentDiffResult {
  const lines1 = content1.split("\n");
  const lines2 = content2.split("\n");
  
  const diff = computeDiff(lines1, lines2);
  const additions = diff.filter(d => d.type === "added").length;
  const deletions = diff.filter(d => d.type === "removed").length;
  const identical = additions === 0 && deletions === 0;
  
  let unified = "";
  if (!identical) {
    unified = `--- ${label1}\n+++ ${label2}\n`;
    unified += toUnifiedFormat(diff);
  }
  
  return {
    identical,
    additions,
    deletions,
    changes: diff.filter(d => d.type !== "unchanged"),
    unified,
  };
}

/**
 * Dosya içeriğini satır numaralarıyla göster
 */
export function showFileContent(filePath: string, startLine?: number, endLine?: number): string {
  if (!existsSync(filePath)) {
    return `Hata: ${filePath} bulunamadı`;
  }
  
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  
  const start = startLine ? Math.max(1, startLine) : 1;
  const end = endLine ? Math.min(lines.length, endLine) : lines.length;
  
  const result: string[] = [];
  const lineNumWidth = String(end).length;
  
  for (let i = start - 1; i < end; i++) {
    const lineNum = String(i + 1).padStart(lineNumWidth, " ");
    result.push(`${lineNum} │ ${lines[i]}`);
  }
  
  return result.join("\n");
}

/**
 * Dosya değişiklik özeti (git diff benzeri)
 */
export function getFileSummary(filePath: string): { lines: number; words: number; chars: number; language: string } {
  if (!existsSync(filePath)) {
    return { lines: 0, words: 0, chars: 0, language: "unknown" };
  }
  
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n").length;
  const words = content.split(/\s+/).filter(w => w.length > 0).length;
  const chars = content.length;
  
  // Detect language from extension
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const languageMap: Record<string, string> = {
    ts: "TypeScript",
    tsx: "TypeScript (React)",
    js: "JavaScript",
    jsx: "JavaScript (React)",
    py: "Python",
    rs: "Rust",
    go: "Go",
    java: "Java",
    cpp: "C++",
    c: "C",
    css: "CSS",
    html: "HTML",
    json: "JSON",
    yaml: "YAML",
    yml: "YAML",
    md: "Markdown",
    sh: "Shell",
  };
  
  const language = languageMap[ext] || ext.toUpperCase();
  
  return { lines, words, chars, language };
}
