#!/usr/bin/env node

/**
 * Modül Bağımlılık Diagram Oluşturucu
 * 
 * Proje modülleri arasındaki bağımlılıkları Mermaid diagram formatında çıkarır.
 * 
 * Kullanım:
 *   npm run diagram                    # Tam diagram
 *   npm run diagram -- --module=webview  # Tek modül
 *   npm run diagram -- --depth=2       # Derinlik sınırı
 *   npm run diagram -- --output=graph.md # Dosyaya kaydet
 *   npm run diagram -- --format=dot    # Graphviz DOT formatı
 * 
 * Çıktı Formatları:
 *   - mermaid (varsayılan): Markdown içinde kullanılabilir
 *   - dot: Graphviz ile PNG/SVG'ye çevrilebilir
 */

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { readdir } from 'fs/promises';
import { resolve, dirname, join, relative, extname, basename } from 'path';
import { fileURLToPath } from 'url';

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
  
  // Modül grupları (diagram için)
  moduleGroups: {
    'core': ['app.js', 'core-engine.js', 'app-state.js'],
    'webview': ['webview-manager.js', 'webview/', 'providers/'],
    'traffic': ['traffic-manager.js', 'traffic/'],
    'relay': ['relay-manager.js', 'relay/'],
    'slot': ['slot-controller.js', 'slot/'],
    'database': ['database/'],
    'settings': ['settings-manager.js', 'settings/'],
    'electron': ['electron/'],
    'mcp': ['mcp-server/'],
  },
  
  // Diagram renkleri
  colors: {
    core: '#e74c3c',
    webview: '#3498db',
    traffic: '#2ecc71',
    relay: '#9b59b6',
    slot: '#f39c12',
    database: '#1abc9c',
    settings: '#95a5a6',
    electron: '#34495e',
    mcp: '#e67e22',
    default: '#bdc3c7',
  },
};

// CLI args
const args = process.argv.slice(2);
const ARGS = {
  module: args.find(a => a.startsWith('--module='))?.split('=')[1],
  depth: parseInt(args.find(a => a.startsWith('--depth='))?.split('=')[1] || '10'),
  output: args.find(a => a.startsWith('--output='))?.split('=')[1],
  format: args.find(a => a.startsWith('--format='))?.split('=')[1] || 'mermaid',
  simplified: args.includes('--simplified'),
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

// ============================================================================
// Import Analizi
// ============================================================================

function analyzeImports(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const imports = [];
    
    // ES6 imports
    const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      if (match[1].startsWith('.')) {
        imports.push(match[1]);
      }
    }
    
    // require()
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      if (match[1].startsWith('.')) {
        imports.push(match[1]);
      }
    }
    
    return imports;
  } catch {
    return [];
  }
}

// ============================================================================
// Bağımlılık Graph'ı Oluşturma
// ============================================================================

function buildDependencyGraph(files) {
  const graph = new Map();
  
  for (const file of files) {
    const relPath = relative(PROJECT_ROOT, file);
    const imports = analyzeImports(file);
    const dependencies = [];
    
    for (const imp of imports) {
      const dir = dirname(file);
      let resolved = resolve(dir, imp);
      
      // .js uzantısı ekle
      if (!extname(resolved)) {
        if (existsSync(resolved + '.js')) resolved += '.js';
        else if (existsSync(resolved + '.cjs')) resolved += '.cjs';
        else if (existsSync(join(resolved, 'index.js'))) resolved = join(resolved, 'index.js');
      }
      
      if (existsSync(resolved)) {
        dependencies.push(relative(PROJECT_ROOT, resolved));
      }
    }
    
    graph.set(relPath, dependencies);
  }
  
  return graph;
}

// ============================================================================
// Modül Gruplarını Belirle
// ============================================================================

function getModuleGroup(filePath) {
  for (const [group, patterns] of Object.entries(CONFIG.moduleGroups)) {
    for (const pattern of patterns) {
      if (filePath.includes(pattern)) {
        return group;
      }
    }
  }
  return 'default';
}

function simplifyPath(filePath) {
  // Dosya adını veya son 2 segmenti al
  const parts = filePath.split('/');
  if (parts.length <= 2) return filePath;
  return parts.slice(-2).join('/');
}

// ============================================================================
// Mermaid Diagram Oluşturma
// ============================================================================

function generateMermaidDiagram(graph, options = {}) {
  const { simplified = false, filterModule = null, maxDepth = 10 } = options;
  
  let output = '```mermaid\nflowchart TB\n';
  
  // Subgraph'lar için modülleri grupla
  const groups = new Map();
  const edges = [];
  const nodeIds = new Map();
  let nodeCounter = 0;
  
  // Node ID oluştur
  function getNodeId(path) {
    if (!nodeIds.has(path)) {
      nodeIds.set(path, `N${nodeCounter++}`);
    }
    return nodeIds.get(path);
  }
  
  // Filtreleme
  function shouldInclude(path) {
    if (!filterModule) return true;
    return path.includes(filterModule);
  }
  
  // Graph'ı işle
  for (const [source, deps] of graph.entries()) {
    if (!shouldInclude(source) && !deps.some(d => shouldInclude(d))) continue;
    
    const sourceGroup = getModuleGroup(source);
    
    if (!groups.has(sourceGroup)) {
      groups.set(sourceGroup, new Set());
    }
    groups.get(sourceGroup).add(source);
    
    for (const dep of deps) {
      const depGroup = getModuleGroup(dep);
      
      if (!groups.has(depGroup)) {
        groups.set(depGroup, new Set());
      }
      groups.get(depGroup).add(dep);
      
      edges.push({ from: source, to: dep });
    }
  }
  
  // Subgraph'ları oluştur
  for (const [group, files] of groups.entries()) {
    const color = CONFIG.colors[group] || CONFIG.colors.default;
    output += `\n    subgraph ${group}[${group.toUpperCase()}]\n`;
    output += `        style ${group} fill:${color}20,stroke:${color}\n`;
    
    for (const file of files) {
      const id = getNodeId(file);
      const label = simplified ? basename(file) : simplifyPath(file);
      output += `        ${id}["${label}"]\n`;
    }
    
    output += '    end\n';
  }
  
  // Edge'leri ekle
  output += '\n';
  const addedEdges = new Set();
  
  for (const edge of edges) {
    const fromId = getNodeId(edge.from);
    const toId = getNodeId(edge.to);
    const edgeKey = `${fromId}-${toId}`;
    
    if (!addedEdges.has(edgeKey)) {
      output += `    ${fromId} --> ${toId}\n`;
      addedEdges.add(edgeKey);
    }
  }
  
  output += '```\n';
  
  return output;
}

