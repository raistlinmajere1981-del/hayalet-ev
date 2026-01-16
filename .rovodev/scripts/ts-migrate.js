#!/usr/bin/env node

/**
 * TypeScript Migration Helper
 * 
 * Güvenli .js → .ts dönüşümü için yardımcı script.
 * Dosyaları tek tek dönüştürür ve her adımda kontrol yapar.
 * 
 * Kullanım:
 *   node .rovodev/scripts/ts-migrate.js check              # Mevcut durumu göster
 *   node .rovodev/scripts/ts-migrate.js convert <file>     # Tek dosya dönüştür
 *   node .rovodev/scripts/ts-migrate.js batch <folder>     # Klasör dönüştür
 *   node .rovodev/scripts/ts-migrate.js revert <file>      # Geri al
 *   node .rovodev/scripts/ts-migrate.js validate           # Tüm kontrolleri çalıştır
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, renameSync, existsSync, readdirSync, statSync, unlinkSync, copyFileSync } from 'fs';
import { resolve, dirname, basename, extname, join } from 'path';
import { fileURLToPath } from 'url';

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
  bold: (t) => `\x1b[1m${t}\x1b[0m`,
};

// ============================================================================
// Backup Yönetimi
// ============================================================================
const BACKUP_DIR = join(PROJECT_ROOT, '.ts-migrate-backup');

function ensureBackupDir() {
  if (!existsSync(BACKUP_DIR)) {
    execSync(`mkdir -p "${BACKUP_DIR}"`);
  }
}

function backupFile(filePath) {
  ensureBackupDir();
  const relativePath = filePath.replace(PROJECT_ROOT + '/', '');
  const backupPath = join(BACKUP_DIR, relativePath);
  const backupDir = dirname(backupPath);
  
  execSync(`mkdir -p "${backupDir}"`);
  copyFileSync(filePath, backupPath);
  
  return backupPath;
}

function restoreFile(filePath) {
  const relativePath = filePath.replace(PROJECT_ROOT + '/', '');
  const backupPath = join(BACKUP_DIR, relativePath.replace('.ts', '.js'));
  
  if (existsSync(backupPath)) {
    const jsPath = filePath.replace('.ts', '.js');
    copyFileSync(backupPath, jsPath);
    if (existsSync(filePath) && filePath.endsWith('.ts')) {
      unlinkSync(filePath);
    }
    return true;
  }
  return false;
}

// ============================================================================
// Import Güncelleyici
// ============================================================================
function updateImportsInFile(filePath, oldExt, newExt) {
  let content = readFileSync(filePath, 'utf-8');
  let modified = false;
  
  // import ... from "./module.js" → import ... from "./module.ts"
  const importRegex = new RegExp(`(from\\s+['"]\\.\\/[^'"]+)${oldExt.replace('.', '\\.')}(['"])`, 'g');
  const newContent = content.replace(importRegex, `$1${newExt}$2`);
  
  if (newContent !== content) {
    writeFileSync(filePath, newContent, 'utf-8');
    modified = true;
  }
  
  return modified;
}

function updateAllImports(convertedFile) {
  const relativePath = convertedFile.replace(PROJECT_ROOT + '/', '');
  const dirPath = dirname(convertedFile);
  const oldBasename = basename(convertedFile, '.ts') + '.js';
  const newBasename = basename(convertedFile);
  
  // Aynı klasördeki ve üst klasörlerdeki dosyaları güncelle
  const jsFiles = findFiles(PROJECT_ROOT, ['.js', '.ts']).filter(f => f !== convertedFile);
  
  let updatedCount = 0;
  for (const file of jsFiles) {
    let content = readFileSync(file, 'utf-8');
    
    // Bu dosyadaki import'ları kontrol et
    if (content.includes(oldBasename)) {
      const updated = content.replace(
        new RegExp(oldBasename.replace('.', '\\.'), 'g'),
        newBasename
      );
      if (updated !== content) {
        writeFileSync(file, updated, 'utf-8');
        updatedCount++;
      }
    }
  }
  
  return updatedCount;
}

// ============================================================================
// Dosya Bulucu
// ============================================================================
function findFiles(dir, extensions, results = []) {
  const items = readdirSync(dir);
  
  for (const item of items) {
    const fullPath = join(dir, item);
    
    // Skip bazı klasörler
    if (['node_modules', 'dist', 'build', '.git', '.ts-migrate-backup'].includes(item)) {
      continue;
    }
    
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      findFiles(fullPath, extensions, results);
    } else if (extensions.some(ext => item.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  
  return results;
}

// ============================================================================
// Kontrol Fonksiyonları
// ============================================================================
function runLint() {
  try {
    execSync('npm run lint', { cwd: PROJECT_ROOT, stdio: 'pipe' });
    return { success: true, errors: 0 };
  } catch (error) {
    const output = error.stdout?.toString() || '';
    const errorCount = (output.match(/error/g) || []).length;
    return { success: false, errors: errorCount, output };
  }
}

function runTypeCheck() {
  try {
    execSync('npm run check-types', { cwd: PROJECT_ROOT, stdio: 'pipe' });
    return { success: true, errors: 0 };
  } catch (error) {
    const output = error.stdout?.toString() || error.stderr?.toString() || '';
    const errorCount = (output.match(/error TS/g) || []).length;
    return { success: false, errors: errorCount, output };
  }
}

// ============================================================================
// Ana Komutlar
// ============================================================================

/**
 * Mevcut durumu göster
 */
