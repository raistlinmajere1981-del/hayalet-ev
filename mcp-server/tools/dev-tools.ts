/**
 * Development Tools for MCP Server
 * 
 * Hayalet-ev geliştirme workflow'ları için araçlar:
 * - dev_analyze_project: Proje analizi
 * - dev_bootstrap_context: Session context üretimi
 * - dev_find_unused: Kullanılmayan kod tespiti
 * - dev_generate_diagram: Bağımlılık diagramı
 * - dev_update_cache: Proje cache güncelleme
 * - dev_edit_lines: Satır bazlı düzenleme
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { readdir } from "fs/promises";
import { join, relative, basename } from "path";
import { execSync, exec } from "child_process";
import { extname } from "path";
import { createHash } from "crypto";
import { createProgress } from "../utils/progress.js";
import { logToolError } from "../utils/mcp-logger.js";
import { DEV_TIMEOUTS } from "../utils/timeouts.js";
import { getContextPreview } from "../utils/file-utils.js";

// ============================================
// Shared Configuration
// ============================================

const CONFIG = {
  srcDirs: ["src/js", "electron", "mcp-server"],
  ignoreDirs: ["node_modules", ".git", "dist", ".vite", "logs", "data", "test-screenshots"],
  extensions: [".ts", ".js", ".cjs", ".mjs"],
  safeModules: [
    "file-utils.ts", "url-utils.ts", "provider-registry.ts",
    "device-manager.ts", "screenshot-manager.ts", "whisper-manager.ts",
    "googledrive-manager.ts", "server-commands.ts",
  ],
};

// ============================================
// Shared Utilities
// ============================================

async function getAllFiles(dir: string, projectRoot: string, files: string[] = []): Promise<string[]> {
  const fullDir = join(projectRoot, dir);
  if (!existsSync(fullDir)) return files;
  
  const entries = await readdir(fullDir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(fullDir, entry.name);
    const relativePath = relative(projectRoot, fullPath);
    
    if (entry.isDirectory()) {
      if (!CONFIG.ignoreDirs.includes(entry.name)) {
        await getAllFiles(relativePath, projectRoot, files);
      }
    } else if (entry.isFile() && CONFIG.extensions.some(ext => entry.name.endsWith(ext))) {
      files.push(relativePath);
    }
  }
  
  return files;
}

function countLines(filePath: string): number {
  try {
    const content = readFileSync(filePath, "utf-8");
    return content.split("\n").length;
  } catch {
    return 0;
  }
}

// ============================================
// Tool 1: Analyze Project
// ============================================

interface AnalyzeResult {
  summary: {
    totalFiles: number;
    totalLines: number;
    byDirectory: Record<string, { files: number; lines: number }>;
  };
  dependencies?: {
    production: string[];
    development: string[];
  };
  modules?: Array<{ file: string; imports: string[]; exports: string[] }>;
  git?: {
    branch: string;
    lastCommits: string[];
    hasChanges: boolean;
  };
}

export async function analyzeProject(
  projectRoot: string,
  options: { mode?: "summary" | "deps" | "modules" | "full" } = {}
): Promise<AnalyzeResult> {
  const mode = options.mode || "summary";
  const progress = createProgress({ operation: "Proje analizi", total: CONFIG.srcDirs.length + 3 });
  
  const result: AnalyzeResult = {
    summary: { totalFiles: 0, totalLines: 0, byDirectory: {} },
  };

  // Dosya istatistikleri
  let step = 0;
  for (const srcDir of CONFIG.srcDirs) {
    progress.update(++step, `${srcDir} taranıyor...`);
    const files = await getAllFiles(srcDir, projectRoot);
    let dirLines = 0;
    
    for (const file of files) {
      const lines = countLines(join(projectRoot, file));
      dirLines += lines;
    }
    
    result.summary.byDirectory[srcDir] = { files: files.length, lines: dirLines };
    result.summary.totalFiles += files.length;
    result.summary.totalLines += dirLines;
  }

  // Dependencies
  if (mode === "deps" || mode === "full") {
    try {
      const pkg = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf-8"));
      result.dependencies = {
        production: Object.keys(pkg.dependencies || {}),
        development: Object.keys(pkg.devDependencies || {}),
      };
    } catch { /* ignore */ }
  }

  // Git info
  if (mode === "summary" || mode === "full") {
    try {
      const branch = execSync("git branch --show-current", { cwd: projectRoot, encoding: "utf-8" }).trim();
      const commits = execSync("git log --oneline -5", { cwd: projectRoot, encoding: "utf-8" }).trim().split("\n");
      const status = execSync("git status --short", { cwd: projectRoot, encoding: "utf-8" }).trim();
      result.git = { branch, lastCommits: commits, hasChanges: status.length > 0 };
    } catch { /* ignore */ }
  }

  // Module analysis
  if (mode === "modules" || mode === "full") {
    progress.update(++step, "Modüller analiz ediliyor...");
    result.modules = [];
    const allFiles: string[] = [];
    for (const srcDir of CONFIG.srcDirs) {
      const files = await getAllFiles(srcDir, projectRoot);
      allFiles.push(...files);
    }
    
    for (const file of allFiles.slice(0, 50)) { // Limit for performance
      try {
        const content = readFileSync(join(projectRoot, file), "utf-8");
        const imports = [...content.matchAll(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g)].map(m => m[1]);
        const exports = [...content.matchAll(/export\s+(?:async\s+)?(?:function|const|class|interface|type)\s+(\w+)/g)].map(m => m[1]);
        if (imports.length > 0 || exports.length > 0) {
          result.modules.push({ file, imports, exports });
        }
      } catch { /* ignore */ }
    }
  }

  progress.done(`${result.summary.totalFiles} dosya analiz edildi`);
  return result;
}

// ============================================
// Tool 2: Bootstrap Context
// ============================================

interface BootstrapResult {
  content: string;
  outputPath?: string;
  stats: { sections: number; lines: number };
}

