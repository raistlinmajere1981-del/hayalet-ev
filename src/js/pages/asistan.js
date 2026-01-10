/**
 * Asistan Page Controller
 * OpenCode web arayüzü bağlantı sayfası
 */

import { AssistantManager } from "../modules/asistan-manager.js";
import { AppState } from "../modules/app-state.js";
// FIX: Import SlotEvent for proper state change subscription
import { SlotController, SlotEvent } from "../modules/slot-controller.js";

export class AsistanPage {
  constructor() {
    this.assistantManager = null;
    this.elements = {};
    
    // State flags
    this._isLoading = false;
    this._isProcessing = false;
  }

  async init() {
    console.log("[AsistanPage] Initializing...");
    
    // DOM elementlerini yakala
    this.cacheElements();
    
    // AssistantManager referansı
    this.assistantManager = AssistantManager;
    
    // Event listener'ları bağla
    this.bindEvents();
    
    // Connected AI'leri yükle (relay dropdown için)
    this.loadConnectedAIs();

    // Zaten bağlı mı kontrol et
    if (this.assistantManager.isConnected) {
      this.onAssistantConnected();
    }
    
    console.log("[AsistanPage] Initialized");
  }

  cacheElements() {
    this.elements = {
      // Provider seçimi
      providerSelect: document.getElementById("asistan-provider"),
      
      // Bağlantı kontrolleri
      connectBtn: document.getElementById("asistan-connect-btn"),
      disconnectBtn: document.getElementById("asistan-disconnect-btn"),
      devtoolsBtn: document.getElementById("asistan-devtools-btn"),
      statusDot: document.getElementById("asistan-status-dot"),
      statusText: document.getElementById("asistan-status-text"),
      
      // Display alanları
      displayEmpty: document.getElementById("display-empty"),
      webviewContainer: document.getElementById("webview-container"),
      assistantWebview: document.getElementById("asistan-webview"),
      
      // Relay kontrolleri
      relayControlsInline: document.getElementById("relay-controls-inline"),
      relayAiSelect: document.getElementById("relay-ai-select"),
      relayStartBtn: document.getElementById("relay-start-btn"),
      relayStopBtn: document.getElementById("relay-stop-btn"),
      relayStatusIndicator: document.getElementById("relay-status-indicator"),
      relayStatusText: document.getElementById("relay-status-text"),

      // Test Panel
      testPanel: document.getElementById("test-panel"),
      testMessageInput: document.getElementById("test-message-input"),
      testSendBtn: document.getElementById("test-send-btn"),
      testOutput: document.getElementById("test-output"),
      testPanelClear: document.getElementById("test-panel-clear"),
      testDebugStatus: document.getElementById("test-debug-status"),
      testDebugCount: document.getElementById("test-debug-count"),

      // Loading ve Processing göstergeleri
      loadingOverlay: document.getElementById("asistan-loading-overlay"),
      loadingText: document.querySelector("#asistan-loading-overlay .loading-text"),
      processingIndicator: document.getElementById("asistan-processing"),
      processingText: document.querySelector("#asistan-processing .processing-text"),
    };

    // Test panel state
    this._testCharCount = 0;
  }

