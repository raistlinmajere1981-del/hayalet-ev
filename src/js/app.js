import { EntranceHallController } from "./pages/entrance.js";
import { AppState } from "./modules/app-state.js";
import { SLOTS, SPECIAL_PAGES, getMimeTypeFromPath, getFilename, ASISTAN_SLOT } from "./constants/index.js";
import { AnalyzeController } from "./pages/analyze.js";
import { WhisperController } from "./pages/whisper.js";
import { ServerController } from "./pages/server.js";
import { ArchivesController } from "./pages/archives.js";
import { AsistanController } from "./pages/asistan.js";
import { LogManager } from "./modules/log-manager.js";
import { TrafficManager } from "./modules/traffic-manager.js";
import { CoreEngine } from "./modules/core-engine.js";
import { SettingsManager } from "./modules/settings-manager.js";
import { SlotController, SlotEvent } from "./modules/slot-controller.js";
import { ConversationListManager } from "./modules/conversation-list-manager.js";
import { RelayManager } from "./modules/relay-manager.js";
import { WindowManager } from "./modules/window-manager.js";
import { WebviewManager } from "./modules/webview-manager.js";
import entranceTemplate from "../pages/entrance.html?raw";
import analyzeTemplate from "../pages/analyze.html?raw";
import whisperTemplate from "../pages/whisper.html?raw";
import serverTemplate from "../pages/server.html?raw";
import archivesTemplate from "../pages/archives.html?raw";
import asistanTemplate from "../pages/asistan.html?raw";

let currentPage = null;
/**
 * @type {Object.<string, any>}
 */
const controllers = {};

function ensureElectronApiFallback() {
  if (window.electronAPI) return;
  const storageKey = "hayalet-settings-v1";
  /**
   * @param {Response} resp
   * @returns {Promise<string|null>}
   */
  const toBase64 = async (resp) => {
    try {
      const buf = await resp.arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buf);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
      return btoa(binary);
    } catch {
      return null;
    }
  };

  window.electronAPI = {
    loadSettings: async () => {
      try {
        const raw = localStorage.getItem(storageKey);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },
    saveSettings: async (settings) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(settings));
        return true;
      } catch {
        return false;
      }
    },

    readFile: async (path) => {
      try {
        const resp = await fetch(path);
        if (!resp.ok) return null;
        const b64 = await toBase64(resp);
        return b64;
      } catch {
        return null;
      }
    },
    readFilesMulti: (paths) => {
      return Promise.all(
        paths.map(async (p) => ({
          path: p,
          data: await window.electronAPI.readFile(p),
        })),
      );
    },

    openPath: async () => {
    },

    appendLog: async (payload) => {
      console.debug("[appendLog]", payload);
    },

    fmEnsureDirs: async () => ({
      success: true,
      paths: { commands: "commands" },
    }),
    fmTempPath: async (prefix, ext) => ({
      path: `${prefix}-${Date.now()}.${ext}`,
    }),
    fmWriteFileAtomic: async (payload) => ({
      success: true,
      path: payload.path,
    }),

    commandInit: async () => ({ success: true }),
    commandWrite: async () => ({ success: true }),
    commandMove: async () => ({ success: true }),
    commandStageAttachments: async (payload) => ({
      success: true,
      staged: (payload.files || []).map((p) => ({
        name: getFilename(p),
        path: p,
      })),
      temp: [],
      commandDir: "commands",
    }),
    commandArchiveCopy: async () => ({ success: true }),
    commandCleanupJob: async () => {
    },
    commandMoveFailed: async () => {
    },

    whisperLoad: async (_params) => ({ pending: [], done: [] }),
    whisperSave: async (_params) => ({ success: true }),

    getPreloadPath: async () => "",
    showOpenDialog: async () => null,
    copyToAssets: async (p) => ({ path: String(p) }),
    capturePage: async () => ({ success: false }),
    screenshotCapture: async () => ({ success: false }),
    windowMinimize: () => {
    },
    windowToggleFullscreen: () => {
    },
    windowClose: () => {
    },
    appRestart: () => {
    },
    generateTree: async () => ({ success: false }),
    fetchUrl: async () => null,
    catboxUpload: async () => null,
    uguuUpload: async () => null,
    googledriveUpload: async () => null,
    googledriveStartAuth: async () => null,
    googledriveExchangeCode: async () => null,
    googledriveDisconnect: async () => null,
  };
}

if (!window.electronAPI) {
  ensureElectronApiFallback();
}

function injectPageTemplates() {
  const container = document.getElementById("pages-container");
  if (container) {
    container.innerHTML = `${entranceTemplate}${analyzeTemplate}${whisperTemplate}${serverTemplate}${asistanTemplate}${archivesTemplate}`;
  }
}

