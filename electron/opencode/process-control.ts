/**
 * OpenCode Manager - Process Control
 * 
 * Server başlatma/durdurma, port kontrolü, graceful shutdown
 */

import { spawn } from "child_process";
import { OPENCODE_DEFAULTS } from "../opencode-config.ts";
import { randomBase62 } from './id-generator.ts';
import { STARTUP_TIMEOUT, SHUTDOWN_TIMEOUT } from './types.ts';
import type { ChildProcess } from "child_process";

/**
 * Server process'ini başlat
 */
export function spawnServer(port: number, cors: string): Promise<{ process: ChildProcess; authHeader: string; pid: number | null }> {
  return new Promise((resolve, reject) => {
    // Generate a random password for this server instance
    const serverPassword = randomBase62(32);
    const username = "opencode";
    
    // Create Basic auth header
    const credentials = Buffer.from(`${username}:${serverPassword}`).toString('base64');
    const authHeader = `Basic ${credentials}`;
    
    const args = ["serve", "--port", String(port), "--cors", cors];
    
    // Set password via environment variable
    const env = {
      ...process.env,
      OPENCODE_SERVER_PASSWORD: serverPassword,
      OPENCODE_SERVER_USERNAME: username,
    };
    
    console.log("[OPENCODE]", "debug", "Server başlatılıyor", { 
      command: OPENCODE_DEFAULTS.command, 
      args,
      authEnabled: true 
    });
    
    const process = spawn(OPENCODE_DEFAULTS.command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
      env,
    });

    const pid = process.pid ?? null;

    // Stdout log
    process.stdout?.on("data", (data) => {
      const output = data.toString().trim();
      if (output) {
        console.log("[OPENCODE-STDOUT]", "debug", output);
      }
    });

    // Stderr log
    process.stderr?.on("data", (data) => {
      const output = data.toString().trim();
      if (output) {
        console.log("[OPENCODE-STDERR]", "warn", output);
      }
    });

    // Process kapandığında
    process.on("close", (code) => {
      console.log("[OPENCODE]", "info", `Server process kapandı`, { code });
    });

    // Hata durumunda
    process.on("error", (err) => {
      console.log("[OPENCODE]", "error", "Process hatası", { error: (err as Error).message });
      reject(err);
    });

    // Spawn başarılı
    resolve({ process, authHeader, pid });
  });
}

/**
 * Server'ın hazır olmasını bekle
 */
export async function waitForServer(port: number): Promise<void> {
  const startTime = Date.now();
  // OpenCode server 127.0.0.1'de dinliyor
  const url = `http://127.0.0.1:${port}`;
  
  while (Date.now() - startTime < STARTUP_TIMEOUT) {
    try {
      const response = await fetch(url, { 
        method: "GET", 
        signal: AbortSignal.timeout(2000) 
      });
      // Herhangi bir yanıt aldıysak server hazır demektir
      // Status 200, 404, 405 vb. olabilir - önemli olan yanıt vermesi
      console.log("[OPENCODE]", "debug", "Server yanıt verdi", { status: response.status });
      return;
    } catch (err: unknown) {
      // Connection refused veya timeout - henüz hazır değil
      console.log("[OPENCODE]", "debug", "Server henüz hazır değil, bekleniyor...");
    }
    await sleep(500);
  }
  
  throw new Error(`Server ${STARTUP_TIMEOUT}ms içinde başlamadı`);
}

/**
 * Port'un kullanımda olup olmadığını kontrol et
 */
export async function isPortInUse(port: number): Promise<boolean> {
  try {
    await fetch(`http://127.0.0.1:${port}`, { 
      method: "GET", 
      signal: AbortSignal.timeout(1000) 
    });
    return true; // Yanıt aldık, port kullanımda
  } catch {
    return false; // Bağlantı başarısız, port boş
  }
}

/**
 * Process'i öldür
 */
export function killProcess(
  process: ChildProcess,
  port: number
): Promise<void> {
  return new Promise((resolve, _reject) => {
    if (!process) {
      resolve(undefined);
      return;
    }

    const pid = process.pid;
    let resolved = false;
    
    const cleanup = () => {
      if (resolved) return;
      resolved = true;
      resolve(undefined);
    };

    // İlk timeout: SIGKILL dene
    const killTimeout = setTimeout(() => {
      console.log("[OPENCODE]", "warn", "Graceful shutdown timeout, SIGKILL gönderiliyor");
      try {
        process?.kill("SIGKILL");
      } catch (e) {
        // Process zaten öldüyse hata verebilir
      }
    }, SHUTDOWN_TIMEOUT);
    
    // İkinci timeout: Port bazlı kill dene ve zorla resolve et
    const forceTimeout = setTimeout(async () => {
      console.log("[OPENCODE]", "warn", "Force shutdown - process yanıt vermiyor, port bazlı kill deneniyor");
      clearTimeout(killTimeout);
      
      // Port bazlı kill dene
      try {
        await killByPort(port);
      } catch (e) {
        console.log("[OPENCODE]", "debug", "Port bazlı kill başarısız", { error: (e as Error).message });
      }
      
      cleanup();
    }, SHUTDOWN_TIMEOUT + 5000); // SIGKILL'den 5 saniye sonra

    process.on("close", () => {
      clearTimeout(killTimeout);
      clearTimeout(forceTimeout);
      cleanup();
    });
    
    process.on("error", (err) => {
      console.log("[OPENCODE]", "error", "Process error", { error: err.message });
      clearTimeout(killTimeout);
      clearTimeout(forceTimeout);
      cleanup();
    });

    // Önce SIGTERM dene
    console.log("[OPENCODE]", "debug", "SIGTERM gönderiliyor", { pid });
    try {
      process.kill("SIGTERM");
    } catch (e) {
      // Process zaten öldüyse
      clearTimeout(killTimeout);
      clearTimeout(forceTimeout);
      cleanup();
    }
  });
}

/**
 * Port kullanan process'i öldür (Linux/Mac için)
 */
export async function killByPort(port: number): Promise<void> {
  const { exec } = await import("child_process");
  const { promisify } = await import("util");
  const execAsync = promisify(exec);
  
  try {
    // Linux/Mac: lsof ile portu kullanan PID'i bul
    const { stdout } = await execAsync(`lsof -t -i:${port} 2>/dev/null || fuser ${port}/tcp 2>/dev/null || true`);
    const pids = stdout.trim().split('\n').filter(p => p);
    
    if (pids.length > 0) {
      for (const pid of pids) {
        try {
          console.log("[OPENCODE]", "debug", "Port bazlı kill", { port, pid });
          await execAsync(`kill -9 ${pid} 2>/dev/null || true`);
        } catch {
          // Ignore
        }
      }
    }
  } catch (e) {
    // Windows veya komut başarısız - ignore
    console.log("[OPENCODE]", "debug", "Port kill komutu başarısız", { error: (e as Error).message });
  }
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
