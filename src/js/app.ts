import type { WebviewTag } from "electron";
import { EntranceHallController } from "./pages/entrance.js";
import { AppState } from "./modules/app-state.js";
import { getMimeTypeFromPath, getFilename } from "./constants/index.js";

// Slot sabitleri (inline - sadece bu dosyada kullanılıyor)
const SLOTS = { AI1: "ai1", AI2: "ai2" };
const ASISTAN_SLOT = "ai0";
const SPECIAL_PAGES = ["settings", "archives", "webview", "asistan"];

interface PageController {
  init?: () => Promise<void> | void;
  onShow?: () => void;
  onHide?: () => void;
}

import { getErrorMessage } from "./types/index.js";
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
import { MetaCommandManager } from "./modules/meta-command-manager.js";
import { SplashScreen } from "./ui/splash-screen.js";
import { ThemeManager } from "./ui/theme-manager.js";
import entranceTemplate from "../pages/entrance.html?raw";
import analyzeTemplate from "../pages/analyze.html?raw";
import whisperTemplate from "../pages/whisper.html?raw";
import serverTemplate from "../pages/server.html?raw";
import archivesTemplate from "../pages/archives.html?raw";
import asistanTemplate from "../pages/asistan.html?raw";

let currentPage: string | null = null;
/**
 * @type {Object.<string, any>}
 */
const controllers: Record<string, PageController> = {};

function ensureElectronApiFallback() {
  if (window.electronAPI) return;
  const storageKey = "hayalet-settings-v1";
  /**
   * @param {Response} resp
   * @returns {Promise<string|null>}
   */
  const toBase64 = async (resp: Response): Promise<string | null> => {
    try {
      const buf = await resp.arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buf);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        const byte = bytes[i];
        if (byte !== undefined) binary += String.fromCharCode(byte);
      }
      return btoa(binary);
    } catch {
      return null;
    }
  };

  (window).electronAPI = {
    loadSettings: async () => {
      try {
        const raw = localStorage.getItem(storageKey);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },
    saveSettings: async (settings: unknown) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(settings));
        return true;
      } catch {
        return false;
      }
    },

    readFile: async (path: string): Promise<string | null> => {
      try {
        const resp = await fetch(path);
        if (!resp.ok) return null;
        const b64 = await toBase64(resp);
        return b64;
      } catch {
        return null;
      }
    },
    readFilesMulti: (async (paths: string[]) => {
      return Promise.all(
        paths.map(async (p) => ({
          path: p,
          data: await window.electronAPI?.readFile(p),
        })),
      );
    }) as any,

    openPath: async (_path: string) => ({ success: true }),

    appendLog: async (payload: unknown) => {
      console.debug("[appendLog]", payload);
    },

    fmEnsureDirs: async () => ({
      success: true,
      paths: { commands: "commands" },
    }),
    fmTempPath: async (prefix: string, ext: string) => ({
      path: `${prefix}-${Date.now()}.${ext}`,
    }),
    fmWriteFileAtomic: async (payload: Record<string, unknown>) => ({
      success: true,
      path: (payload.path as string) || '',
    }),

    commandInit: async () => ({ success: true, jobs: [] }),
    commandWrite: async () => ({ success: true }),
    commandMove: async () => ({ success: true }),
    commandStageAttachments: async (payload: { files?: string[] }) => ({
      success: true,
      staged: (payload.files || []).map((p: string) => ({
        name: getFilename(p),
        path: p,
      })),
      temp: [] as string[],
      commandDir: "commands",
    }),
    commandArchiveCopy: async () => ({ success: true }),
    commandCleanupJob: async () => ({ success: true }),
    commandMoveFailed: async () => ({ success: true }),

    whisperLoad: async (_params: unknown) => ({ success: true, pending: [] as unknown[], done: [] as unknown[] }),
    whisperSave: async (_params: unknown) => ({ success: true }),

    getPreloadPath: async (): Promise<string> => "",
    showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
    copyToAssets: async (p: string) => ({ success: true, path: String(p) }),
    capturePage: async (): Promise<{ success: boolean }> => ({ success: false }),
    screenshotCapture: async (): Promise<{ success: boolean }> => ({ success: false }),
    windowMinimize: async (): Promise<void> => {
    },
    windowToggleFullscreen: async (): Promise<void> => {
    },
    windowClose: async (): Promise<void> => {
    },
    appRestart: async (): Promise<void> => {
    },
    generateTree: async (): Promise<{ success: boolean }> => ({ success: false }),
    fetchUrl: async () => ({ success: false, url: '' }),
    catboxUpload: async () => ({ success: false, url: '' }),
    uguuUpload: async () => ({ success: false, url: '', uploadedLinks: [], uploaded: 0, errors: [] }),
    googledriveUpload: async () => ({ success: false, authUrl: '' }),
    googledriveStartAuth: async () => ({ success: false }),
    googledriveExchangeCode: async () => ({ success: false }),
    googledriveDisconnect: async () => ({ success: false }),
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
  // Splash screen progress updates
  SplashScreen.update(10, 'Ayarlar yükleniyor...');
  
  await CoreEngine.init();
  SplashScreen.update(30, 'Komutlar yükleniyor...');
  
  // Custom komutları yükle
  await MetaCommandManager.loadCommands();
  SplashScreen.update(40, 'Arayüz hazırlanıyor...');
  
  try {
    document.documentElement.setAttribute("spellcheck", "false");
    document.body?.setAttribute("spellcheck", "false");
  } catch (e) {
  }
  injectPageTemplates();
  TrafficManager.init();
  SplashScreen.update(50, 'Modüller başlatılıyor...');

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
  await controllers.entrance.init?.();
  await controllers.analyze.init?.();
  await controllers.whisper.init?.();
  await controllers.server.init?.();
  await controllers.archives.init?.();
  await controllers.asistan.init?.();
  await ConversationListManager.init();

  // AI webview'lerini kaydet
  const ai0Webview = document.getElementById("ai0-webview") as WebviewTag | null;
  const ai1Webview = document.getElementById("ai1-webview") as WebviewTag | null;
  const ai2Webview = document.getElementById("ai2-webview") as WebviewTag | null;
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


  SplashScreen.update(90, 'Son hazırlıklar...');
  
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

  LogManager.addEvent("system", "info", "Uygulama başlatıldı", { visibility: 2 });
  
  // Splash screen'i gizle (min 2sn bekler)
  SplashScreen.complete();
  await SplashScreen.hide();
}

