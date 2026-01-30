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
// ButtonStates kullanılmıyor - direkt buton manipülasyonu yapılıyor
// OPENCODE_DEFAULTS artık workspace-manager'da kullanılıyor
import type { AppSettings } from "../types/settings.js";

// ============================================================================
// Types
// ============================================================================

interface WebviewElement extends HTMLElement {
  src?: string;
  getWebContentsId?: () => number;
  getURL?: () => string;
  openDevTools?: () => void;
  executeJavaScript?: (script: string) => Promise<unknown>;
}

interface SlotStateInfo {
  state?: string;
  accountId?: string | null;
  currentUrl?: string;
  error?: string;
}

interface ServerResult {
  success: boolean;
  url?: string;
  error?: string;
  alreadyRunning?: boolean;
  existingServer?: boolean;
  workspaceId?: string;
}

interface TrafficState {
  state?: {
    status?: {
      loading?: string;
      thinking?: string;
      send?: string;
    };
  };
}

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

  async init(): Promise<void> {
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
    this._unsubSlot = SlotController.subscribe((payload: unknown) => {
      const p = payload as { slot?: string; event?: string };
      if (p.slot === "ai0") {
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
    
    LogManager.addEvent("asistan", "info", "AsistanController initialized", { visibility: 2 });
  }

  _populateProviderSelect(): void {
    if (!this.providerSelect) return;
    
    this.providerSelect.innerHTML = "";
    
    const asistanProviders = ProviderRegistry.getAllAsistan();
    asistanProviders.forEach((provider) => {
      const opt = document.createElement("option");
      opt.value = provider.id;
      opt.textContent = provider.name;
      this.providerSelect?.appendChild(opt);
    });
    
    // Settings'den seçili provider'ı al
    const settings = SettingsManager.getSnapshot() as AppSettings | null;
    const asistanAccounts = settings?.asistanAccounts as { id: string; provider?: string }[] | undefined;
    const asistanSlot = settings?.asistanSlot as { accountId?: string } | undefined;
    const account = asistanAccounts?.find(
      (acc) => acc.id === asistanSlot?.accountId
    );
    if (account?.provider && this.providerSelect.querySelector(`option[value="${account.provider}"]`)) {
      this.providerSelect.value = account.provider;
    }
  }

  _setupEventListeners(): void {
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
    
    // UI Mode Toggle - sadece panel visibility değişir, sunucu Bağlan butonuyla başlar
    const nativeModeBtn = document.getElementById("ui-mode-native");
    const webviewModeBtn = document.getElementById("ui-mode-webview");
    const nativePanel = document.getElementById("asistan-native-panel");
    const webviewPanel = document.getElementById("asistan-webview-panel");
    
    nativeModeBtn?.addEventListener("click", () => {
      // Bağlıyken mod değiştirmeye izin verme
      if (this._isConnected()) {
        LogManager.addEvent("asistan", "warn", "Mod değiştirmek için önce bağlantıyı kesin", { visibility: 1 });
        return;
      }
      
      nativeModeBtn.classList.add("active");
      webviewModeBtn?.classList.remove("active");
      nativePanel?.classList.remove("hidden");
      webviewPanel?.classList.add("hidden");
    });
    
    webviewModeBtn?.addEventListener("click", () => {
      // Bağlıyken mod değiştirmeye izin verme
      if (this._isConnected()) {
        LogManager.addEvent("asistan", "warn", "Mod değiştirmek için önce bağlantıyı kesin", { visibility: 1 });
        return;
      }
      
      webviewModeBtn.classList.add("active");
      nativeModeBtn?.classList.remove("active");
      webviewPanel?.classList.remove("hidden");
      nativePanel?.classList.add("hidden");
    });
  }

  /**
   * Bağlantı durumunu kontrol et
   */
  _isConnected(): boolean {
    const slotState = SlotController.getState("ai0") as SlotStateInfo | null;
    return slotState?.state === SlotState.CONNECTED || 
           this._isServerRunning || 
           this._isSSEServerRunning;
  }

  async _toggleConnection(): Promise<void> {
    const slotState = SlotController.getState("ai0") as SlotStateInfo | null;
    
    if (slotState?.state === SlotState.CONNECTED || this._isServerRunning || this._isSSEServerRunning) {
      // Bağlantıyı kes - direkt buton güncelle (ButtonStates kullanma)
      if (this.connectBtn) {
        this.connectBtn.textContent = "Kesiliyor...";
        this.connectBtn.disabled = true;
        this.connectBtn.classList.remove("btn-danger", "btn-primary");
        this.connectBtn.classList.add("btn-primary");
      }
      
      const nativeModeBtn = document.getElementById("ui-mode-native");
      const isNativeMode = nativeModeBtn?.classList.contains("active");
      
      try {
        if (isNativeMode) {
          // Native modda SSE Server'ı durdur
          if (this._isSSEServerRunning) {
            await this._stopSSEServer();
          }
        } else {
          // Webview modda slot'u disconnect et
          LogManager.addEvent("asistan", "debug", "Webview disconnect başlatılıyor", { 
            slotState: slotState?.state,
            visibility: 3
          });
          
          if (slotState?.state === SlotState.CONNECTED) {
            await SlotController.disconnect("ai0");
          }
        }
        
        // OpenCode server'ı durdur (her iki modda da)
        LogManager.addEvent("asistan", "debug", "OpenCode server durduruluyor", { visibility: 3 });
        await this._stopOpenCodeServer();
        
        // Flag'leri sıfırla
        this._isServerRunning = false;
        
        // Başarılı - kısa süre "Kesildi!" göster
        if (this.connectBtn) {
          this.connectBtn.textContent = "Kesildi!";
          this.connectBtn.disabled = false;
        }
        LogManager.addEvent("asistan", "success", "Asistan bağlantısı kesildi", { 
          mode: isNativeMode ? "native" : "webview",
          visibility: 1 
        });
      } catch (err) {
        const error = err as Error;
        LogManager.addEvent("asistan", "error", "Bağlantı kesme hatası", { 
          error: error.message,
          visibility: 1 
        });
        
        // Hata olsa bile flag'leri sıfırla
        this._isServerRunning = false;
        if (this.connectBtn) {
          this.connectBtn.textContent = "Hata!";
          this.connectBtn.disabled = false;
        }
      }
      
      // UI'ı güncelle (1 saniye sonra normal duruma dön)
      setTimeout(() => this._updateConnectionUI(), 1000);
    } else if (slotState?.state === SlotState.ASSIGNED || slotState?.state === SlotState.EMPTY) {
      // Bağlan - direkt buton güncelle (ButtonStates kullanma)
      if (this.connectBtn) {
        this.connectBtn.textContent = "Başlatılıyor...";
        this.connectBtn.disabled = true;
        this.connectBtn.classList.remove("btn-danger");
        this.connectBtn.classList.add("btn-primary");
      }
      
      const result = await this._startOpenCodeServer();
      if (result.success) {
        const nativeModeBtn = document.getElementById("ui-mode-native");
        const isNativeMode = nativeModeBtn?.classList.contains("active");
        
        if (isNativeMode) {
          // Native mode: SSE Server + Native webview kullan, ai0 slot'a bağlanma
          await this._startSSEServer();
        } else {
          // Webview mode: ai0 slot'a bağlan (OpenCode Web UI)
          await SlotController.connect("ai0", { url: result.url });
        }
        
        // Başarılı - kısa süre "Bağlandı!" göster
        if (this.connectBtn) {
          this.connectBtn.textContent = "Bağlandı!";
          this.connectBtn.disabled = false;
        }
        LogManager.addEvent("asistan", "success", "Asistan bağlantısı başlatıldı", { 
          url: result.url, 
          mode: isNativeMode ? "native" : "webview",
          visibility: 1 
        });
        
        // UI'ı güncelle (1 saniye sonra "Bağlantıyı Kes" moduna geç)
        setTimeout(() => this._updateConnectionUI(), 1000);
      } else {
        // Hata
        if (this.connectBtn) {
          this.connectBtn.textContent = "Hata!";
          this.connectBtn.disabled = false;
        }
        LogManager.addEvent("asistan", "error", "OpenCode server başlatılamadı", { error: result.error, visibility: 1 });
        this._showError(result.error || "Server başlatılamadı");
        
        // UI'ı güncelle (1 saniye sonra normal duruma dön)
        setTimeout(() => this._updateConnectionUI(), 1000);
      }
    }
  }

  /**
   * OpenCode server'ı başlat (workspace-based)
   * WorkspaceManager üzerinden dinamik port ile instance başlatır
   */
  async _startOpenCodeServer(): Promise<ServerResult> {
    try {
      // UI'ı güncelle
      this._updateStatusUI("connecting", "Workspace oluşturuluyor...");
      
      // Default workspace path (hayalet-ev)
      const defaultWorkspacePath = '/home/raistlin/hayalet-ev';
      
      // WorkspaceManager üzerinden workspace oluştur (dinamik port allocation)
      const result = await window.electronAPI?.workspaceCreate?.({
        path: defaultWorkspacePath,
        name: 'hayalet-ev',
      });
      
      if (result?.success && result?.data) {
        const workspace = result.data;
        this._isServerRunning = true;
        
        // Store workspace info for later use
        this._activeWorkspaceId = workspace.id;
        this._activeWorkspacePort = workspace.port ?? null;
        
        const url = `http://127.0.0.1:${workspace.port}`;
        
        LogManager.addEvent("asistan", "info", "Workspace oluşturuldu", { 
          id: workspace.id,
          port: workspace.port,
          url,
          path: workspace.path,
        });
        
        return { 
          success: true, 
          url,
          workspaceId: workspace.id,
        };
      } else {
        this._isServerRunning = false;
        return { success: false, error: result?.error || "Workspace oluşturulamadı" };
      }
    } catch (e) {
      const err = e as Error;
      this._isServerRunning = false;
      LogManager.addEvent("asistan", "error", "Workspace oluşturma hatası", { error: err.message });
      return { success: false, error: err.message };
    }
  }

  /** Active workspace ID */
  private _activeWorkspaceId: string | null = null;
  
  /** Active workspace port */
  private _activeWorkspacePort: number | null = null;

  /**
   * OpenCode server'ı durdur (workspace-based)
   * WorkspaceManager üzerinden workspace'i siler ve process'i durdurur
   */
  async _stopOpenCodeServer(): Promise<ServerResult> {
    try {
      if (this._activeWorkspaceId) {
        const result = await window.electronAPI?.workspaceDelete?.(this._activeWorkspaceId);
        this._isServerRunning = false;
        this._activeWorkspaceId = null;
        this._activeWorkspacePort = null;
        
        if (result?.success) {
          LogManager.addEvent("asistan", "info", "Workspace kapatıldı", { visibility: 2 });
        }
        
        return { success: true };
      } else {
        // Fallback: eski yöntemle durdur
        const result = await window.electronAPI?.opencodeStop?.() as ServerResult | undefined;
        this._isServerRunning = false;
        
        if (result?.success) {
          LogManager.addEvent("asistan", "info", "OpenCode server durduruldu", { visibility: 2 });
        }
        
        return result || { success: false };
      }
    } catch (e) {
      const err = e as Error;
      this._isServerRunning = false;
      this._activeWorkspaceId = null;
      this._activeWorkspacePort = null;
      LogManager.addEvent("asistan", "error", "Workspace kapatma hatası", { error: err.message });
      return { success: false, error: err.message };
    }
  }

  // =========================================================================
  // SSE Server (Native UI için)
  // =========================================================================

  /** @type {boolean} */
  private _isSSEServerRunning = false;

  /**
   * SSE Server'u başlat
   */
  async _startSSEServer(): Promise<void> {
    if (this._isSSEServerRunning) return;
    
    try {
      // Loading overlay göster
      this._showNativeLoadingOverlay(true, "Bağlantı kuruluyor...");
      
      // 1. SSE Server'ı başlat
      const result = await window.electronAPI?.opencodeSSEStart?.();
      if (result?.success) {
        this._isSSEServerRunning = true;
        LogManager.addEvent("asistan", "info", `SSE Server başlatıldı: ${result.url}`, { visibility: 2 });
        
        this._showNativeLoadingOverlay(true, "OpenCode'a bağlanılıyor...");
        
        // 2. OpenCode'a bağlan (SSE bridge)
        const connectResult = await window.electronAPI?.opencodeSSEConnect?.();
        if (connectResult?.success) {
          LogManager.addEvent("asistan", "info", `OpenCode bağlantısı kuruldu: ${connectResult.sessionId}`, { visibility: 2 });
        } else {
          LogManager.addEvent("asistan", "warn", `OpenCode bağlantısı kurulamadı: ${connectResult?.error}`, { visibility: 2 });
        }
        
        this._showNativeLoadingOverlay(true, "UI yükleniyor...");
        
        // 3. Placeholder'ı gizle, webview'ı göster
        const placeholder = document.getElementById("native-panel-placeholder");
        const nativeWebview = document.getElementById("opencode-native-webview") as WebviewElement | null;
        
        if (placeholder) {
          placeholder.classList.add("hidden");
        }
        
        if (nativeWebview) {
          nativeWebview.classList.remove("hidden");
          
          // Preload path'i Electron API'den al ve webview'a ayarla
          try {
            const preloadPath = await window.electronAPI?.getPreloadPath?.("webview");
            if (preloadPath) {
              // preloadPath zaten file:// ile başlıyorsa tekrar ekleme
              const fullPreloadPath = preloadPath.startsWith("file://") ? preloadPath : `file://${preloadPath}`;
              nativeWebview.setAttribute("preload", fullPreloadPath);
              LogManager.addEvent("asistan", "debug", `Native webview preload: ${fullPreloadPath}`, { visibility: 3 });
            }
          } catch (preloadErr) {
            LogManager.addEvent("asistan", "warn", `Preload path alınamadı: ${(preloadErr as Error).message}`, { visibility: 2 });
          }
          
          // Native UI bridge'i kur (Electron API erişimi için)
          this._setupNativeUIBridge(nativeWebview);
          
          // Server URL'ini query param olarak gönder (instance-aware)
          // ÖNEMLI: Workspace port'u kullanılmalı, SSE server port'u (4097) değil!
          // _activeWorkspacePort, _startOpenCodeServer()'da set ediliyor
          if (!this._activeWorkspacePort) {
            LogManager.addEvent("asistan", "warn", "Workspace port not set, using fallback", { visibility: 2 });
          }
          const serverUrl = this._activeWorkspacePort 
            ? `http://127.0.0.1:${this._activeWorkspacePort}` 
            : "http://127.0.0.1:4097";
          const baseOrigin = window.location.origin;
          // Doğrudan index.html yükle (entrance.html yerine)
          // Workspace path default project path'i kullanır
          const workspacePath = '/home/raistlin/hayalet-ev';
          const srcUrl = `${baseOrigin}/pages/asistan-native.html?server=${encodeURIComponent(serverUrl)}&workspace=${encodeURIComponent(workspacePath)}`;
          
          LogManager.addEvent("asistan", "info", `Native UI URL: ${srcUrl}`, { 
            workspacePort: this._activeWorkspacePort,
            visibility: 2 
          });
          
          LogManager.addEvent("asistan", "debug", `Native webview URL: ${srcUrl}`, { 
            visibility: 3,
            workspaceId: this._activeWorkspaceId,
            port: this._activeWorkspacePort,
          });
          
          // Webview yüklenince loading overlay'i kapat
          const onDomReady = () => {
            this._showNativeLoadingOverlay(false);
            nativeWebview.removeEventListener("dom-ready", onDomReady);
            LogManager.addEvent("asistan", "info", "Native UI yüklendi", { visibility: 2 });
          };
          nativeWebview.addEventListener("dom-ready", onDomReady);
          
          // Webview DOM'a eklendikten sonra URL'i set et
          requestAnimationFrame(() => {
            if (nativeWebview.src !== srcUrl) {
              nativeWebview.src = srcUrl;
            }
          });
        }
      } else {
        // Hata durumunda overlay'i kapat
        this._showNativeLoadingOverlay(false);
        LogManager.addEvent("asistan", "error", `SSE Server başlatılamadı: ${result?.error}`, { visibility: 1 });
      }
    } catch (e) {
      const err = e as Error;
      LogManager.addEvent("asistan", "error", `SSE Server hatası: ${err.message}`, { visibility: 1 });
    }
  }

  /**
   * SSE Server'u durdur
   */
  async _stopSSEServer(): Promise<void> {
    if (!this._isSSEServerRunning) return;
    
    try {
      // Önce OpenCode bağlantısını kes
      await window.electronAPI?.opencodeSSEDisconnect?.();
      
      // Sonra SSE Server'ı durdur
      await window.electronAPI?.opencodeSSEStop?.();
      this._isSSEServerRunning = false;
      LogManager.addEvent("asistan", "info", "SSE Server durduruldu", { visibility: 2 });
      
      // Webview'ı gizle, placeholder'ı göster
      const placeholder = document.getElementById("native-panel-placeholder");
      const nativeWebview = document.getElementById("opencode-native-webview") as WebviewElement | null;
      
      if (nativeWebview) {
        nativeWebview.classList.add("hidden");
        nativeWebview.src = "about:blank";
      }
      
      if (placeholder) {
        placeholder.classList.remove("hidden");
      }
      
      // Native bridge flag'ini reset et - sonraki bağlantıda yeniden kurulması için
      this._nativeBridgeSetup = false;
    } catch (e) {
      const err = e as Error;
      LogManager.addEvent("asistan", "error", `SSE Server durdurma hatası: ${err.message}`);
    }
  }

  /**
   * Hata mesajı göster
   */
  _showError(message: string): void {
    const overlayEl = document.getElementById("ai0-webview-overlay");
    this._updateOverlay(overlayEl, "error", "❌", "Bağlantı Hatası", message);
  }

  /**
   * Status UI'ını güncelle (loading durumları için)
   */
  _updateStatusUI(state: string, message: string): void {
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

  /**
   * Native panel loading overlay'ini göster/gizle
   */
  _showNativeLoadingOverlay(show: boolean, message?: string): void {
    const placeholder = document.getElementById("native-panel-placeholder");
    if (!placeholder) return;
    
    if (show) {
      // Placeholder'a loading state ekle
      placeholder.classList.remove("hidden");
      placeholder.innerHTML = `
        <div class="loading-overlay-content">
          <div class="loading-spinner"></div>
          <h3>${message || "Yükleniyor..."}</h3>
        </div>
      `;
    } else {
      // Loading tamamlandı, placeholder'i gizle
      placeholder.classList.add("hidden");
    }
  }

  async _onProviderChange(): Promise<void> {
    const providerId = this.providerSelect?.value;
    if (!providerId) return;
    
    const provider = ProviderRegistry.getAsistan(providerId as "opencode");
    if (!provider) return;
    
    // Provider değişikliğini settings'e kaydet
    const settings = SettingsManager.getSnapshot() as AppSettings | null;
    const asistanAccounts = settings?.asistanAccounts as { id: string; provider?: string }[] | undefined;
    const account = asistanAccounts?.find((acc) => acc.provider === providerId);
    
    if (account && settings) {
      const asistanSlot = settings.asistanSlot as { accountId?: string } | undefined;
      await SettingsManager.save({
        ...settings,
        asistanSlot: {
          ...asistanSlot,
          accountId: account.id,
        },
      } as unknown as Record<string, unknown>);
    }
    
    // Başlığı güncelle
    if (this.titleEl) {
      this.titleEl.textContent = provider.name;
    }
    
    LogManager.addEvent("asistan", "info", `Provider değiştirildi: ${provider.name}`);
  }

  _openDevTools(): void {
    // Mode'a göre doğru webview'i seç
    const nativeModeBtn = document.getElementById("ui-mode-native");
    const isNativeMode = nativeModeBtn?.classList.contains("active");
    
    const webviewId = isNativeMode ? "opencode-native-webview" : "ai0-webview";
    const webview = document.getElementById(webviewId) as WebviewElement | null;
    
    if (webview && typeof webview.openDevTools === "function") {
      webview.openDevTools();
      LogManager.addEvent("asistan", "info", `DevTools açıldı: ${webviewId}`, { visibility: 2 });
    } else {
      LogManager.addEvent("asistan", "warn", `Webview bulunamadı: ${webviewId}`, { visibility: 1 });
    }
  }

  async _toggleRelay(): Promise<void> {
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
      LogManager.addEvent("asistan", "info", `AI-Asistan relay başlatıldı: ${sourceSlot} ↔ ai0`, { visibility: 2 });
    }
    
    this._updateRelayControls();
  }

  async _onRelaySourceChange(): Promise<void> {
    // Kaynak değiştiğinde ve relay aktifse, relay'i yeniden başlat
    if (this._isRelayActive) {
      await this._toggleRelay(); // Önce durdur
      await this._toggleRelay(); // Sonra yeni kaynakla başlat
    }
  }

  _updateConnectionUI(): void {
    const slotState = SlotController.getState("ai0") as SlotStateInfo | null;
    const nativeModeBtn = document.getElementById("ui-mode-native");
    const isNativeMode = nativeModeBtn?.classList.contains("active");
    
    // Native modda SSE server durumu, webview modda slot durumu
    const isConnected = isNativeMode 
      ? this._isSSEServerRunning 
      : slotState?.state === SlotState.CONNECTED;
    const isConnecting = slotState?.state === SlotState.CONNECTING;
    const isError = slotState?.state === SlotState.ERROR;
    const hasAccount = !!slotState?.accountId;
    
    // Webview ve overlay elementleri (sadece webview modda kullanılır)
    const webviewEl = document.getElementById("ai0-webview");
    const mountEl = document.getElementById("ai0-webview-mount");
    const overlayEl = document.getElementById("ai0-webview-overlay");
    
    // Webview modda webview mount edilir
    if (!isNativeMode && webviewEl && mountEl && !mountEl.contains(webviewEl)) {
      mountEl.appendChild(webviewEl);
      webviewEl.style.cssText = "position: relative; top: 0; left: 0; width: 100%; height: 100%;";
    }
    
    // Webview event setup (bir kez)
    if (webviewEl && !webviewEl.dataset.eventsSetup) {
      this._setupWebviewEvents(webviewEl);
      webviewEl.dataset.eventsSetup = "true";
    }
    
    // Webview modda overlay sınıflarını temizle
    if (!isNativeMode && overlayEl) {
      overlayEl.classList.remove("hidden", "empty", "disconnected", "connecting", "error");
      
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
        overlayEl.classList.add("hidden");
        if (webviewEl) {
          webviewEl.removeAttribute("data-detached");
        }
      }
    }
    
    // Buton metnini güncelle
    if (this.connectBtn) {
      const isDisconnectMode = isConnected || this._isServerRunning;
      
      // Inline style'ları temizle (ButtonStates'ten kalan olabilir)
      this.connectBtn.style.opacity = "";
      this.connectBtn.style.transform = "";
      this.connectBtn.style.transition = "";
      
      if (isConnecting) {
        this.connectBtn.textContent = "Bağlanıyor...";
        this.connectBtn.disabled = true;
        this.connectBtn.classList.remove("btn-danger", "btn-primary");
        this.connectBtn.classList.add("btn-primary");
      } else if (isDisconnectMode) {
        this.connectBtn.textContent = "Bağlantıyı Kes";
        this.connectBtn.disabled = false;
        this.connectBtn.classList.remove("btn-primary");
        this.connectBtn.classList.add("btn-danger");
      } else {
        this.connectBtn.textContent = "Bağlan";
        this.connectBtn.disabled = false;
        this.connectBtn.classList.remove("btn-danger");
        this.connectBtn.classList.add("btn-primary");
      }
    }
    
    // DevTools butonu durumu
    if (this.devtoolsBtn) {
      this.devtoolsBtn.disabled = !isConnected && !this._isSSEServerRunning;
    }
    
    // Status dot ve text
    if (this.statusDot) {
      this.statusDot.classList.toggle("connected", isConnected);
    }
    if (this.statusText) {
      if (isNativeMode) {
        this.statusText.textContent = this._isSSEServerRunning ? "Native UI Bağlı" : "Bağlı Değil";
      } else {
        this.statusText.textContent = isConnected ? "Bağlı" : (isConnecting ? "Bağlanıyor..." : "Bağlı Değil");
      }
    }
    
    // URL display
    if (this.urlDisplay) {
      if (isNativeMode && this._isSSEServerRunning) {
        this.urlDisplay.textContent = "Native UI (SSE: http://127.0.0.1:4097)";
      } else if (slotState?.currentUrl) {
        this.urlDisplay.textContent = slotState.currentUrl;
      } else {
        this.urlDisplay.textContent = "-";
      }
    }
    
    // UI Mode butonlarını bağlıyken disable et
    const nativeBtn = document.getElementById("ui-mode-native") as HTMLButtonElement | null;
    const webviewBtn = document.getElementById("ui-mode-webview") as HTMLButtonElement | null;
    const isBusy = isConnected || this._isServerRunning || this._isSSEServerRunning;
    
    if (nativeBtn) {
      nativeBtn.disabled = isBusy;
      nativeBtn.classList.toggle("disabled", isBusy);
    }
    if (webviewBtn) {
      webviewBtn.disabled = isBusy;
      webviewBtn.classList.toggle("disabled", isBusy);
    }
  }

  /**
   * Overlay içeriğini güncelle
   */
  _updateOverlay(overlayEl: HTMLElement | null, stateClass: string, icon: string, title: string, subtitle: string): void {
    if (!overlayEl) return;
    
    overlayEl.classList.add(stateClass);
    
    const iconEl = overlayEl.querySelector(".overlay-icon");
    const titleEl = overlayEl.querySelector(".overlay-title");
    const subtitleEl = overlayEl.querySelector(".overlay-subtitle");
    
    if (iconEl) iconEl.textContent = icon;
    if (titleEl) titleEl.textContent = title;
    if (subtitleEl) subtitleEl.textContent = subtitle;
  }

  _updateConnectedAIList(): void {
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

  _updateRelayControls(): void {
    const hasConnectedAI = SlotController.isConnected("ai1") || SlotController.isConnected("ai2");
    const isAsistanConnected = SlotController.isConnected("ai0");
    const canRelay = hasConnectedAI && isAsistanConnected;
    
    // Relay butonu
    if (this.relayBtn) {
      this.relayBtn.disabled = !canRelay;
      this.relayBtn.classList.toggle("active", this._isRelayActive);
      this.relayBtn.textContent = this._isRelayActive ? "Relay Durdur" : "AI-Asistan Sohbeti";
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
   */
  _updateTrafficUI(trafficState: TrafficState | unknown): void {
    const state = trafficState as TrafficState;
    if (!state?.state?.status) return;
    
    const { loading, thinking, send } = state.state.status;
    const slotState = SlotController.getState("ai0") as SlotStateInfo | null;
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

  _onSettingsChange(_settings: unknown): void {
    // Settings değiştiğinde UI'ı güncelle
    this._populateProviderSelect();
  }

  /**
   * Webview event listener'larını kur ve provider config inject et
   */
  _setupWebviewEvents(webviewEl: WebviewElement): void {
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

      const cfg = ProviderRegistry.get(providerId as "opencode" | "chatgpt" | "grok" | "gemini");
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
          await webviewEl.executeJavaScript?.(configScript);
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

  /**
   * Native UI webview için Electron API bridge kurulumu
   * executeJavaScript ile API fonksiyonlarını inject eder ve console.log ile iletişim kurar
   */
  _nativeBridgeSetup = false; // Flag to prevent duplicate setup

  _setupNativeUIBridge(webviewEl: WebviewElement): void {
    if (!webviewEl) return;
    
    // Prevent duplicate setup
    if (this._nativeBridgeSetup) {
      LogManager.addEvent("asistan", "debug", "Native UI bridge already setup, skipping", { visibility: 3 });
      return;
    }
    this._nativeBridgeSetup = true;

    // did-finish-load event'inde API bridge'i inject et
    webviewEl.addEventListener("did-finish-load", async () => {
      LogManager.addEvent("asistan", "debug", "Native webview loaded, injecting API bridge", { visibility: 3 });
      
      // Inject API bridge script
      const bridgeScript = `
        (function() {
          if (window.__nativeUIBridgeReady) return;
          window.__nativeUIBridgeReady = true;
          
          // Request ID counter
          let requestId = 0;
          const pendingRequests = new Map();
          
          // Listen for responses
          window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'electron-api-response') {
              const { requestId: respId, result, error } = event.data;
              const pending = pendingRequests.get(respId);
              if (pending) {
                pendingRequests.delete(respId);
                if (error) {
                  pending.reject(new Error(error));
                } else {
                  pending.resolve(result);
                }
              }
            }
          });
          
          // Create API proxy
          window.__nativeUIRequest = function(method, ...args) {
            return new Promise((resolve, reject) => {
              const id = ++requestId;
              pendingRequests.set(id, { resolve, reject });
              
              // Timeout after 15 seconds
              setTimeout(() => {
                if (pendingRequests.has(id)) {
                  pendingRequests.delete(id);
                  reject(new Error('Request timeout: ' + method));
                }
              }, 15000);
              
              // Signal to host via console (will be intercepted)
              console.log('__NATIVE_UI_REQUEST__:' + JSON.stringify({ requestId: id, method, args }));
            });
          };
          
          // Expose electronAPI-like interface
          window.electronAPI = {
            loadOpencodeConfig: () => window.__nativeUIRequest('loadOpencodeConfig'),
            saveOpencodeConfig: (config) => window.__nativeUIRequest('saveOpencodeConfig', config),
            opcAddRecentFolder: (path, name) => window.__nativeUIRequest('opcAddRecentFolder', path, name),
            opcRemoveRecentFolder: (path) => window.__nativeUIRequest('opcRemoveRecentFolder', path),
            opcUpdatePreferences: (updates) => window.__nativeUIRequest('opcUpdatePreferences', updates),
            showOpenDialog: (options) => window.__nativeUIRequest('showOpenDialog', options),
            openTerminal: (path) => window.__nativeUIRequest('openTerminal', path),
            shellOpenPath: (path) => window.__nativeUIRequest('shellOpenPath', path),
            selectFolder: (options) => window.__nativeUIRequest('selectFolder', options),
            // Agent & Model Lists
            opcListModels: () => window.__nativeUIRequest('opcListModels'),
            opcListAgents: () => window.__nativeUIRequest('opcListAgents'),
            // Agent/Model Preference Persistence
            opcGetAgentModelPreference: (folderPath) => window.__nativeUIRequest('opcGetAgentModelPreference', folderPath),
            opcSaveAgentModelPreference: (preference, folderPath) => window.__nativeUIRequest('opcSaveAgentModelPreference', preference, folderPath),
            opcSaveAgentPreference: (agent, folderPath) => window.__nativeUIRequest('opcSaveAgentPreference', agent, folderPath),
            opcSaveModelPreference: (providerId, modelId, folderPath) => window.__nativeUIRequest('opcSaveModelPreference', providerId, modelId, folderPath),
            // Active Projects Management
            opcGetActiveProjects: () => window.__nativeUIRequest('opcGetActiveProjects'),
            opcAddActiveProject: (projectPath) => window.__nativeUIRequest('opcAddActiveProject', projectPath),
            opcRemoveActiveProject: (projectPath) => window.__nativeUIRequest('opcRemoveActiveProject', projectPath),
            // Workspace Management (Backend IPC)
            workspaceCreate: (options) => window.__nativeUIRequest('workspaceCreate', options),
            workspaceDelete: (workspaceId) => window.__nativeUIRequest('workspaceDelete', workspaceId),
            workspaceList: () => window.__nativeUIRequest('workspaceList'),
            workspaceGetAuth: (workspaceId) => window.__nativeUIRequest('workspaceGetAuth', workspaceId),
          };
          
          console.log('[NativeUI] API bridge injected');
        })();
      `;
      
      try {
        await webviewEl.executeJavaScript?.(bridgeScript);
        LogManager.addEvent("asistan", "info", "Native UI API bridge injected", { visibility: 2 });
      } catch (err) {
        LogManager.addEvent("asistan", "error", `Failed to inject API bridge: ${(err as Error).message}`, { visibility: 2 });
      }
    });

    // console-message event'ini dinle (webview'dan gelen API istekleri)
    webviewEl.addEventListener("console-message", async (event: Event) => {
      const consoleEvent = event as Event & { message: string; level: number };
      const { message } = consoleEvent;
      
      // Check if this is an API request
      if (!message?.startsWith('__NATIVE_UI_REQUEST__:')) return;
      
      try {
        const jsonStr = message.substring('__NATIVE_UI_REQUEST__:'.length);
        const { requestId, method, args } = JSON.parse(jsonStr) as { requestId: number; method: string; args: unknown[] };
        
        LogManager.addEvent("asistan", "debug", `Native UI API request: ${method}`, { requestId, visibility: 3 });
        
        let result: unknown;
        
        // Map method names to Electron API calls
        switch (method) {
          case "loadOpencodeConfig":
            result = await window.electronAPI?.loadOpencodeConfig?.();
            break;
          case "saveOpencodeConfig":
            result = await window.electronAPI?.saveOpencodeConfig?.(args[0] as Parameters<NonNullable<typeof window.electronAPI.saveOpencodeConfig>>[0]);
            break;
          case "opcAddRecentFolder":
            result = await window.electronAPI?.opcAddRecentFolder?.(args[0] as string, args[1] as string | undefined);
            break;
          case "opcRemoveRecentFolder":
            result = await window.electronAPI?.opcRemoveRecentFolder?.(args[0] as string);
            break;
          case "opcUpdatePreferences":
            result = await window.electronAPI?.opcUpdatePreferences?.(args[0] as Parameters<NonNullable<typeof window.electronAPI.opcUpdatePreferences>>[0]);
            break;
          case "showOpenDialog":
            result = await window.electronAPI?.showOpenDialog?.(args[0] as Parameters<NonNullable<typeof window.electronAPI.showOpenDialog>>[0]);
            break;
          case "openTerminal":
            result = await window.electronAPI?.openTerminal?.(args[0] as string);
            break;
          case "shellOpenPath":
            result = await window.electronAPI?.shellOpenPath?.(args[0] as string);
            break;
          case "opcListModels":
            result = await window.electronAPI?.opcListModels?.();
            break;
          case "opcListAgents":
            result = await window.electronAPI?.opcListAgents?.();
            break;
          // Agent/Model Preference Persistence
          case "opcGetAgentModelPreference":
            result = await window.electronAPI?.opcGetAgentModelPreference?.(args[0] as string | undefined);
            break;
          case "opcSaveAgentModelPreference":
            result = await window.electronAPI?.opcSaveAgentModelPreference?.(args[0] as Record<string, unknown>, args[1] as string | undefined);
            break;
          case "opcSaveAgentPreference":
            result = await window.electronAPI?.opcSaveAgentPreference?.(args[0] as string, args[1] as string | undefined);
            break;
          case "opcSaveModelPreference":
            result = await window.electronAPI?.opcSaveModelPreference?.(args[0] as string, args[1] as string, args[2] as string | undefined);
            break;
          // Active Projects Management
          case "opcGetActiveProjects":
            result = await window.electronAPI?.opcGetActiveProjects?.();
            break;
          case "opcAddActiveProject":
            result = await window.electronAPI?.opcAddActiveProject?.(args[0] as string);
            break;
          case "opcRemoveActiveProject":
            result = await window.electronAPI?.opcRemoveActiveProject?.(args[0] as string);
            break;
          // Workspace Management (Backend IPC)
          case "workspaceCreate": {
            // InstanceStore folder kullanıyor, backend path bekliyor
            const opts = args[0] as { folder?: string; path?: string; name?: string };
            result = await window.electronAPI?.workspaceCreate?.({ 
              path: opts.path || opts.folder || '', 
              name: opts.name 
            });
            break;
          }
          case "workspaceDelete":
            result = await window.electronAPI?.workspaceDelete?.(args[0] as string);
            break;
          case "workspaceList":
            result = await window.electronAPI?.workspaceList?.();
            break;
          case "workspaceGetAuth":
            result = await window.electronAPI?.workspaceGetAuth?.(args[0] as string);
            break;
          case "selectFolder":
            result = await window.electronAPI?.showOpenDialog?.({ properties: ['openDirectory'] });
            break;
          default:
            throw new Error(`Unknown API method: ${method}`);
        }
        
        // Send response back to webview
        const responseScript = `
          window.postMessage({
            type: 'electron-api-response',
            requestId: ${requestId},
            result: ${JSON.stringify(result)}
          }, '*');
        `;
        await webviewEl.executeJavaScript?.(responseScript);
        
      } catch (err) {
        const error = err as Error;
        LogManager.addEvent("asistan", "error", `Native UI API error: ${error.message}`, { visibility: 2 });
        
        // Try to extract requestId and send error response
        try {
          const jsonStr = message.substring('__NATIVE_UI_REQUEST__:'.length);
          const { requestId } = JSON.parse(jsonStr) as { requestId: number };
          const errorScript = `
            window.postMessage({
              type: 'electron-api-response',
              requestId: ${requestId},
              error: ${JSON.stringify(error.message)}
            }, '*');
          `;
          await webviewEl.executeJavaScript?.(errorScript);
        } catch (_) {
          // Ignore
        }
      }
    });
    
    LogManager.addEvent("asistan", "debug", "Native UI bridge listeners setup", { visibility: 3 });
  }

  onShow(): void {
    this._updateConnectionUI();
    this._updateConnectedAIList();
    this._updateRelayControls();
    // SSE Server sayfa girişinde başlatılmaz, bağlan butonu ile aktifleşir
  }

  onHide(): void {
    // Sayfa gizlendiğinde temizlik
  }

  async destroy(): Promise<void> {
    // OpenCode server'ı kapat
    if (this._isServerRunning) {
      await this._stopOpenCodeServer();
    }
    
    // SSE Server'ı kapat
    if (this._isSSEServerRunning) {
      await this._stopSSEServer();
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
    
    // Native bridge flag'ini reset et
    this._nativeBridgeSetup = false;
  }
}
