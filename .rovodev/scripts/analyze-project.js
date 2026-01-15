#!/usr/bin/env node

/**
 * Proje Analiz Script'i
 * 
 * AI agent'ların proje hakkında hızlı bilgi toplaması için kapsamlı analiz.
 * 
 * Kullanım:
 *   npm run analyze                 # Tam analiz
 *   npm run analyze -- --summary    # Sadece özet
 *   npm run analyze -- --deps       # Bağımlılık analizi
 *   npm run analyze -- --structure  # Dosya yapısı
 *   npm run analyze -- --modules    # Modül bağımlılıkları
 *   npm run analyze -- --json       # JSON çıktı
 * 
 * Çıktılar:
 *   - Proje istatistikleri (dosya sayıları, satır sayıları)
 *   - Modül bağımlılık haritası
 *   - Kullanılmayan export'lar
 *   - Circular dependency tespiti
 *   - npm paket analizi
 */

import { readFileSync, existsSync, statSync, writeFileSync } from 'fs';
import { readdir } from 'fs/promises';
import { resolve, dirname, join, relative, extname, basename } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '../..');

// ============================================================================
// Konfigürasyon
// ============================================================================

const CONFIG = {
  srcDirs: ['src/js', 'electron', 'mcp-server'],
  ignoreDirs: ['node_modules', '.git', 'dist', '.vite', 'logs', 'data'],
  extensions: ['.js', '.cjs', '.mjs'],
  entryPoints: [
    'src/js/app.js',
    'electron/main.js',
    'electron/preload.cjs',
    'electron/webview-preload.cjs',
    'mcp-server/index.js',
  ],
};

// CLI args
const ARGS = {
  summary: process.argv.includes('--summary'),
  deps: process.argv.includes('--deps'),
  structure: process.argv.includes('--structure'),
  modules: process.argv.includes('--modules'),
  json: process.argv.includes('--json'),
  output: process.argv.find(a => a.startsWith('--output='))?.split('=')[1],
};

const FULL_ANALYSIS = !ARGS.summary && !ARGS.deps && !ARGS.structure && !ARGS.modules;

// ============================================================================
// Renk Kodları
// ============================================================================

const colors = {
  red: (t) => ARGS.json ? t : `\x1b[31m${t}\x1b[0m`,
  green: (t) => ARGS.json ? t : `\x1b[32m${t}\x1b[0m`,
  yellow: (t) => ARGS.json ? t : `\x1b[33m${t}\x1b[0m`,
  blue: (t) => ARGS.json ? t : `\x1b[34m${t}\x1b[0m`,
  cyan: (t) => ARGS.json ? t : `\x1b[36m${t}\x1b[0m`,
  gray: (t) => ARGS.json ? t : `\x1b[90m${t}\x1b[0m`,
  bold: (t) => ARGS.json ? t : `\x1b[1m${t}\x1b[0m`,
};

// ============================================================================
// Dosya Tarama
// ============================================================================

async function getAllFiles(dir, files = []) {
  if (!existsSync(dir)) return files;
  
  const entries = await readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    
    if (entry.isDirectory()) {
      if (!CONFIG.ignoreDirs.includes(entry.name)) {
        await getAllFiles(fullPath, files);
      }
    } else if (entry.isFile() && CONFIG.extensions.some(ext => entry.name.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  
  return files;
}

function countLines(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const codeLines = lines.filter(l => l.trim() && !l.trim().startsWith('//')).length;
    return { total: lines.length, code: codeLines };
  } catch {
    return { total: 0, code: 0 };
  }
}

// ============================================================================
// Import/Export Analizi
// ============================================================================

function analyzeImports(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const imports = [];
    
    // ES6 imports
    const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push({
        source: match[1],
        isRelative: match[1].startsWith('.'),
        isPackage: !match[1].startsWith('.') && !match[1].startsWith('/'),
      });
    }
    
    // require()
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      imports.push({
        source: match[1],
        isRelative: match[1].startsWith('.'),
        isPackage: !match[1].startsWith('.') && !match[1].startsWith('/'),
      });
    }
    
    return imports;
  } catch {
    return [];
  }
}

function analyzeExports(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const exports = [];
    
    // export const/let/function/class
    const namedExportRegex = /export\s+(?:const|let|var|function|class|async\s+function)\s+(\w+)/g;
    let match;
    while ((match = namedExportRegex.exec(content)) !== null) {
      exports.push({ name: match[1], type: 'named' });
    }
    
    // export { ... }
    const bracketExportRegex = /export\s+\{([^}]+)\}/g;
    while ((match = bracketExportRegex.exec(content)) !== null) {
      match[1].split(',').forEach(exp => {
        const name = exp.trim().split(/\s+as\s+/)[0].trim();
        if (name) exports.push({ name, type: 'named' });
      });
    }
    
    // export default
    if (/export\s+default/.test(content)) {
      exports.push({ name: 'default', type: 'default' });
    }
    
    return exports;
  } catch {
    return [];
  }
}

// ============================================================================
// Circular Dependency Tespiti
// ============================================================================

