/**
 * File Utilities for Filesystem Tools
 * 
 * Collapsed view, code parsing, glob matching ve diğer dosya işlemleri
 */

import { readFile, readdir, stat } from "fs/promises";
import { join, extname, basename } from "path";
import type { CodeStructure, FileContent, FolderEntry, GrepMatch } from "../types/index.js";

// ============================================
// Constants
// ============================================

/** Collapsed view için maksimum dosya boyutu (byte) */
const COLLAPSE_THRESHOLD = 5000;

/** Desteklenen kod dosyası uzantıları */
const CODE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".java", ".kt", ".go", ".rs", ".c", ".cpp", ".h",
  ".cs", ".rb", ".php", ".swift", ".scala", ".vue", ".svelte"
]);

/** Binary dosya uzantıları (atlanacak) */
const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".svg",
  ".pdf", ".zip", ".tar", ".gz", ".rar", ".7z",
  ".exe", ".dll", ".so", ".dylib", ".bin",
  ".mp3", ".mp4", ".wav", ".avi", ".mov", ".mkv",
  ".woff", ".woff2", ".ttf", ".eot", ".otf",
  ".db", ".sqlite", ".sqlite3"
]);

/** Ignore edilecek dizinler */
const IGNORE_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".vite",
  "__pycache__", ".cache", "coverage", ".nyc_output",
  ".next", ".nuxt", ".svelte-kit", "vendor"
]);

// ============================================
// Code Structure Parsing
// ============================================

/**
 * TypeScript/JavaScript dosyasından kod yapısını çıkar
 * Basit regex-based parser (tam AST parsing yerine performans için)
 */
