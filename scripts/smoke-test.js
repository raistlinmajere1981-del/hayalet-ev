/**
 * Smoke Test Script
 * 
 * Uygulamayı başlatır, belirli süre bekler, kapatır ve logları analiz eder.
 * Başarılı test için exit code 0, hata varsa exit code 1 döner.
 * 
 * Kullanım: npm run test:smoke
 */

import { spawn } from 'child_process';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const CONFIG = {
  startupWait: 12000,
  shutdownWait: 3000,
  logsDir: './logs',
};

async function getLatestLogDir() {
  const dirs = await readdir(CONFIG.logsDir);
  if (dirs.length === 0) return null;
  
  const sorted = dirs.sort((a, b) => {
    const parseDate = (d) => {
      const [date, time] = d.split('_');
      const [day, month, year] = date.split('-');
      const [hour, min, sec] = time.split('-');
      return new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}`);
    };
    return parseDate(b) - parseDate(a);
  });
  
  return join(CONFIG.logsDir, sorted[0]);
}

async function analyzeLog(logDir) {
  const results = {
    success: true,
    errors: [],
    warnings: [],
    info: [],
  };

  const errorLogPath = join(logDir, 'error.log');
  if (existsSync(errorLogPath)) {
    const errorContent = await readFile(errorLogPath, 'utf-8');
    if (errorContent.trim()) {
      const lines = errorContent.trim().split('\n');
      results.errors.push(...lines);
      results.success = false;
    }
  }

  const summaryPath = join(logDir, 'summary.json');
  if (existsSync(summaryPath)) {
    const summaryContent = await readFile(summaryPath, 'utf-8');
    if (summaryContent.trim()) {
      const summary = JSON.parse(summaryContent);
      if (summary.endReason !== 'normal') {
        results.errors.push(`Abnormal shutdown: ${summary.endReason}`);
        results.success = false;
      }
      results.info.push(`Session duration: ${summary.duration || 'N/A'}`);
      results.info.push(`End reason: ${summary.endReason}`);
    } else {
      results.warnings.push('summary.json boş (uygulama hızlı kapatıldı)');
    }
  }

  const consoleLogPath = join(logDir, 'console-001.log');
  if (existsSync(consoleLogPath)) {
    const consoleContent = await readFile(consoleLogPath, 'utf-8');
    const lines = consoleContent.split('\n');
    
    for (const line of lines) {
      const lower = line.toLowerCase();
      if (lower.includes('failed to resolve') || 
          lower.includes('cannot find module') ||
          lower.includes('syntaxerror') ||
          lower.includes('referenceerror')) {
        results.errors.push(line.trim());
        results.success = false;
      }
    }
  }

  return results;
}

async function killElectron() {
  return new Promise((resolve) => {
    const kill = spawn('pkill', ['-f', 'electron'], { stdio: 'ignore' });
    kill.on('close', () => {
      const killVite = spawn('pkill', ['-f', 'vite'], { stdio: 'ignore' });
      killVite.on('close', () => resolve());
    });
  });
}

async function runSmokeTest() {
  console.log('🚀 Smoke Test Başlatılıyor...\n');

  await killElectron();

  console.log('📦 Uygulama başlatılıyor...');
  const app = spawn('npm', ['run', 'start'], {
    stdio: 'pipe',
    detached: true,
  });

  let startupOutput = '';
  app.stdout?.on('data', (data) => {
    startupOutput += data.toString();
  });
  app.stderr?.on('data', (data) => {
    startupOutput += data.toString();
  });

  console.log(`⏳ ${CONFIG.startupWait / 1000} saniye bekleniyor...`);
  await new Promise((resolve) => setTimeout(resolve, CONFIG.startupWait));

  console.log('🛑 Uygulama kapatılıyor...');
  await killElectron();
  
  await new Promise((resolve) => setTimeout(resolve, CONFIG.shutdownWait));

  console.log('📊 Loglar analiz ediliyor...\n');

  const logDir = await getLatestLogDir();
  if (!logDir) {
    console.error('❌ Log klasörü bulunamadı!');
    process.exit(1);
  }

  console.log(`📁 Log klasörü: ${logDir}\n`);

  const results = await analyzeLog(logDir);

  if (results.info.length > 0) {
    console.log('ℹ️  Bilgi:');
    results.info.forEach((info) => console.log(`   ${info}`));
    console.log('');
  }

  if (results.warnings.length > 0) {
    console.log('⚠️  Uyarılar:');
    results.warnings.forEach((warn) => console.log(`   ${warn}`));
    console.log('');
  }

  if (results.errors.length > 0) {
    console.log('❌ Hatalar:');
    results.errors.forEach((err) => console.log(`   ${err}`));
    console.log('');
  }

  if (results.success) {
    console.log('✅ Smoke Test BAŞARILI!\n');
    process.exit(0);
  } else {
    console.log('❌ Smoke Test BAŞARISIZ!\n');
    process.exit(1);
  }
}

runSmokeTest().catch((err) => {
  console.error('❌ Test hatası:', err);
  process.exit(1);
});
