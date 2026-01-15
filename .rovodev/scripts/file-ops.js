#!/usr/bin/env node

/**
 * Dosya İşlemleri Script'i
 * 
 * AI agent'ların hızlı dosya/klasör işlemleri yapması için.
 * Tool kısıtlamalarını aşar ve toplu işlemleri destekler.
 * 
 * Kullanım:
 *   npm run file -- delete <path> [path2] [path3]...
 *   npm run file -- delete-dir <dir>
 *   npm run file -- move <source> <dest>
 *   npm run file -- copy <source> <dest>
 *   npm run file -- rename <old> <new>
 *   npm run file -- list <dir> [--recursive]
 *   npm run file -- find <pattern> [dir]
 *   npm run file -- clean-empty [dir]
 * 
 * Örnekler:
 *   npm run file -- delete scripts/old.js scripts/unused.js
 *   npm run file -- delete-dir claude-plugins
 *   npm run file -- move scripts/*.js .rovodev/scripts/
 *   npm run file -- clean-empty scripts
 */

import { 
  existsSync, 
  statSync, 
  readdirSync, 
  unlinkSync, 
  rmdirSync, 
  mkdirSync,
  copyFileSync,
  renameSync
} from 'fs';
import { resolve, dirname, basename, join, relative } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { glob } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '../..');

// ============================================================================
// Renk Kodları
// ============================================================================

const colors = {
  red: (t) => `\x1b[31m${t}\x1b[0m`,
  green: (t) => `\x1b[32m${t}\x1b[0m`,
  yellow: (t) => `\x1b[33m${t}\x1b[0m`,
  blue: (t) => `\x1b[34m${t}\x1b[0m`,
  gray: (t) => `\x1b[90m${t}\x1b[0m`,
};

// ============================================================================
// Yardımcı Fonksiyonlar
// ============================================================================

function resolvePath(p) {
  if (p.startsWith('/')) return p;
  return resolve(PROJECT_ROOT, p);
}

function isDirectory(p) {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function deleteRecursive(p) {
  if (!existsSync(p)) return false;
  
  if (isDirectory(p)) {
    const entries = readdirSync(p);
    for (const entry of entries) {
      deleteRecursive(join(p, entry));
    }
    rmdirSync(p);
  } else {
    unlinkSync(p);
  }
  return true;
}

function findEmptyDirs(dir, empties = []) {
  if (!existsSync(dir) || !isDirectory(dir)) return empties;
  
  const entries = readdirSync(dir);
  
  if (entries.length === 0) {
    empties.push(dir);
  } else {
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      if (isDirectory(fullPath)) {
        findEmptyDirs(fullPath, empties);
      }
    }
    
    // Tekrar kontrol et (alt klasörler silindiyse)
    const remaining = readdirSync(dir);
    if (remaining.length === 0) {
      empties.push(dir);
    }
  }
  
  return empties;
}

function listDir(dir, recursive = false, indent = '') {
  if (!existsSync(dir)) {
    console.log(colors.red(`❌ Klasör bulunamadı: ${dir}`));
    return;
  }
  
  const entries = readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relPath = relative(PROJECT_ROOT, fullPath);
    
    if (entry.isDirectory()) {
      console.log(colors.blue(`${indent}📁 ${entry.name}/`));
      if (recursive) {
        listDir(fullPath, true, indent + '   ');
      }
    } else {
      const size = statSync(fullPath).size;
      const sizeStr = size > 1024 ? `${(size/1024).toFixed(1)}KB` : `${size}B`;
      console.log(colors.gray(`${indent}   ${entry.name} (${sizeStr})`));
    }
  }
}

function findFiles(pattern, dir = '.') {
  const searchDir = resolvePath(dir);
  
  try {
    const result = execSync(`find ${searchDir} -name "${pattern}" -type f 2>/dev/null`, {
      encoding: 'utf-8',
      cwd: PROJECT_ROOT
    }).trim();
    
    return result ? result.split('\n').map(p => relative(PROJECT_ROOT, p)) : [];
  } catch {
    return [];
  }
}

// ============================================================================
// Komutlar
// ============================================================================