export async function bootstrapContext(
  projectRoot: string,
  options: { print?: boolean; full?: boolean } = {}
): Promise<BootstrapResult> {
  const lines: string[] = [];
  const now = new Date().toISOString().split("T")[0];
  
  // Header
  lines.push("# Hayalet-ev Project Context");
  lines.push(`> Auto-generated: ${now} | Regenerate: \`npm run bootstrap\``);
  lines.push("");

  // Package info
  try {
    const pkg = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf-8"));
    lines.push("## 📦 Proje Bilgisi");
    lines.push(`- **Ad:** ${pkg.name} v${pkg.version}`);
    
    // Git info
    try {
      const branch = execSync("git branch --show-current", { cwd: projectRoot, encoding: "utf-8" }).trim();
      const status = execSync("git status --short", { cwd: projectRoot, encoding: "utf-8" }).trim();
      lines.push(`- **Branch:** ${branch}`);
      lines.push(`- **Uncommitted:** ${status ? `${status.split("\n").length} dosya` : "Yok ✓"}`);
    } catch { /* ignore */ }
    lines.push("");
  } catch { /* ignore */ }

  // Directory stats
  lines.push("## 📊 Yapı Özeti");
  for (const srcDir of CONFIG.srcDirs) {
    const files = await getAllFiles(srcDir, projectRoot);
    let totalLines = 0;
    for (const file of files) {
      totalLines += countLines(join(projectRoot, file));
    }
    lines.push(`- \`${srcDir}/\`: ${files.length} dosya, ${totalLines} satır`);
  }
  lines.push("");

  // Module map
  lines.push("## 🗺️ Modül Haritası");
  lines.push("");
  lines.push("### Orchestrator'lar");
  lines.push("- core-engine.ts - Ana koordinatör");
  lines.push("- webview-manager.ts - Webview lifecycle");
  lines.push("- traffic-manager.ts - State tracking");
  lines.push("- slot-controller.ts - Slot yaşam döngüsü");
  lines.push("");

  // Critical rules
  lines.push("## ⚡ Kritik Kurallar");
  lines.push("- ❌ console.log kullanma → LogManager.addEvent() kullan");
  lines.push("- ✅ Her error log'a context ekle");
  lines.push("- ✅ Test sonrası logs/ klasörünü kontrol et");
  lines.push("");

  // Commands
  lines.push("## 🛠️ Sık Kullanılan Komutlar");
  lines.push("- `npm start` - Uygulamayı başlat");
  lines.push("- `npm run lint` - Kod kontrolü");
  lines.push("- `npm run pre-commit` - Commit öncesi");
  lines.push("");

  // Recent commits
  try {
    const commits = execSync("git log --oneline -5", { cwd: projectRoot, encoding: "utf-8" }).trim().split("\n");
    lines.push("## 🔄 Son Commit'ler");
    for (const commit of commits) {
      lines.push(`- ${commit}`);
    }
    lines.push("");
  } catch { /* ignore */ }

  lines.push("---");
  lines.push("*Bu dosya otomatik üretilir. Manuel düzenleme yapmayın.*");

  const content = lines.join("\n");
  
  // Write to file if not print mode
  let outputPath: string | undefined;
  if (!options.print) {
    outputPath = join(projectRoot, ".rovodev/context.md");
    writeFileSync(outputPath, content, "utf-8");
  }

  return {
    content: options.print ? content : `Context dosyası güncellendi: ${outputPath}`,
    outputPath,
    stats: { sections: 6, lines: lines.length },
  };
}

// ============================================
// Tool 3: Generate Diagram
// ============================================

interface DiagramResult {
  format: "mermaid" | "dot";
  diagram: string;
  nodeCount: number;
  edgeCount: number;
}

export async function generateDiagram(
  projectRoot: string,
  options: { format?: "mermaid" | "dot"; module?: string; depth?: number } = {}
): Promise<DiagramResult> {
  const format = options.format || "mermaid";
  // const _maxDepth = options.depth || 10; // TODO: Implement depth limiting
  
  const allFiles: string[] = [];
  for (const srcDir of CONFIG.srcDirs) {
    const files = await getAllFiles(srcDir, projectRoot);
    allFiles.push(...files);
  }

  // Build dependency graph
  const graph: Map<string, string[]> = new Map();
  
  for (const file of allFiles) {
    const fileName = basename(file).replace(/\.(ts|js|mjs|cjs)$/, "");
    
    // Filter by module if specified
    if (options.module && !file.includes(options.module)) continue;
    
    try {
      const content = readFileSync(join(projectRoot, file), "utf-8");
      const imports = [...content.matchAll(/from\s+['"]\.\.?\/([^'"]+)['"]/g)]
        .map(m => basename(m[1]).replace(/\.(ts|js|mjs|cjs)$/, ""));
      
      if (imports.length > 0) {
        graph.set(fileName, imports);
      }
    } catch { /* ignore */ }
  }

  // Generate output
  let diagram = "";
  let edgeCount = 0;
  
  if (format === "mermaid") {
    diagram = "```mermaid\nflowchart TD\n";
    for (const [from, tos] of graph) {
      for (const to of tos) {
        diagram += `  ${from} --> ${to}\n`;
        edgeCount++;
      }
    }
    diagram += "```";
  } else {
    diagram = "digraph Dependencies {\n  rankdir=LR;\n  node [shape=box];\n";
    for (const [from, tos] of graph) {
      for (const to of tos) {
        diagram += `  "${from}" -> "${to}";\n`;
        edgeCount++;
      }
    }
    diagram += "}";
  }

  return {
    format,
    diagram,
    nodeCount: graph.size,
    edgeCount,
  };
}

// ============================================
// Tool 5: Update Cache
// ============================================

interface CacheData {
  version: string;
  timestamp: string;
  files: Record<string, { hash: string; lines: number; exports: string[] }>;
  stats: { totalFiles: number; totalLines: number; totalExports: number };
}

interface CacheResult {
  updated: boolean;
  path: string;
  stats: { totalFiles: number; totalLines: number; totalExports: number };
  changedFiles: string[];
}

