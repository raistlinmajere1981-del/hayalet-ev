/**
 * AsistanController - Asistan (AI0) Sayfası Yöneticisi
 * 
 * Provider seçimi, bağlantı yönetimi, webview kontrolü ve
 * AI-Asistan relay işlemlerini yönetir.
 * 
 * OpenCode server subprocess yönetimi:
 * - Bağlan: opencode serve başlatılır, webview URL'e yönlendirilir
 * - Bağlantıyı Kes: subprocess kapatılır
 * - App Close: subprocess otomatik kapatılır (main process'te)
 */

import { LogManager } from "../modules/log-manager.js";
import { SettingsManager } from "../modules/settings-manager.js";
import { AppState } from "../modules/app-state.js";
import { SlotController, SlotState } from "../modules/slot-controller.js";
import { TrafficManager } from "../modules/traffic-manager.js";
import { ProviderRegistry } from "../modules/webview/provider-registry.js";
import { RelayManager } from "../modules/relay-manager.js";
import { OPENCODE_DEFAULTS } from "../modules/webview/providers/opencode/config.js";

export class AsistanController {
  // Subscriptions
  _unsubSettings: (() => void) | null;
  _unsubSlot: (() => void) | null;
  _unsubTraffic: (() => void) | null;
  _unsubAppState: (() => void) | null;
  
  // State
  _isRelayActive: boolean;
  _isServerRunning: boolean;
  
  // DOM Elements
  providerSelect: HTMLSelectElement | null;
  connectBtn: HTMLButtonElement | null;
  connectedList: HTMLElement | null;
  relayBtn: HTMLButtonElement | null;
  relaySourceSelect: HTMLSelectElement | null;
  devtoolsBtn: HTMLButtonElement | null;
  urlDisplay: HTMLElement | null;
  titleEl: HTMLElement | null;
  statusDot: HTMLElement | null;
  statusText: HTMLElement | null;

  constructor() {
    this._unsubSettings = null;
    this._unsubSlot = null;
    this._unsubTraffic = null;
    this._unsubAppState = null;
    this._isRelayActive = false;
    this._isServerRunning = false;
    
    // DOM Elements init
    this.providerSelect = null;
    this.connectBtn = null;
    this.connectedList = null;
    this.relayBtn = null;
    this.relaySourceSelect = null;
    this.devtoolsBtn = null;
    this.urlDisplay = null;
    this.titleEl = null;
    this.statusDot = null;
    this.statusText = null;
  }

  async init() {
    await SettingsManager.load();
    
    // DOM elementleri
    this.providerSelect = document.getElementById("asistan-provider-select") as HTMLSelectElement | null;
    this.connectBtn = document.getElementById("asistan-connect-btn") as HTMLButtonElement | null;
    this.connectedList = document.getElementById("asistan-connected-list");
    this.relayBtn = document.getElementById("asistan-relay-btn") as HTMLButtonElement | null;
    this.relaySourceSelect = document.getElementById("asistan-relay-source") as HTMLSelectElement | null;
    this.devtoolsBtn = document.getElementById("asistan-devtools-btn") as HTMLButtonElement | null;
    this.urlDisplay = document.getElementById("asistan-url-display");
    this.titleEl = document.getElementById("asistan-title");
    this.statusDot = document.getElementById("asistan-status-dot");
    this.statusText = document.getElementById("asistan-status-text");
    
    // Provider listesini doldur
    this._populateProviderSelect();
    
    // Event listener'ları kur
    this._setupEventListeners();
    
    // Settings değişikliklerini dinle
    this._unsubSettings = SettingsManager.subscribe(({ settings }) => {
      this._onSettingsChange(settings);
    });
    
    // Slot durumu değişikliklerini dinle
    this._unsubSlot = SlotController.subscribe((payload: { slot?: string; event?: string }) => {
      if (payload.slot === "ai0") {
        this._updateConnectionUI();
      }
      // Bağlı AI listesini güncelle
      this._updateConnectedAIList();
      this._updateRelayControls();
    });
    
    // AppState değişikliklerini dinle
    this._unsubAppState = AppState.subscribe(() => {
      this._updateConnectedAIList();
      this._updateRelayControls();
    });
    
    // Traffic güncellemelerini dinle
    this._unsubTraffic = TrafficManager.onUpdate((snapshot: { ai0?: unknown; [key: string]: unknown }) => {
      if (snapshot?.ai0) {
        this._updateTrafficUI(snapshot.ai0);
      }
    });
    
    // İlk durumu render et
    this._updateConnectionUI();
    this._updateConnectedAIList();
    this._updateRelayControls();
    
    LogManager.addEvent("asistan", "info", "AsistanController initialized");
  }

