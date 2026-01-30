/**
 * Filesystem Tools - Shared Helpers
 * 
 * Internal utility functions
 */

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
  const fs = require('fs');
  const path = require('path');
  
  if (!fs.existsSync(filePath)) {
    return `❌ File not found: ${filePath}`;
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  const start = startLine !== undefined ? Math.max(0, startLine) : 0;
  const end = endLine !== undefined ? Math.min(lines.length, endLine) : lines.length;
  
  let output = '';
  for (let i = start; i < end; i++) {
    const lineNum = String(i + 1).padStart(4, ' ');
    output += `${lineNum} │ ${lines[i]}\n`;
  }
  
  return output;
}

/**
 * Get file summary (lines count and language)
 */
export function getFileSummary(filePath: string): { lines: number; language: string } {
  const fs = require('fs');
  const path = require('path');
  
  if (!fs.existsSync(filePath)) {
    return { lines: 0, language: 'unknown' };
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').length;
  const ext = path.extname(filePath).slice(1);
  
  const languageMap: Record<string, string> = {
    'ts': 'TypeScript',
    'js': 'JavaScript',
    'tsx': 'TypeScript React',
    'jsx': 'JavaScript React',
    'json': 'JSON',
    'md': 'Markdown',
    'css': 'CSS',
    'html': 'HTML',
    'txt': 'Text',
  };
  
  return {
    lines,
    language: languageMap[ext] || ext || 'unknown'
  };
}