function cmdCheck() {
  console.log(colors.blue('\n📊 TypeScript Migration Durumu\n'));
  
  const jsFiles = findFiles(join(PROJECT_ROOT, 'src/js'), ['.js']);
  const tsFiles = findFiles(join(PROJECT_ROOT, 'src/js'), ['.ts']).filter(f => !f.endsWith('.d.ts'));
  
  console.log(`   JavaScript dosyaları: ${colors.yellow(jsFiles.length)}`);
  console.log(`   TypeScript dosyaları: ${colors.green(tsFiles.length)}`);
  console.log(`   Dönüşüm oranı: ${colors.bold(((tsFiles.length / (jsFiles.length + tsFiles.length)) * 100).toFixed(1))}%`);
  
  console.log(colors.blue('\n🔍 Kontrol Durumu\n'));
  
  const lint = runLint();
  const types = runTypeCheck();
  
  console.log(`   ESLint: ${lint.success ? colors.green('✅ Başarılı') : colors.red(`❌ ${lint.errors} hata`)}`);
  console.log(`   TypeScript: ${types.success ? colors.green('✅ Başarılı') : colors.yellow(`⚠️ ${types.errors} tip hatası`)}`);
  
  // Backup durumu
  if (existsSync(BACKUP_DIR)) {
    const backups = findFiles(BACKUP_DIR, ['.js']);
    if (backups.length > 0) {
      console.log(colors.blue('\n📁 Backup Dosyaları\n'));
      backups.forEach(b => {
        console.log(`   ${colors.gray(b.replace(BACKUP_DIR + '/', ''))}`);
      });
    }
  }
  
  console.log();
}

/**
 * Tek dosya dönüştür
 */
function cmdConvert(filePath) {
  const fullPath = resolve(PROJECT_ROOT, filePath);
  
  if (!existsSync(fullPath)) {
    console.log(colors.red(`\n❌ Dosya bulunamadı: ${filePath}\n`));
    process.exit(1);
  }
  
  if (!fullPath.endsWith('.js')) {
    console.log(colors.red(`\n❌ Sadece .js dosyaları dönüştürülebilir: ${filePath}\n`));
    process.exit(1);
  }
  
  console.log(colors.blue(`\n🔄 Dönüştürülüyor: ${filePath}\n`));
  
  // 1. Backup al
  console.log('   📁 Backup alınıyor...');
  const backupPath = backupFile(fullPath);
  console.log(colors.gray(`      → ${backupPath}`));
  
  // 2. Dönüşüm öncesi kontrol
  console.log('   🔍 Dönüşüm öncesi kontrol...');
  const beforeLint = runLint();
  const beforeTypes = runTypeCheck();
  
  // 3. Dosyayı .ts'e çevir
  console.log('   📝 Dosya yeniden adlandırılıyor...');
  const newPath = fullPath.replace('.js', '.ts');
  renameSync(fullPath, newPath);
  console.log(colors.gray(`      → ${newPath}`));
  
  // 4. Import'ları güncelle
  console.log('   🔗 Import\'lar güncelleniyor...');
  const updatedCount = updateAllImports(newPath);
  console.log(colors.gray(`      → ${updatedCount} dosya güncellendi`));
  
  // 5. Dönüşüm sonrası kontrol
  console.log('   🔍 Dönüşüm sonrası kontrol...');
  const afterLint = runLint();
  const afterTypes = runTypeCheck();
  
  // 6. Sonuç
  const lintDiff = afterLint.errors - beforeLint.errors;
  const typesDiff = afterTypes.errors - beforeTypes.errors;
  
  console.log(colors.blue('\n📊 Sonuç\n'));
  console.log(`   ESLint: ${lintDiff > 0 ? colors.red(`+${lintDiff} hata`) : colors.green('OK')}`);
  console.log(`   TypeScript: ${typesDiff > 0 ? colors.yellow(`+${typesDiff} tip hatası`) : colors.green('OK')}`);
  
  if (lintDiff > 0) {
    console.log(colors.yellow(`\n⚠️  Yeni ESLint hataları oluştu. Geri almak için:`));
    console.log(colors.gray(`   node .rovodev/scripts/ts-migrate.js revert ${filePath.replace('.js', '.ts')}\n`));
  } else {
    console.log(colors.green(`\n✅ Dönüşüm başarılı!\n`));
  }
}

/**
 * Geri al
 */
