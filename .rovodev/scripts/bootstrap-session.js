#!/usr/bin/env node

/**
 * Session Bootstrap Script
 * 
 * Yeni AI agent session'ı başlatırken kompakt bir context dosyası üretir.
 * Bu sayede agent büyük dosyaları okumak yerine özet bilgiyle başlar.
 * 
 * Kullanım:
 *   npm run bootstrap              # .rovodev/context.md üret
 *   npm run bootstrap -- --print   # Konsola yazdır
 *   npm run bootstrap -- --full    # Detaylı versiyon
 * 
 * Üretilen dosya (~200 satır):
 *   - Proje özeti
 *   - Kritik dosya listesi
 *   - Modül haritası
 *   - Aktif TODO'lar
 *   - Son değişiklikler
 *   - Sık kullanılan komutlar
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { execSync } from 'child_process';
import { resolve, dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';
import { readdir } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '../..');

const ARGS = {
  print: process.argv.includes('--print'),
  full: process.argv.includes('--full'),
  output: process.argv.find(a => a.startsWith('--output='))?.split('=')[1] || '.rovodev/context.md',
};

// ============================================================================
// Veri Toplama
// ============================================================================

function getPackageInfo() {
  try {
    const pkg = JSON.parse(readFileSync(join(PROJECT_ROOT, 'package.json'), 'utf-8'));
    return {
      name: pkg.name,
      version: pkg.version,
      description: pkg.description,
      scripts: Object.keys(pkg.scripts || {}).filter(s => 
        !s.startsWith('git-') && s !== 'postinstall'
      ),
    };
  } catch {
    return null;
  }
}

function getGitInfo() {
  try {
    const branch = execSync('git branch --show-current', { cwd: PROJECT_ROOT, encoding: 'utf-8' }).trim();
    const lastCommits = execSync('git log --oneline -5', { cwd: PROJECT_ROOT, encoding: 'utf-8' }).trim().split('\n');
    const status = execSync('git status --short', { cwd: PROJECT_ROOT, encoding: 'utf-8' }).trim();
    
    return {
      branch,
      lastCommits,
      hasChanges: status.length > 0,
      changedFiles: status ? status.split('\n').length : 0,
    };
  } catch {
    return null;
  }
}

function getDirectoryStructure() {
  const structure = {};
  
  const dirs = ['src/js/modules', 'src/js/pages', 'electron', 'mcp-server'];
  
  for (const dir of dirs) {
    const fullPath = join(PROJECT_ROOT, dir);
    if (existsSync(fullPath)) {
      structure[dir] = countFilesRecursive(fullPath);
    }
  }
  
  return structure;
}

function countFilesRecursive(dir, count = { files: 0, lines: 0 }) {
  const entries = readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    
    if (entry.isDirectory() && !['node_modules', '.git'].includes(entry.name)) {
      countFilesRecursive(fullPath, count);
    } else if (entry.isFile() && /\.(js|cjs|mjs)$/.test(entry.name)) {
      count.files++;
      try {
        const content = readFileSync(fullPath, 'utf-8');
        count.lines += content.split('\n').filter(l => l.trim() && !l.trim().startsWith('//')).length;
      } catch {}
    }
  }
  
  return count;
}

function getRecentlyModified() {
  try {
    const result = execSync(
      'find src/js electron mcp-server -name "*.js" -mtime -7 -type f 2>/dev/null | head -15',
      { cwd: PROJECT_ROOT, encoding: 'utf-8' }
    ).trim();
    
    return result ? result.split('\n') : [];
  } catch {
    return [];
  }
}

function getModuleMap() {
  // Kritik modüller ve rolleri
  return {
    'Orchestrator\'lar': [
      'core-engine.js - Ana koordinatör, tüm modülleri bağlar',
      'webview-manager.js - Webview lifecycle ve messaging',
      'traffic-manager.js - Loading/thinking state tracking',
      'relay-manager.js - AI↔AI ve AI↔Asistan iletişimi',
      'slot-controller.js - Slot yaşam döngüsü',
    ],
    'Veri Yönetimi': [
      'database/ - SQLite (konuşma, mesaj, attachment)',
      'settings-manager.js - JSON config yönetimi',
      'app-state.js - Global runtime state',
    ],
    'AI Providers': [
      'providers/chatgpt/ - ChatGPT entegrasyonu',
      'providers/grok/ - Grok entegrasyonu', 
      'providers/gemini/ - Gemini entegrasyonu',
      'providers/opencode/ - Asistan (lokal server)',
    ],
    'Electron': [
      'main.js - Ana process, IPC handlers',
      'preload.cjs - contextBridge API',
      'console-logger.js - Log sistemi',
    ],
  };
}

function getCriticalRules() {
  return [
    '❌ console.log kullanma → LogManager.addEvent() kullan',
    '✅ Her error log\'a context ekle (provider, url, selector)',
    '✅ Büyük dosyalarda edit-lines.js kullan',
    '✅ Test sonrası logs/ klasörünü kontrol et',
    '✅ executeJavaScript içi console.error kabul edilir (webview context)',
  ];
}

function getUsefulCommands() {
  return {
    'Geliştirme': [
      'npm start - Uygulamayı başlat',
      'npm run lint - Kod kontrolü',
      'npm run pre-commit - Commit öncesi kontrol',
    ],
    'Analiz': [
      'npm run analyze -- --summary - Hızlı proje özeti',
      'npm run lint:unused - Kullanılmayan export\'lar',
      'npm run diagram:simple - Modül bağımlılık diagramı',
    ],
    'Test': [
      'npm run test:smoke - Smoke test (Electron çalışırken)',
      'check_electron_connection - CDP bağlantı kontrolü',
      'inspect_element --selector "..." - Element inceleme',
    ],
    'Yardımcı': [
      'npm run edit-lines -- DOSYA --show SATIR1 SATIR2',
      'npm run bootstrap - Bu context dosyasını yenile',
    ],
  };
}

function getActiveIssues() {
  // Circular dependencies ve bilinen sorunlar
  const issues = [];
  
  try {
    const analyzeOutput = execSync('npm run analyze -- --summary 2>&1', { 
      cwd: PROJECT_ROOT, 
      encoding: 'utf-8',
      timeout: 10000
    });
    
    if (analyzeOutput.includes('Circular')) {
      issues.push('⚠️ Circular dependency\'ler mevcut (npm run analyze ile detay)');
    }
  } catch {}
  
  return issues;
}

// ============================================================================
// Context Dosyası Oluşturma
// ============================================================================

function generateContext() {
  const pkg = getPackageInfo();
  const git = getGitInfo();
  const structure = getDirectoryStructure();
  const recentFiles = getRecentlyModified();
  const moduleMap = getModuleMap();
  const rules = getCriticalRules();
  const commands = getUsefulCommands();
  const issues = getActiveIssues();
  
  const timestamp = new Date().toISOString().split('T')[0];
  
  let output = `# Hayalet-ev Project Context
> Auto-generated: ${timestamp} | Regenerate: \`npm run bootstrap\`

## 📦 Proje Bilgisi
- **Ad:** ${pkg?.name || 'hayalet-ev'} v${pkg?.version || '?'}
- **Branch:** ${git?.branch || 'unknown'}
- **Uncommitted:** ${git?.hasChanges ? `${git.changedFiles} dosya` : 'Yok ✓'}

## 📊 Yapı Özeti
`;

  // Yapı istatistikleri
  for (const [dir, stats] of Object.entries(structure)) {
    output += `- \`${dir}/\`: ${stats.files} dosya, ${stats.lines.toLocaleString()} satır\n`;
  }

  output += `
## 🗺️ Modül Haritası
`;

  for (const [category, modules] of Object.entries(moduleMap)) {
    output += `\n### ${category}\n`;
    for (const mod of modules) {
      output += `- ${mod}\n`;
    }
  }

  output += `
## ⚡ Kritik Kurallar
`;
  for (const rule of rules) {
    output += `- ${rule}\n`;
  }

  output += `
## 🛠️ Sık Kullanılan Komutlar
`;
  for (const [category, cmds] of Object.entries(commands)) {
    output += `\n**${category}:**\n`;
    for (const cmd of cmds) {
      output += `- \`${cmd}\`\n`;
    }
  }

  if (recentFiles.length > 0) {
    output += `
## 📝 Son Değişen Dosyalar (7 gün)
`;
    for (const file of recentFiles.slice(0, 10)) {
      output += `- ${file}\n`;
    }
  }

  if (git?.lastCommits) {
    output += `
## 🔄 Son Commit'ler
`;
    for (const commit of git.lastCommits) {
      output += `- ${commit}\n`;
    }
  }

  if (issues.length > 0) {
    output += `
## ⚠️ Bilinen Sorunlar
`;
    for (const issue of issues) {
      output += `- ${issue}\n`;
    }
  }

  output += `
## 📚 Detaylı Rehberler
- \`AGENTS.md\` - Ana geliştirme rehberi
- \`.rovodev/cdp.md\` - CDP tool'ları
- \`.rovodev/logging.md\` - Log sistemi
- \`.rovodev/testing.md\` - Test workflow'ları

---
*Bu dosya \`npm run bootstrap\` ile otomatik üretilir. Manuel düzenleme yapmayın.*
`;

  return output;
}

// ============================================================================
// Ana Çalıştırma
// ============================================================================

async function main() {
  console.log('📋 Session context oluşturuluyor...\n');
  
  const context = generateContext();
  
  if (ARGS.print) {
    console.log(context);
  } else {
    const outputPath = resolve(PROJECT_ROOT, ARGS.output);
    writeFileSync(outputPath, context);
    console.log(`✅ Context dosyası oluşturuldu: ${ARGS.output}`);
    console.log(`   Satır sayısı: ${context.split('\n').length}`);
    console.log(`   Boyut: ~${Math.round(context.length / 1024)}KB`);
    console.log(`\n💡 Yeni session başlangıcında bu dosyayı okuyun.`);
  }
}

main().catch(err => {
  console.error(`❌ Hata: ${err.message}`);
  process.exit(1);
});