function buildDependencyGraph(files) {
  const graph = new Map();
  
  for (const file of files) {
    const relPath = relative(PROJECT_ROOT, file);
    const imports = analyzeImports(file);
    const dependencies = [];
    
    for (const imp of imports) {
      if (imp.isRelative) {
        const dir = dirname(file);
        let resolved = resolve(dir, imp.source);
        
        // .js uzantısı ekle
        if (!extname(resolved)) {
          if (existsSync(resolved + '.js')) resolved += '.js';
          else if (existsSync(join(resolved, 'index.js'))) resolved = join(resolved, 'index.js');
        }
        
        if (existsSync(resolved)) {
          dependencies.push(relative(PROJECT_ROOT, resolved));
        }
      }
    }
    
    graph.set(relPath, dependencies);
  }
  
  return graph;
}

function findCircularDependencies(graph) {
  const circular = [];
  const visited = new Set();
  const stack = new Set();
  
  function dfs(node, path = []) {
    if (stack.has(node)) {
      const cycleStart = path.indexOf(node);
      circular.push(path.slice(cycleStart).concat(node));
      return;
    }
    
    if (visited.has(node)) return;
    
    visited.add(node);
    stack.add(node);
    path.push(node);
    
    const deps = graph.get(node) || [];
    for (const dep of deps) {
      dfs(dep, [...path]);
    }
    
    stack.delete(node);
  }
  
  for (const node of graph.keys()) {
    dfs(node);
  }
  
  return circular;
}

// ============================================================================
// npm Paket Analizi
// ============================================================================