export async function waitForDomReady(webview: HTMLElement & { isLoading?: () => boolean }) {
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
    // Listen for custom navigation events (from other parts of the app)
    document.addEventListener("navigate-page", ((e: CustomEvent<{ page: string }>) => {
      if (e.detail?.page) {
        showPage(e.detail.page);
      }
    }) as EventListener);
  } catch (error) {
    LogManager.addEvent("system", "error", `Navigation setup error: ${getErrorMessage(error)}`);
  }
}

/**
 * @param {string} pageName
 */
function showPage(pageName: string) {
  const previousPage = currentPage;
  if (
    previousPage &&
    previousPage !== pageName &&
    controllers[previousPage]?.onHide
  ) {
    controllers[previousPage]?.onHide?.();
  }
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.add("hidden");
  });

  const pageElement = document.getElementById(`page-${pageName}`);
  if (pageElement) {
    pageElement.classList.remove("hidden");
    currentPage = pageName;

    if (controllers[pageName]?.onShow) {
      controllers[pageName]?.onShow?.();
    }

    setActiveNavigation(pageName);
  }
}

function setupWindowControls() {
  const minimizeToTrayBtn = document.getElementById("window-minimize-to-tray");
  const minimizeBtn = document.getElementById("window-minimize");
  const fullscreenBtn = document.getElementById("window-fullscreen");
  const closeBtn = document.getElementById("window-close");
  const topBar = document.querySelector(".top-bar");

  minimizeToTrayBtn?.addEventListener("click", () => WindowManager.minimizeToTray());
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
    const themeToggle = document.getElementById("theme-toggle");

    if (asistanBtn) {
      asistanBtn.addEventListener("click", () => {
        showPage("asistan");
      });
    }

    // Theme toggle in topbar
    if (themeToggle) {
      // Set initial icon
      themeToggle.textContent = ThemeManager.getIcon();
      
      themeToggle.addEventListener("click", () => {
        // Doğrudan DOM'u güncelle - Vite HMR sorunlarını bypass et
        const root = document.documentElement;
        const currentTheme = root.getAttribute("data-theme") || "dark";
        const newTheme = currentTheme === "dark" ? "light" : "dark";
        
        root.setAttribute("data-theme", newTheme);
        localStorage.setItem("hayalet-ev-theme", newTheme);
        themeToggle.textContent = newTheme === "dark" ? "🌙" : "☀️";
        
        LogManager.addEvent("theme", "info", `Tema değiştirildi: ${newTheme}`, { visibility: 3 });
      });

      // Listen for theme changes from other sources (system preference etc.)
      ThemeManager.onChange(() => {
        themeToggle.textContent = ThemeManager.getIcon();
      });
    }

    // Side navigation overlay hover handling
    const sideNavOverlay = document.getElementById("side-nav-overlay");
    const sideNavTrigger = document.querySelector(".side-nav-trigger");
    const sideNavMenu = document.querySelector(".side-nav-menu");
    
    if (sideNavOverlay && sideNavTrigger && sideNavMenu) {
      // Trigger zone'a girildiğinde menüyü aç
      sideNavTrigger.addEventListener("mouseenter", () => {
        sideNavOverlay.classList.add("is-open");
      });
      
      // Menüden çıkıldığında kapat
      sideNavMenu.addEventListener("mouseleave", () => {
        sideNavOverlay.classList.remove("is-open");
      });
      
      // Trigger'dan direkt dışarı çıkıldığında (menüye girmeden)
      sideNavTrigger.addEventListener("mouseleave", (e) => {
        const relatedTarget = (e as MouseEvent).relatedTarget as Element | null;
        if (!relatedTarget || !sideNavMenu.contains(relatedTarget)) {
          // Kısa gecikme ile kapat (menüye geçiş için zaman tanı)
          setTimeout(() => {
            if (!sideNavOverlay.matches(":hover")) {
              sideNavOverlay.classList.remove("is-open");
            }
          }, 100);
        }
      });
    }

    // Page navigation buttons in side overlay
    const navButtons = document.querySelectorAll(".side-nav-btn") as NodeListOf<HTMLElement>;
    navButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const page = btn.dataset.page;
        if (page) {
          showPage(page);
          // Update active state
          navButtons.forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
        }
      });
    });
  } catch (error) {
    LogManager.addEvent("system", "error", `Top bar setup error: ${getErrorMessage(error)}`);
  }
}

