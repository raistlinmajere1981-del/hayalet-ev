// @ts-nocheck
// Ana uygulama kontrolörü
import { EntranceHallController } from "./pages/entrance.js";
import { AppState } from "./modules/app-state.js";
import { SettingsController } from "./pages/settings.js";
import { WebviewController } from "./pages/webview.js";
import { AnalyzeController } from "./pages/analyze.js";
import { WhisperController } from "./pages/whisper.js";
import { ServerController } from "./pages/server.js";
import { ArchivesController } from "./pages/archives.js";
import { TestKonvaController } from "./pages/test-konva.js";
import { LogManager } from "./modules/log-manager.js";
import { TrafficManager } from "./modules/traffic-manager.js";
import { CoreEngine } from "./modules/core-engine.js";
import { SettingsContext } from "./modules/settings-context.js";
import { getAvatarPath } from "./modules/settings-helpers.js";
import { SettingsManager } from "./modules/settings-manager.js";
import { ConversationListManager } from "./modules/conversation-list-manager.js";
import entranceTemplate from "../pages/entrance.html?raw";
import settingsTemplate from "../pages/settings.html?raw";
import webviewTemplate from "../pages/webview.html?raw";
import analyzeTemplate from "../pages/analyze.html?raw";
import whisperTemplate from "../pages/whisper.html?raw";
import serverTemplate from "../pages/server.html?raw";
import archivesTemplate from "../pages/archives.html?raw";
import testKonvaTemplate from "../pages/test-konva.html?raw";

let currentPage = null;
/**
 * @type {Object.<string, any>}
 */
const controllers = {};

