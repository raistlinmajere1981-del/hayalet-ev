#!/usr/bin/env node

/**
 * Pre-commit Hook Script
 * 
 * Commit öncesi otomatik kontroller:
 * 1. ESLint kontrolü
 * 2. TypeScript kontrolü (soft mode - sadece uyarı)
 * 3. console.log yasağı (renderer process'te)
 * 4. LogManager kullanım kontrolü
 * 5. Geçici dosya kontrolü
 * 
 * Kurulum:
 *   # .git/hooks/pre-commit olarak kopyala
 *   cp .rovo/scripts/pre-commit.js .git/hooks/pre-commit
 *   chmod +x .git/hooks/pre-commit
 * 
 *   # veya npm script olarak kullan
 *   npm run pre-commit
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '../..');

// ============================================================================
// Konfigürasyon
// ============================================================================

const CONFIG = {
  // console.log kontrolü yapılacak klasörler
  checkConsolePaths: [
    'src/js/modules/',
    'src/js/pages/',
  ],
  
  // console.log kontrolünden muaf dosyalar
  exemptFiles: [
    'webview-preload.cjs',  // Webview context
  ],
  
  // console.log kontrolünden muaf pattern'ler (executeJavaScript içi)
  exemptPatterns: [
    /executeJavaScript\s*\(\s*`[\s\S]*?console\./,
    /\.executeJavaScript\s*\(\s*['"][\s\S]*?console\./,
  ],
  
  // Zorunlu import (LogManager kullanılıyorsa)
  requiredImport: 'log-manager.js',
};

// ============================================================================
// Renk Kodları
// ============================================================================

const colors = {
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  gray: (text) => `\x1b[90m${text}\x1b[0m`,
};

// ============================================================================
// Kontrol Fonksiyonları
// ============================================================================

/**
 * Staged dosyaları al
 */
function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      cwd: PROJECT_ROOT,
      encoding: 'utf-8',
    });
    return output.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * ESLint kontrolü
 */
function checkLint() {
  console.log(colors.blue('\n📋 ESLint kontrolü...'));
  
  try {
    execSync('npm run lint', {
      cwd: PROJECT_ROOT,
      stdio: 'pipe',
    });
    console.log(colors.green('   ✅ Lint kontrolü başarılı'));
    return { success: true, errors: [] };
  } catch (error) {
    const output = error.stdout?.toString() || error.stderr?.toString() || '';
    
    // Sadece hataları kontrol et (uyarılar OK)
    if (output.includes('error') && !output.includes('0 errors')) {
      console.log(colors.red('   ❌ Lint hataları var'));
      return { success: false, errors: ['ESLint hataları mevcut. "npm run lint" ile kontrol edin.'] };
    }
    
    console.log(colors.green('   ✅ Lint kontrolü başarılı (sadece uyarılar)'));
    return { success: true, errors: [] };
  }
}

/**
 * TypeScript kontrolü (soft mode - sadece uyarı)
 */
function checkTypeScriptSoft() {
  console.log(colors.blue('\n📘 TypeScript kontrolü (soft mode)...'));
  
  try {
    execSync('npx tsc --noEmit', {
      cwd: PROJECT_ROOT,
      stdio: 'pipe',
    });
    console.log(colors.green('   ✅ Type kontrolü başarılı'));
    return { success: true, errors: [] };
  } catch (error) {
    const output = error.stdout?.toString() || error.stderr?.toString() || '';
    
    // Hata sayısını bul
    const errorMatch = output.match(/Found (\d+) error/);
    const errorCount = errorMatch ? errorMatch[1] : 'bilinmeyen';
    
    console.log(colors.yellow(`   ⚠️  ${errorCount} TypeScript hatası mevcut (commit engellenmedi)`));
    console.log(colors.gray('      Hataları görmek için: npm run ai:errors'));
    console.log(colors.gray('      Tam kontrol için: npm run ai:check'));
    
    // Soft mode: Uyarı ver ama commit'i engelleme
    return { success: true, errors: [] };
  }
}

/**
 * console.log kullanım kontrolü
 */
