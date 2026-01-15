#!/usr/bin/env node

/**
 * Proje Cache Güncelleme Script'i
 * 
 * Sık değişmeyen bilgileri cache'ler:
 * - Export/Import haritası
 * - Modül bağımlılıkları
 * - Dosya istatistikleri
 * 
 * Bu cache sayesinde AI agent her seferinde tüm dosyaları taramak zorunda kalmaz.
 * 
 * Kullanım:
 *   npm run cache:update    # Cache'i güncelle
 *   npm run cache:show      # Cache içeriğini göster
 * 
 * Cache dosyası: .rovodev/cache.json
 */

import { readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { readdir } from 'fs/promises';
import { resolve, dirname, join, relative, extname, basename } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '../..');
const CACHE_FILE = resolve(PROJECT_ROOT, '.rovodev/cache.json');

const ARGS = {
  show: process.argv.includes('--show'),
  force: process.argv.includes('--force'),
};

// ============================================================================
// Konfigürasyon
// ============================================================================

const CONFIG = {
  srcDirs: ['src/js', 'electron', 'mcp-server'],
  ignoreDirs: ['node_modules', '.git', 'dist', '.vite', 'logs', 'data', 'test-screenshots'],
  extensions: ['.js', '.cjs', '.mjs'],
  // Cache geçerlilik süresi (ms) - 1 saat
  maxAge: 60 * 60 * 1000,
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
// Dosya Analizi
// ============================================================================

function analyzeFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const stats = statSync(filePath);
    const lines = content.split('\n');
    
    // Hash hesapla (değişiklik tespiti için)
    const hash = createHash('md5').update(content).digest('hex').substring(0, 8);
    
    // Export'ları bul
    const exports = [];
    const exportRegex = /export\s+(?:const|let|var|function|class|async\s+function)\s+(\w+)/g;
    let match;
    while ((match = exportRegex.exec(content)) !== null) {
      exports.push(match[1]);
    }
    
    // export { ... } 
    const bracketExportRegex = /export\s+\{([^}]+)\}/g;
    while ((match = bracketExportRegex.exec(content)) !== null) {
      match[1].split(',').forEach(exp => {
        const name = exp.trim().split(/\s+as\s+/)[0].trim();
        if (name && !exports.includes(name)) exports.push(name);
      });
    }
    
    // export default
    if (/export\s+default/.test(content)) {
      exports.push('default');
    }
    
    // Import'ları bul
    const imports = [];
    const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push({
        source: match[1],
        isRelative: match[1].startsWith('.'),
        isPackage: !match[1].startsWith('.') && !match[1].startsWith('/'),
      });
    }
    
    return {
      path: relative(PROJECT_ROOT, filePath),
      hash,
      size: stats.size,
      lines: lines.length,
      codeLines: lines.filter(l => l.trim() && !l.trim().startsWith('//')).length,
      exports,
      imports,
      modified: stats.mtime.toISOString(),
    };
  } catch (err) {
    return null;
  }
}

// ============================================================================
// Cache Yönetimi
// ============================================================================

function loadCache() {
  try {
    if (existsSync(CACHE_FILE)) {
      return JSON.parse(readFileSync(CACHE_FILE, 'utf-8'));
    }
  } catch {}
  return null;
}

function saveCache(cache) {
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

function isCacheValid(cache) {
  if (!cache || !cache.timestamp) return false;
  
  const age = Date.now() - new Date(cache.timestamp).getTime();
  return age < CONFIG.maxAge;
}

// ============================================================================
// Özet Oluşturma
// ============================================================================

function generateSummary(files) {
  const summary = {
    totalFiles: files.length,
    totalLines: 0,
    totalCodeLines: 0,
    totalExports: 0,
    byDirectory: {},
    mostExports: [],
    mostImported: {},
    unusedExports: [],
  };
  
  // İstatistikler
  for (const file of files) {
    summary.totalLines += file.lines;
    summary.totalCodeLines += file.codeLines;
    summary.totalExports += file.exports.length;
    
    // Dizin bazlı
    const dir = file.path.split('/').slice(0, 2).join('/');
    if (!summary.byDirectory[dir]) {
      summary.byDirectory[dir] = { files: 0, lines: 0 };
    }
    summary.byDirectory[dir].files++;
    summary.byDirectory[dir].lines += file.codeLines;
    
    // En çok export
    if (file.exports.length > 3) {
      summary.mostExports.push({
        file: file.path,
        count: file.exports.length,
        exports: file.exports.slice(0, 5),
      });
    }
    
    // Import sayımı
    for (const imp of file.imports) {
      if (imp.isRelative) {
        const key = imp.source;
        summary.mostImported[key] = (summary.mostImported[key] || 0) + 1;
      }
    }
  }
  
  // Sırala
  summary.mostExports.sort((a, b) => b.count - a.count);
  summary.mostExports = summary.mostExports.slice(0, 10);
  
  // En çok import edilenleri array'e çevir
  summary.mostImported = Object.entries(summary.mostImported)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([file, count]) => ({ file, count }));
  
  return summary;
}