function cmdRevert(filePath) {
  const fullPath = resolve(PROJECT_ROOT, filePath);
  
  console.log(colors.blue(`\n🔙 Geri alınıyor: ${filePath}\n`));
  
  if (restoreFile(fullPath)) {
    console.log(colors.green('✅ Dosya başarıyla geri alındı!\n'));
  } else {
    console.log(colors.red('❌ Backup bulunamadı!\n'));
    process.exit(1);
  }
}

/**
 * Tüm kontrolleri çalıştır
 */
function cmdValidate() {
  console.log(colors.blue('\n🔍 Tüm Kontroller Çalıştırılıyor\n'));
  
  let hasErrors = false;
  
  // ESLint
  console.log('   📝 ESLint...');
  const lint = runLint();
  if (lint.success) {
    console.log(colors.green('      ✅ Başarılı'));
  } else {
    console.log(colors.red(`      ❌ ${lint.errors} hata`));
    hasErrors = true;
  }
  
  // TypeScript
  console.log('   🔷 TypeScript...');
  const types = runTypeCheck();
  if (types.success) {
    console.log(colors.green('      ✅ Başarılı'));
  } else {
    console.log(colors.yellow(`      ⚠️ ${types.errors} tip hatası`));
  }
  
  // Build
  console.log('   📦 Build...');
  try {
    execSync('npm run build', { cwd: PROJECT_ROOT, stdio: 'pipe' });
    console.log(colors.green('      ✅ Başarılı'));
  } catch {
    console.log(colors.red('      ❌ Build hatası'));
    hasErrors = true;
  }
  
  console.log();
  
  if (hasErrors) {
    console.log(colors.red('❌ Bazı kontroller başarısız!\n'));
    process.exit(1);
  } else {
    console.log(colors.green('✅ Tüm kontroller başarılı!\n'));
  }
}

/**
 * Klasör dönüştür (batch)
 */
function cmdBatch(folderPath) {
  const fullPath = resolve(PROJECT_ROOT, folderPath);
  
  if (!existsSync(fullPath)) {
    console.log(colors.red(`\n❌ Klasör bulunamadı: ${folderPath}\n`));
    process.exit(1);
  }
  
  const jsFiles = findFiles(fullPath, ['.js']);
  
  console.log(colors.blue(`\n📁 Batch Dönüşüm: ${folderPath}`));
  console.log(colors.gray(`   ${jsFiles.length} dosya bulundu\n`));
  
  console.log(colors.yellow('⚠️  Bu işlem tüm .js dosyalarını .ts\'e dönüştürecek.'));
  console.log(colors.yellow('   Her dosya için backup alınacak.\n'));
  
  console.log('Devam etmek için ENTER\'a basın (Ctrl+C ile iptal)...');
  
  // Interactive onay için
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  rl.question('', () => {
    rl.close();
    
    let successCount = 0;
    let failCount = 0;
    
    for (const file of jsFiles) {
      const relativePath = file.replace(PROJECT_ROOT + '/', '');
      process.stdout.write(`   ${relativePath}... `);
      
      try {
        // Backup
        backupFile(file);
        
        // Rename
        const newPath = file.replace('.js', '.ts');
        renameSync(file, newPath);
        
        // Update imports
        updateAllImports(newPath);
        
        console.log(colors.green('✅'));
        successCount++;
      } catch (err) {
        console.log(colors.red(`❌ ${err.message}`));
        failCount++;
      }
    }
    
    console.log(colors.blue(`\n📊 Sonuç: ${successCount} başarılı, ${failCount} başarısız\n`));
    
    // Son kontrol
    console.log('   🔍 Son kontroller yapılıyor...');
    cmdValidate();
  });
}

// ============================================================================
// CLI
// ============================================================================
function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  console.log(colors.bold('\n🔷 TypeScript Migration Helper\n'));
  
  switch (command) {
    case 'check':
      cmdCheck();
      break;
    case 'convert':
      if (!args[1]) {
        console.log(colors.red('❌ Dosya yolu gerekli: ts-migrate.js convert <file>\n'));
        process.exit(1);
      }
      cmdConvert(args[1]);
      break;
    case 'revert':
      if (!args[1]) {
        console.log(colors.red('❌ Dosya yolu gerekli: ts-migrate.js revert <file>\n'));
        process.exit(1);
      }
      cmdRevert(args[1]);
      break;
    case 'validate':
      cmdValidate();
      break;
    case 'batch':
      if (!args[1]) {
        console.log(colors.red('❌ Klasör yolu gerekli: ts-migrate.js batch <folder>\n'));
        process.exit(1);
      }
      cmdBatch(args[1]);
      break;
    default:
      console.log('Kullanım:');
      console.log('  node .rovodev/scripts/ts-migrate.js check              # Mevcut durumu göster');
      console.log('  node .rovodev/scripts/ts-migrate.js convert <file>     # Tek dosya dönüştür');
      console.log('  node .rovodev/scripts/ts-migrate.js batch <folder>     # Klasör dönüştür');
      console.log('  node .rovodev/scripts/ts-migrate.js revert <file>      # Geri al');
      console.log('  node .rovodev/scripts/ts-migrate.js validate           # Tüm kontrolleri çalıştır');
      console.log();
  }
}

main();