export async function updateCache(
  projectRoot: string,
  options: { force?: boolean; show?: boolean } = {}
): Promise<CacheResult> {
  const cachePath = join(projectRoot, ".rovodev/cache.json");
  
  // Load existing cache
  let existingCache: CacheData | null = null;
  if (existsSync(cachePath) && !options.force) {
    try {
      existingCache = JSON.parse(readFileSync(cachePath, "utf-8"));
    } catch { /* ignore */ }
  }

  // Show mode
  if (options.show && existingCache) {
    return {
      updated: false,
      path: cachePath,
      stats: existingCache.stats,
      changedFiles: [],
    };
  }

  // Build new cache
  const newCache: CacheData = {
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    files: {},
    stats: { totalFiles: 0, totalLines: 0, totalExports: 0 },
  };

  const changedFiles: string[] = [];
  const allFiles: string[] = [];
  
  for (const srcDir of CONFIG.srcDirs) {
    const files = await getAllFiles(srcDir, projectRoot);
    allFiles.push(...files);
  }

  for (const file of allFiles) {
    try {
      const content = readFileSync(join(projectRoot, file), "utf-8");
      const hash = createHash("md5").update(content).digest("hex").slice(0, 8);
      const lines = content.split("\n").length;
      const exports = [...content.matchAll(/export\s+(?:async\s+)?(?:function|const|class|interface|type)\s+(\w+)/g)]
        .map(m => m[1]);

      // Check if changed
      if (existingCache?.files[file]?.hash !== hash) {
        changedFiles.push(file);
      }

      newCache.files[file] = { hash, lines, exports };
      newCache.stats.totalFiles++;
      newCache.stats.totalLines += lines;
      newCache.stats.totalExports += exports.length;
    } catch { /* ignore */ }
  }

  // Write cache
  writeFileSync(cachePath, JSON.stringify(newCache, null, 2), "utf-8");

  return {
    updated: true,
    path: cachePath,
    stats: newCache.stats,
    changedFiles,
  };
}

// ============================================
// Tool 6: Edit Lines
// ============================================

interface EditLinesResult {
  success: boolean;
  message: string;
  linesAffected?: number;
  preview?: string;
  contextPreview?: string; // Değişiklik bölgesinin context'i (±5 satır)
  syntaxValid?: boolean;
  syntaxError?: string;
}

export async function editLines(
  filePath: string,
  options: {
    operation: "replace" | "delete" | "insert" | "show";
    startLine: number;
    endLine?: number;
    content?: string;
    dryRun?: boolean;
    validateSyntax?: boolean;
  },
  projectRoot?: string
): Promise<EditLinesResult> {
  if (!existsSync(filePath)) {
    return { success: false, message: `Dosya bulunamadı: ${filePath}` };
  }

  const originalContent = readFileSync(filePath, "utf-8");
  const lines = originalContent.split("\n");
  const start = options.startLine - 1; // 1-indexed to 0-indexed
  const end = options.endLine ? options.endLine : start + 1;

  // Validate range
  if (start < 0 || start >= lines.length) {
    return { success: false, message: `Geçersiz başlangıç satırı: ${options.startLine}` };
  }

  switch (options.operation) {
    case "show": {
      const showEnd = Math.min(end, lines.length);
      const preview = lines.slice(start, showEnd)
        .map((line, i) => `${String(start + i + 1).padStart(4)} | ${line}`)
        .join("\n");
      return { success: true, message: "Satırlar gösteriliyor", preview, linesAffected: showEnd - start };
    }

    case "delete": {
      const newLines = [...lines.slice(0, start), ...lines.slice(end)];
      
      // Context preview oluştur (değişiklik yapılmadan önce)
      let contextPreview: string | undefined;
      try {
        contextPreview = await getContextPreview(filePath, start, end, 5);
      } catch (err) {
        // Preview oluşturulamazsa devam et
      }
      
      if (!options.dryRun) {
        writeFileSync(filePath, newLines.join("\n"), "utf-8");
      }
      return { 
        success: true, 
        message: options.dryRun ? "Dry run: silme yapılacak" : `${end - start} satır silindi`,
        linesAffected: end - start,
        contextPreview,
      };
    }

    case "insert": {
      if (!options.content) {
        return { success: false, message: "İçerik gerekli" };
      }
      const insertLines = options.content.split("\n");
      const newLines = [...lines.slice(0, start + 1), ...insertLines, ...lines.slice(start + 1)];
      
      // Değişiklik yap ve sonra context preview oluştur
      if (!options.dryRun) {
        writeFileSync(filePath, newLines.join("\n"), "utf-8");
      }
      
      // Context preview (eklenen bölge için)
      let contextPreview: string | undefined;
      try {
        contextPreview = await getContextPreview(filePath, start + 1, start + 1 + insertLines.length, 5);
      } catch (err) {
        // Preview oluşturulamazsa devam et
      }
      
      return { 
        success: true, 
        message: options.dryRun ? "Dry run: ekleme yapılacak" : `${insertLines.length} satır eklendi`,
        linesAffected: insertLines.length,
        contextPreview,
      };
    }

    case "replace": {
      if (!options.content) {
        return { success: false, message: "İçerik gerekli" };
      }
      const replaceLines = options.content.split("\n");
      const newLines = [...lines.slice(0, start), ...replaceLines, ...lines.slice(end)];
      
      // Syntax validation (TypeScript/JavaScript dosyaları için)
      let syntaxValid = true;
      let syntaxError: string | undefined;
      
      if (options.validateSyntax && projectRoot && /\.(ts|js|tsx|jsx)$/.test(filePath)) {
        const tempContent = newLines.join("\n");
        try {
          // Node.js syntax check (basit ama hızlı)
          execSync(`node --check --input-type=module`, {
            input: tempContent,
            cwd: projectRoot,
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
            timeout: 5000
          });
          syntaxValid = true;
        } catch (err: any) {
          syntaxValid = false;
          const error = err as { stderr?: { toString(): string }; message?: string };
          syntaxError = error.stderr?.toString() || error.message || "Syntax hatası";
          
          // Dry run değilse ve syntax hatası varsa işlemi iptal et
          if (!options.dryRun) {
            return {
              success: false,
              message: "Syntax hatası tespit edildi, değişiklik yapılmadı",
              syntaxValid: false,
              syntaxError
            };
          }
        }
      }
      
      if (!options.dryRun) {
        writeFileSync(filePath, newLines.join("\n"), "utf-8");
      }
      
      // Context preview (değiştirilen bölge için)
      let contextPreview: string | undefined;
      try {
        contextPreview = await getContextPreview(filePath, start, start + replaceLines.length, 5);
      } catch (err) {
        // Preview oluşturulamazsa devam et
      }
      
      return { 
        success: true, 
        message: options.dryRun ? "Dry run: değişiklik yapılacak" : `${end - start} satır değiştirildi`,
        linesAffected: end - start,
        contextPreview,
        syntaxValid,
        syntaxError
      };
    }

    default:
      return { success: false, message: `Bilinmeyen işlem: ${options.operation}` };
  }
}