  _populateProviderSelect() {
    if (!this.providerSelect) return;
    
    this.providerSelect.innerHTML = "";
    
    const asistanProviders = ProviderRegistry.getAllAsistan();
    asistanProviders.forEach((provider) => {
      const opt = document.createElement("option");
      opt.value = provider.id;
      opt.textContent = provider.name;
      this.providerSelect.appendChild(opt);
    });
    
    // Settings'den seçili provider'ı al
    const settings = SettingsManager.getSnapshot();
    const account = settings.asistanAccounts?.find(
      (acc) => acc.id === settings.asistanSlot?.accountId
    );
    if (account?.provider && this.providerSelect.querySelector(`option[value="${account.provider}"]`)) {
      this.providerSelect.value = account.provider;
    }
  }

  _setupEventListeners() {
    // Bağlan/Bağlantıyı Kes butonu
    this.connectBtn?.addEventListener("click", () => this._toggleConnection());
    
    // Provider değişikliği
    this.providerSelect?.addEventListener("change", () => this._onProviderChange());
    
    // DevTools butonu
    this.devtoolsBtn?.addEventListener("click", () => this._openDevTools());
    
    // Relay butonu
    this.relayBtn?.addEventListener("click", () => this._toggleRelay());
    
    // Relay kaynak seçimi
    this.relaySourceSelect?.addEventListener("change", () => this._onRelaySourceChange());
  }

  async _toggleConnection() {
    const slotState = SlotController.getState("ai0");
    
    if (slotState?.state === SlotState.CONNECTED || this._isServerRunning) {
      // Bağlantıyı kes
      await this._stopOpenCodeServer();
      await SlotController.disconnect("ai0");
      LogManager.addEvent("asistan", "info", "Asistan bağlantısı kesildi");
    } else if (slotState?.state === SlotState.ASSIGNED || slotState?.state === SlotState.EMPTY) {
      // Bağlan - önce server'ı başlat, sonra webview'ı yönlendir
      const result = await this._startOpenCodeServer();
      if (result.success) {
        // SlotController'a URL'i ilet
        await SlotController.connect("ai0", { url: result.url });
        LogManager.addEvent("asistan", "info", "Asistan bağlantısı başlatıldı", { url: result.url });
      } else {
        LogManager.addEvent("asistan", "error", "OpenCode server başlatılamadı", { error: result.error });
        this._showError(result.error || "Server başlatılamadı");
      }
    }
  }

  /**
   * OpenCode server'ı başlat
   * @returns {Promise<{success: boolean, url?: string, error?: string}>}
   */
  async _startOpenCodeServer() {
    try {
      // UI'ı güncelle
      this._updateStatusUI("connecting", "Server başlatılıyor...");
      
      const result = await window.electronAPI.opencodeStart({
        port: OPENCODE_DEFAULTS.port,
        projectPath: null,
      });
      
      if (result.success) {
        this._isServerRunning = true;
        LogManager.addEvent("asistan", "info", "OpenCode server başlatıldı", { 
          url: result.url,
          alreadyRunning: result.alreadyRunning,
          existingServer: result.existingServer,
        });
        return result;
      } else {
        this._isServerRunning = false;
        return { success: false, error: result.error };
      }
    } catch (err) {
      this._isServerRunning = false;
      LogManager.addEvent("asistan", "error", "OpenCode server başlatma hatası", { error: err.message });
      return { success: false, error: err.message };
    }
  }

  /**
   * OpenCode server'ı durdur
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async _stopOpenCodeServer() {
    try {
      const result = await window.electronAPI.opencodeStop();
      this._isServerRunning = false;
      
      if (result.success) {
        LogManager.addEvent("asistan", "info", "OpenCode server durduruldu");
      }
      
      return result;
    } catch (err) {
      this._isServerRunning = false;
      LogManager.addEvent("asistan", "error", "OpenCode server durdurma hatası", { error: err.message });
      return { success: false, error: err.message };
    }
  }

  /**
   * Hata mesajı göster
   * @param {string} message
   */
  _showError(message) {
    const overlayEl = document.getElementById("ai0-webview-overlay");
    this._updateOverlay(overlayEl, "error", "❌", "Bağlantı Hatası", message);
  }