export function parseCodeStructure(content: string, extension: string): CodeStructure[] {
  const structures: CodeStructure[] = [];
  const lines = content.split("\n");
  
  // Sadece TS/JS dosyaları için parse et
  if (![".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(extension)) {
    return structures;
  }
  
  const stack: { type: string; name: string; startLine: number; braceCount: number }[] = [];
  let braceCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i; // 0-indexed
    
    // Brace counting
    const openBraces = (line.match(/{/g) || []).length;
    const closeBraces = (line.match(/}/g) || []).length;
    
    // Function declaration: function name(...) { veya async function name(...)
    const funcMatch = line.match(/^(\s*)(export\s+)?(async\s+)?function\s+(\w+)\s*\(/);
    if (funcMatch) {
      stack.push({ type: "function", name: funcMatch[4], startLine: lineNum, braceCount });
    }
    
    // Arrow function: const name = (...) => veya const name = async (...) =>
    const arrowMatch = line.match(/^(\s*)(export\s+)?(const|let|var)\s+(\w+)\s*=\s*(async\s*)?\([^)]*\)\s*(:\s*\w+)?\s*=>/);
    if (arrowMatch) {
      stack.push({ type: "function", name: arrowMatch[4], startLine: lineNum, braceCount });
    }
    
    // Class declaration
    const classMatch = line.match(/^(\s*)(export\s+)?(abstract\s+)?class\s+(\w+)/);
    if (classMatch) {
      stack.push({ type: "class", name: classMatch[4], startLine: lineNum, braceCount });
    }
    
    // Interface declaration
    const interfaceMatch = line.match(/^(\s*)(export\s+)?interface\s+(\w+)/);
    if (interfaceMatch) {
      stack.push({ type: "interface", name: interfaceMatch[3], startLine: lineNum, braceCount });
    }
    
    // Type declaration
    const typeMatch = line.match(/^(\s*)(export\s+)?type\s+(\w+)\s*=/);
    if (typeMatch) {
      // Type'lar genellikle tek satır, ama çok satırlı olabilir
      stack.push({ type: "type", name: typeMatch[3], startLine: lineNum, braceCount });
    }
    
    // Method in class: name(...) { veya async name(...)
    const methodMatch = line.match(/^(\s+)(async\s+)?(\w+)\s*\([^)]*\)\s*(:\s*[^{]+)?\s*{/);
    if (methodMatch && stack.length > 0 && stack[stack.length - 1].type === "class") {
      stack.push({ type: "method", name: methodMatch[3], startLine: lineNum, braceCount });
    }
    
    // Update brace count
    braceCount += openBraces - closeBraces;
    
    // Check if any structure is closed
    while (stack.length > 0) {
      const current = stack[stack.length - 1];
      if (braceCount <= current.braceCount) {
        stack.pop();
        structures.push({
          type: current.type as CodeStructure["type"],
          name: current.name,
          startLine: current.startLine,
          endLine: lineNum,
        });
      } else {
        break;
      }
    }
  }
  
  // Close any remaining structures
  while (stack.length > 0) {
    const current = stack.pop()!;
    structures.push({
      type: current.type as CodeStructure["type"],
      name: current.name,
      startLine: current.startLine,
      endLine: lines.length - 1,
    });
  }
  
  return structures.sort((a, b) => a.startLine - b.startLine);
}

/**
 * Collapsed view oluştur - fonksiyon/class gövdelerini gizle
 */
export function createCollapsedView(content: string, extension: string): string {
  const structures = parseCodeStructure(content, extension);
  if (structures.length === 0) {
    return content;
  }
  
  const lines = content.split("\n");
  const result: string[] = [];
  const hiddenRanges: Set<number> = new Set();
  
  // Gizlenecek satırları belirle (fonksiyon/method gövdeleri)
  for (const struct of structures) {
    if (struct.type === "function" || struct.type === "method") {
      // İlk satırı (signature) göster, geri kalanını gizle
      for (let i = struct.startLine + 1; i < struct.endLine; i++) {
        hiddenRanges.add(i);
      }
    }
  }
  
  let lastWasHidden = false;
  for (let i = 0; i < lines.length; i++) {
    if (hiddenRanges.has(i)) {
      if (!lastWasHidden) {
        result.push(`${String(i).padStart(4)}     ... (collapsed)`);
        lastWasHidden = true;
      }
    } else {
      result.push(`${String(i).padStart(4)} ${lines[i]}`);
      lastWasHidden = false;
    }
  }
  
  return result.join("\n");
}

/**
 * Satır numaralı içerik oluştur
 */
export function addLineNumbers(content: string): string {
  const lines = content.split("\n");
  return lines.map((line, i) => `${String(i).padStart(4)} ${line}`).join("\n");
}

// ============================================
// File Reading
// ============================================

/**
 * Dosya oku ve collapsed view uygula (gerekirse)
 */
export async function readFileWithCollapse(filePath: string): Promise<FileContent> {
  try {
    const ext = extname(filePath).toLowerCase();
    
    // Binary dosyaları atla
    if (BINARY_EXTENSIONS.has(ext)) {
      return {
        path: filePath,
        content: `[Binary file: ${ext}]`,
        lineCount: 0,
        isCollapsed: false,
      };
    }
    
    const content = await readFile(filePath, "utf-8");
    const lineCount = content.split("\n").length;
    const shouldCollapse = content.length > COLLAPSE_THRESHOLD && CODE_EXTENSIONS.has(ext);
    
    if (shouldCollapse) {
      return {
        path: filePath,
        content: createCollapsedView(content, ext),
        lineCount,
        isCollapsed: true,
      };
    }
    
    return {
      path: filePath,
      content: addLineNumbers(content),
      lineCount,
      isCollapsed: false,
    };
  } catch (error) {
    return {
      path: filePath,
      content: "",
      lineCount: 0,
      isCollapsed: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Belirli satır aralıklarını genişlet
 */
export async function expandLineRanges(
  filePath: string,
  ranges: [number, number][]
): Promise<string> {
  const content = await readFile(filePath, "utf-8");
  const lines = content.split("\n");
  const result: string[] = [];
  
  // Tüm dosya için [-1] veya [0, -1]
  if (ranges.length === 1 && (ranges[0][1] === -1 || ranges[0][0] === -1)) {
    return addLineNumbers(content);
  }
  
  // Normalize edilmiş ranges
  const normalizedRanges = ranges.map(([start, end]) => {
    const normalizedEnd = end === -1 ? lines.length : end;
    return [Math.max(0, start), Math.min(normalizedEnd, lines.length)] as [number, number];
  });
  
  // Birleşik satır setleri
  const includedLines = new Set<number>();
  for (const [start, end] of normalizedRanges) {
    for (let i = start; i < end; i++) {
      includedLines.add(i);
    }
  }
  
  let lastIncluded = -2;
  for (let i = 0; i < lines.length; i++) {
    if (includedLines.has(i)) {
      if (i > lastIncluded + 1 && lastIncluded >= 0) {
        result.push("     ...");
      }
      result.push(`${String(i).padStart(4)} ${lines[i]}`);
      lastIncluded = i;
    }
  }
  
  return result.join("\n");
}

/**
 * Kod sembollerini (fonksiyon, class vb.) bul ve genişlet
 */
export async function expandSymbols(
  filePath: string,
  patterns: string[]
): Promise<string> {
  const content = await readFile(filePath, "utf-8");
  const ext = extname(filePath).toLowerCase();
  const lines = content.split("\n");
  const structures = parseCodeStructure(content, ext);
  
  const matchedRanges: [number, number][] = [];
  
  for (const pattern of patterns) {
    // "def function_name" veya "class ClassName" formatı
    const [prefix, name] = pattern.includes(" ") 
      ? pattern.split(" ", 2) 
      : [null, pattern];
    
    // Slash ile nested symbol: "MyClass/myMethod"
    const parts = name.split("/");
    
    for (const struct of structures) {
      let matches = false;
      
      if (parts.length === 1) {
        // Basit eşleşme
        matches = struct.name === parts[0] || struct.name.includes(parts[0]);
        if (prefix) {
          const typeMap: Record<string, string[]> = {
            "def": ["function", "method"],
            "function": ["function"],
            "class": ["class"],
            "interface": ["interface"],
            "type": ["type"],
          };
          matches = matches && (typeMap[prefix]?.includes(struct.type) ?? false);
        }
      } else if (parts.length === 2) {
        // Nested: parent/child
        const [parentName, childName] = parts;
        if (struct.name === parentName || struct.name.includes(parentName)) {
          // Parent içindeki child'ları bul
          for (const child of structures) {
            if (
              (child.name === childName || child.name.includes(childName)) &&
              child.startLine > struct.startLine &&
              child.endLine <= struct.endLine
            ) {
              matchedRanges.push([child.startLine, child.endLine + 1]);
            }
          }
        }
        continue;
      }
      
      if (matches) {
        matchedRanges.push([struct.startLine, struct.endLine + 1]);
      }
    }
  }
  
  if (matchedRanges.length === 0) {
    // Pattern bulunamadı, grep ile ara
    const grepMatches: number[] = [];
    for (const pattern of patterns) {
      const searchTerm = pattern.includes(" ") ? pattern.split(" ")[1] : pattern;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(searchTerm)) {
          grepMatches.push(i);
        }
      }
    }
    
    if (grepMatches.length > 0) {
      // Her eşleşme etrafında context göster
      for (const lineNum of grepMatches) {
        matchedRanges.push([Math.max(0, lineNum - 2), Math.min(lines.length, lineNum + 3)]);
      }
    }
  }
  
  if (matchedRanges.length === 0) {
    return `Pattern bulunamadı: ${patterns.join(", ")}`;
  }
  
  return expandLineRanges(filePath, matchedRanges);
}

// ============================================
// Directory Operations
// ============================================

/**
 * Klasör yapısını recursive olarak oku
 */
export async function readFolderStructure(
  folderPath: string,
  maxDepth: number = 3,
  currentDepth: number = 0
): Promise<FolderEntry[]> {
  if (currentDepth >= maxDepth) {
    return [];
  }
  
  try {
    const entries = await readdir(folderPath, { withFileTypes: true });
    const result: FolderEntry[] = [];
    
    // Önce dizinler, sonra dosyalar (sıralı)
    const sorted = entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });
    
    for (const entry of sorted) {
      // Ignore dirs
      if (entry.isDirectory() && IGNORE_DIRS.has(entry.name)) {
        continue;
      }
      
      const fullPath = join(folderPath, entry.name);
      
      if (entry.isDirectory()) {
        const children = await readFolderStructure(fullPath, maxDepth, currentDepth + 1);
        result.push({
          name: entry.name,
          type: "directory",
          path: fullPath,
          children,
        });
      } else {
        const stats = await stat(fullPath);
        result.push({
          name: entry.name,
          type: "file",
          path: fullPath,
          size: stats.size,
        });
      }
    }
    
    return result;
  } catch (error) {
    return [];
  }
}