// ============================================
// Tool 7: Git Diff
// ============================================

export function gitDiff(projectRoot: string, options: { staged?: boolean; file?: string } = {}): { success: boolean; diff: string; stats?: { additions: number; deletions: number } } {
  try {
    let cmd = "git diff";
    if (options.staged) cmd += " --staged";
    if (options.file) cmd += ` -- "${options.file}"`;
    
    const diff = execSync(cmd, { cwd: projectRoot, encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });
    
    // Stats
    let statsCmd = "git diff --stat";
    if (options.staged) statsCmd += " --staged";
    if (options.file) statsCmd += ` -- "${options.file}"`;
    
    const statOutput = execSync(statsCmd, { cwd: projectRoot, encoding: "utf-8" });
    const statMatch = statOutput.match(/(\d+) insertions?\(\+\).*?(\d+) deletions?\(-\)/);
    
    return {
      success: true,
      diff: diff || "Değişiklik yok",
      stats: statMatch ? { additions: parseInt(statMatch[1]), deletions: parseInt(statMatch[2]) } : undefined,
    };
  } catch (error) {
    logToolError("hev_dev_git_diff", error as Error, { staged: options.staged, file: options.file });
    return { success: false, diff: (error as Error).message };
  }
}

// ============================================
// Tool 8: Lint File
// ============================================

export function lintFile(projectRoot: string, filePath: string, fix: boolean = false): { success: boolean; output: string; errorCount: number; warningCount: number } {
  const progress = createProgress({ operation: "ESLint", interval: 5000 });
  
  try {
    const fixArg = fix ? " --fix" : "";
    const cmd = `npx eslint "${filePath}" --format stylish${fixArg}`;
    progress.update(0, `${filePath} lint ediliyor...`);
    
    try {
      const output = execSync(cmd, { cwd: projectRoot, encoding: "utf-8", timeout: DEV_TIMEOUTS.LINT });
      progress.done("Hata bulunamadı");
      return { success: true, output: output || "✅ Hata bulunamadı", errorCount: 0, warningCount: 0 };
    } catch (err) {
      const error = err as { stdout?: string; stderr?: string; status?: number };
      const output = error.stdout || error.stderr || "";
      
      // Parse error/warning counts
      const errorMatch = output.match(/(\d+) errors?/);
      const warningMatch = output.match(/(\d+) warnings?/);
      const errorCount = errorMatch ? parseInt(errorMatch[1]) : 0;
      const warningCount = warningMatch ? parseInt(warningMatch[1]) : 0;
      
      progress.fail(`${errorCount} hata, ${warningCount} uyarı`);
      return {
        success: false,
        output,
        errorCount,
        warningCount,
      };
    }
  } catch (error) {
    progress.fail((error as Error).message);
    logToolError("hev_dev_lint_file", error as Error, { filePath, fix });
    return { success: false, output: (error as Error).message, errorCount: 0, warningCount: 0 };
  }
}

// ============================================
// Tool 9: Search Symbol
// ============================================

