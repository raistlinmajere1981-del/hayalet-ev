#!/usr/bin/env node

/**
 * Satır Bazlı Dosya Düzenleme Script'i
 * 
 * AI agent'ların büyük dosyalarda güvenli düzenleme yapması için.
 * find_and_replace tool'u uzun metinlerde hata verdiğinde bu script kullanılır.
 * 
 * Kullanım:
 *   node edit-lines.js <dosya> <başlangıç> <bitiş> <yeni-içerik-dosyası>
 *   node edit-lines.js <dosya> --delete <başlangıç> <bitiş>
 *   node edit-lines.js <dosya> --insert <satır> <içerik-dosyası>
 *   node edit-lines.js <dosya> --show <başlangıç> <bitiş>
 * 
 * Örnekler:
 *   # 100-150 arası satırları yeni içerikle değiştir
 *   node edit-lines.js AGENTS.md 100 150 /tmp/new_content.txt
 * 
 *   # 200-250 arası satırları sil
 *   node edit-lines.js AGENTS.md --delete 200 250
 * 
 *   # 300. satırdan sonra içerik ekle
 *   node edit-lines.js AGENTS.md --insert 300 /tmp/insert_content.txt
 * 
 *   # 100-120 arası satırları göster
 *   node edit-lines.js AGENTS.md --show 100 120
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// ============================================================================
// Yardımcı Fonksiyonlar
// ============================================================================

function showUsage() {
  console.log(`
Satır Bazlı Dosya Düzenleme

Kullanım:
  node edit-lines.js <dosya> <başlangıç> <bitiş> <yeni-içerik-dosyası>
  node edit-lines.js <dosya> --delete <başlangıç> <bitiş>
  node edit-lines.js <dosya> --insert <satır> <içerik-dosyası>
  node edit-lines.js <dosya> --show <başlangıç> <bitiş>

Parametreler:
  <dosya>           Düzenlenecek dosya yolu
  <başlangıç>       Başlangıç satır numarası (1-indexed)
  <bitiş>           Bitiş satır numarası (dahil)
  <içerik-dosyası>  Yeni içeriğin bulunduğu dosya

Seçenekler:
  --delete    Belirtilen satır aralığını sil
  --insert    Belirtilen satırdan sonra içerik ekle
  --show      Belirtilen satır aralığını göster (düzenleme yapmaz)
  --backup    Orijinal dosyanın yedeğini al (.bak)
  --dry-run   Değişiklikleri göster ama uygulamaz

Örnekler:
  # AGENTS.md'nin 100-150 satırlarını /tmp/new.txt içeriğiyle değiştir
  node edit-lines.js AGENTS.md 100 150 /tmp/new.txt

  # Satır 200-250'yi sil
  node edit-lines.js AGENTS.md --delete 200 250

  # Satır 300'den sonra içerik ekle
  node edit-lines.js AGENTS.md --insert 300 /tmp/insert.txt

  # Önce göster, sonra düzenle
  node edit-lines.js AGENTS.md --show 100 120
`);
}

function readFile(filePath) {
  const fullPath = resolve(filePath);
  if (!existsSync(fullPath)) {
    console.error(`❌ Dosya bulunamadı: ${fullPath}`);
    process.exit(1);
  }
  return readFileSync(fullPath, 'utf-8');
}

function writeFile(filePath, content) {
  const fullPath = resolve(filePath);
  writeFileSync(fullPath, content, 'utf-8');
}

function validateLineNumbers(start, end, totalLines) {
  if (start < 1 || end < 1) {
    console.error('❌ Satır numaraları 1\'den başlamalı');
    process.exit(1);
  }
  if (start > end) {
    console.error('❌ Başlangıç satırı bitiş satırından büyük olamaz');
    process.exit(1);
  }
  if (start > totalLines) {
    console.error(`❌ Başlangıç satırı (${start}) dosya uzunluğunu (${totalLines}) aşıyor`);
    process.exit(1);
  }
}

// ============================================================================
// Ana İşlemler
// ============================================================================

function showLines(filePath, start, end) {
  const content = readFile(filePath);
  const lines = content.split('\n');
  
  validateLineNumbers(start, end, lines.length);
  
  const actualEnd = Math.min(end, lines.length);
  
  console.log(`\n📄 ${filePath} (satır ${start}-${actualEnd}, toplam ${lines.length} satır)\n`);
  console.log('─'.repeat(60));
  
  for (let i = start - 1; i < actualEnd; i++) {
    const lineNum = String(i + 1).padStart(4, ' ');
    console.log(`${lineNum} │ ${lines[i]}`);
  }
  
  console.log('─'.repeat(60));
}

function deleteLines(filePath, start, end, options = {}) {
  const content = readFile(filePath);
  const lines = content.split('\n');
  
  validateLineNumbers(start, end, lines.length);
  
  const actualEnd = Math.min(end, lines.length);
  const deletedCount = actualEnd - start + 1;
  
  // Silme işlemi
  const newLines = [
    ...lines.slice(0, start - 1),
    ...lines.slice(actualEnd)
  ];
  
  if (options.dryRun) {
    console.log(`\n🔍 DRY RUN: ${deletedCount} satır silinecek (${start}-${actualEnd})`);
    console.log(`   Yeni dosya uzunluğu: ${newLines.length} satır`);
    return;
  }
  
  if (options.backup) {
    writeFile(`${filePath}.bak`, content);
    console.log(`💾 Yedek alındı: ${filePath}.bak`);
  }
  
  writeFile(filePath, newLines.join('\n'));
  console.log(`✅ ${deletedCount} satır silindi (${start}-${actualEnd})`);
  console.log(`   Yeni dosya uzunluğu: ${newLines.length} satır`);
}

function insertLines(filePath, afterLine, contentFile, options = {}) {
  const content = readFile(filePath);
  const lines = content.split('\n');
  const newContent = readFile(contentFile);
  const newLines = newContent.split('\n');
  
  if (afterLine < 0 || afterLine > lines.length) {
    console.error(`❌ Geçersiz satır numarası: ${afterLine} (dosya ${lines.length} satır)`);
    process.exit(1);
  }
  
  // Ekleme işlemi
  const resultLines = [
    ...lines.slice(0, afterLine),
    ...newLines,
    ...lines.slice(afterLine)
  ];
  
  if (options.dryRun) {
    console.log(`\n🔍 DRY RUN: ${newLines.length} satır eklenecek (satır ${afterLine}'den sonra)`);
    console.log(`   Yeni dosya uzunluğu: ${resultLines.length} satır`);
    return;
  }
  
  if (options.backup) {
    writeFile(`${filePath}.bak`, content);
    console.log(`💾 Yedek alındı: ${filePath}.bak`);
  }
  
  writeFile(filePath, resultLines.join('\n'));
  console.log(`✅ ${newLines.length} satır eklendi (satır ${afterLine}'den sonra)`);
  console.log(`   Yeni dosya uzunluğu: ${resultLines.length} satır`);
}

function replaceLines(filePath, start, end, contentFile, options = {}) {
  const content = readFile(filePath);
  const lines = content.split('\n');
  const newContent = readFile(contentFile);
  const newLines = newContent.split('\n');
  
  validateLineNumbers(start, end, lines.length);
  
  const actualEnd = Math.min(end, lines.length);
  const replacedCount = actualEnd - start + 1;
  
  // Değiştirme işlemi
  const resultLines = [
    ...lines.slice(0, start - 1),
    ...newLines,
    ...lines.slice(actualEnd)
  ];
  
  if (options.dryRun) {
    console.log(`\n🔍 DRY RUN: ${replacedCount} satır → ${newLines.length} satır`);
    console.log(`   Değiştirilecek aralık: ${start}-${actualEnd}`);
    console.log(`   Yeni dosya uzunluğu: ${resultLines.length} satır`);
    return;
  }
  
  if (options.backup) {
    writeFile(`${filePath}.bak`, content);
    console.log(`💾 Yedek alındı: ${filePath}.bak`);
  }
  
  writeFile(filePath, resultLines.join('\n'));
  console.log(`✅ ${replacedCount} satır → ${newLines.length} satır ile değiştirildi`);
  console.log(`   Değiştirilen aralık: ${start}-${actualEnd}`);
  console.log(`   Yeni dosya uzunluğu: ${resultLines.length} satır`);
}

// ============================================================================
// CLI
// ============================================================================

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showUsage();
    process.exit(0);
  }
  
  const options = {
    backup: args.includes('--backup'),
    dryRun: args.includes('--dry-run')
  };
  
  // Seçenekleri args'tan çıkar
  const cleanArgs = args.filter(a => !a.startsWith('--'));
  
  if (args.includes('--show')) {
    const [filePath, start, end] = cleanArgs;
    showLines(filePath, parseInt(start), parseInt(end));
  } else if (args.includes('--delete')) {
    const [filePath, start, end] = cleanArgs;
    deleteLines(filePath, parseInt(start), parseInt(end), options);
  } else if (args.includes('--insert')) {
    const [filePath, afterLine, contentFile] = cleanArgs;
    insertLines(filePath, parseInt(afterLine), contentFile, options);
  } else if (cleanArgs.length === 4) {
    const [filePath, start, end, contentFile] = cleanArgs;
    replaceLines(filePath, parseInt(start), parseInt(end), contentFile, options);
  } else {
    console.error('❌ Geçersiz parametreler');
    showUsage();
    process.exit(1);
  }
}

main();