/**
 * Klasör yapısını string olarak formatla
 */
export function formatFolderStructure(entries: FolderEntry[], indent: string = ""): string {
  const lines: string[] = [];
  
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const isLast = i === entries.length - 1;
    const prefix = indent + (isLast ? "└── " : "├── ");
    const childIndent = indent + (isLast ? "    " : "│   ");
    
    if (entry.type === "directory") {
      lines.push(`${prefix}${entry.name}/`);
      if (entry.children && entry.children.length > 0) {
        lines.push(formatFolderStructure(entry.children, childIndent));
      }
    } else {
      const sizeStr = entry.size ? ` (${formatSize(entry.size)})` : "";
      lines.push(`${prefix}${entry.name}${sizeStr}`);
    }
  }
  
  return lines.join("\n");
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// ============================================
// Grep / Search
// ============================================

/**
 * Dosya içeriğinde pattern ara
 */
export async function grepFile(
  filePath: string,
  pattern: RegExp,
  maxMatches: number = 100
): Promise<GrepMatch[]> {
  try {
    const ext = extname(filePath).toLowerCase();
    if (BINARY_EXTENSIONS.has(ext)) {
      return [];
    }
    
    const content = await readFile(filePath, "utf-8");
    const lines = content.split("\n");
    const matches: GrepMatch[] = [];
    
    for (let i = 0; i < lines.length && matches.length < maxMatches; i++) {
      const line = lines[i];
      const match = pattern.exec(line);
      if (match) {
        matches.push({
          file: filePath,
          line: i + 1, // 1-indexed for display
          content: line.trim(),
          matchStart: match.index,
          matchEnd: match.index + match[0].length,
        });
      }
    }
    
    return matches;
  } catch {
    return [];
  }
}