// ============================================================================
// DOT (Graphviz) Formatı
// ============================================================================

function generateDotDiagram(graph, options = {}) {
  const { simplified = false, filterModule = null } = options;
  
  let output = 'digraph G {\n';
  output += '    rankdir=TB;\n';
  output += '    node [shape=box, style=filled];\n';
  output += '    compound=true;\n\n';
  
  const groups = new Map();
  const edges = [];
  
  // Filtreleme
  function shouldInclude(path) {
    if (!filterModule) return true;
    return path.includes(filterModule);
  }
  
  // Graph'ı işle
  for (const [source, deps] of graph.entries()) {
    if (!shouldInclude(source) && !deps.some(d => shouldInclude(d))) continue;
    
    const sourceGroup = getModuleGroup(source);
    
    if (!groups.has(sourceGroup)) {
      groups.set(sourceGroup, new Set());
    }
    groups.get(sourceGroup).add(source);
    
    for (const dep of deps) {
      const depGroup = getModuleGroup(dep);
      
      if (!groups.has(depGroup)) {
        groups.set(depGroup, new Set());
      }
      groups.get(depGroup).add(dep);
      
      edges.push({ from: source, to: dep });
    }
  }
  
  // Cluster'ları oluştur
  let clusterIndex = 0;
  for (const [group, files] of groups.entries()) {
    const color = CONFIG.colors[group] || CONFIG.colors.default;
    output += `    subgraph cluster_${clusterIndex++} {\n`;
    output += `        label="${group.toUpperCase()}";\n`;
    output += `        style=filled;\n`;
    output += `        fillcolor="${color}20";\n`;
    output += `        color="${color}";\n`;
    
    for (const file of files) {
      const nodeId = file.replace(/[\/\.\-]/g, '_');
      const label = simplified ? basename(file) : simplifyPath(file);
      output += `        "${nodeId}" [label="${label}", fillcolor="${color}40"];\n`;
    }
    
    output += '    }\n\n';
  }
  
  // Edge'leri ekle
  const addedEdges = new Set();
  for (const edge of edges) {
    const fromId = edge.from.replace(/[\/\.\-]/g, '_');
    const toId = edge.to.replace(/[\/\.\-]/g, '_');
    const edgeKey = `${fromId}-${toId}`;
    
    if (!addedEdges.has(edgeKey)) {
      output += `    "${fromId}" -> "${toId}";\n`;
      addedEdges.add(edgeKey);
    }
  }
  
  output += '}\n';
  
  return output;
}

// ============================================================================
// Ana Çalıştırma
// ============================================================================

async function main() {
  console.log('\n📊 Modül bağımlılık diagramı oluşturuluyor...\n');
  
  // Dosyaları tara
  let allFiles = [];
  for (const dir of CONFIG.srcDirs) {
    const dirPath = join(PROJECT_ROOT, dir);
    if (existsSync(dirPath)) {
      const files = await getAllFiles(dirPath);
      allFiles = allFiles.concat(files);
    }
  }
  
  console.log(`   ${allFiles.length} dosya tarandı`);
  
  // Graph oluştur
  const graph = buildDependencyGraph(allFiles);
  console.log(`   ${graph.size} modül analiz edildi`);
  
  // Diagram oluştur
  let diagram;
  const options = {
    simplified: ARGS.simplified,
    filterModule: ARGS.module,
    maxDepth: ARGS.depth,
  };
  
  if (ARGS.format === 'dot') {
    diagram = generateDotDiagram(graph, options);
  } else {
    diagram = generateMermaidDiagram(graph, options);
  }
  
  // Çıktı
  if (ARGS.output) {
    writeFileSync(ARGS.output, diagram);
    console.log(`\n✅ Diagram kaydedildi: ${ARGS.output}`);
    
    if (ARGS.format === 'dot') {
      console.log(`\n   PNG'ye çevirmek için:`);
      console.log(`   dot -Tpng ${ARGS.output} -o diagram.png`);
    }
  } else {
    console.log('\n' + diagram);
  }
  
  // İstatistikler
  let edgeCount = 0;
  for (const deps of graph.values()) {
    edgeCount += deps.length;
  }
  
  console.log(`\n📈 İstatistikler:`);
  console.log(`   Modül sayısı: ${graph.size}`);
  console.log(`   Bağlantı sayısı: ${edgeCount}`);
  console.log(`   Ortalama bağımlılık: ${(edgeCount / graph.size).toFixed(1)}`);
  console.log();
}

main().catch(err => {
  console.error(`\n❌ Hata: ${err.message}\n`);
  process.exit(1);
});