// taklit edilmiş versiyonlarını sunar.
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
      // @ts-ignore
      return Promise.all(
        paths.map(async (p) => ({
          path: p,
          data: await window.electronAPI.readFile(p),
        })),
      );
    },

    archiveSync: async (_payload) => ({
      success: true,
      meta: { folder: "protocol", id: "protocol" },
    }),
    readArchivesIndex: async () => [],
    writeArchivesIndex: async () => ({ success: true }),
    removeArchive: async () => {
      /* noop */
    },
    openPath: async () => {
      /* noop */
    },

    appendLog: async (payload) => {
      console.debug("[appendLog]", payload);
    },

    fmEnsureDirs: async () => ({
      success: true,
      paths: { commands: "commands", archives: "archives" },
    }),
    fmTempPath: async (prefix, ext) => ({
      path: `${prefix}-${Date.now()}.${ext}`,
    }),
    fmWriteFileAtomic: async (payload) => ({
      success: true,
      path: payload.path,
    }),
    fmArchiveWrite: async () => ({ success: true, path: "protocol" }),

    commandInit: async () => ({ success: true }),
    commandWrite: async () => ({ success: true }),
    commandMove: async () => ({ success: true }),
    commandStageAttachments: async (payload) => ({
      success: true,
      staged: (payload.files || []).map((p) => ({
        name: p.split("/").pop(),
        path: p,
      })),
      temp: [],
      commandDir: "commands",
    }),
    commandArchiveCopy: async () => ({ success: true }),
    commandCleanupJob: async () => {
      /* noop */
    },
    commandMoveFailed: async () => {
      /* noop */
    },

    whisperLoad: async (_provider) => ({ pending: [], done: [] }),
    whisperSave: async () => ({ success: true }),

    getPreloadPath: async () => "",
    showOpenDialog: async () => null,
    copyToAssets: async (p) => ({ path: String(p) }),
    capturePage: async () => ({ success: false }),
    screenshotCapture: async () => ({ success: false }),
    windowMinimize: () => {
      /* noop */
    },
    windowToggleFullscreen: () => {
      /* noop */
    },
    windowClose: () => {
      /* noop */
    },
    appRestart: () => {
      /* noop */
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

ensureElectronApiFallback();

function injectPageTemplates() {
  const container = document.getElementById("pages-container");
  if (container) {
    container.innerHTML = `${entranceTemplate}${analyzeTemplate}${whisperTemplate}${serverTemplate}${archivesTemplate}${settingsTemplate}${webviewTemplate}${testKonvaTemplate}`;
  }
}

async function syncAppStateNicknames() {
  try {
    const s = await SettingsContext.refresh();
    if (s) {
      AppState.setNicknames({
        human: s.human?.nickname || "User",
        // ai1 and ai2 nicknames are now retrieved dynamically from accounts via AppState.getNickname()
      });
    }
  } catch (err) {
    console.warn("syncAppStateNicknames failed", err);
  }
}

export async function initApp() {
  LogManager.init();
  await CoreEngine.init();
  try {
    document.documentElement.setAttribute("spellcheck", "false");
    document.body?.setAttribute("spellcheck", "false");
  } catch (e) {
    /* noop */
  }
  injectPageTemplates();
  TrafficManager.init();
  await SettingsContext.init();
  await syncAppStateNicknames();

  // Realtime sync via settings manager (stronger than relying only on DOM event)
  try {
    if (!window.__hayalet_settings_unsub) {
      // @ts-ignore
      window.__hayalet_settings_unsub = SettingsManager.subscribe(async () => {
        try {
          await syncAppStateNicknames();
          try {
            // also force-disconnect slots without assigned account
            const s = SettingsContext.get() || (await SettingsContext.refresh());
            ["ai1", "ai2"].forEach((slot) => {
              const hasAccount = !!s?.[slot]?.activeAccountId;
              if (!hasAccount) CoreEngine.setConnection(slot, false);
            });
          } catch (_) {
            void 0;
          }
          try {
            updateIndicatorAvatars();
          } catch (_) {
            void 0;
          }
        } catch (_) {
          void 0;
        }
      });
    }
  } catch (_) {
    /* noop */
  }

  // SettingsManager.subscribe handles realtime sync

  controllers.entrance = new EntranceHallController();
  controllers.settings = new SettingsController();
  controllers.webview = new WebviewController();
  controllers.analyze = new AnalyzeController();
  controllers.whisper = new WhisperController();
  controllers.server = new ServerController();
  controllers.archives = new ArchivesController();
  controllers["test-konva"] = new TestKonvaController();

  await controllers.entrance.init();
  await controllers.settings.init();
  await controllers.webview.init();
  await controllers.analyze.init();
  await controllers.whisper.init();
  await controllers.server.init();
  await controllers.archives.init();
  await controllers["test-konva"].init();
  await ConversationListManager.init();

  // Gezinmeyi yapılandır
  setupNavigation();

  // Pencere kontrol butonlarını ayarla
  setupWindowControls();

  // Üst çubuk butonlarını ayarla
  setupTopBarButtons();

  // Rapor panelini ayarla
  setupReportPanel();

  // Başlangıç sayfasını göster
  showPage("entrance");
  updateIndicatorAvatars();
  AppState.subscribe(updateIndicatorAvatars);

  LogManager.addEvent("system", "info", "Uygulama başlatıldı");
}

// Paylaşılan yardımcı fonksiyonlar (diğer modüller tarafından import edilebilir)
export async function waitForDomReady(webview) {
  if (!webview) return;
  try {
    if (typeof webview.isLoading === "function" && !webview.isLoading()) return;
    await new Promise((resolve) => {
      webview.addEventListener("dom-ready", resolve, { once: true });
    });
  } catch (e) {
    // ignore
  }
}

export function normalizeUrl(url) {
  let cleaned = (url || "").split("?")[0].split("#")[0];
  cleaned = cleaned.replace(/\/c\/([a-f0-9-]+)(\/.*)?\??.*$/i, "/c/$1");
  return cleaned;
}

function setupNavigation() {
  try {
    const menuItems = document.querySelectorAll(".menu-item");
    if (menuItems.length === 0) {
      console.warn("No menu items found");
      return;
    }
    menuItems.forEach((item) => {
      item.addEventListener("click", () => {
        const page = /** @type {HTMLElement} */ (item).dataset.page;
        if (page) {
          showPage(page);
        }
      });
    });
  } catch (error) {
    console.error("Error setting up navigation:", error);
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

    // Eğer varsa sayfa controller'ının `onShow` metodunu çağır
    if (controllers[pageName] && controllers[pageName].onShow) {
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

  minimizeBtn?.addEventListener("click", () => CoreEngine.window("minimize"));
  fullscreenBtn?.addEventListener("click", () =>
    CoreEngine.window("fullscreen"),
  );
  closeBtn?.addEventListener("click", () => CoreEngine.window("close"));

  topBar?.addEventListener("dblclick", (e) => {
    if (e.target instanceof Element && e.target.closest(".icon-btn")) return;
    CoreEngine.window("fullscreen");
  });
}

function setupTopBarButtons() {
  try {
    const settingsBtn = document.getElementById("settings-btn");
    const archiveBtn = document.getElementById("archive-btn");
    const webviewBtn = document.getElementById("webview-btn");
    const menuToggle = document.getElementById("menu-toggle");

    if (settingsBtn) {
      settingsBtn.addEventListener("click", () => {
        showPage("settings");
      });
    }

    if (archiveBtn) {
      archiveBtn.addEventListener("click", () => {
        showPage("archives");
      });
    }

    if (webviewBtn) {
      webviewBtn.addEventListener("click", () => {
        showPage("webview");
      });
    }

    if (menuToggle) {
      menuToggle.addEventListener("click", () => {
        CoreEngine.window("toggleMenu");
      });
    }
  } catch (error) {
    console.error("Error setting up top bar buttons:", error);
  }
}

/**
 * @param {string} pageName
 */
function setActiveNavigation(pageName) {
  const menuItems = document.querySelectorAll(".menu-item");
  const specialPages = ["settings", "archives", "webview"];
  menuItems.forEach((mi) => mi.classList.remove("active"));
  if (!specialPages.includes(pageName)) {
    menuItems.forEach((mi) => {
      if (/** @type {HTMLElement} */ (mi).dataset.page === pageName) {
        mi.classList.add("active");
      }
    });
  }

  /** @type {Record<string, HTMLElement | null>} */
  const iconMap = {
    settings: document.getElementById("settings-btn"),
    archives: document.getElementById("archive-btn"),
    webview: document.getElementById("webview-btn"),
  };
  Object.values(iconMap).forEach((btn) => btn?.classList.remove("active"));
  const activeIcon = iconMap[pageName];
  if (activeIcon) {
    activeIcon.classList.add("active");
  }
}

async function updateIndicatorAvatars() {
  const settings = SettingsContext.get() || {};
  const map = {
    human: {
      el: document.getElementById("indicator-avatar-human"),
      path: getAvatarPath(settings, "human"),
      connected: AppState.getConnection
        ? AppState.getConnection("human")
        : false,
      nickname: AppState.getNickname("human"),
    },
    ai1: {
      el: document.getElementById("indicator-avatar-ai1"),
      path: getAvatarPath(settings, "ai1"),
      connected: AppState.getConnection ? AppState.getConnection("ai1") : false,
      nickname: AppState.getNickname("ai1"),
    },
    ai2: {
      el: document.getElementById("indicator-avatar-ai2"),
      path: getAvatarPath(settings, "ai2"),
      connected: AppState.getConnection ? AppState.getConnection("ai2") : false,
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
      const ext = filePath.split(".").pop()?.toLowerCase() || "";
      /** @type {Record<string, string>} */
      const mimeMap = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        gif: "image/gif",
        webp: "image/webp",
      };
      const mime = mimeMap[ext] || "image/png";
      return `data:${mime};base64,${data}`;
    } catch (err) {
      console.warn("Avatar read failed", err);
      return null;
    }
  };

  /**
   * @param {HTMLElement | null} el
   * @param {string | null} src
   * @param {boolean} connected
   */
  const applyAvatar = (el, src, connected) => {
    if (!el) return;
    if (src) {
      el.style.backgroundImage = `url('${src}')`;
      el.classList.remove("avatar-placeholder");
      el.textContent = "";
    } else {
      el.style.backgroundImage = "";
      el.classList.add("avatar-placeholder");
      el.textContent = ""; // Leave empty if no avatar
    }
    el.classList.toggle("connected", !!connected);
    const cluster = el.closest(".indicator-cluster");
    if (cluster) cluster.classList.toggle("disconnected", !connected);
  };

  Object.values(map).forEach(({ el, path, connected }) => {
    if (!el) return;
    // varsayılan: yer tutucu
    applyAvatar(el, null, connected);
    if (path) {
      buildDataUrl(path).then((uri) => {
        if (uri) applyAvatar(el, uri, connected);
      });
    }
    try {
      if (el && el.id && el.id.includes("indicator-avatar-")) {
        const provider = el.id.replace("indicator-avatar-", "");
        /** @type {HTMLSelectElement | null} */
        const conv = document.getElementById(`conversation-${provider}`);
        if (conv) {
          conv.disabled = !connected;
          // If disconnected, ensure 'Yeni Sohbet' is selected
          if (!connected) {
            try {
              conv.value = "new";
            } catch (_) {
              void 0;
            }
          }
          try {
            /** @type {HTMLButtonElement | null} */
            const btn = document.getElementById(
              `conversation-refresh-${provider}`,
            );
            if (btn) {
              btn.disabled = !connected;
              // @ts-ignore
              if (btn.__convRefreshHandler) {
                // @ts-ignore
                btn.removeEventListener("click", btn.__convRefreshHandler);
              }
              /** @param {MouseEvent} [ev] */
              const handler = async (ev) => {
                ev?.preventDefault();
                try {
                  await CoreEngine.syncProvider(provider, { from: "manual" });
                } catch (err) {
                  console.warn("Manual sync failed", err);
                }
              };
              // @ts-ignore
              btn.__convRefreshHandler = handler;
              btn.addEventListener("click", handler);
            }
          } catch (e) {
            /* noop */
          }
        }
      }
    } catch (e) {
      /* noop */
    }
  });
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
    // Modal açılmadan önce mevcut oturum loglarını güncel sırayla yaz
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

// Self-initialize the app once the script is loaded
initApp();