  /**
   * Status UI'ını güncelle (loading durumları için)
   * @param {string} state - "idle" | "connecting" | "connected" | "error"
   * @param {string} message
   */
  _updateStatusUI(state, message) {
    if (this.statusDot) {
      this.statusDot.classList.remove("connected", "connecting", "error");
      if (state === "connected") {
        this.statusDot.classList.add("connected");
      } else if (state === "connecting") {
        this.statusDot.classList.add("connecting");
      } else if (state === "error") {
        this.statusDot.classList.add("error");
      }
    }
    if (this.statusText) {
      this.statusText.textContent = message || "Bağlı Değil";
    }
  }

  async _onProviderChange() {
    const providerId = this.providerSelect?.value;
    if (!providerId) return;
    
    const provider = ProviderRegistry.getAsistan(providerId as "opencode");
    if (!provider) return;
    
    // Provider değişikliğini settings'e kaydet
    const settings = SettingsManager.getSnapshot();
    const account = settings.asistanAccounts?.find((acc) => acc.provider === providerId);
    
    if (account) {
      await SettingsManager.save({
        ...settings,
        asistanSlot: {
          ...settings.asistanSlot,
          accountId: account.id,
        },
      });
    }
    
    // Başlığı güncelle
    if (this.titleEl) {
      this.titleEl.textContent = provider.name;
    }
    
    LogManager.addEvent("asistan", "info", `Provider değiştirildi: ${provider.name}`);
  }

  _openDevTools() {
    const webview = document.getElementById("ai0-webview") as any;
    if (webview && typeof webview.openDevTools === "function") {
      webview.openDevTools();
    }
  }

  async _toggleRelay() {
    const sourceSlot = this.relaySourceSelect?.value;
    
    if (this._isRelayActive) {
      // Relay'i durdur
      await RelayManager.stopAIAsistanSession();
      this._isRelayActive = false;
      AppState.setAsistanRelay(false, null);
      LogManager.addEvent("asistan", "info", "AI-Asistan relay durduruldu");
    } else {
      // Relay'i başlat
      if (!sourceSlot) {
        LogManager.addEvent("asistan", "warning", "Relay için kaynak AI seçilmedi");
        return;
      }
      
      // Kaynak AI'ın bağlı olduğunu kontrol et
      if (!SlotController.isConnected(sourceSlot)) {
        LogManager.addEvent("asistan", "warning", `${sourceSlot} bağlı değil`);
        return;
      }
      
      // Asistan'ın bağlı olduğunu kontrol et
      if (!SlotController.isConnected("ai0")) {
        LogManager.addEvent("asistan", "warning", "Asistan bağlı değil");
        return;
      }
      
      await RelayManager.startAIAsistanSession(sourceSlot);
      this._isRelayActive = true;
      AppState.setAsistanRelay(true, sourceSlot);
      LogManager.addEvent("asistan", "info", `AI-Asistan relay başlatıldı: ${sourceSlot} ↔ ai0`);
    }
    
    this._updateRelayControls();
  }

  _onRelaySourceChange() {
    // Kaynak değiştiğinde ve relay aktifse, relay'i yeniden başlat
    if (this._isRelayActive) {
      this._toggleRelay(); // Önce durdur
      this._toggleRelay(); // Sonra yeni kaynakla başlat
    }
  }