function checkConsoleUsage(files) {
  console.log(colors.blue('\n🔍 console.log kontrolü...'));
  
  const errors = [];
  const warnings = [];
  
  // Sadece ilgili dosyaları kontrol et
  const relevantFiles = files.filter(file => {
    return CONFIG.checkConsolePaths.some(path => file.startsWith(path)) &&
           file.endsWith('.js') &&
           !CONFIG.exemptFiles.some(exempt => file.includes(exempt));
  });
  
  if (relevantFiles.length === 0) {
    console.log(colors.gray('   ℹ️  Kontrol edilecek dosya yok'));
    return { success: true, errors: [] };
  }
  
  for (const file of relevantFiles) {
    const fullPath = resolve(PROJECT_ROOT, file);
    if (!existsSync(fullPath)) continue;
    
    const content = readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');
    
    // executeJavaScript blokları dışındaki console kullanımlarını bul
    let inExecuteJS = false;
    let executeJSDepth = 0;
    
    lines.forEach((line, index) => {
      const lineNum = index + 1;
      
      // executeJavaScript başlangıcı
      if (line.includes('executeJavaScript')) {
        inExecuteJS = true;
        executeJSDepth = (line.match(/`/g) || []).length;
      }
      
      // executeJavaScript bitişi
      if (inExecuteJS && executeJSDepth > 0) {
        const backticks = (line.match(/`/g) || []).length;
        executeJSDepth -= backticks;
        if (executeJSDepth <= 0) {
          inExecuteJS = false;
        }
      }
      
      // console.log/error/warn kontrolü (executeJS dışında)
      if (!inExecuteJS) {
        const consoleMatch = line.match(/console\.(log|error|warn|debug|info)\s*\(/);
        if (consoleMatch) {
          // Yorum satırı mı?
          const trimmedLine = line.trim();
          if (!trimmedLine.startsWith('//') && !trimmedLine.startsWith('*')) {
            errors.push({
              file,
              line: lineNum,
              type: consoleMatch[1],
              content: line.trim().substring(0, 60),
            });
          }
        }
      }
    });
    
    // LogManager kullanılıyor mu kontrol et
    if (content.includes('LogManager.addEvent') && !content.includes('log-manager.js')) {
      warnings.push({
        file,
        message: 'LogManager kullanılıyor ama import eksik olabilir',
      });
    }
  }
  
  if (errors.length > 0) {
    console.log(colors.red(`   ❌ ${errors.length} console kullanımı bulundu:\n`));
    
    errors.forEach(err => {
      console.log(colors.yellow(`      ${err.file}:${err.line}`));
      console.log(colors.gray(`         console.${err.type}(...)`));
      console.log(colors.gray(`         → LogManager.addEvent() kullanın\n`));
    });
    
    return { success: false, errors: errors.map(e => `${e.file}:${e.line} - console.${e.type}`) };
  }
  
  if (warnings.length > 0) {
    warnings.forEach(w => {
      console.log(colors.yellow(`   ⚠️  ${w.file}: ${w.message}`));
    });
  }
  
  console.log(colors.green('   ✅ console.log kontrolü başarılı'));
  return { success: true, errors: [] };
}

/**
 * Geçici test dosyaları kontrolü
 */
function checkTempFiles(files) {
  console.log(colors.blue('\n🗑️  Geçici dosya kontrolü...'));
  
  const tempFiles = files.filter(f => 
    f.includes('tmp_rovodev_') || 
    f.includes('.tmp') ||
    f.includes('test_') && !f.includes('test_utils')
  );
  
  if (tempFiles.length > 0) {
    console.log(colors.yellow(`   ⚠️  Geçici dosyalar commit ediliyor:`));
    tempFiles.forEach(f => console.log(colors.gray(`      - ${f}`)));
    console.log(colors.gray('      Bu dosyaları silmeyi düşünün.\n'));
  } else {
    console.log(colors.green('   ✅ Geçici dosya yok'));
  }
  
  return { success: true, errors: [] }; // Uyarı, hata değil
}

// ============================================================================
// Ana Fonksiyon
// ============================================================================

async function main() {
  console.log(colors.blue('\n╔══════════════════════════════════════════════╗'));
  console.log(colors.blue('║        🔒 Pre-commit Kontrolleri             ║'));
  console.log(colors.blue('╚══════════════════════════════════════════════╝'));
  
  const stagedFiles = getStagedFiles();
  
  if (stagedFiles.length === 0) {
    console.log(colors.gray('\nCommit edilecek dosya yok.\n'));
    process.exit(0);
  }
  
  console.log(colors.gray(`\n${stagedFiles.length} dosya kontrol edilecek...\n`));
  
  const results = [];
  
  // 1. ESLint kontrolü
  results.push(checkLint());
  
  // 2. TypeScript kontrolü (soft mode - sadece uyarı)
  checkTypeScriptSoft();
  
  // 3. console.log kontrolü
  results.push(checkConsoleUsage(stagedFiles));
  
  // 3. Geçici dosya kontrolü
  results.push(checkTempFiles(stagedFiles));
  
  // Sonuçları değerlendir
  const failed = results.filter(r => !r.success);
  
  console.log(colors.blue('\n══════════════════════════════════════════════'));
  
  if (failed.length > 0) {
    console.log(colors.red('\n❌ Pre-commit kontrolleri BAŞARISIZ\n'));
    console.log(colors.yellow('Düzeltilmesi gereken sorunlar:'));
    failed.forEach(f => {
      f.errors.forEach(e => console.log(colors.gray(`  - ${e}`)));
    });
    console.log();
    process.exit(1);
  }
  
  console.log(colors.green('\n✅ Tüm kontroller başarılı! Commit devam ediyor...\n'));
  process.exit(0);
}

main().catch(err => {
  console.error(colors.red(`\n❌ Pre-commit hatası: ${err.message}\n`));
  process.exit(1);
});