async function initApp() {
  await CoreEngine.init();
  try {
    document.documentElement.setAttribute("spellcheck", "false");
    document.body?.setAttribute("spellcheck", "false");
  } catch (e) {
  }
  injectPageTemplates();
  TrafficManager.init();

  try {
    if (!window.__hayalet_settings_unsub) {
      window.__hayalet_settings_unsub = SettingsManager.subscribe(async () => {
        try {
          updateIndicatorAvatars();
        } catch (_) {
          void 0;
        }
      });
    }
  } catch (_) {
  }

  controllers.entrance = new EntranceHallController();
  controllers.analyze = new AnalyzeController();
  controllers.whisper = new WhisperController();
  controllers.server = new ServerController();
  controllers.archives = new ArchivesController();
  controllers.asistan = new AsistanController();
  await controllers.entrance.init();
  await controllers.analyze.init();
  await controllers.whisper.init();
  await controllers.server.init();
  await controllers.archives.init();
  await controllers.asistan.init();
  await ConversationListManager.init();

  // AI webview'lerini kaydet
  const ai0Webview = document.getElementById("ai0-webview");
  const ai1Webview = document.getElementById("ai1-webview");
  const ai2Webview = document.getElementById("ai2-webview");
  if (ai0Webview) {
    SlotController.registerWebview(ASISTAN_SLOT, ai0Webview);
    WebviewManager.register(ASISTAN_SLOT, ai0Webview);
  }
  if (ai1Webview) {
    SlotController.registerWebview(SLOTS.AI1, ai1Webview);
    WebviewManager.register(SLOTS.AI1, ai1Webview);
  }
  if (ai2Webview) {
    SlotController.registerWebview(SLOTS.AI2, ai2Webview);
    WebviewManager.register(SLOTS.AI2, ai2Webview);
  }

  setupNavigation();
  setupWindowControls();
  setupTopBarButtons();
  setupReportPanel();


  showPage("entrance");
  updateIndicatorAvatars();
  updateRelayIndicator();
  AppState.subscribe(() => {
    updateIndicatorAvatars();
    updateRelayIndicator();
  });

  SlotController.on(SlotEvent.STATE_CHANGED, () => {
    updateIndicatorAvatars();
    updateRelayIndicator();
  });

  LogManager.addEvent("system", "info", "Uygulama başlatıldı");
}

export async function waitForDomReady(webview) {
  if (!webview) return;
  try {
    if (typeof webview.isLoading === "function" && !webview.isLoading()) return;
    await new Promise((resolve) => {
      webview.addEventListener("dom-ready", resolve, { once: true });
    });
  } catch (e) {
  }
}

function setupNavigation() {
  try {
    const menuItems = document.querySelectorAll(".menu-item");
    if (menuItems.length === 0) {
      LogManager.addEvent("system", "warning", "No menu items found");
      return;
    }
    menuItems.forEach((item) => {
      item.addEventListener("click", () => {
        const page = item.dataset.page;
        if (page) {
          showPage(page);
        }
      });
    });
  } catch (error) {
    LogManager.addEvent("system", "error", `Navigation setup error: ${error?.message || error}`);
  }
}

/**
 * @param {string} pageName
 */
function showPage(pageName) {
  const previousPage = currentPage;
  if (
    previousPage &&
    previousPage !== pageName &&
    controllers[previousPage]?.onHide
  ) {
    controllers[previousPage].onHide();
  }
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.add("hidden");
  });

  const pageElement = document.getElementById(`page-${pageName}`);
  if (pageElement) {
    pageElement.classList.remove("hidden");
    currentPage = pageName;

    if (controllers[pageName]?.onShow) {
      controllers[pageName].onShow();
    }

    setActiveNavigation(pageName);
  }
}

function setupWindowControls() {
  const minimizeBtn = document.getElementById("window-minimize");
  const fullscreenBtn = document.getElementById("window-fullscreen");
  const closeBtn = document.getElementById("window-close");
  const topBar = document.querySelector(".top-bar");

  minimizeBtn?.addEventListener("click", () => WindowManager.apply("minimize"));
  fullscreenBtn?.addEventListener("click", () =>
    WindowManager.apply("fullscreen"),
  );
  closeBtn?.addEventListener("click", () => WindowManager.closeApp());

  topBar?.addEventListener("dblclick", (e) => {
    if (e.target instanceof Element && e.target.closest(".icon-btn")) return;
    WindowManager.apply("fullscreen");
  });
}

function setupTopBarButtons() {
  try {
    const asistanBtn = document.getElementById("asistan-btn");
    const menuToggle = document.getElementById("menu-toggle");

    if (asistanBtn) {
      asistanBtn.addEventListener("click", () => {
        showPage("asistan");
      });
    }

    if (menuToggle) {
      menuToggle.addEventListener("click", () => {
        WindowManager.apply("toggleMenu");
      });
    }
  } catch (error) {
    LogManager.addEvent("system", "error", `Top bar setup error: ${error?.message || error}`);
  }
}

