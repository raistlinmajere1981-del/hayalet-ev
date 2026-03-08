/**
 * App Entry Point - Orchestrator
 *
 * Tüm modülleri koordine eder ve uygulama yaşam döngüsünü yönetir.
 * Her modülün detay implementasyonu kendi dosyasındadır.
 */

import { AppState } from "../modules/app-state.js";
import { getErrorMessage } from "@shared/index.js";
import { Logger, LogCategory, LogLevel, LogVisibility } from "../modules/logger/index.js";
import { TrafficManager } from "../modules/traffic-manager.js";
import { CoreEngine, registerServerCommands } from "../modules/core-engine.js";
import { ServerCommands } from "../modules/server-commands.js";
import { SettingsManager } from "../modules/settings-manager.js";
import { SlotController, SlotEvent } from "../modules/slot-controller.js";
import { WebviewManager } from "../modules/webview-manager.js";
import { ConversationListManager } from "../modules/conversation-list-manager.js";
import { MetaCommandManager } from "../modules/meta-command-manager.js";
import { RoomRegistry } from "../modules/rooms/room-registry.js";
import { SplashScreen } from "../ui/splash-screen.js";

import type { PageController } from "./types.js";
import { ensureElectronApiFallback } from "./electron-fallback.js";
import {
  setupNavigation,
  setupWindowControls,
  setupTopBarButtons,
  showPage,
  setControllers,
  setupReportPanel,
} from "./navigation.js";
import { updateIndicatorAvatars } from "./indicators.js";
import {
  updateRelayIndicator,
  setupTopBarRelayButtons,
  updateRelayButtonStates,
} from "./relay-ui.js";
import {
  injectPageTemplates,
  setupUILogListener,
  initControllers,
  registerWebviews,
} from "./page-init.js";
import { setupRoomOverlay } from "./room-overlay.js";

// Extend Window interface for global access
declare global {
  interface Window {
    SlotController: typeof SlotController;
    WebviewManager: typeof WebviewManager;
    AppState: typeof AppState;
  }
}

const controllers: Record<string, PageController> = {};

if (!window.electronAPI) {
  ensureElectronApiFallback();
}

let isInitializing = false;
let isInitialized = false;

