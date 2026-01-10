/**
 * Assistant Manager (Main Process)
 * Web server yönetimi - OpenCode web arayüzü için
 */

import { spawn } from "child_process";
import { pathToFileURL } from "url";
import http from "http";

// Dynamic import for config
async function getProviderConfig(providerId) {
  try {
    const configPath = pathToFileURL(
      new URL("../src/js/modules/asistan/config.js", import.meta.url).pathname
    ).href;
    const mod = await import(configPath);
    return mod.assistantConfigs?.[providerId] || null;
  } catch (error) {
    console.error("[AssistantManager] Failed to load config:", error);
    return null;
  }
}

/**
 * Port'un kullanılabilir olup olmadığını kontrol et
 */
function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}`, (res) => {
      resolve(true); // Port'ta bir şey var
    });
    req.on("error", () => {
      resolve(false); // Port boş veya erişilemez
    });
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Server'ın hazır olmasını bekle
 */
async function waitForServer(port, maxWaitMs = 30000) {
  const startTime = Date.now();
  const checkInterval = 500;
  
  while (Date.now() - startTime < maxWaitMs) {
    const isReady = await checkPort(port);
    if (isReady) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }
  return false;
}

export class AssistantManager {
  constructor() {
    this.webProcess = null;
    this.currentProvider = null;
    this.currentPort = null;
    this.isConnected = false;
    this.mainWindow = null;
  }

  /**
   * Main window referansını set et
   */
  setMainWindow(window) {
    this.mainWindow = window;
  }

  /**
   * Asistana bağlan (web server başlat)
   */
  async connect(provider) {
    if (this.isConnected) {
      throw new Error("Zaten bir asistan bağlı");
    }

    const config = await getProviderConfig(provider);
    if (!config) {
      throw new Error(`Bilinmeyen provider: ${provider}`);
    }

    console.log(`[AssistantManager] Connecting to ${provider} web server...`);

    try {
      const result = await this.startWebServer(config);
      return result;
    } catch (error) {
      console.error("[AssistantManager] Connection failed:", error);
      throw error;
    }
  }

  /**
   * Web server başlat
   */
  async startWebServer(config) {
    if (!config.webStartCommand || !config.webPort) {
      throw new Error(`${config.name} web modunu desteklemiyor`);
    }

    const port = config.webPort;
    
    // Port zaten kullanılıyor mu kontrol et (önceki oturum?)
    const portInUse = await checkPort(port);
    if (portInUse) {
      console.log(`[AssistantManager] Port ${port} already in use, assuming server is running`);
      this.isConnected = true;
      this.currentProvider = config.id;
      this.currentPort = port;
      const url = config.webUrl.replace("{port}", port);
      return { success: true, url };
    }

    return new Promise((resolve, reject) => {
      // Komutu parse et ve port'u yerleştir
      const commandStr = config.webStartCommand.replace("{port}", port);
      const parts = commandStr.split(" ");
      const command = parts[0];
      const args = parts.slice(1);

      console.log(`[AssistantManager] Starting web server: ${command} ${args.join(" ")}`);

      this.webProcess = spawn(command, args, {
        stdio: ["pipe", "pipe", "pipe"],
        shell: true,
        env: {
          ...process.env,
          BROWSER: "none", // Browser açmayı engelle
          NO_BROWSER: "true"
        },
        detached: false
      });

      // Stdout log
      this.webProcess.stdout.on("data", (data) => {
        const output = data.toString();
        console.log(`[AssistantManager] ${config.id}:`, output);
      });

      // Stderr log
      this.webProcess.stderr.on("data", (data) => {
        const output = data.toString();
        // "Server is running" gibi bilgiler stderr'e gelebilir
        console.log(`[AssistantManager] ${config.id} stderr:`, output);
      });

      // Process exit
      this.webProcess.on("exit", (code, signal) => {
        console.log(`[AssistantManager] Web server exited (code: ${code}, signal: ${signal})`);
        this.handleProcessExit(code);
      });

      // Process error
      this.webProcess.on("error", (error) => {
        console.error("[AssistantManager] Web server spawn error:", error);
        reject(error);
      });

      // Server'ın başlamasını bekle
      waitForServer(port, 30000).then((ready) => {
        if (ready && this.webProcess && !this.webProcess.killed) {
          this.isConnected = true;
          this.currentProvider = config.id;
          this.currentPort = port;
          const url = config.webUrl.replace("{port}", port);
          console.log(`[AssistantManager] Web server ready at ${url}`);
          resolve({ success: true, url });
        } else {
          reject(new Error("Web server başlatılamadı veya timeout"));
        }
      });
    });
  }

  /**
   * Bağlantıyı kes (web server'ı durdur)
   */
  async disconnect() {
    if (!this.isConnected) {
      console.warn("[AssistantManager] Not connected");
      return;
    }

    console.log(`[AssistantManager] Disconnecting from ${this.currentProvider}...`);

    if (this.webProcess) {
      try {
        const pid = this.webProcess.pid;
        console.log(`[AssistantManager] Killing web server (PID: ${pid})`);
        
        // Önce SIGTERM gönder
        this.webProcess.kill("SIGTERM");
        
        // SIGTERM'in işlemesi için bekle
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Hala yaşıyorsa SIGKILL
        if (this.webProcess && !this.webProcess.killed) {
          this.webProcess.kill("SIGKILL");
        }
        
      } catch (error) {
        console.error("[AssistantManager] Error killing process:", error);
      }
    }

    this.cleanup();
  }

  /**
   * Process exit handler
   */
  handleProcessExit(code) {
    console.log(`[AssistantManager] Process exited (code: ${code})`);
    
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send("assistant-disconnected", { code });
    }

    this.cleanup();
  }

  /**
   * Cleanup
   */
  cleanup() {
    if (this.webProcess) {
      try {
        if (!this.webProcess.killed) {
          this.webProcess.kill("SIGKILL");
        }
      } catch (error) {
        // Already dead
      }
    }
    
    this.webProcess = null;
    this.currentProvider = null;
    this.currentPort = null;
    this.isConnected = false;
  }

  /**
   * Durum bilgisi
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      provider: this.currentProvider,
      port: this.currentPort,
      url: this.currentPort ? `http://localhost:${this.currentPort}` : null
    };
  }

  /**
   * Provider config'ini al
   */
  async getProviderConfig(providerId) {
    return await getProviderConfig(providerId);
  }
}

// Singleton instance
export const assistantManager = new AssistantManager();
