/**
 * App Entry Point - Orchestrator
 *
 * Coordinates all modules and manages the application lifecycle.
 * Each module keeps its own implementation details in its own file.
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
import { AppI18n } from "../modules/i18n/index.js";
import { SplashScreen } from "../ui/splash-screen.js";
import { isAssistantAccountsSettingsPath, isAssistantSlotSettingsPath } from "@shared/settings.js";

import type { PageController } from "./types.js";
import { ensureElectronApiFallback } from "./electron-fallback.js";
import { applyShellStaticTranslations, bootstrapShellI18n } from "./shell-i18n.js";
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

// Extend the Window interface for shared module access.
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
  // Prevent duplicate initialization.
  if (isInitializing || isInitialized) {
    console.warn(AppI18n.t("app.logs.initSkippedDuplicate"));
    return;
  }

  isInitializing = true;
  let initSucceeded = false;

  // Inject ServerCommands into CoreEngine to break the circular dependency.
  registerServerCommands(ServerCommands);

  try {
    try {
      const electronApi = window.electronAPI;
      if (electronApi === undefined) {
        const sessionId = "renderer-fallback";
        Logger.init(sessionId);
        Logger.debugT(LogCategory.SYSTEM, "app.logs.loggerInitialized", undefined, { sessionId });
      } else {
        const sessionId = await electronApi.logger.getSessionId();
        Logger.init(sessionId);
        Logger.debugT(LogCategory.SYSTEM, "app.logs.loggerInitialized", undefined, { sessionId });
      }
    } catch (err) {
      console.error(
        AppI18n.t("app.logs.loggerInitError", {
          message: err instanceof Error ? err.message : String(err),
        })
      );
    }

    setupUILogListener();
    Logger.debugT(LogCategory.SYSTEM, "app.logs.uiLogListenerReady");

    await SettingsManager.load();
    await AppI18n.bootstrap(SettingsManager);
    bootstrapShellI18n();

    SplashScreen.update(10, AppI18n.t("app.startup.loadingSettings"));

    TrafficManager.init();

    await CoreEngine.init();
    SplashScreen.update(30, AppI18n.t("app.startup.loadingCommands"));

    await MetaCommandManager.loadCommands();
    SplashScreen.update(40, AppI18n.t("app.startup.loadingRooms"));
    await RoomRegistry.loadInstalledRooms();
    SplashScreen.update(45, AppI18n.t("app.startup.preparingUi"));

    try {
      document.documentElement.setAttribute("spellcheck", "false");
      document.body.setAttribute("spellcheck", "false");
    } catch (e) {
      Logger.debugT(
        LogCategory.SYSTEM,
        "app.logs.spellcheckDisableFailed",
        { message: getErrorMessage(e) },
        {
          error: getErrorMessage(e),
        }
      );
    }
    injectPageTemplates();
    applyShellStaticTranslations();
    SplashScreen.update(50, AppI18n.t("app.startup.startingModules"));

    try {
      window.__app_settings_unsub ??= SettingsManager.subscribe(
        ({ changedPaths }: { changedPaths: string[] }) => {
          const shouldUpdateIndicators =
            changedPaths.includes("*") ||
            changedPaths.some(
              (path) =>
                path.startsWith("user") ||
                path.startsWith("accounts") ||
                isAssistantAccountsSettingsPath(path) ||
                path.startsWith("slots") ||
                isAssistantSlotSettingsPath(path)
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
      Logger.debugT(
        LogCategory.SYSTEM,
        "app.logs.settingsSubscriptionFailed",
        { message: getErrorMessage(_) },
        {
          error: getErrorMessage(_),
        }
      );
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

    SplashScreen.update(90, AppI18n.t("app.startup.finalizing"));

    // Startup flag handling: --start-page and --auto-connect arguments.
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

    Logger.panelT(LogCategory.SYSTEM, LogLevel.INFO, "app.logs.appStarted", undefined, {
      visibility: LogVisibility.PANEL,
    });

    SplashScreen.complete();
    await SplashScreen.hide();

    // --auto-connect: click the assistant connect button automatically on the assistant page.
    if (autoConnect && startPage === "assistant") {
      setTimeout(() => {
        const connectBtn = document.getElementById(
          "assistant-connect-btn"
        ) as HTMLButtonElement | null;
        if (connectBtn !== null && !connectBtn.disabled) {
          connectBtn.click();
          Logger.panelT(
            LogCategory.SYSTEM,
            LogLevel.INFO,
            "app.logs.autoConnectClicked",
            undefined,
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
    console.error(AppI18n.t("app.logs.appInitFailed", { message }));
    try {
      Logger.errorT(
        LogCategory.SYSTEM,
        "app.logs.appInitFailed",
        { message },
        {
          error: error instanceof Error ? error : new Error(String(error)),
        }
      );
    } catch {
      void 0;
    }
    try {
      SplashScreen.show();
      SplashScreen.setStatus(AppI18n.t("app.startup.startupError"));
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