function analyzePackages() {
  try {
    const pkg = JSON.parse(readFileSync(join(PROJECT_ROOT, 'package.json'), 'utf-8'));
    
    const deps = Object.keys(pkg.dependencies || {});
    const devDeps = Object.keys(pkg.devDependencies || {});
    
    // depcheck ile kullanılmayan paketleri bul
    let unused = { dependencies: [], devDependencies: [] };
    try {
      const result = execSync('npx depcheck --json', { 
        cwd: PROJECT_ROOT, 
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      unused = JSON.parse(result);
    } catch (e) {
      // depcheck hatası, devam et
    }
    
    return {
      name: pkg.name,
      version: pkg.version,
      dependencies: deps,
      devDependencies: devDeps,
      unusedDependencies: unused.dependencies || [],
      unusedDevDependencies: unused.devDependencies || [],
    };
  } catch {
    return null;
  }
}

// ============================================================================
// Modül Yapısı Analizi
// ============================================================================

function analyzeModuleStructure(files) {
  const modules = {};
  
  for (const file of files) {
    const relPath = relative(PROJECT_ROOT, file);
    const parts = relPath.split('/');
    
    // Ana kategori
    let category = parts[0];
    if (parts[0] === 'src' && parts[1] === 'js') {
      category = parts[2] || 'root'; // modules, pages, constants
    }
    
    if (!modules[category]) {
      modules[category] = { files: [], lines: 0, exports: 0 };
    }
    
    const lineCount = countLines(file);
    const exports = analyzeExports(file);
    
    modules[category].files.push(relPath);
    modules[category].lines += lineCount.code;
    modules[category].exports += exports.length;
  }
  
  return modules;
}

// ============================================================================
// Rapor Oluşturma
// ============================================================================

async function generateReport() {
  const report = {
    timestamp: new Date().toISOString(),
    project: null,
    statistics: null,
    modules: null,
    dependencies: null,
    circularDeps: null,
    unusedExports: null,
  };
  
  // Dosyaları tara
  let allFiles = [];
  for (const dir of CONFIG.srcDirs) {
    const dirPath = join(PROJECT_ROOT, dir);
    if (existsSync(dirPath)) {
      const files = await getAllFiles(dirPath);
      allFiles = allFiles.concat(files);
    }
  }
  
  // Paket bilgisi
  report.project = analyzePackages();
  
  // İstatistikler
  if (FULL_ANALYSIS || ARGS.summary) {
    let totalLines = 0;
    let totalCodeLines = 0;
    
    const byExtension = {};
    
    for (const file of allFiles) {
      const ext = extname(file);
      const lines = countLines(file);
      
      totalLines += lines.total;
      totalCodeLines += lines.code;
      
      if (!byExtension[ext]) byExtension[ext] = { files: 0, lines: 0 };
      byExtension[ext].files++;
      byExtension[ext].lines += lines.code;
    }
    
    report.statistics = {
      totalFiles: allFiles.length,
      totalLines,
      totalCodeLines,
      byExtension,
    };
  }
  
  // Modül yapısı
  if (FULL_ANALYSIS || ARGS.structure || ARGS.modules) {
    report.modules = analyzeModuleStructure(allFiles);
  }
  
  // Bağımlılık analizi
  if (FULL_ANALYSIS || ARGS.deps || ARGS.modules) {
    const graph = buildDependencyGraph(allFiles);
    
    // Circular dependencies
    report.circularDeps = findCircularDependencies(graph);
    
    // En çok import edilen dosyalar
    const importCounts = new Map();
    for (const deps of graph.values()) {
      for (const dep of deps) {
        importCounts.set(dep, (importCounts.get(dep) || 0) + 1);
      }
    }
    
    report.dependencies = {
      totalModules: graph.size,
      mostImported: [...importCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([file, count]) => ({ file, importedBy: count })),
    };
  }
  
  return report;
}

// ============================================================================
// Çıktı Formatlama
// ============================================================================

function printReport(report) {
  if (ARGS.json) {
    const output = JSON.stringify(report, null, 2);
    if (ARGS.output) {
      writeFileSync(ARGS.output, output);
      console.log(`Rapor kaydedildi: ${ARGS.output}`);
    } else {
      console.log(output);
    }
    return;
  }
  
  console.log(colors.blue('\n╔══════════════════════════════════════════════════════════════╗'));
  console.log(colors.blue('║              📊 Proje Analiz Raporu                          ║'));
  console.log(colors.blue('╚══════════════════════════════════════════════════════════════╝\n'));
  
  // Proje Bilgisi
  if (report.project) {
    console.log(colors.cyan('📦 Proje Bilgisi'));
    console.log(colors.gray('─'.repeat(50)));
    console.log(`   Ad: ${colors.bold(report.project.name)} v${report.project.version}`);
    console.log(`   Dependencies: ${report.project.dependencies.length}`);
    console.log(`   DevDependencies: ${report.project.devDependencies.length}`);
    
    if (report.project.unusedDependencies.length > 0) {
      console.log(colors.yellow(`\n   ⚠️  Kullanılmayan dependencies:`));
      report.project.unusedDependencies.forEach(d => console.log(colors.gray(`      - ${d}`)));
    }
    if (report.project.unusedDevDependencies.length > 0) {
      console.log(colors.yellow(`\n   ⚠️  Kullanılmayan devDependencies:`));
      report.project.unusedDevDependencies.forEach(d => console.log(colors.gray(`      - ${d}`)));
    }
    console.log();
  }
  
  // İstatistikler
  if (report.statistics) {
    console.log(colors.cyan('📈 İstatistikler'));
    console.log(colors.gray('─'.repeat(50)));
    console.log(`   Toplam dosya: ${colors.bold(report.statistics.totalFiles)}`);
    console.log(`   Toplam satır: ${report.statistics.totalLines.toLocaleString()}`);
    console.log(`   Kod satırı: ${colors.bold(report.statistics.totalCodeLines.toLocaleString())}`);
    console.log();
    
    console.log('   Uzantıya göre:');
    Object.entries(report.statistics.byExtension)
      .sort((a, b) => b[1].lines - a[1].lines)
      .forEach(([ext, data]) => {
        console.log(colors.gray(`      ${ext}: ${data.files} dosya, ${data.lines.toLocaleString()} satır`));
      });
    console.log();
  }
  
  // Modül Yapısı
  if (report.modules) {
    console.log(colors.cyan('🏗️  Modül Yapısı'));
    console.log(colors.gray('─'.repeat(50)));
    
    Object.entries(report.modules)
      .sort((a, b) => b[1].lines - a[1].lines)
      .forEach(([name, data]) => {
        const bar = '█'.repeat(Math.min(20, Math.round(data.lines / 500)));
        console.log(`   ${name.padEnd(15)} ${colors.green(bar)} ${data.files.length} dosya, ${data.lines} satır`);
      });
    console.log();
  }
  
  // Bağımlılıklar
  if (report.dependencies) {
    console.log(colors.cyan('🔗 Bağımlılık Analizi'));
    console.log(colors.gray('─'.repeat(50)));
    console.log(`   Toplam modül: ${report.dependencies.totalModules}`);
    console.log();
    
    console.log('   En çok import edilen dosyalar:');
    report.dependencies.mostImported.slice(0, 10).forEach((item, i) => {
      const num = (i + 1).toString().padStart(2);
      console.log(colors.gray(`   ${num}. ${item.file} (${item.importedBy}x)`));
    });
    console.log();
  }
  
  // Circular Dependencies
  if (report.circularDeps && report.circularDeps.length > 0) {
    console.log(colors.red('⚠️  Circular Dependencies'));
    console.log(colors.gray('─'.repeat(50)));
    
    const uniqueCycles = report.circularDeps
      .map(c => c.join(' → '))
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 5);
    
    uniqueCycles.forEach(cycle => {
      console.log(colors.yellow(`   ${cycle}`));
    });
    
    if (report.circularDeps.length > 5) {
      console.log(colors.gray(`   ... ve ${report.circularDeps.length - 5} tane daha`));
    }
    console.log();
  } else if (report.circularDeps) {
    console.log(colors.green('✅ Circular dependency yok\n'));
  }
  
  console.log(colors.gray(`Rapor zamanı: ${report.timestamp}\n`));
}

// ============================================================================
// Ana Çalıştırma
// ============================================================================

async function main() {
  try {
    const report = await generateReport();
    printReport(report);
  } catch (error) {
    console.error(colors.red(`\n❌ Analiz hatası: ${error.message}\n`));
    if (!ARGS.json) console.error(error.stack);
    process.exit(1);
  }
}

main();
