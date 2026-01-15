/**
 * OpenCode Manager
 * 
 * OpenCode serve subprocess yönetimi
 * - Server başlatma/durdurma
 * - Port kontrolü
 * - Graceful shutdown
 * - Process state tracking
 * 
 * Config değerleri: src/js/modules/webview/providers/opencode/config.js
 */

import { spawn } from "child_process";
import { OPENCODE_DEFAULTS } from "../src/js/modules/webview/providers/opencode/config.js";

// Timeout değerleri
const STARTUP_TIMEOUT = 10000; // 10 saniye
const SHUTDOWN_TIMEOUT = 5000; // 5 saniye

/**
 * @typedef {Object} OpenCodeState
 * @property {boolean} running - Server çalışıyor mu
 * @property {number|null} pid - Process ID
 * @property {number} port - Kullanılan port
 * @property {string|null} projectPath - Açık proje yolu
 * @property {string|null} error - Son hata mesajı
 */

export const OpenCodeManager = {
  /** @type {import("child_process").ChildProcess|null} */
  _process: null,
  
  /** @type {OpenCodeState} */
  _state: {
    running: false,
    pid: null,
    port: OPENCODE_DEFAULTS.port,
    projectPath: null,
    error: null,
  },
  
  /** @type {Function[]} */
  _statusListeners: [],

  // =========================================================================
  // Public API
  // =========================================================================

  /**
   * OpenCode server'ı başlat
   * @param {Object} options - Başlatma seçenekleri
   * @param {number} [options.port=4096] - Server portu
   * @param {string} [options.cors] - CORS origin
   * @param {string} [options.projectPath] - Proje klasörü
   * @returns {Promise<{success: boolean, url?: string, error?: string}>}
   */
  async start(options = {}) {
    const port = options.port || OPENCODE_DEFAULTS.port;
    const cors = options.cors || OPENCODE_DEFAULTS.cors;
    const projectPath = options.projectPath || null;

    // Zaten çalışıyorsa
    if (this._process && this._state.running) {
      console.log("[OPENCODE]", "warn", "Server zaten çalışıyor", { pid: this._state.pid });
      return {
        success: true,
        url: this._getProjectUrl(projectPath, port),
        alreadyRunning: true,
      };
    }

    try {
      // Port kontrolü
      const portInUse = await this._isPortInUse(port);
      if (portInUse) {
        // Port kullanımda - belki başka bir opencode instance?
        console.log("[OPENCODE]", "warn", `Port ${port} kullanımda, mevcut server'a bağlanılıyor`);
        this._state.running = true;
        this._state.port = port;
        this._state.projectPath = projectPath;
        return {
          success: true,
          url: this._getProjectUrl(projectPath, port),
          existingServer: true,
        };
      }

      // Server'ı başlat
      await this._spawnServer(port, cors);
      
      // Server hazır olana kadar bekle
      await this._waitForServer(port);
      
      this._state.running = true;
      this._state.port = port;
      this._state.projectPath = projectPath;
      this._state.error = null;
      
      const url = this._getProjectUrl(projectPath, port);
      console.log("[OPENCODE]", "info", "Server başlatıldı", { port, url, pid: this._state.pid });
      
      this._notifyListeners();
      
      return { success: true, url };
    } catch (error) {
      this._state.error = error.message;
      console.log("[OPENCODE]", "error", "Server başlatılamadı", { error: error.message });
      return { success: false, error: error.message };
    }
  },

  /**
   * OpenCode server'ı durdur
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async stop() {
    if (!this._process) {
      console.log("[OPENCODE]", "debug", "Server zaten çalışmıyor");
      this._resetState();
      return { success: true, alreadyStopped: true };
    }

    try {
      await this._killProcess();
      this._resetState();
      console.log("[OPENCODE]", "info", "Server durduruldu");
      this._notifyListeners();
      return { success: true };
    } catch (error) {
      console.log("[OPENCODE]", "error", "Server durdurulamadı", { error: error.message });
      return { success: false, error: error.message };
    }
  },

  /**
   * Server durumunu al
   * @returns {OpenCodeState}
   */
  getStatus() {
    return { ...this._state };
  },

  /**
   * Durum değişikliği dinleyicisi ekle
   * @param {Function} callback
   */
  onStatusChange(callback) {
    this._statusListeners.push(callback);
  },

  /**
   * Dinleyiciyi kaldır
   * @param {Function} callback
   */
  removeStatusListener(callback) {
    this._statusListeners = this._statusListeners.filter(cb => cb !== callback);
  },

  /**
   * Uygulama kapanırken çağrılacak cleanup
   * @returns {Promise<void>}
   */
  async cleanup() {
    console.log("[OPENCODE]", "info", "Cleanup başlatılıyor...");
    await this.stop();
  },

  // =========================================================================
  // Private Methods
  // =========================================================================

  /**
   * Server process'ini başlat
   * @param {number} port
   * @param {string} cors
   * @returns {Promise<void>}
   */
  _spawnServer(port, cors) {
    return new Promise((resolve, reject) => {
      const args = ["serve", "--port", String(port), "--cors", cors];
      
      console.log("[OPENCODE]", "debug", "Server başlatılıyor", { command: OPENCODE_DEFAULTS.command, args });
      
      this._process = spawn(OPENCODE_DEFAULTS.command, args, {
        stdio: ["ignore", "pipe", "pipe"],
        detached: false,
      });

      this._state.pid = this._process.pid;

      // Stdout log
      this._process.stdout?.on("data", (data) => {
        const output = data.toString().trim();
        if (output) {
          console.log("[OPENCODE-STDOUT]", "debug", output);
        }
      });

      // Stderr log
      this._process.stderr?.on("data", (data) => {
        const output = data.toString().trim();
        if (output) {
          console.log("[OPENCODE-STDERR]", "warn", output);
        }
      });

      // Process kapandığında
      this._process.on("close", (code) => {
        console.log("[OPENCODE]", "info", `Server process kapandı`, { code });
        this._resetState();
        this._notifyListeners();
      });

      // Hata durumunda
      this._process.on("error", (err) => {
        console.log("[OPENCODE]", "error", "Process hatası", { error: err.message });
        this._state.error = err.message;
        reject(err);
      });

      // Spawn başarılı
      resolve();
    });
  },

  /**
   * Server'ın hazır olmasını bekle
   * @param {number} port
   * @returns {Promise<void>}
   */
  async _waitForServer(port) {
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
      } catch (err) {
        // Connection refused veya timeout - henüz hazır değil
        console.log("[OPENCODE]", "debug", "Server henüz hazır değil, bekleniyor...");
      }
      await this._sleep(500);
    }
    
    throw new Error(`Server ${STARTUP_TIMEOUT}ms içinde başlamadı`);
  },

  /**
   * Port'un kullanımda olup olmadığını kontrol et
   * @param {number} port
   * @returns {Promise<boolean>}
   */
  async _isPortInUse(port) {
    try {
      await fetch(`http://127.0.0.1:${port}`, { 
        method: "GET", 
        signal: AbortSignal.timeout(1000) 
      });
      return true; // Yanıt aldık, port kullanımda
    } catch {
      return false; // Bağlantı başarısız, port boş
    }
  },

  /**
   * Process'i öldür
   * @returns {Promise<void>}
   */
  _killProcess() {
    return new Promise((resolve, reject) => {
      if (!this._process) {
        resolve();
        return;
      }

      const pid = this._process.pid;
      
      // Timeout kontrolü
      const timeout = setTimeout(() => {
        console.log("[OPENCODE]", "warn", "Graceful shutdown timeout, SIGKILL gönderiliyor");
        this._process?.kill("SIGKILL");
      }, SHUTDOWN_TIMEOUT);

      this._process.on("close", () => {
        clearTimeout(timeout);
        this._process = null;
        resolve();
      });

      // Önce SIGTERM dene
      console.log("[OPENCODE]", "debug", "SIGTERM gönderiliyor", { pid });
      this._process.kill("SIGTERM");
    });
  },

  /**
   * State'i sıfırla
   */
  _resetState() {
    this._process = null;
    this._state = {
      running: false,
      pid: null,
      port: OPENCODE_DEFAULTS.port,
      projectPath: null,
      error: null,
    };
  },

  /**
   * Proje URL'i oluştur
   * @param {string|null} projectPath
   * @param {number} port
   * @returns {string}
   */
  _getProjectUrl(projectPath, port) {
    const baseUrl = `http://localhost:${port}`;
    if (projectPath) {
      return `${baseUrl}?project=${encodeURIComponent(projectPath)}`;
    }
    return baseUrl;
  },

  /**
   * Dinleyicileri bilgilendir
   */
  _notifyListeners() {
    const state = this.getStatus();
    this._statusListeners.forEach(cb => {
      try {
        cb(state);
      } catch (err) {
        console.log("[OPENCODE]", "error", "Status listener hatası", { error: err.message });
      }
    });
  },

  /**
   * Sleep utility
   * @param {number} ms
   * @returns {Promise<void>}
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
};