const commands = {
  delete: (args) => {
    if (args.length === 0) {
      console.log(colors.red('❌ Silinecek dosya belirtilmedi'));
      return;
    }
    
    let deleted = 0;
    let notFound = 0;
    
    for (const file of args) {
      const fullPath = resolvePath(file);
      
      if (!existsSync(fullPath)) {
        console.log(colors.yellow(`⚠️  Bulunamadı: ${file}`));
        notFound++;
        continue;
      }
      
      if (isDirectory(fullPath)) {
        console.log(colors.yellow(`⚠️  Klasör: ${file} (delete-dir kullanın)`));
        continue;
      }
      
      unlinkSync(fullPath);
      console.log(colors.green(`✅ Silindi: ${file}`));
      deleted++;
    }
    
    console.log(colors.gray(`\nToplam: ${deleted} silindi, ${notFound} bulunamadı`));
  },
  
  'delete-dir': (args) => {
    if (args.length === 0) {
      console.log(colors.red('❌ Silinecek klasör belirtilmedi'));
      return;
    }
    
    for (const dir of args) {
      const fullPath = resolvePath(dir);
      
      if (!existsSync(fullPath)) {
        console.log(colors.yellow(`⚠️  Bulunamadı: ${dir}`));
        continue;
      }
      
      if (!isDirectory(fullPath)) {
        console.log(colors.yellow(`⚠️  Dosya, klasör değil: ${dir}`));
        continue;
      }
      
      // Güvenlik kontrolü
      const relPath = relative(PROJECT_ROOT, fullPath);
      if (relPath.startsWith('..') || relPath === '') {
        console.log(colors.red(`❌ Güvenlik: Proje dışı klasör silinemez: ${dir}`));
        continue;
      }
      
      const entries = readdirSync(fullPath);
      if (entries.length > 0) {
        console.log(colors.yellow(`⚠️  Klasör boş değil (${entries.length} öğe): ${dir}`));
        console.log(colors.gray(`   İçerik: ${entries.slice(0, 5).join(', ')}${entries.length > 5 ? '...' : ''}`));
        console.log(colors.gray(`   Zorla silmek için: npm run file -- delete-dir ${dir} --force`));
        
        if (!args.includes('--force')) {
          continue;
        }
      }
      
      deleteRecursive(fullPath);
      console.log(colors.green(`✅ Silindi: ${dir}/`));
    }
  },
  
  move: (args) => {
    if (args.length < 2) {
      console.log(colors.red('❌ Kaynak ve hedef belirtilmedi'));
      console.log(colors.gray('   Kullanım: npm run file -- move <kaynak> <hedef>'));
      return;
    }
    
    const source = resolvePath(args[0]);
    const dest = resolvePath(args[1]);
    
    if (!existsSync(source)) {
      console.log(colors.red(`❌ Kaynak bulunamadı: ${args[0]}`));
      return;
    }
    
    // Hedef klasör mü?
    if (isDirectory(dest)) {
      const destFile = join(dest, basename(source));
      renameSync(source, destFile);
      console.log(colors.green(`✅ Taşındı: ${args[0]} → ${relative(PROJECT_ROOT, destFile)}`));
    } else {
      ensureDir(dirname(dest));
      renameSync(source, dest);
      console.log(colors.green(`✅ Taşındı: ${args[0]} → ${args[1]}`));
    }
  },
  
  copy: (args) => {
    if (args.length < 2) {
      console.log(colors.red('❌ Kaynak ve hedef belirtilmedi'));
      return;
    }
    
    const source = resolvePath(args[0]);
    const dest = resolvePath(args[1]);
    
    if (!existsSync(source)) {
      console.log(colors.red(`❌ Kaynak bulunamadı: ${args[0]}`));
      return;
    }
    
    if (isDirectory(source)) {
      console.log(colors.red('❌ Klasör kopyalama henüz desteklenmiyor'));
      return;
    }
    
    ensureDir(dirname(dest));
    
    if (isDirectory(dest)) {
      const destFile = join(dest, basename(source));
      copyFileSync(source, destFile);
      console.log(colors.green(`✅ Kopyalandı: ${args[0]} → ${relative(PROJECT_ROOT, destFile)}`));
    } else {
      copyFileSync(source, dest);
      console.log(colors.green(`✅ Kopyalandı: ${args[0]} → ${args[1]}`));
    }
  },
  
  rename: (args) => {
    if (args.length < 2) {
      console.log(colors.red('❌ Eski ve yeni isim belirtilmedi'));
      return;
    }
    
    const oldPath = resolvePath(args[0]);
    const newPath = resolvePath(args[1]);
    
    if (!existsSync(oldPath)) {
      console.log(colors.red(`❌ Kaynak bulunamadı: ${args[0]}`));
      return;
    }
    
    ensureDir(dirname(newPath));
    renameSync(oldPath, newPath);
    console.log(colors.green(`✅ Yeniden adlandırıldı: ${args[0]} → ${args[1]}`));
  },
  
  list: (args) => {
    const dir = args[0] || '.';
    const recursive = args.includes('--recursive') || args.includes('-r');
    
    console.log(colors.blue(`\n📂 ${dir}${recursive ? ' (recursive)' : ''}\n`));
    listDir(resolvePath(dir), recursive);
  },
  
  find: (args) => {
    if (args.length === 0) {
      console.log(colors.red('❌ Arama pattern\'i belirtilmedi'));
      console.log(colors.gray('   Kullanım: npm run file -- find "*.js" [dir]'));
      return;
    }
    
    const pattern = args[0];
    const dir = args[1] || '.';
    
    console.log(colors.blue(`\n🔍 "${pattern}" araması (${dir}):\n`));
    
    const files = findFiles(pattern, dir);
    
    if (files.length === 0) {
      console.log(colors.yellow('   Sonuç bulunamadı'));
    } else {
      files.forEach(f => console.log(colors.gray(`   ${f}`)));
      console.log(colors.gray(`\n   Toplam: ${files.length} dosya`));
    }
  },
  
  'clean-empty': (args) => {
    const dir = args[0] || '.';
    const fullPath = resolvePath(dir);
    
    console.log(colors.blue(`\n🧹 Boş klasör temizliği (${dir}):\n`));
    
    const empties = findEmptyDirs(fullPath);
    
    if (empties.length === 0) {
      console.log(colors.green('   ✅ Boş klasör yok'));
      return;
    }
    
    for (const empty of empties) {
      const relPath = relative(PROJECT_ROOT, empty);
      try {
        rmdirSync(empty);
        console.log(colors.green(`   ✅ Silindi: ${relPath}/`));
      } catch (e) {
        console.log(colors.yellow(`   ⚠️  Silinemedi: ${relPath}/ (${e.message})`));
      }
    }
  },
  
  help: () => {
    console.log(`
${colors.blue('📁 Dosya İşlemleri Script\'i')}

${colors.yellow('Kullanım:')}
  npm run file -- <komut> [argümanlar]

${colors.yellow('Komutlar:')}
  ${colors.green('delete')} <dosya> [dosya2]...    Dosya(ları) sil
  ${colors.green('delete-dir')} <klasör> [--force] Klasörü sil (--force: dolu klasör)
  ${colors.green('move')} <kaynak> <hedef>         Taşı
  ${colors.green('copy')} <kaynak> <hedef>         Kopyala
  ${colors.green('rename')} <eski> <yeni>          Yeniden adlandır
  ${colors.green('list')} <klasör> [-r]            Listele (-r: recursive)
  ${colors.green('find')} <pattern> [klasör]       Dosya ara (glob pattern)
  ${colors.green('clean-empty')} [klasör]          Boş klasörleri temizle
  ${colors.green('help')}                          Bu yardımı göster

${colors.yellow('Örnekler:')}
  npm run file -- delete old.js unused.js
  npm run file -- delete-dir claude-plugins --force
  npm run file -- move scripts/test.js .rovodev/scripts/
  npm run file -- find "*.md" docs/
  npm run file -- clean-empty .
`);
  }
};

// ============================================================================
// Ana Çalıştırma
// ============================================================================

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    commands.help();
    return;
  }
  
  const command = args[0];
  const cmdArgs = args.slice(1).filter(a => a !== '--force');
  const hasForce = args.includes('--force');
  
  if (commands[command]) {
    if (hasForce) cmdArgs.push('--force');
    commands[command](cmdArgs);
  } else {
    console.log(colors.red(`❌ Bilinmeyen komut: ${command}`));
    console.log(colors.gray('   Yardım için: npm run file -- help'));
  }
}

main();