/**
 * @param {string} pageName
 */
function setActiveNavigation(pageName) {
  const menuItems = document.querySelectorAll(".menu-item");
  menuItems.forEach((mi) => mi.classList.remove("active"));
  if (!SPECIAL_PAGES.includes(pageName)) {
    menuItems.forEach((mi) => {
      if (mi.dataset.page === pageName) {
        mi.classList.add("active");
      }
    });
  }

  /** @type {Record<string, HTMLElement | null>} */
  const iconMap = {
    asistan: document.getElementById("asistan-btn"),
  };
  Object.values(iconMap).forEach((btn) => btn?.classList.remove("active"));
  const activeIcon = iconMap[pageName];
  if (activeIcon) {
    activeIcon.classList.add("active");
  }
}

async function updateIndicatorAvatars() {
  const getAvatar = (provider) => AppState.getAvatar(provider);

  const map = {
    ai0: {
      el: document.getElementById("indicator-avatar-ai0"),
      path: getAvatar("ai0"),
      connected: SlotController.isConnected("ai0"),
      nickname: AppState.getNickname("ai0"),
      isAsistan: true,
    },
    ai1: {
      el: document.getElementById("indicator-avatar-ai1"),
      path: getAvatar("ai1"),
      connected: SlotController.isConnected("ai1"),
      nickname: AppState.getNickname("ai1"),
    },
    ai2: {
      el: document.getElementById("indicator-avatar-ai2"),
      path: getAvatar("ai2"),
      connected: SlotController.isConnected("ai2"),
      nickname: AppState.getNickname("ai2"),
    },
  };

  /**
   * @param {string | undefined} filePath
   * @returns {Promise<string | null>}
   */
  const buildDataUrl = async (filePath) => {
    if (!filePath || !window.electronAPI?.readFile) return null;
    try {
      const data = await window.electronAPI.readFile(filePath);
      if (!data) return null;
      const mime = getMimeTypeFromPath(filePath);
      return `data:${mime};base64,${data}`;
    } catch (err) {
      // Avatar okuma hatası - sessiz geç (kritik değil)
      return null;
    }
  };

  /**
   * @param {HTMLElement | null} el
   * @param {string | null} src
   * @param {boolean} connected
   */
  const applyAvatar = (el, src, slotState) => {
    if (!el) return;
    if (src) {
      el.style.backgroundImage = `url('${src}')`;
      el.classList.remove("avatar-placeholder");
      el.textContent = "";
    } else {
      el.style.backgroundImage = "";
      el.classList.add("avatar-placeholder");
      el.textContent = "";
    }

    const cluster = el.closest(".indicator-cluster");
    if (!cluster) return;

    if (slotState === "empty") {
      el.style.opacity = "0.3";
      cluster.style.opacity = "0.5";
      cluster.style.pointerEvents = "none";
    } else if (slotState === "disconnected") {
      el.style.opacity = "0.6";
      cluster.style.opacity = "0.7";
      cluster.style.pointerEvents = "none";
    } else if (slotState === "connected") {
      el.style.opacity = "1";
      cluster.style.opacity = "1";
      cluster.style.pointerEvents = "auto";
    }
  };

  Object.entries(map).forEach(([provider, { el, path, isAsistan }]) => {
    if (!el) return;

    /** @type {"empty"|"disconnected"|"connected"} */
    let slotState = "empty";

    const settings = SettingsManager.getSnapshot();
    
    // Asistan için asistanSlot, diğerleri için slots kullan
    const hasAccount = isAsistan 
      ? !!settings?.asistanSlot?.accountId
      : !!settings?.slots?.[provider]?.accountId;
    const connected = SlotController.isConnected(provider);
    
    if (!hasAccount) {
      slotState = "empty";
    } else if (connected) {
      slotState = "connected";
    } else {
      slotState = "disconnected";
    }

    applyAvatar(el, null, slotState);
    if (path) {
      buildDataUrl(path).then((uri) => {
        if (uri) applyAvatar(el, uri, slotState);
      });
    }

    // Asistan için conversation select yok
    if (isAsistan) return;

    try {
      /** @type {HTMLSelectElement | null} */
      const conv = document.getElementById(`conversation-${provider}`);
      if (conv) {
        conv.disabled = slotState !== "connected";
        try {
          /** @type {HTMLButtonElement | null} */
          const btn = document.getElementById(
            `conversation-refresh-${provider}`,
          );
          if (btn) {
            btn.disabled = slotState !== "connected";
            if (btn.__convRefreshHandler) {
              btn.removeEventListener("click", btn.__convRefreshHandler);
            }
            /** @param {MouseEvent} [ev] */
            const handler = async (ev) => {
              ev?.preventDefault();
              try {
                await WebviewManager.syncProvider(provider, { from: "manual" });
              } catch (err) {
                LogManager.addEvent("sync", "warning", `Manual sync failed: ${err?.message || err}`);
              }
            };
            btn.__convRefreshHandler = handler;
            btn.addEventListener("click", handler);
          }
        } catch (e) {
          /* noop */
        }
      }
    } catch (e) {
    }
  });
}

