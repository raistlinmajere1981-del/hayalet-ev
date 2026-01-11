/**
 * Find Unused Code Script
 * 
 * Kullanılmayan export'ları ve import'ları tespit eder.
 * AGENTS.md'deki "Dikkat Edilmesi Gerekenler" bölümünü dikkate alır.
 * 
 * Kullanım: npm run lint:unused
 */

import { readdir, readFile } from 'fs/promises';
import { join, relative } from 'path';
import { existsSync } from 'fs';

const CONFIG = {
  searchDirs: ['./src', './electron', './mcp-server'],
  extensions: ['.js', '.cjs', '.mjs'],
  ignoreDirs: ['node_modules', '.vite', 'dist', 'build'],
  safeModules: [
    'upload-services.js',
    'file-utils.js',
    'url-utils.js',
    'provider-registry.js',
    'device-manager.js',
    'screenshot-manager.js',
    'whisper-manager.js',
    'googledrive-manager.js',
    'server-commands.js',
    'asistan-manager.js',
  ],
  ignoreExports: [
    { name: 'uploadFile', file: 'provider-tools.js', reason: 'Template string içinde - yeni provider oluşturma template\'i' },
    { name: 'sendMessage', file: 'provider-tools.js', reason: 'Template string içinde - yeni provider oluşturma template\'i' },
  ],
};

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

async function findExports(filePath) {
  const content = await readFile(filePath, 'utf-8');
  const exports = [];
  
  const exportRegex = /export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
  let match;
  while ((match = exportRegex.exec(content)) !== null) {
    exports.push(match[1]);
  }
  
  const defaultExportRegex = /export\s+default\s+(?:class\s+|function\s+)?([a-zA-Z_$][a-zA-Z0-9_$]*)?/g;
  while ((match = defaultExportRegex.exec(content)) !== null) {
    if (match[1]) {
      exports.push(`default:${match[1]}`);
    }
  }
  
  return exports;
}

async function findImports(filePath) {
  const content = await readFile(filePath, 'utf-8');
  const imports = [];
  
  const importRegex = /import\s+\{([^}]+)\}\s+from/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const names = match[1].split(',').map(n => n.trim().split(' as ')[0].trim());
    imports.push(...names);
  }
  
  const defaultImportRegex = /import\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s+from/g;
  while ((match = defaultImportRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  
  return { filePath, imports, content };
}

async function analyzeUnused() {
  console.log('🔍 Kullanılmayan kod analizi başlatılıyor...\n');
  
  const allFiles = [];
  for (const dir of CONFIG.searchDirs) {
    await getAllFiles(dir, allFiles);
  }
  
  console.log(`📁 ${allFiles.length} dosya taranıyor...\n`);
  
  const fileExports = new Map();
  const allExports = new Map();
  
  for (const file of allFiles) {
    const exports = await findExports(file);
    fileExports.set(file, exports);
    
    for (const exp of exports) {
      if (!allExports.has(exp)) {
        allExports.set(exp, []);
      }
      allExports.get(exp).push(file);
    }
  }
  
  const allContent = new Map();
  for (const file of allFiles) {
    const content = await readFile(file, 'utf-8');
    allContent.set(file, content);
  }
  
  const unusedExports = [];
  
  for (const [exportName, definedIn] of allExports.entries()) {
    if (exportName.startsWith('default:')) continue;
    
    let usageCount = 0;
    
    for (const [file, content] of allContent.entries()) {
      if (definedIn.includes(file)) continue;
      
      const regex = new RegExp(`\\b${exportName}\\b`, 'g');
      if (regex.test(content)) {
        usageCount++;
      }
    }
    
    if (usageCount === 0) {
      const isIgnored = CONFIG.ignoreExports.some(ignored =>
        ignored.name === exportName && definedIn.some(f => f.includes(ignored.file))
      );
      
      if (isIgnored) continue;
      
      const isSafe = CONFIG.safeModules.some(safe => 
        definedIn.some(f => f.includes(safe))
      );
      
      unusedExports.push({
        name: exportName,
        files: definedIn.map(f => relative('.', f)),
        safe: isSafe,
      });
    }
  }
  
  const safeUnused = unusedExports.filter(e => e.safe);
  const unsafeUnused = unusedExports.filter(e => !e.safe);
  
  if (unsafeUnused.length > 0) {
    console.log('❌ Kullanılmayan Export\'lar (silinebilir):');
    console.log('─'.repeat(50));
    for (const exp of unsafeUnused) {
      console.log(`  ${exp.name}`);
      exp.files.forEach(f => console.log(`    └─ ${f}`));
    }
    console.log('');
  }
  
  if (safeUnused.length > 0) {
    console.log('⚠️  Güvenli Modüllerdeki Kullanılmayan Export\'lar (DİKKAT):');
    console.log('─'.repeat(50));
    for (const exp of safeUnused) {
      console.log(`  ${exp.name} (IPC/bağımlılık olabilir)`);
      exp.files.forEach(f => console.log(`    └─ ${f}`));
    }
    console.log('');
  }
  
  console.log('📊 Özet:');
  console.log(`   Taranan dosya: ${allFiles.length}`);
  console.log(`   Toplam export: ${allExports.size}`);
  console.log(`   Kullanılmayan (silinebilir): ${unsafeUnused.length}`);
  console.log(`   Kullanılmayan (güvenli modül): ${safeUnused.length}`);
  console.log('');
  
  if (unsafeUnused.length === 0) {
    console.log('✅ Kullanılmayan kod bulunamadı!\n');
    return 0;
  } else {
    console.log(`⚠️  ${unsafeUnused.length} kullanılmayan export bulundu.\n`);
    return 1;
  }
}

analyzeUnused()
  .then(code => process.exit(code))
  .catch(err => {
    console.error('❌ Analiz hatası:', err);
    process.exit(1);
  });