  bindEvents() {
    // Provider değiştiğinde
    this.elements.providerSelect.addEventListener("change", () => {
      this.onProviderChange();
    });

    // Bağlan butonu
    this.elements.connectBtn.addEventListener("click", () => {
      this.onConnect();
    });

    // Bağlantıyı kes butonu
    this.elements.disconnectBtn.addEventListener("click", () => {
      this.onDisconnect();
    });

    // DevTools butonu
    this.elements.devtoolsBtn.addEventListener("click", () => {
      this.onOpenDevTools();
    });

    // Relay başlat
    this.elements.relayStartBtn.addEventListener("click", () => {
      this.onRelayStart();
    });

    // Relay durdur
    this.elements.relayStopBtn.addEventListener("click", () => {
      this.onRelayStop();
    });

    // AI selection değiştiğinde relay başlat butonunu etkinleştir
    this.elements.relayAiSelect.addEventListener("change", () => {
      const hasSelection = this.elements.relayAiSelect.value !== "";
      this.elements.relayStartBtn.disabled = !hasSelection;
    });

    // AssistantManager event'lerini dinle
    this.assistantManager.on("connected", () => this.onAssistantConnected());
    this.assistantManager.on("disconnected", () => this.onAssistantDisconnected());
    this.assistantManager.on("relay-started", () => this.onRelayActivated());
    this.assistantManager.on("relay-stopped", () => this.onRelayDeactivated());

    // FIX: SlotController state değişikliklerini dinle (bağlantı durumu için)
    // AI slot'ları bağlanıp koptuğunda relay dropdown'u güncelle
    if (!this._unsubSlotController) {
      this._unsubSlotController = SlotController.on(SlotEvent.STATE_CHANGED, () => {
        this.loadConnectedAIs();
      });
    }

    // Test Panel Event'leri
    this.elements.testSendBtn?.addEventListener("click", () => this.onTestSend());
    
    this.elements.testMessageInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.onTestSend();
      }
    });

    this.elements.testPanelClear?.addEventListener("click", () => this.onTestClear());
  }

  onProviderChange() {
    const provider = this.elements.providerSelect.value;
    this.elements.connectBtn.disabled = !provider;
  }

  async onConnect() {
    const provider = this.elements.providerSelect.value;
    if (!provider) return;

    try {
      this.elements.connectBtn.disabled = true;
      this.elements.providerSelect.disabled = true;

      // Loading state başlat
      this.showLoading("OpenCode başlatılıyor...");

      // Bağlan
      const result = await this.assistantManager.connect(provider);
      
      if (result.success && result.url) {
        // Webview'i initialize et
        this.showLoading("Web arayüzü yükleniyor...");
        await this.assistantManager.initWebview(this.elements.assistantWebview);
      }

      this.hideLoading();
      
    } catch (error) {
      console.error("[AsistanPage] Connection failed:", error);
      alert(`Bağlantı hatası: ${error.message}`);
      
      this.hideLoading();
      this.elements.connectBtn.disabled = false;
      this.elements.providerSelect.disabled = false;
    }
  }

  async onDisconnect() {
    try {
      await this.assistantManager.disconnect();
    } catch (error) {
      console.error("[AsistanPage] Disconnect failed:", error);
    }
  }

  onOpenDevTools() {
    if (this.elements.assistantWebview) {
      this.elements.assistantWebview.openDevTools();
    }
  }

  onAssistantConnected() {
    // UI güncellemeleri
    this.elements.connectBtn.style.display = "none";
    this.elements.disconnectBtn.style.display = "inline-block";
    this.elements.disconnectBtn.disabled = false;
    this.elements.devtoolsBtn.style.display = "inline-block";
    this.elements.devtoolsBtn.disabled = false;
    
    this.elements.statusDot.classList.add("connected");
    this.elements.statusText.textContent = "Bağlı";

    // Webview'i göster
    this.elements.displayEmpty.style.display = "none";
    this.elements.webviewContainer.classList.add("active");
    this.elements.webviewContainer.style.display = "block";

    // Relay controls'u aktif et
    this.elements.relayControlsInline.style.opacity = "1";
    this.elements.relayControlsInline.style.pointerEvents = "auto";

    // Test Panel'i göster
    if (this.elements.testPanel) {
      this.elements.testPanel.style.display = "block";
      this.elements.testSendBtn.disabled = false;
      this.elements.testMessageInput.disabled = false;
      this.updateTestDebugStatus("Bağlı - Mesaj gönderebilirsiniz");
    }

    this.hideLoading();
  }

  onAssistantDisconnected() {
    // UI güncellemeleri
    this.elements.connectBtn.style.display = "inline-block";
    this.elements.disconnectBtn.style.display = "none";
    this.elements.devtoolsBtn.style.display = "none";
    this.elements.connectBtn.disabled = false;
    
    this.elements.providerSelect.disabled = false;

    this.elements.statusDot.classList.remove("connected");
    this.elements.statusText.textContent = "Bağlı Değil";

    // Display alanını gizle
    this.elements.displayEmpty.style.display = "flex";
    this.elements.webviewContainer.classList.remove("active");
    this.elements.webviewContainer.style.display = "none";

    // Relay controls'u deaktif et
    this.elements.relayControlsInline.style.opacity = "0.3";
    this.elements.relayControlsInline.style.pointerEvents = "none";
    
    // Relay durumunu sıfırla
    if (this.assistantManager.isRelayActive) {
      this.assistantManager.stopRelay();
    }

    // Loading/Processing state'lerini sıfırla
    this.hideLoading();
    this.hideProcessing();

    // Test Panel'i temizle ve gizle
    if (this.elements.testPanel) {
      this.elements.testPanel.style.display = "none";
      this.elements.testSendBtn.disabled = true;
      this.elements.testMessageInput.disabled = true;
      
      if (this.elements.testOutput) {
        this.elements.testOutput.value = "";
      }
      this._testCharCount = 0;
      this.updateTestDebugCount();
      this.updateTestDebugStatus("Bağlı değil");
    }
  }

  // ==========================================
  // LOADING & PROCESSING STATE
  // ==========================================

  showLoading(text = "Yükleniyor...") {
    this._isLoading = true;
    if (this.elements.loadingOverlay) {
      this.elements.loadingOverlay.style.display = "flex";
    }
    if (this.elements.loadingText) {
      this.elements.loadingText.textContent = text;
    }
  }

  hideLoading() {
    this._isLoading = false;
    if (this.elements.loadingOverlay) {
      this.elements.loadingOverlay.style.display = "none";
    }
  }

  showProcessing(text = "Cevap bekleniyor...") {
    this._isProcessing = true;
    if (this.elements.processingIndicator) {
      this.elements.processingIndicator.style.display = "flex";
    }
    if (this.elements.processingText) {
      this.elements.processingText.textContent = text;
    }
  }

  hideProcessing() {
    this._isProcessing = false;
    if (this.elements.processingIndicator) {
      this.elements.processingIndicator.style.display = "none";
    }
  }

  // ==========================================
  // RELAY METHODS
  // ==========================================

  async onRelayStart() {
    const aiSlot = this.elements.relayAiSelect.value;
    if (!aiSlot) return;

    try {
      this.elements.relayStartBtn.disabled = true;
      await this.assistantManager.startRelay(aiSlot);
    } catch (error) {
      console.error("[AsistanPage] Relay start failed:", error);
      alert(`Relay başlatma hatası: ${error.message}`);
      this.elements.relayStartBtn.disabled = false;
    }
  }

  async onRelayStop() {
    try {
      await this.assistantManager.stopRelay();
    } catch (error) {
      console.error("[AsistanPage] Relay stop failed:", error);
    }
  }

  onRelayActivated() {
    this.elements.relayStartBtn.style.display = "none";
    this.elements.relayStopBtn.style.display = "inline-block";
    this.elements.relayStopBtn.disabled = false;
    
    this.elements.relayAiSelect.disabled = true;
    
    this.elements.relayStatusIndicator.classList.add("active");
    this.elements.relayStatusText.textContent = "Relay Aktif";
  }

  onRelayDeactivated() {
    this.elements.relayStartBtn.style.display = "inline-block";
    this.elements.relayStopBtn.style.display = "none";
    this.elements.relayStartBtn.disabled = !this.elements.relayAiSelect.value;
    
    this.elements.relayAiSelect.disabled = false;
    
    this.elements.relayStatusIndicator.classList.remove("active");
    this.elements.relayStatusText.textContent = "Relay İnaktif";
  }

  loadConnectedAIs() {
    const select = this.elements.relayAiSelect;
    select.innerHTML = '<option value="">Seçiniz</option>';
    
    ["ai1", "ai2"].forEach(slot => {
      const connected = SlotController.isConnected(slot);
      const nickname = AppState.getNickname ? AppState.getNickname(slot) : slot.toUpperCase();
      
      if (connected) {
        const option = document.createElement("option");
        option.value = slot;
        option.textContent = `${nickname} (${slot.toUpperCase()})`;
        select.appendChild(option);
      }
    });
  }

  // ==========================================
  // TEST PANEL METHODS
  // ==========================================

  async onTestSend() {
    const message = this.elements.testMessageInput?.value?.trim();
    if (!message) return;

    if (!this.assistantManager?.isConnected) {
      this.updateTestDebugStatus("Hata: Asistan bağlı değil");
      return;
    }

    try {
      this.updateTestDebugStatus("Mesaj gönderiliyor...");
      this.elements.testSendBtn.disabled = true;

      // Output alanını temizle
      if (this.elements.testOutput) {
        this.elements.testOutput.value = "";
      }
      this._testCharCount = 0;
      this.updateTestDebugCount();

      // Processing state başlat
      this.showProcessing("Cevap bekleniyor...");

      // Input'u temizle
      this.elements.testMessageInput.value = "";

      // Query gönder (mesaj gönder + cevap bekle)
      const result = await this.assistantManager.query(message, {
        timeout: 120000 // 2 dakika
      });

      // Cevabı göster
      if (result.success) {
        this.elements.testOutput.value = result.response;
        this._testCharCount = result.response.length;
        this.updateTestDebugCount();
        this.updateTestDebugStatus("Cevap alındı ✓");
      } else {
        this.elements.testOutput.value = `HATA: ${result.error}`;
        this.updateTestDebugStatus(`Hata: ${result.error}`);
      }

    } catch (error) {
      console.error("[AsistanPage] Test send failed:", error);
      this.updateTestDebugStatus(`Hata: ${error.message}`);
      this.elements.testOutput.value = `HATA: ${error.message}`;
    } finally {
      this.hideProcessing();
      this.elements.testSendBtn.disabled = false;
      this.elements.testMessageInput?.focus();
    }
  }

  onTestClear() {
    if (this.elements.testOutput) {
      this.elements.testOutput.value = "";
    }
    this._testCharCount = 0;
    this.updateTestDebugCount();
    this.updateTestDebugStatus("Temizlendi");
  }

  updateTestDebugStatus(status) {
    if (this.elements.testDebugStatus) {
      this.elements.testDebugStatus.textContent = status;
    }
  }

  updateTestDebugCount() {
    if (this.elements.testDebugCount) {
      this.elements.testDebugCount.textContent = `Karakter: ${this._testCharCount}`;
    }
  }

  // ==========================================
  // LIFECYCLE
  // ==========================================

  destroy() {
    console.log("[AsistanPage] Destroying...");
    
    // Event listener'ları temizle
    if (this.assistantManager) {
      this.assistantManager.off("connected", this.onAssistantConnected);
      this.assistantManager.off("disconnected", this.onAssistantDisconnected);
      this.assistantManager.off("relay-started", this.onRelayActivated);
      this.assistantManager.off("relay-stopped", this.onRelayDeactivated);
    }
  }
}

// Export singleton instance
export const asistanPage = new AsistanPage();