/**
 * @param {string} pageName
 */
function setActiveNavigation(pageName: string) {
  const menuItems = document.querySelectorAll(".menu-item") as NodeListOf<HTMLElement>;
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
  const activeIcon = iconMap[pageName as keyof typeof iconMap];
  if (activeIcon) {
    activeIcon.classList.add("active");
  }
}

async function updateIndicatorAvatars() {
  const getAvatar = (provider: string) => AppState.getAvatar(provider);

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
      isAsistan: false,
    },
    ai2: {
      el: document.getElementById("indicator-avatar-ai2"),
      path: getAvatar("ai2"),
      connected: SlotController.isConnected("ai2"),
      nickname: AppState.getNickname("ai2"),
      isAsistan: false,
    },
  };

  /**
   * @param {string | undefined} filePath
   * @returns {Promise<string | null>}
   */
  const buildDataUrl = async (filePath: string | undefined): Promise<string | null> => {
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
  const applyAvatar = (el: HTMLElement | null, src: string | null, slotState: "empty" | "disconnected" | "connected") => {
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

    const cluster = el.closest(".indicator-cluster") as HTMLElement | null;
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

    let slotState: "empty" | "disconnected" | "connected" = "empty";

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
      const conv = document.getElementById(`conversation-${provider}`) as HTMLSelectElement | null;
      if (conv) {
        conv.disabled = slotState !== "connected";
        try {
          const btn = document.getElementById(
            `conversation-refresh-${provider}`,
          ) as (HTMLButtonElement & { __convRefreshHandler?: EventListener }) | null;
          if (btn) {
            btn.disabled = slotState !== "connected";
            if (btn.__convRefreshHandler) {
              btn.removeEventListener("click", btn.__convRefreshHandler);
            }
            const handler: EventListener = async (ev: Event) => {
              ev?.preventDefault();
              try {
                await WebviewManager.syncProvider(provider, { from: "manual" });
              } catch (err) {
                LogManager.addEvent("sync", "warning", `Manual sync failed: ${getErrorMessage(err)}`);
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
  // Report panel artık entrance.ts tarafından yönetiliyor
  // Bu fonksiyon geriye dönük uyumluluk için boş bırakıldı
}

export { currentPage, showPage };

// DOM hazır olduğunda initApp'i çağır
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => initApp());
} else {
  // DOM zaten hazır
  initApp();
}