// ============================================================================
// Ana Fonksiyon
// ============================================================================

async function main() {
  // Cache göster modu
  if (ARGS.show) {
    const cache = loadCache();
    if (!cache) {
      console.log('❌ Cache dosyası bulunamadı. `npm run cache:update` çalıştırın.');
      return;
    }
    
    console.log('\n📦 Cache Bilgisi');
    console.log('─'.repeat(50));
    console.log(`   Oluşturulma: ${cache.timestamp}`);
    console.log(`   Dosya sayısı: ${cache.summary.totalFiles}`);
    console.log(`   Kod satırı: ${cache.summary.totalCodeLines.toLocaleString()}`);
    console.log(`   Export sayısı: ${cache.summary.totalExports}`);
    
    console.log('\n📊 Dizin Dağılımı:');
    for (const [dir, stats] of Object.entries(cache.summary.byDirectory)) {
      console.log(`   ${dir}: ${stats.files} dosya, ${stats.lines} satır`);
    }
    
    console.log('\n🔗 En Çok Import Edilen:');
    cache.summary.mostImported.slice(0, 10).forEach((item, i) => {
      console.log(`   ${i + 1}. ${item.file} (${item.count}x)`);
    });
    
    return;
  }
  
  // Cache güncelle
  console.log('🔄 Cache güncelleniyor...\n');
  
  const existingCache = loadCache();
  
  if (!ARGS.force && isCacheValid(existingCache)) {
    console.log('✅ Cache hala geçerli (1 saatten yeni)');
    console.log('   Zorla güncellemek için: npm run cache:update -- --force');
    return;
  }
  
  // Dosyaları tara
  let allFiles = [];
  for (const dir of CONFIG.srcDirs) {
    const dirPath = join(PROJECT_ROOT, dir);
    if (existsSync(dirPath)) {
      const files = await getAllFiles(dirPath);
      allFiles = allFiles.concat(files);
    }
  }
  
  console.log(`   ${allFiles.length} dosya taranıyor...`);
  
  // Analiz et
  const analyzedFiles = [];
  let changed = 0;
  
  for (const filePath of allFiles) {
    const relPath = relative(PROJECT_ROOT, filePath);
    const existingFile = existingCache?.files?.find(f => f.path === relPath);
    
    const analysis = analyzeFile(filePath);
    if (analysis) {
      analyzedFiles.push(analysis);
      
      // Değişiklik kontrolü
      if (!existingFile || existingFile.hash !== analysis.hash) {
        changed++;
      }
    }
  }
  
  // Özet oluştur
  const summary = generateSummary(analyzedFiles);
  
  // Cache kaydet
  const cache = {
    timestamp: new Date().toISOString(),
    version: '1.0',
    files: analyzedFiles,
    summary,
  };
  
  saveCache(cache);
  
  console.log(`\n✅ Cache güncellendi: .rovodev/cache.json`);
  console.log(`   Toplam: ${analyzedFiles.length} dosya`);
  console.log(`   Değişen: ${changed} dosya`);
  console.log(`   Boyut: ${Math.round(JSON.stringify(cache).length / 1024)}KB`);
  
  console.log('\n📊 Özet:');
  console.log(`   Kod satırı: ${summary.totalCodeLines.toLocaleString()}`);
  console.log(`   Export sayısı: ${summary.totalExports}`);
}

main().catch(err => {
  console.error(`❌ Hata: ${err.message}`);
  process.exit(1);
});