  _updateConnectionUI() {
    const slotState = SlotController.getState("ai0");
    const isConnected = slotState?.state === SlotState.CONNECTED;
    const isConnecting = slotState?.state === SlotState.CONNECTING;
    const isError = slotState?.state === SlotState.ERROR;
    const hasAccount = !!slotState?.accountId;
    
    // Webview ve overlay elementleri
    const webviewEl = document.getElementById("ai0-webview");
    const mountEl = document.getElementById("ai0-webview-mount");
    const overlayEl = document.getElementById("ai0-webview-overlay");
    
    // Webview her zaman mount edilir
    if (webviewEl && mountEl && !mountEl.contains(webviewEl)) {
      mountEl.appendChild(webviewEl);
      webviewEl.style.cssText = "position: relative; top: 0; left: 0; width: 100%; height: 100%;";
    }
    
    // Webview event setup (bir kez)
    if (webviewEl && !webviewEl.dataset.eventsSetup) {
      this._setupWebviewEvents(webviewEl);
      webviewEl.dataset.eventsSetup = "true";
    }
    
    // Overlay sınıflarını temizle
    if (overlayEl) {
      overlayEl.classList.remove("hidden", "empty", "disconnected", "connecting", "error");
    }
    
    // Overlay durumunu güncelle
    if (!hasAccount) {
      this._updateOverlay(overlayEl, "empty", "🤖", "Asistan Seçilmedi", "Provider seçip bağlanın");
    } else if (isConnecting) {
      this._updateOverlay(overlayEl, "connecting", "🔄", "Bağlanıyor...", "Lütfen bekleyin");
    } else if (isError) {
      this._updateOverlay(overlayEl, "error", "❌", "Bağlantı Hatası", slotState?.error || "Tekrar deneyin");
    } else if (!isConnected) {
      this._updateOverlay(overlayEl, "disconnected", "⚡", "Asistan Bağlı Değil", "Bağlan butonuna tıklayın");
    } else {
      // CONNECTED - overlay gizle
      if (overlayEl) {
        overlayEl.classList.add("hidden");
      }
      if (webviewEl) {
        webviewEl.removeAttribute("data-detached");
      }
    }
    
    // Buton metnini güncelle
    if (this.connectBtn) {
      if (isConnecting) {
        this.connectBtn.textContent = "Bağlanıyor...";
        this.connectBtn.disabled = true;
      } else if (isConnected) {
        this.connectBtn.textContent = "Bağlantıyı Kes";
        this.connectBtn.disabled = false;
        this.connectBtn.classList.add("btn-danger");
        this.connectBtn.classList.remove("btn-primary");
      } else {
        this.connectBtn.textContent = "Bağlan";
        this.connectBtn.disabled = false;
        this.connectBtn.classList.remove("btn-danger");
        this.connectBtn.classList.add("btn-primary");
      }
    }
    
    // DevTools butonu durumu
    if (this.devtoolsBtn) {
      this.devtoolsBtn.disabled = !isConnected;
    }
    
    // Status dot ve text
    if (this.statusDot) {
      this.statusDot.classList.toggle("connected", isConnected);
    }
    if (this.statusText) {
      this.statusText.textContent = isConnected ? "Bağlı" : (isConnecting ? "Bağlanıyor..." : "Bağlı Değil");
    }
    
    // URL display
    if (this.urlDisplay) {
      if (slotState?.currentUrl) {
        this.urlDisplay.textContent = slotState.currentUrl;
      } else {
        this.urlDisplay.textContent = "-";
      }
    }
  }

  /**
   * Overlay içeriğini güncelle
   */
  _updateOverlay(overlayEl, stateClass, icon, title, subtitle) {
    if (!overlayEl) return;
    
    overlayEl.classList.add(stateClass);
    
    const iconEl = overlayEl.querySelector(".overlay-icon");
    const titleEl = overlayEl.querySelector(".overlay-title");
    const subtitleEl = overlayEl.querySelector(".overlay-subtitle");
    
    if (iconEl) iconEl.textContent = icon;
    if (titleEl) titleEl.textContent = title;
    if (subtitleEl) subtitleEl.textContent = subtitle;
  }

  _updateConnectedAIList() {
    if (!this.connectedList) return;
    
    const badges = [];
    
    // AI1 bağlı mı?
    if (SlotController.isConnected("ai1")) {
      const nickname = AppState.getNickname("ai1");
      badges.push(`<span class="ai-badge ai1">${nickname}</span>`);
    }
    
    // AI2 bağlı mı?
    if (SlotController.isConnected("ai2")) {
      const nickname = AppState.getNickname("ai2");
      badges.push(`<span class="ai-badge ai2">${nickname}</span>`);
    }
    
    if (badges.length === 0) {
      this.connectedList.innerHTML = '<span class="ai-badge inactive">Bağlı AI yok</span>';
    } else {
      this.connectedList.innerHTML = badges.join("");
    }
  }

  _updateRelayControls() {
    const hasConnectedAI = SlotController.isConnected("ai1") || SlotController.isConnected("ai2");
    const isAsistanConnected = SlotController.isConnected("ai0");
    const canRelay = hasConnectedAI && isAsistanConnected;
    
    // Relay butonu
    if (this.relayBtn) {
      this.relayBtn.disabled = !canRelay;
      this.relayBtn.classList.toggle("active", this._isRelayActive);
      this.relayBtn.textContent = this._isRelayActive ? "Relay Durdur" : "AI-Asistan Sohbet";
    }
    
    // Kaynak seçici
    if (this.relaySourceSelect) {
      this.relaySourceSelect.disabled = !canRelay || this._isRelayActive;
      
      // Seçenekleri güncelle
      this.relaySourceSelect.innerHTML = '<option value="">Kaynak Seç</option>';
      
      if (SlotController.isConnected("ai1")) {
        const opt = document.createElement("option");
        opt.value = "ai1";
        opt.textContent = AppState.getNickname("ai1");
        this.relaySourceSelect.appendChild(opt);
      }
      
      if (SlotController.isConnected("ai2")) {
        const opt = document.createElement("option");
        opt.value = "ai2";
        opt.textContent = AppState.getNickname("ai2");
        this.relaySourceSelect.appendChild(opt);
      }
    }
  }