/**
 * Relay göstergesini güncelle - Flow line animasyonları
 * AI-AI: Alt çizgi sarı/turuncu, AI1-Asistan: Sol çizgi yeşil, AI2-Asistan: Sağ çizgi mavi
 */
function updateRelayIndicator() {
  const flowAi1Ai0 = document.getElementById("relay-flow-ai1-ai0");
  const flowAi0Ai2 = document.getElementById("relay-flow-ai0-ai2");
  const flowAi1Ai2 = document.getElementById("relay-flow-ai1-ai2");
  
  if (!flowAi1Ai0 || !flowAi0Ai2 || !flowAi1Ai2) return;

  // Tüm relay class'ları temizle (thinking-active hariç - o TrafficManager tarafından yönetilir)
  flowAi1Ai0.classList.remove("active", "thinking");
  flowAi0Ai2.classList.remove("active", "thinking");
  flowAi1Ai2.classList.remove("active", "thinking");

  // Relay durumunu kontrol et
  const isAIAIActive = RelayManager.isAIAIActive();
  const isAIAsistanActive = RelayManager.isAIAsistanActive();
  const asistanSourceSlot = RelayManager.getAIAsistanSourceSlot();

  if (isAIAIActive) {
    // AI-AI Relay: Alt çizgi (AI1-AI2) sarı/turuncu animasyonlu
    flowAi1Ai2.classList.add("active");
    flowAi1Ai2.title = "AI1 ↔ AI2 Relay Aktif";
  } else if (isAIAsistanActive && asistanSourceSlot === "ai1") {
    // AI1-Asistan Relay: Sol çizgi yeşil animasyonlu
    flowAi1Ai0.classList.add("active");
    flowAi1Ai0.title = "AI1 ↔ Asistan Relay Aktif";
  } else if (isAIAsistanActive && asistanSourceSlot === "ai2") {
    // AI2-Asistan Relay: Sağ çizgi mavi animasyonlu
    flowAi0Ai2.classList.add("active");
    flowAi0Ai2.title = "Asistan ↔ AI2 Relay Aktif";
  } else {
    flowAi1Ai0.title = "";
    flowAi0Ai2.title = "";
    flowAi1Ai2.title = "";
  }
}

function setupReportPanel() {
  const reportToggle = document.getElementById("report-toggle");
  const reportPanel = document.getElementById("report-panel");
  const modal = document.getElementById("report-modal");
  const modalBody = document.getElementById("report-modal-body");
  const modalClose = document.getElementById("report-modal-close");

  reportToggle?.addEventListener("click", () => openModal());

  const openModal = () => {
    if (!modal) return;
    if (modalBody) {
      modalBody.innerHTML = "";
      const all = LogManager.getAll();
      [...all].reverse().forEach((entry) => {
        const line = document.createElement("div");
        line.className = "log-entry";
        line.textContent = `[${entry.timestamp}] [${entry.source}] ${entry.message}`;
        modalBody.appendChild(line);
      });
    }
    modal.classList.remove("hidden");
  };

  const closeModal = () => {
    if (!modal) return;
    modal.classList.add("hidden");
  };

  reportPanel?.addEventListener("dblclick", openModal);
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
  modalClose?.addEventListener("click", closeModal);

  LogManager.onUpdate((entry) => {
    const reportContent = document.getElementById("report-content");
    if (!reportContent) return;

    const logEntry = document.createElement("div");
    logEntry.className = "log-entry";
    logEntry.textContent = `[${entry.timestamp}] [${entry.source}] ${entry.message}`;
    if (reportContent.firstChild) {
      reportContent.insertBefore(logEntry, reportContent.firstChild);
    } else {
      reportContent.appendChild(logEntry);
    }
    reportContent.scrollTop = 0;

    if (modalBody && !modal?.classList.contains("hidden")) {
      const modalLine = logEntry.cloneNode(true);
      if (modalBody.firstChild) {
        modalBody.insertBefore(modalLine, modalBody.firstChild);
      } else {
        modalBody.appendChild(modalLine);
      }
      modalBody.scrollTop = 0;
    }
  });
}

export { currentPage, showPage };

setTimeout(() => {
  initApp();
}, 0);