/**
 * Recursive olarak dosyalarda ara
 */
export async function grepDirectory(
  dirPath: string,
  contentPattern: RegExp | null,
  pathGlob: string | null,
  maxResults: number = 500
): Promise<GrepMatch[]> {
  const allMatches: GrepMatch[] = [];
  
  async function searchDir(currentPath: string): Promise<void> {
    if (allMatches.length >= maxResults) return;
    
    try {
      const entries = await readdir(currentPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (allMatches.length >= maxResults) break;
        
        const fullPath = join(currentPath, entry.name);
        
        if (entry.isDirectory()) {
          if (!IGNORE_DIRS.has(entry.name)) {
            await searchDir(fullPath);
          }
        } else {
          // Path glob check
          if (pathGlob && !matchGlob(fullPath, pathGlob)) {
            continue;
          }
          
          // Content search
          if (contentPattern) {
            const matches = await grepFile(fullPath, contentPattern, maxResults - allMatches.length);
            allMatches.push(...matches);
          } else {
            // Sadece path arama
            allMatches.push({
              file: fullPath,
              line: 0,
              content: "",
              matchStart: 0,
              matchEnd: 0,
            });
          }
        }
      }
    } catch {
      // Erişim hatası, devam et
    }
  }
  
  await searchDir(dirPath);
  return allMatches;
}

/**
 * Basit glob pattern matching
 */
export function matchGlob(path: string, pattern: string): boolean {
  // Glob pattern matching:
  // ** → herhangi bir path (alt dizinler dahil)
  // * → tek dizin seviyesinde herhangi bir karakter (/ hariç)
  // ? → tek karakter
  
  // Önce ** için placeholder kullan (tek * ile karışmaması için)
  const placeholder = "\x00GLOBSTAR\x00";
  const regexPattern = pattern
    .replace(/\*\*/g, placeholder)  // ** → placeholder
    .replace(/\./g, "\\.")         // . → \.
    .replace(/\*/g, "[^/]*")        // * → [^/]* (tek seviye)
    .replace(/\?/g, ".")            // ? → .
    .replace(new RegExp(placeholder, "g"), ".*");  // placeholder → .* (çok seviye)
  
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(path) || regex.test(basename(path));
}

// ============================================
// Find & Replace
// ============================================

/**
 * Dosyada bul ve değiştir
 */
export async function findAndReplace(
  filePath: string,
  find: string,
  replace: string
): Promise<{ success: boolean; replacements: number; error?: string }> {
  try {
    const content = await readFile(filePath, "utf-8");
    
    // Kaç kez değişiklik yapılacak
    const occurrences = content.split(find).length - 1;
    
    if (occurrences === 0) {
      return { success: false, replacements: 0, error: "Pattern bulunamadı" };
    }
    
    const newContent = content.split(find).join(replace);
    
    // Dosyayı yaz
    const { writeFile } = await import("fs/promises");
    await writeFile(filePath, newContent, "utf-8");
    
    return { success: true, replacements: occurrences };
  } catch (error) {
    return { success: false, replacements: 0, error: (error as Error).message };
  }
}

// ============================================
// Exports
// ============================================

export {
  COLLAPSE_THRESHOLD,
  CODE_EXTENSIONS,
  BINARY_EXTENSIONS,
  IGNORE_DIRS,
};