  /**
   * Traffic durumuna göre UI güncellemeleri
   * @param {Object} trafficState - ai0 için traffic durumu
   */
  _updateTrafficUI(trafficState) {
    if (!trafficState?.state?.status) return;
    
    const { loading, thinking, send } = trafficState.state.status;
    const slotState = SlotController.getState("ai0");
    const isConnected = slotState?.state === SlotState.CONNECTED;
    
    // Bağlı değilse traffic UI gösterme
    if (!isConnected) return;
    
    // Status dot ve text güncellemesi
    if (this.statusDot) {
      this.statusDot.classList.remove("loading", "thinking", "send-disabled");
      
      if (loading === "busy") {
        this.statusDot.classList.add("loading");
      } else if (thinking === "busy") {
        this.statusDot.classList.add("thinking");
      } else if (send === "busy") {
        this.statusDot.classList.add("send-disabled");
      }
    }
    
    // Status text güncellemesi
    if (this.statusText) {
      if (loading === "busy") {
        this.statusText.textContent = "Yükleniyor...";
      } else if (thinking === "busy") {
        this.statusText.textContent = "Düşünüyor...";
      } else if (send === "busy") {
        this.statusText.textContent = "Gönderilemiyor";
      } else {
        this.statusText.textContent = "Bağlı";
      }
    }
    
    // Relay butonu thinking durumunda devre dışı
    if (this.relayBtn && this._isRelayActive) {
      // Thinking durumunda relay işlemi devam ediyor demektir
      if (thinking === "busy") {
        this.relayBtn.textContent = "AI Düşünüyor...";
      } else {
        this.relayBtn.textContent = "Relay Durdur";
      }
    }
  }

  _onSettingsChange(_settings) {
    // Settings değiştiğinde UI'ı güncelle
    this._populateProviderSelect();
  }

  /**
   * Webview event listener'larını kur ve provider config inject et
   * @param {HTMLElement} webviewEl - Webview elementi
   */
  _setupWebviewEvents(webviewEl) {
    if (!webviewEl) return;

    // Provider ID'yi al
    const providerId = AppState.getProviderIdForSlot("ai0") || "opencode";

    // did-stop-loading event'inde provider config inject et (sayfa tam yüklendiğinde)
    webviewEl.addEventListener("did-stop-loading", async () => {
      try {
        if (typeof webviewEl.getWebContentsId !== "function") return;
        webviewEl.getWebContentsId();
      } catch (_) {
        return;
      }

      const cfg = ProviderRegistry.get(providerId);
      if (cfg) {
        try {
          const configScript = `
            (function() {
              try {
                window.__hayalet_slot = "ai0";
                window.__hayalet_provider_config = ${JSON.stringify(cfg)};
                return true;
              } catch (e) {
                console.error('[Hayalet-Config-Inject] Failed:', e);
                return false;
              }
            })();
          `;
          await webviewEl.executeJavaScript(configScript);
        } catch (_err) {
          // Config injection başarısız - send() öncesi fallback devreye girecek
        }
      }
    });

    // URL display güncelleme
    webviewEl.addEventListener("did-navigate", () => {
      try {
        const url = webviewEl.getURL?.() || "";
        if (this.urlDisplay) {
          this.urlDisplay.textContent = url || "-";
        }
      } catch (_) {
        // Ignore
      }
    });

  }

  onShow() {
    this._updateConnectionUI();
    this._updateConnectedAIList();
    this._updateRelayControls();
  }

  onHide() {
    // Sayfa gizlendiğinde temizlik
  }

  async destroy() {
    // OpenCode server'ı kapat
    if (this._isServerRunning) {
      await this._stopOpenCodeServer();
    }
    
    // Relay'i durdur
    if (this._isRelayActive) {
      await RelayManager.stopAIAsistanSession();
      this._isRelayActive = false;
    }
    
    // Subscription'ları temizle
    this._unsubSettings?.();
    this._unsubSlot?.();
    this._unsubTraffic?.();
    this._unsubAppState?.();
  }
}