async function initApp(): Promise<void> {
  // Prevent duplicate initialization
  if (isInitializing || isInitialized) {
    console.warn("[App] Already initialized or initializing, skipping");
    return;
  }

  isInitializing = true;
  let initSucceeded = false;

  // Inject ServerCommands into CoreEngine to break circular dependency
  registerServerCommands(ServerCommands);

  try {
    try {
      const electronApi = window.electronAPI;
      if (electronApi === undefined) {
        const sessionId = "renderer-fallback";
        Logger.init(sessionId);
        Logger.debug(LogCategory.SYSTEM, "Unified logger initialized", { sessionId });
      } else {
        const sessionId = await electronApi.logger.getSessionId();
        Logger.init(sessionId);
        Logger.debug(LogCategory.SYSTEM, "Unified logger initialized", { sessionId });
      }
    } catch (err) {
      console.error("[App] Logger init error:", err instanceof Error ? err.message : String(err));
    }

    setupUILogListener();
    Logger.debug(LogCategory.SYSTEM, "UI log listener setup complete");

    SplashScreen.update(10, "Ayarlar yükleniyor...");

    TrafficManager.init();

    await CoreEngine.init();
    SplashScreen.update(30, "Komutlar yükleniyor...");

    await MetaCommandManager.loadCommands();
    SplashScreen.update(40, "Odalar hazırlanıyor...");
    await RoomRegistry.loadInstalledRooms();
    SplashScreen.update(45, "Arayüz hazırlanıyor...");

    try {
      document.documentElement.setAttribute("spellcheck", "false");
      document.body.setAttribute("spellcheck", "false");
    } catch (e) {
      Logger.debug(LogCategory.SYSTEM, "Spellcheck disable failed", {
        error: getErrorMessage(e),
      });
    }
    injectPageTemplates();
    SplashScreen.update(50, "Modüller başlatılıyor...");

    try {
      window.__hayalet_settings_unsub ??= SettingsManager.subscribe(
        ({ changedPaths }: { changedPaths: string[] }) => {
          const shouldUpdateIndicators =
            changedPaths.includes("*") ||
            changedPaths.some(
              (path) =>
                path.startsWith("user") ||
                path.startsWith("accounts") ||
                path.startsWith("asistanAccounts") ||
                path.startsWith("slots") ||
                path.startsWith("asistanSlot")
            );

          if (!shouldUpdateIndicators) {
            return;
          }

          try {
            updateIndicatorAvatars();
          } catch (_) {
            void 0;
          }
        }
      );
    } catch (_) {
      Logger.debug(LogCategory.SYSTEM, "Settings subscription failed", {
        error: getErrorMessage(_),
      });
    }

    await initControllers(controllers);
    setControllers(controllers);

    window.SlotController = SlotController;
    window.WebviewManager = WebviewManager;
    window.AppState = AppState;
    window.ConversationListManager = ConversationListManager;

    registerWebviews();

    const entranceController = controllers["entrance"] as
      | { applyDefaultConnections?: () => void }
      | undefined;
    entranceController?.applyDefaultConnections?.();

    setupNavigation();
    setupWindowControls();
    setupTopBarButtons();
    setupRoomOverlay(controllers);
    setupTopBarRelayButtons();
    setupReportPanel();

    SplashScreen.update(90, "Son hazırlıklar...");

    // Startup flag kontrolü: --start-page ve --auto-connect argümanları
    const startupFlags = window.electronAPI?.["getStartupFlags"]?.() as
      | { startPage: string | null; autoConnect: boolean }
      | undefined;
    const startPage = startupFlags?.startPage ?? "entrance";
    const autoConnect = startupFlags?.autoConnect ?? false;

    showPage(startPage);
    updateIndicatorAvatars();
    updateRelayIndicator();
    AppState.subscribe(() => {
      updateIndicatorAvatars();
      updateRelayIndicator();
    });

    SlotController.on(SlotEvent.STATE_CHANGED, () => {
      updateIndicatorAvatars();
      updateRelayIndicator();
      updateRelayButtonStates(); // Update relay button states on slot connection changes
    });

    Logger.panel(LogCategory.SYSTEM, LogLevel.INFO, "Uygulama başlatıldı", {
      visibility: LogVisibility.PANEL,
    });

    SplashScreen.complete();
    await SplashScreen.hide();

    // --auto-connect: Asistan sayfasındaysa bağlan butonuna otomatik tıkla
    if (autoConnect && startPage === "asistan") {
      setTimeout(() => {
        const connectBtn = document.getElementById(
          "asistan-connect-btn"
        ) as HTMLButtonElement | null;
        if (connectBtn !== null && !connectBtn.disabled) {
          connectBtn.click();
          Logger.panel(
            LogCategory.SYSTEM,
            LogLevel.INFO,
            "Auto-connect: asistan bağlan butonuna tıklandı",
            {
              visibility: LogVisibility.PANEL,
            }
          );
        }
      }, 500);
    }

    initSucceeded = true;
    isInitialized = true;
  } catch (error) {
    const message = getErrorMessage(error);
    console.error("[App] initApp failed:", message);
    try {
      Logger.error(LogCategory.SYSTEM, `[app:init] ${message}`, {
        error: error instanceof Error ? error : new Error(String(error)),
      });
    } catch {
      void 0;
    }
    try {
      SplashScreen.show();
      SplashScreen.setStatus("Başlatma hatası");
      SplashScreen.setProgress(100);
      await SplashScreen.hide();
    } catch {
      void 0;
    }
  } finally {
    isInitializing = false;
    if (!initSucceeded) {
      isInitialized = false;
    }
  }
}

export { showPage, getCurrentPage } from "./navigation.js";

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => void initApp());
} else {
  void initApp();
}