export async function searchSymbol(projectRoot: string, symbol: string, options: { type?: "function" | "class" | "interface" | "type" | "const" | "all" } = {}): Promise<{ matches: Array<{ file: string; line: number; type: string; context: string }>; total: number }> {
  const allFiles: string[] = [];
  for (const srcDir of CONFIG.srcDirs) {
    const files = await getAllFiles(srcDir, projectRoot);
    allFiles.push(...files);
  }
  
  const matches: Array<{ file: string; line: number; type: string; context: string }> = [];
  const symbolType = options.type || "all";
  
  // Build regex patterns based on type
  const patterns: Record<string, RegExp> = {
    function: new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+(${symbol})\\s*\\(`, "i"),
    class: new RegExp(`(?:export\\s+)?(?:abstract\\s+)?class\\s+(${symbol})`, "i"),
    interface: new RegExp(`(?:export\\s+)?interface\\s+(${symbol})`, "i"),
    type: new RegExp(`(?:export\\s+)?type\\s+(${symbol})\\s*=`, "i"),
    const: new RegExp(`(?:export\\s+)?const\\s+(${symbol})\\s*[=:]`, "i"),
  };
  
  const searchPatterns = symbolType === "all" ? Object.entries(patterns) : [[symbolType, patterns[symbolType]]];
  
  for (const file of allFiles) {
    try {
      const content = readFileSync(join(projectRoot, file), "utf-8");
      const lines = content.split("\n");
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        for (const [type, pattern] of searchPatterns as [string, RegExp][]) {
          if (pattern && pattern.test(line)) {
            matches.push({
              file,
              line: i + 1,
              type,
              context: line.trim().slice(0, 100),
            });
          }
        }
        
        // Also search for usage (not just definition)
        if (line.includes(symbol) && !matches.some(m => m.file === file && m.line === i + 1)) {
          matches.push({
            file,
            line: i + 1,
            type: "usage",
            context: line.trim().slice(0, 100),
          });
        }
      }
    } catch { /* ignore */ }
  }
  
  // Limit results
  return { matches: matches.slice(0, 100), total: matches.length };
}

// ============================================
// Tool 10: Test Run
// ============================================

export function testRun(projectRoot: string, options: { file?: string; grep?: string; timeout?: number } = {}): { success: boolean; output: string; passed: number; failed: number } {
  const progress = createProgress({ operation: "Test çalıştırma", interval: 3000 });
  
  try {
    let cmd = "npm test";
    
    // Check if project uses vitest, jest, or mocha
    const pkg = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf-8"));
    const hasVitest = pkg.devDependencies?.vitest || pkg.dependencies?.vitest;
    const hasJest = pkg.devDependencies?.jest || pkg.dependencies?.jest;
    
    if (hasVitest) {
      cmd = "npx vitest run";
      if (options.file) cmd += ` ${options.file}`;
      if (options.grep) cmd += ` --grep "${options.grep}"`;
    } else if (hasJest) {
      cmd = "npx jest";
      if (options.file) cmd += ` ${options.file}`;
      if (options.grep) cmd += ` -t "${options.grep}"`;
    }
    
    const timeout = options.timeout || DEV_TIMEOUTS.TEST;
    progress.update(0, `${cmd} çalıştırılıyor...`);
    
    try {
      const output = execSync(cmd, { cwd: projectRoot, encoding: "utf-8", timeout, maxBuffer: 10 * 1024 * 1024 });
      
      // Parse test results
      const passMatch = output.match(/(\d+)\s+pass/i);
      const failMatch = output.match(/(\d+)\s+fail/i);
      const passed = passMatch ? parseInt(passMatch[1]) : 0;
      const failed = failMatch ? parseInt(failMatch[1]) : 0;
      
      progress.done(`${passed} passed, ${failed} failed`);
      return {
        success: true,
        output,
        passed,
        failed,
      };
    } catch (err) {
      const error = err as { stdout?: string; stderr?: string };
      const output = error.stdout || error.stderr || "";
      
      const passMatch = output.match(/(\d+)\s+pass/i);
      const failMatch = output.match(/(\d+)\s+fail/i);
      const passed = passMatch ? parseInt(passMatch[1]) : 0;
      const failed = failMatch ? parseInt(failMatch[1]) : 0;
      
      progress.fail(`${passed} passed, ${failed} failed`);
      return {
        success: false,
        output,
        passed,
        failed,
      };
    }
  } catch (error) {
    progress.fail((error as Error).message);
    logToolError("hev_dev_test_run", error as Error, { file: options.file, grep: options.grep, timeout: options.timeout });
    return { success: false, output: (error as Error).message, passed: 0, failed: 0 };
  }
}

// ============================================
// Tool Definitions (for MCP registration)
// ============================================

export const DEV_TOOL_DEFINITIONS = [
  {
    name: "hev_dev_analyze_project",
    description: "Proje analizi: dosya sayıları, satır sayıları, bağımlılıklar, git durumu",
    inputSchema: {
      type: "object" as const,
      properties: {
        mode: {
          type: "string",
          enum: ["summary", "deps", "modules", "full"],
          description: "Analiz modu: summary (hızlı), deps (bağımlılıklar), modules (import/export), full (tümü)",
          default: "summary",
        },
      },
    },
  },
  {
    name: "hev_dev_bootstrap_context",
    description: "Session context dosyası üret (.rovodev/context.md). Yeni AI session başlatırken kullanışlı.",
    inputSchema: {
      type: "object" as const,
      properties: {
        print: {
          type: "boolean",
          description: "Dosyaya yazmak yerine içeriği döndür",
          default: false,
        },
        full: {
          type: "boolean",
          description: "Detaylı versiyon",
          default: false,
        },
      },
    },
  },
  {
    name: "hev_dev_generate_diagram",
    description: "Modül bağımlılık diagramı oluştur (Mermaid veya DOT formatında)",
    inputSchema: {
      type: "object" as const,
      properties: {
        format: {
          type: "string",
          enum: ["mermaid", "dot"],
          description: "Çıktı formatı",
          default: "mermaid",
        },
        module: {
          type: "string",
          description: "Sadece belirli modülü filtrele (örn: 'webview', 'traffic')",
        },
        depth: {
          type: "integer",
          description: "Maksimum derinlik",
          default: 10,
        },
      },
    },
  },
  {
    name: "hev_dev_update_cache",
    description: "Proje cache'ini güncelle (export/import haritası, dosya hash'leri)",
    inputSchema: {
      type: "object" as const,
      properties: {
        force: {
          type: "boolean",
          description: "Cache'i sıfırdan oluştur",
          default: false,
        },
        show: {
          type: "boolean",
          description: "Mevcut cache'i göster (güncelleme yapma)",
          default: false,
        },
      },
    },
  },
  {
    name: "hev_dev_edit_lines",
    description: "Satır bazlı dosya düzenleme. Büyük dosyalarda find_and_replace yerine kullanılabilir.",
    inputSchema: {
      type: "object" as const,
      properties: {
        file_path: {
          type: "string",
          description: "Dosya yolu",
        },
        operation: {
          type: "string",
          enum: ["replace", "delete", "insert", "show"],
          description: "İşlem türü",
        },
        start_line: {
          type: "integer",
          description: "Başlangıç satırı (1-indexed)",
        },
        end_line: {
          type: "integer",
          description: "Bitiş satırı (dahil, delete/replace için)",
        },
        content: {
          type: "string",
          description: "Yeni içerik (replace/insert için)",
        },
        dry_run: {
          type: "boolean",
          description: "Değişiklikleri uygulama, sadece önizle",
          default: false,
        },
      },
      required: ["file_path", "operation", "start_line"],
    },
  },
  {
    name: "hev_dev_git_diff",
    description: "Git değişikliklerini göster (staged veya unstaged)",
    inputSchema: {
      type: "object" as const,
      properties: {
        staged: {
          type: "boolean",
          description: "Sadece staged değişiklikleri göster",
          default: false,
        },
        file: {
          type: "string",
          description: "Sadece belirli dosyanın değişikliklerini göster",
        },
      },
    },
  },
  {
    name: "hev_dev_lint_file",
    description: "Tek dosyada ESLint çalıştır",
    inputSchema: {
      type: "object" as const,
      properties: {
        file_path: {
          type: "string",
          description: "Lint yapılacak dosya yolu",
        },
        fix: {
          type: "boolean",
          description: "Otomatik düzeltilebilir hataları düzelt",
          default: false,
        },
      },
      required: ["file_path"],
    },
  },
  {
    name: "hev_dev_search_symbol",
    description: "Projede sembol ara (fonksiyon, class, interface, type, const)",
    inputSchema: {
      type: "object" as const,
      properties: {
        symbol: {
          type: "string",
          description: "Aranacak sembol adı",
        },
        type: {
          type: "string",
          enum: ["function", "class", "interface", "type", "const", "all"],
          description: "Sembol tipi filtresi",
          default: "all",
        },
      },
      required: ["symbol"],
    },
  },
  {
    name: "hev_dev_test_run",
    description: "Test çalıştır (vitest/jest otomatik algılanır)",
    inputSchema: {
      type: "object" as const,
      properties: {
        file: {
          type: "string",
          description: "Sadece belirli test dosyasını çalıştır",
        },
        grep: {
          type: "string",
          description: "Test adı filtresi",
        },
        timeout: {
          type: "integer",
          description: "Timeout (ms)",
          default: DEV_TIMEOUTS.TEST,
        },
      },
    },
  },
  {
    name: "hev_dev_check_syntax",
    description: "Dosyada syntax hataları, parantez dengesi ve ESLint kontrolleri yap",
    inputSchema: {
      type: "object" as const,
      properties: {
        file_path: {
          type: "string",
          description: "Kontrol edilecek dosya yolu",
        },
        check_brackets: {
          type: "boolean",
          description: "Parantez dengesi kontrolü (varsayılan: true)",
          default: true,
        },
        check_eslint: {
          type: "boolean",
          description: "ESLint syntax kontrolü (varsayılan: true)",
          default: true,
        },
        check_ts: {
          type: "boolean",
          description: "TypeScript type check (varsayılan: false)",
          default: false,
        },
      },
      required: ["file_path"],
    },
  },
  {
    name: "hev_dev_visualize_structure",
    description: "Dosya yapısını görselleştir: AST tree, scope hierarchy, bracket analysis, comment blocks. Parantez cehennemi sorunlarını çözmek için idealdir.",
    inputSchema: {
      type: "object" as const,
      properties: {
        file_path: {
          type: "string",
          description: "Analiz edilecek dosya yolu",
        },
        show_scopes: {
          type: "boolean",
          description: "Scope hierarchy göster (function, class, if, for, etc.)",
          default: true,
        },
        show_brackets: {
          type: "boolean",
          description: "Bracket analysis göster (kapanmamış/fazla parantezler)",
          default: true,
        },
        show_comments: {
          type: "boolean",
          description: "Comment blocks göster",
          default: true,
        },
        show_strings: {
          type: "boolean",
          description: "String literals göster",
          default: false,
        },
        max_depth: {
          type: "number",
          description: "Maksimum scope derinliği",
          default: 10,
        },
      },
      required: ["file_path"],
    },
  },
];

/**
 * Check syntax errors and bracket balance
 */

/**
 * Check syntax errors and bracket balance
 */
export async function checkSyntax(
  projectRoot: string,
  filePath: string,
  options: {
    checkBrackets?: boolean;
    checkESLint?: boolean;
    checkTS?: boolean;
  } = {}
): Promise<{
  success: boolean;
  output: string;
  errors: Array<{ line?: number; column?: number; message: string; type: string }>;
  bracketsBalanced: boolean;
  bracketDetails?: { open: number; close: number; type: string }[];
}> {
  const { checkBrackets = true, checkESLint = true, checkTS = false } = options;
  const errors: Array<{ line?: number; column?: number; message: string; type: string }> = [];
  const output: string[] = [];
  
  const fullPath = join(projectRoot, filePath);
  
  if (!existsSync(fullPath)) {
    return {
      success: false,
      output: `❌ Dosya bulunamadı: ${filePath}`,
      errors: [{ message: 'File not found', type: 'system' }],
      bracketsBalanced: false,
    };
  }

  const content = readFileSync(fullPath, 'utf-8');
  const ext = extname(filePath);
  
  output.push(`🔍 Syntax Kontrolü: ${filePath}`);
  output.push('─'.repeat(50));

  let bracketsBalanced = true;
  const bracketDetails: { open: number; close: number; type: string }[] = [];
  
  if (checkBrackets) {
    const brackets = [
      { open: '(', close: ')', name: 'Parantez' },
      { open: '{', close: '}', name: 'Süslü Parantez' },
      { open: '[', close: ']', name: 'Köşeli Parantez' },
    ];

    for (const bracket of brackets) {
      const openCount = (content.match(new RegExp(`\\${bracket.open}`, 'g')) || []).length;
      const closeCount = (content.match(new RegExp(`\\${bracket.close}`, 'g')) || []).length;
      
      bracketDetails.push({
        open: openCount,
        close: closeCount,
        type: bracket.name,
      });

      if (openCount !== closeCount) {
        bracketsBalanced = false;
        const diff = Math.abs(openCount - closeCount);
        const missing = openCount > closeCount ? bracket.close : bracket.open;
        errors.push({
          message: `${bracket.name} dengesi bozuk: ${diff} adet '${missing}' ${openCount > closeCount ? 'eksik' : 'fazla'}`,
          type: 'bracket',
        });
      }
    }

    if (bracketsBalanced) {
      output.push('✅ Parantez Dengesi: OK');
      bracketDetails.forEach((detail) => {
        output.push(`   ${detail.type}: ${detail.open}/${detail.close}`);
      });
    } else {
      output.push('❌ Parantez Dengesi: BOZUK');
      bracketDetails.forEach((detail) => {
        if (detail.open !== detail.close) {
          output.push(`   ${detail.type}: ${detail.open} açık / ${detail.close} kapalı`);
        }
      });
    }
  }

  if (checkESLint && ['.js', '.ts', '.jsx', '.tsx'].includes(ext)) {
    try {
      const eslintResult = await new Promise<string>((resolve) => {
        exec(
          `cd "${projectRoot}" && npx eslint --no-eslintrc --parser @typescript-eslint/parser "${filePath}" 2>&1 || true`,
          { timeout: DEV_TIMEOUTS.LINT },
          (error, stdout) => {
            resolve(stdout);
          }
        );
      });

      if (eslintResult.includes('error') || eslintResult.includes('Parsing error')) {
        output.push('❌ ESLint: Syntax hatası bulundu');
        
        const errorLines = eslintResult.split('\n').filter(line => 
          line.includes('error') || line.includes('Parsing error')
        );
        
        errorLines.slice(0, 5).forEach(line => {
          const match = line.match(/(\d+):(\d+)\s+error\s+(.+)/);
          if (match) {
            errors.push({
              line: parseInt(match[1]),
              column: parseInt(match[2]),
              message: match[3].trim(),
              type: 'eslint',
            });
            output.push(`   Line ${match[1]}: ${match[3].trim()}`);
          }
        });
      } else {
        output.push('✅ ESLint: Syntax OK');
      }
    } catch (err) {
      output.push('⚠️  ESLint: Kontrol edilemedi');
    }
  }

  if (checkTS && ['.ts', '.tsx'].includes(ext)) {
    try {
      const tscResult = await new Promise<string>((resolve) => {
        exec(
          `cd "${projectRoot}" && npx tsc --noEmit --pretty false "${filePath}" 2>&1 || true`,
          { timeout: DEV_TIMEOUTS.LINT },
          (error, stdout) => {
            resolve(stdout);
          }
        );
      });

      if (tscResult.includes('error TS')) {
        output.push('❌ TypeScript: Type hataları bulundu');
        
        const errorLines = tscResult.split('\n').filter(line => line.includes('error TS'));
        errorLines.slice(0, 5).forEach(line => {
          const match = line.match(/(\d+):(\d+) - error TS\d+: (.+)/);
          if (match) {
            errors.push({
              line: parseInt(match[1]),
              column: parseInt(match[2]),
              message: match[3].trim(),
              type: 'typescript',
            });
            output.push(`   Line ${match[1]}: ${match[3].trim()}`);
          }
        });
      } else {
        output.push('✅ TypeScript: Type check OK');
      }
    } catch (err) {
      output.push('⚠️  TypeScript: Kontrol edilemedi');
    }
  }

  if (ext === '.json') {
    try {
      JSON.parse(content);
      output.push('✅ JSON: Geçerli format');
    } catch (err) {
      const error = err as Error;
      errors.push({
        message: error.message,
        type: 'json',
      });
      output.push('❌ JSON: Geçersiz format');
      output.push(`   ${error.message}`);
    }
  }

  output.push('─'.repeat(50));

  const success = errors.length === 0 && bracketsBalanced;
  
  if (success) {
    output.push('✅ Tüm kontroller başarılı!');
  } else {
    output.push(`❌ ${errors.length} hata bulundu`);
  }

  return {
    success,
    output: output.join('\n'),
    errors,
    bracketsBalanced,
    bracketDetails,
  };
}

/**
 * Visualize file structure (AST, brackets, scopes)
 */
export async function visualizeStructure(
  projectRoot: string,
  filePath: string,
  options: {
    showScopes?: boolean;
    showBrackets?: boolean;
    showComments?: boolean;
    showStrings?: boolean;
    maxDepth?: number;
  } = {}
): Promise<{
  success: boolean;
  output: string;
  tree?: any;
  errors: string[];
}> {
  const { 
    showScopes = true, 
    showBrackets = true, 
    showComments = true,
    showStrings = false,
    maxDepth = 10 
  } = options;
  
  const fullPath = join(projectRoot, filePath);
  const errors: string[] = [];
  const output: string[] = [];
  
  if (!existsSync(fullPath)) {
    return {
      success: false,
      output: `❌ Dosya bulunamadı: ${filePath}`,
      errors: ['File not found'],
    };
  }

  const content = readFileSync(fullPath, 'utf-8');
  const ext = extname(filePath);
  const lines = content.split('\n');
  
  output.push(`🔍 Dosya Yapısı: ${filePath}`);
  output.push('═'.repeat(50));
  output.push('');

  let scopeCount = 0; // Track scope count outside try block

  // Try AST parsing for JS/TS files
  if (['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'].includes(ext)) {
    try {
      const { parse } = await import('@babel/parser');
      const traverseImport: any = await import('@babel/traverse');
      // Handle both CommonJS and ESM imports
      const traverse = typeof traverseImport === 'function' 
        ? traverseImport 
        : traverseImport.default?.default || traverseImport.default || traverseImport;
      
      const ast = parse(content, {
        sourceType: 'module',
        plugins: [
          'typescript',
          'jsx',
          'decorators-legacy',
          'classProperties',
          'objectRestSpread',
          'optionalChaining',
          'nullishCoalescingOperator',
        ],
      });

      if (showScopes) {
        output.push('📦 SCOPE HIERARCHY:');
        output.push('━'.repeat(50));
        
        const scopes: Array<{
          type: string;
          name: string;
          start: number;
          end: number;
          startLine: number;
          endLine: number;
          parent?: any;
        }> = [];

        traverse(ast, {
          FunctionDeclaration(path: any) {
            const node = path.node;
            scopes.push({
              type: 'function',
              name: node.id?.name || 'anonymous',
              start: node.start,
              end: node.end,
              startLine: node.loc.start.line,
              endLine: node.loc.end.line,
            });
          },
          FunctionExpression(path: any) {
            const node = path.node;
            scopes.push({
              type: 'function',
              name: node.id?.name || 'anonymous',
              start: node.start,
              end: node.end,
              startLine: node.loc.start.line,
              endLine: node.loc.end.line,
            });
          },
          ArrowFunctionExpression(path: any) {
            const node = path.node;
            scopes.push({
              type: 'arrow',
              name: 'arrow function',
              start: node.start,
              end: node.end,
              startLine: node.loc.start.line,
              endLine: node.loc.end.line,
            });
          },
          ClassDeclaration(path: any) {
            const node = path.node;
            scopes.push({
              type: 'class',
              name: node.id?.name || 'anonymous',
              start: node.start,
              end: node.end,
              startLine: node.loc.start.line,
              endLine: node.loc.end.line,
            });
          },
          IfStatement(path: any) {
            const node = path.node;
            scopes.push({
              type: 'if',
              name: 'if statement',
              start: node.start,
              end: node.end,
              startLine: node.loc.start.line,
              endLine: node.loc.end.line,
            });
          },
          ForStatement(path: any) {
            const node = path.node;
            scopes.push({
              type: 'for',
              name: 'for loop',
              start: node.start,
              end: node.end,
              startLine: node.loc.start.line,
              endLine: node.loc.end.line,
            });
          },
          WhileStatement(path: any) {
            const node = path.node;
            scopes.push({
              type: 'while',
              name: 'while loop',
              start: node.start,
              end: node.end,
              startLine: node.loc.start.line,
              endLine: node.loc.end.line,
            });
          },
          TryStatement(path: any) {
            const node = path.node;
            scopes.push({
              type: 'try',
              name: 'try block',
              start: node.start,
              end: node.end,
              startLine: node.loc.start.line,
              endLine: node.loc.end.line,
            });
          },
          SwitchStatement(path: any) {
            const node = path.node;
            scopes.push({
              type: 'switch',
              name: 'switch statement',
              start: node.start,
              end: node.end,
              startLine: node.loc.start.line,
              endLine: node.loc.end.line,
            });
          },
        });

        // Sort by start line
        scopes.sort((a, b) => a.startLine - b.startLine);

        // Build hierarchy
        const rootScopes = scopes.filter(s => 
          !scopes.some(parent => 
            parent.start < s.start && parent.end > s.end && parent !== s
          )
        );

        const renderScope = (scope: any, depth: number = 0, prefix: string = '') => {
          if (depth > maxDepth) return;
          
          const indent = '  '.repeat(depth);
          const lineRange = `${scope.startLine}-${scope.endLine}`;
          const icon = scope.type === 'function' ? '⚡' : 
                      scope.type === 'class' ? '🏛️' : 
                      scope.type === 'if' ? '🔀' :
                      scope.type === 'for' || scope.type === 'while' ? '🔁' :
                      scope.type === 'try' ? '🛡️' :
                      scope.type === 'switch' ? '🎛️' : '📦';
          
          const status = scope.endLine ? '✅' : '❌ UNCLOSED';
          
          output.push(`${indent}${lineRange.padEnd(8)} │ ${prefix}${icon} ${scope.name.padEnd(25)} ${status}`);

          // Find children
          const children = scopes.filter(child => 
            child.start > scope.start && 
            child.end < scope.end &&
            !scopes.some(between => 
              between.start > scope.start && 
              between.end < scope.end &&
              between.start < child.start && 
              between.end > child.end &&
              between !== child
            )
          );

          children.forEach((child, idx) => {
            const isLast = idx === children.length - 1;
            const childPrefix = isLast ? '└─ ' : '├─ ';
            renderScope(child, depth + 1, childPrefix);
          });
        };

        rootScopes.forEach(scope => renderScope(scope));
        
        output.push('━'.repeat(50));
        output.push('');
        
        scopeCount = scopes.length; // Save count before leaving scope
      }

      output.push(`✅ AST parse başarılı (${scopeCount} scope bulundu)`);

    } catch (err) {
      const error = err as Error;
      errors.push(`AST parse error: ${error.message}`);
      output.push(`⚠️  AST parse başarısız, fallback mod kullanılıyor...`);
      output.push('');
    }
  }

  // Bracket analysis (always run)
  if (showBrackets) {
    output.push('');
    output.push('🔗 BRACKET ANALYSIS:');
    output.push('━'.repeat(50));
    
    const bracketStack: Array<{ char: string; line: number; col: number }> = [];
    const bracketPairs = { '(': ')', '{': '}', '[': ']' };
    const unclosedBrackets: Array<{ char: string; line: number; col: number }> = [];
    const extraBrackets: Array<{ char: string; line: number; col: number }> = [];

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      
      for (let col = 0; col < line.length; col++) {
        const char = line[col];
        
        if (['(', '{', '['].includes(char)) {
          bracketStack.push({ char, line: lineIdx + 1, col: col + 1 });
        } else if ([')', '}', ']'].includes(char)) {
          const last = bracketStack[bracketStack.length - 1];
          const expectedOpen = Object.keys(bracketPairs).find(k => bracketPairs[k as keyof typeof bracketPairs] === char);
          
          if (last && last.char === expectedOpen) {
            bracketStack.pop();
          } else {
            extraBrackets.push({ char, line: lineIdx + 1, col: col + 1 });
          }
        }
      }
    }

    unclosedBrackets.push(...bracketStack);

    if (unclosedBrackets.length === 0 && extraBrackets.length === 0) {
      output.push('✅ Tüm parantezler dengeli');
    } else {
      if (unclosedBrackets.length > 0) {
        output.push(`❌ Kapanmamış parantezler (${unclosedBrackets.length}):`);
        unclosedBrackets.slice(0, 5).forEach(b => {
          output.push(`   Line ${b.line}, Col ${b.col}: '${b.char}' kapanmamış`);
        });
        if (unclosedBrackets.length > 5) {
          output.push(`   ... ve ${unclosedBrackets.length - 5} tane daha`);
        }
      }
      
      if (extraBrackets.length > 0) {
        output.push(`❌ Fazla kapanış parantezleri (${extraBrackets.length}):`);
        extraBrackets.slice(0, 5).forEach(b => {
          output.push(`   Line ${b.line}, Col ${b.col}: '${b.char}' açılış yok`);
        });
        if (extraBrackets.length > 5) {
          output.push(`   ... ve ${extraBrackets.length - 5} tane daha`);
        }
      }
    }
    
    output.push('━'.repeat(50));
  }

  // Comment analysis
  if (showComments) {
    output.push('');
    output.push('💬 COMMENT BLOCKS:');
    output.push('━'.repeat(50));
    
    const commentBlocks: Array<{ type: string; start: number; end?: number }> = [];
    let inMultilineComment = false;
    let multilineStart = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Single line comments
      if (line.includes('//')) {
        const idx = line.indexOf('//');
        commentBlocks.push({ type: 'single', start: i + 1 });
      }
      
      // Multi-line comments
      if (line.includes('/*')) {
        inMultilineComment = true;
        multilineStart = i + 1;
      }
      
      if (inMultilineComment && line.includes('*/')) {
        commentBlocks.push({ type: 'multi', start: multilineStart, end: i + 1 });
        inMultilineComment = false;
      }
    }

    if (inMultilineComment) {
      commentBlocks.push({ type: 'multi', start: multilineStart, end: undefined });
      errors.push(`Unclosed multi-line comment starting at line ${multilineStart}`);
    }

    if (commentBlocks.length === 0) {
      output.push('   (Yorum bloğu yok)');
    } else {
      const singleComments = commentBlocks.filter(c => c.type === 'single');
      const multiComments = commentBlocks.filter(c => c.type === 'multi');
      
      output.push(`   Single-line: ${singleComments.length}`);
      output.push(`   Multi-line: ${multiComments.length}`);
      
      multiComments.slice(0, 5).forEach(c => {
        if (c.end) {
          output.push(`   Line ${c.start}-${c.end}: /* ... */ ✅`);
        } else {
          output.push(`   Line ${c.start}: /* ... ❌ UNCLOSED`);
        }
      });
    }
    
    output.push('━'.repeat(50));
  }

  output.push('');
  output.push(`📊 Total Lines: ${lines.length}`);
  
  if (errors.length > 0) {
    output.push('');
    output.push('⚠️  ISSUES DETECTED:');
    errors.forEach(err => output.push(`   • ${err}`));
  }

  return {
    success: errors.length === 0,
    output: output.join('\n'),
    errors,
  };
}
