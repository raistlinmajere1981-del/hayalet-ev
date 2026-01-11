/**
 * Assistant Manager (Renderer Process)
 * Web modunda asistan yönetimi - OpenCode web arayüzü için
 */

import { getProviderConfig } from "./asistan/config.js";
import { WebviewHandler } from "./asistan/webview-handler.js";
import { LogManager } from "./log-manager.js";

/**
 * Simple Event Emitter mixin
 */
const EventEmitterMixin = {
  _events: {},
  
  on(event, callback) {
    if (!this._events[event]) {
      this._events[event] = [];
    }
    this._events[event].push(callback);
  },
  
  off(event, callback) {
    if (!this._events[event]) return;
    this._events[event] = this._events[event].filter(cb => cb !== callback);
  },
  
  emit(event, ...args) {
    if (!this._events[event]) return;
    this._events[event].forEach(cb => {
      try {
        cb(...args);
      } catch (e) {
        LogManager.addEvent("asistan", "error", `Event handler error (${event}): ${e?.message || e}`);
      }
    });
  }
};

/**
 * AssistantManager Singleton
 * Web modunda asistan bağlantısı ve mesaj gönderme/alma
 */
export const AssistantManager = {
  ...EventEmitterMixin,
  _events: {},
  
  isConnected: false,
  currentProvider: null,
  currentUrl: null,
  
  webviewHandler: null,
  webviewElement: null,
  
  /**
   * Provider config'ini al
   */
  getProviderConfig(providerId) {
    return getProviderConfig(providerId);
  },

  /**
   * Asistana bağlan (web server başlat ve webview'e yükle)
   */
  async connect(provider) {
    if (this.isConnected) {
      throw new Error("Zaten bir asistan bağlı");
    }

    const config = getProviderConfig(provider);
    if (!config) {
      throw new Error(`Bilinmeyen provider: ${provider}`);
    }

    LogManager.addEvent("assistant", "info", `Connecting to ${provider}...`);

    try {
      const result = await window.electronAPI.assistantConnect(provider);
      
      if (!result.success) {
        throw new Error(result.error || "Bağlantı başarısız");
      }

      this.isConnected = true;
      this.currentProvider = provider;
      this.currentUrl = result.url;

      LogManager.addEvent("assistant", "info", `Connected to ${provider} at ${result.url}`);
      
      this.emit("connected", { provider, url: result.url });

      return result;
    } catch (error) {
      LogManager.addEvent("assistant", "error", `Connection failed: ${error.message}`);
      throw error;
    }
  },

  /**
   * Webview'i initialize et (sayfa tarafından çağrılır)
   */
  async initWebview(webviewElement) {
    if (!webviewElement) {
      throw new Error("Webview element gerekli");
    }

    this.webviewElement = webviewElement;
    this.webviewHandler = new WebviewHandler(webviewElement);

    if (this.currentUrl) {
      await this.webviewHandler.init(this.currentUrl);
      LogManager.addEvent("assistant", "info", `Webview loaded: ${this.currentUrl}`);
    }
  },

  /**
   * Bağlantıyı kes
   */
  async disconnect() {
    if (!this.isConnected) {
      return;
    }

    LogManager.addEvent("assistant", "info", `Disconnecting from ${this.currentProvider}...`);

    try {
      if (this.webviewHandler) {
        this.webviewHandler.destroy();
        this.webviewHandler = null;
      }

      await window.electronAPI.assistantDisconnect();

      this.isConnected = false;
      this.currentProvider = null;
      this.currentUrl = null;
      this.webviewElement = null;

      LogManager.addEvent("assistant", "info", "Disconnected");
      
      this.emit("disconnected");
    } catch (error) {
      LogManager.addEvent("assistant", "error", `Disconnect failed: ${error.message}`);
      throw error;
    }
  },

  /**
   * Webview'e mesaj gönder (DOM injection ile)
   */
  async sendMessage(message) {
    if (!this.isConnected || !this.webviewHandler) {
      throw new Error("Asistan bağlı değil veya webview hazır değil");
    }

    LogManager.addEvent("assistant", "info", `Sending message: "${message.substring(0, 50)}..."`);

    try {
      await this.webviewHandler.sendMessage(message);
      LogManager.addEvent("assistant", "info", "Message sent");
    } catch (error) {
      LogManager.addEvent("assistant", "error", `Send failed: ${error.message}`);
      throw error;
    }
  },

  /**
   * Son asistan cevabını al (DOM'dan)
   */
  async getLastResponse() {
    if (!this.isConnected || !this.webviewHandler) {
      throw new Error("Asistan bağlı değil veya webview hazır değil");
    }

    try {
      const response = await this.webviewHandler.getLastResponse();
      LogManager.addEvent("assistant", "info", `Got response: ${response?.substring(0, 100)}...`);
      return response;
    } catch (error) {
      LogManager.addEvent("assistant", "error", `Get response failed: ${error.message}`);
      throw error;
    }
  },

  /**
   * Mesaj gönder ve cevabı bekle
   */
  async query(message, options = {}) {
    const timeout = options.timeout || 120000;

    if (!this.isConnected || !this.webviewHandler) {
      return {
        success: false,
        response: "",
        error: "Asistan bağlı değil"
      };
    }

    LogManager.addEvent("assistant", "info", `Query: "${message.substring(0, 50)}..."`);

    try {
      await this.sendMessage(message);

      const response = await this.webviewHandler.waitForResponse(timeout);

      return {
        success: true,
        response: response
      };
    } catch (error) {
      LogManager.addEvent("assistant", "error", `Query failed: ${error.message}`);
      return {
        success: false,
        response: "",
        error: error.message
      };
    }
  },

  /**
   * Durum bilgisi
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      provider: this.currentProvider,
      url: this.currentUrl
    };
  },

  isRelayActive: false,
  
  async startRelay(aiSlot) {
    // TODO: AI-Asistan relay implementasyonu
    this.isRelayActive = true;
    this.emit("relay-started", { aiSlot });
  },
  
  async stopRelay() {
    this.isRelayActive = false;
    this.emit("relay-stopped");
  }
};

if (window.electronAPI?.onAssistantDisconnected) {
  window.electronAPI.onAssistantDisconnected((data) => {
    console.log("[AssistantManager] Received disconnect event from main process");
    AssistantManager.isConnected = false;
    AssistantManager.currentProvider = null;
    AssistantManager.currentUrl = null;
    AssistantManager.emit("disconnected", data);
  });
}

export default AssistantManager;
