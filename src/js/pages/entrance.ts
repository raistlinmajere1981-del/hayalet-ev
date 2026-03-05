import { Logger } from "../modules/logger/index.js";
import type { LogEntry } from "@shared/logging-core";
import { LogCategory, LogLevel } from "@shared/logging-core";
import { getErrorMessage } from "@shared/index.js";
import { SettingsManager } from "../modules/settings-manager.js";
import { MAX_LOGS_TERMINAL, MAX_LOGS_SERVER } from "@limits";

import type { AppSettings } from "@shared/settings.js";
import { AppState } from "../modules/app-state.js";
import { CoreEngine } from "../modules/core-engine.js";
import { SlotController, SlotEvent } from "../modules/slot-controller.js";
import { TrafficManager } from "../modules/traffic-manager.js";
import { getMimeTypeFromPath } from "../constants/index.js";
import { ButtonStates } from "../ui/button-states.js";

import { UserPanel } from "./entrance/user-panel.js";
import { SlotPanel } from "./entrance/slot-panel.js";
import { AccountPanel } from "./entrance/account-panel.js";
import { WhisperPanel } from "./entrance/whisper-panel.js";
import { WebviewPanel } from "./entrance/webview-panel.js";

export class EntranceHallController {
  defaultsApplied: boolean;
  userPanel: UserPanel;
  slotPanelAi1: SlotPanel;
  slotPanelAi2: SlotPanel;
  accountPanel: AccountPanel;
  whisperPanel: WhisperPanel;
  webviewPanel: WebviewPanel;
  _unsubSettings: (() => void) | null = null;
  _unsubSlotController: (() => void) | null = null;

  constructor() {
    this.defaultsApplied = false;

    this.userPanel = new UserPanel(SettingsManager);
    this.slotPanelAi1 = new SlotPanel("ai1", SettingsManager);
    this.slotPanelAi2 = new SlotPanel("ai2", SettingsManager);
    this.accountPanel = new AccountPanel(SettingsManager);
    this.whisperPanel = new WhisperPanel();
    this.webviewPanel = new WebviewPanel();
  }

  async init(): Promise<void> {
    this.userPanel.init();
    this.slotPanelAi1.init();
    this.slotPanelAi2.init();
    this.accountPanel.init();
    this.whisperPanel.init();
    this.webviewPanel.init();

    this.setupEventListeners();
    this.setupLogArea(); // Aşama 2: Log area for Level 1-2
    this.setupLiveLogOverlay(); // Aşama 3: Live overlay for Level 1-2-3
    await this.loadUserSettings();
    this.updateUI();

    await this.webviewPanel.setupWebviews();
    this.webviewPanel.applyGating(SettingsManager.getSnapshot(), ["*"]);
    this.webviewPanel.updateUrlDisplay("ai1", TrafficManager.state["ai1"]);
    this.webviewPanel.updateUrlDisplay("ai2", TrafficManager.state["ai2"]);
    this.webviewPanel.subscribeToTraffic();

    this._unsubSettings ??= SettingsManager.subscribe(
      ({ settings, changedPaths }: { settings: unknown; changedPaths: string[] }) => {
        const typedSettings = settings as AppSettings;
        const shouldApplyIdentityUi =
          changedPaths.includes("*") ||
          changedPaths.some(
            (path) =>
              path.startsWith("user") ||
              path.startsWith("accounts") ||
              path.startsWith("asistanAccounts") ||
              path.startsWith("slots") ||
              path.startsWith("asistanSlot")
          );

        if (shouldApplyIdentityUi) {
          this.applySettingsToUI(typedSettings, changedPaths);
        }

        const shouldApplyWebviewGating =
          changedPaths.includes("*") ||
          changedPaths.some((path) => path.startsWith("slots") || path.startsWith("accounts"));

        if (shouldApplyWebviewGating) {
          this.webviewPanel.applyGating(typedSettings, changedPaths);
        }

        if (changedPaths.includes("*") || changedPaths.some((p) => p.startsWith("accounts"))) {
          this.accountPanel.render();
          this.slotPanelAi1.render();
          this.slotPanelAi2.render();
        }
        if (changedPaths.includes("*") || changedPaths.some((p) => p.startsWith("user"))) {
          this.userPanel.render();
        }
      }
    );

    this._unsubSlotController ??= SlotController.on(SlotEvent.STATE_CHANGED, () => {
      this.webviewPanel.applyGating(SettingsManager.getSnapshot(), ["*"]);
    });
  }

  setupEventListeners(): void {
    try {
      ["ai1", "ai2"].forEach((u) => {
        const btn = document.getElementById(`${u}-toggle-btn`);
        if (btn) {
          btn.addEventListener("click", () => {
            void (async (): Promise<void> => {
              if (SlotController.isConnected(u) === true) await this.disconnectUser(u);
              else await this.connectUser(u);
            })();
          });
        }
      });

      const accordionToggle = document.getElementById("settings-accordion-toggle");
      const accordionContent = document.getElementById("settings-accordion-content");
      if (accordionToggle && accordionContent) {
        accordionToggle.addEventListener("click", () => {
          const isOpen = accordionContent.classList.contains("open");
          accordionContent.classList.toggle("open");
          accordionToggle.setAttribute("aria-expanded", String(!isOpen));
        });
      }
    } catch (error) {
      Logger.error(LogCategory.ENTRANCE, `Event listener setup hatası: ${getErrorMessage(error)}`);
    }
  }

  setupReportPanel(): void {
    const reportModalOpen = document.getElementById("report-modal-open");
    const modal = document.getElementById("report-modal");
    const modalBody = document.getElementById("report-modal-body");
    const modalClose = document.getElementById("report-modal-close");
    const entranceReportContent = document.getElementById("entrance-report-content");

    const createLogElement = (entry: LogEntry, showVisibility = false): HTMLDivElement => {
      const line = document.createElement("div");
      line.className = "log-entry";
      const visibility = entry.visibility ?? 3;
      const visibilityBadge = showVisibility ? `[L${visibility}] ` : "";
      const source = entry.category;
      line.textContent = `[${entry.timestamp}] ${visibilityBadge}[${source}] ${entry.message}`;
      if (visibility === 1) line.classList.add("log-toast");
      else if (visibility === 2) line.classList.add("log-panel");
      return line;
    };

    const openModal = (): void => {
      if (!modal || !modalBody) return;
      modalBody.innerHTML = "";
      const all = Logger.getRecentLogs(500); // Get all recent logs
      [...all].reverse().forEach((entry) => {
        modalBody.appendChild(createLogElement(entry, true));
      });
      modal.classList.remove("hidden");
    };

    const closeModal = (): void => modal?.classList.add("hidden");

    reportModalOpen?.addEventListener("click", openModal);
    modal?.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
    modalClose?.addEventListener("click", closeModal);

    if (entranceReportContent) {
      entranceReportContent.innerHTML = "";
      const panelLogs = Logger.getRecentLogs(200).filter(
        (e) => e.visibility !== undefined && e.visibility <= 2
      );
      [...panelLogs].reverse().forEach((entry) => {
        entranceReportContent.appendChild(createLogElement(entry));
      });
    }

    Logger.subscribe((entry) => {
      if (entranceReportContent && (entry.visibility ?? 3) <= 2) {
        const logEntry = createLogElement(entry);
        if (entranceReportContent.firstChild) {
          entranceReportContent.insertBefore(logEntry, entranceReportContent.firstChild);
        } else {
          entranceReportContent.appendChild(logEntry);
        }
      }

      const modalIsOpen = modal?.classList.contains("hidden") === false;
      if (modalBody && modalIsOpen) {
        const modalLine = createLogElement(entry, true);
        if (modalBody.firstChild) {
          modalBody.insertBefore(modalLine, modalBody.firstChild);
        } else {
          modalBody.appendChild(modalLine);
        }
      }
    });
  }

  async loadUserSettings(): Promise<void> {
    try {
      const settings = await SettingsManager.load();
      this.applySettingsToUI(settings, ["*"] as string[]);
    } catch (error) {
      Logger.error(LogCategory.ENTRANCE, `Settings yükleme hatası: ${getErrorMessage(error)}`);
    }
  }

  applySettingsToUI(_settings: AppSettings, _changedPaths: string[] = []): void {
    const ai1Nickname = AppState.getNickname("ai1");
    const ai2Nickname = AppState.getNickname("ai2");

    const ai1NickEl = document.getElementById("ai1-nickname");
    const ai2NickEl = document.getElementById("ai2-nickname");

    if (ai1NickEl) ai1NickEl.textContent = ai1Nickname;
    if (ai2NickEl) ai2NickEl.textContent = ai2Nickname;

    const getAvatar = (provider: string): string => AppState.getAvatar(provider);
    void this.updateAvatar("user", getAvatar("user"));
    void this.updateAvatar("ai1", getAvatar("ai1"));
    void this.updateAvatar("ai2", getAvatar("ai2"));

    this.updateUI();
  }

  async updateAvatar(userType: string, avatarPath: string | null): Promise<void> {
    const avatarElement = document.getElementById(`${userType}-avatar`);
    if (!avatarElement) return;

    const electronApi = window.electronAPI;
    if (!electronApi?.readFile) {
      avatarElement.innerHTML = "";
      avatarElement.style.backgroundImage = "";
      return;
    }

    const candidates =
      userType === "user" ? ["src/assets/user.png", "src/assets/default.png"] : [avatarPath ?? ""];

    const uniqueCandidates = candidates.filter(
      (candidate, index, arr) => candidate !== "" && arr.indexOf(candidate) === index
    );

    try {
      const tryLoadCandidate = async (index: number): Promise<boolean> => {
        const candidate = uniqueCandidates[index];
        if (candidate === undefined) {
          return false;
        }

        const imageData = await electronApi.readFile(candidate);
        if (typeof imageData !== "string" || imageData === "") {
          return await tryLoadCandidate(index + 1);
        }

        const mimeType = getMimeTypeFromPath(candidate);
        avatarElement.innerHTML = ``;
        avatarElement.style.backgroundImage = `url(data:${mimeType};base64,${imageData})`;
        return true;
      };

      const loaded = await tryLoadCandidate(0);
      if (!loaded) {
        avatarElement.innerHTML = "";
        avatarElement.style.backgroundImage = "";
      }
    } catch (error) {
      Logger.error(LogCategory.ENTRANCE, `Avatar yükleme hatası: ${getErrorMessage(error)}`, {
        context: { userType },
      });

      avatarElement.innerHTML = "";
      avatarElement.style.backgroundImage = "";
    }
  }

  async connectUser(userType: string): Promise<void> {
    const settings = await SettingsManager.load();
    const currentlyConnected = SlotController.isConnected(userType) === true;

    if (currentlyConnected) return;
    if (userType === "user") return;

    const toggleBtn = document.getElementById(`${userType}-toggle-btn`) as HTMLButtonElement | null;
    const nickname = AppState.getNickname(userType);

    if (toggleBtn) {
      ButtonStates.setLoading(toggleBtn, "Bağlanıyor...");
    }

    Logger.info(LogCategory.ENTRANCE, `${nickname} bağlanıyor...`);

    const accountId = settings.slots[userType]?.accountId;
    const hasAccount = accountId !== undefined && accountId !== null && accountId !== "";
    if (!hasAccount) {
      if (toggleBtn) {
        ButtonStates.setError(toggleBtn, "Hesap Yok!", 1500);
      }
      this.updateUserStatus(userType);
      Logger.warn(LogCategory.ENTRANCE, `${userType} connect blocked: no account assigned`);
      return;
    }

    const resumeUrl = this.getResumeUrlForSlot(userType, settings);
    const result = await CoreEngine.setConnection(userType, true, {
      ...(resumeUrl !== "" ? { url: resumeUrl } : {}),
    });

    if (result.success) {
      if (toggleBtn) {
        ButtonStates.setSuccess(toggleBtn, "Bağlandı!", 1500);
      }
      Logger.success(LogCategory.ENTRANCE, `${nickname} bağlandı`);
      await this.updateRememberedConnectionState(userType as "ai1" | "ai2", "connected");
    } else {
      if (toggleBtn) {
        ButtonStates.setError(toggleBtn, "Hata!", 1500);
      }
      Logger.panel(
        LogCategory.ENTRANCE,
        LogLevel.ERROR,
        `${nickname} bağlantı hatası: ${result.message ?? "bilinmeyen"}`
      );
    }

    setTimeout(() => {
      this.updateUserStatus(userType);
    }, 1600);
  }

  getResumeUrlForSlot(userType: string, settings: AppSettings): string {
    if (userType !== "ai1" && userType !== "ai2") {
      return "";
    }

    const slotSettings = settings.slots[userType];
    if (slotSettings.resumeLastSession !== true) {
      return "";
    }

    const accountId = slotSettings.accountId;
    if (accountId === null || accountId === "") {
      return "";
    }

    const account = settings.accounts.find((item) => item.id === accountId);
    const lastSessionUrl = account?.lastSessionUrl;
    if (typeof lastSessionUrl !== "string" || lastSessionUrl === "") {
      return "";
    }

    return lastSessionUrl;
  }

  async disconnectUser(userType: string): Promise<void> {
    if (userType === "user") return;
    const currentlyConnected = SlotController.isConnected(userType) === true;
    if (!currentlyConnected) return;

    const toggleBtn = document.getElementById(`${userType}-toggle-btn`) as HTMLButtonElement | null;
    const nickname = AppState.getNickname(userType);

    if (toggleBtn) {
      ButtonStates.setLoading(toggleBtn, "Kesiliyor...");
    }

    Logger.debug(LogCategory.ENTRANCE, `${nickname} bağlantısı kesiliyor...`);

    const result = await CoreEngine.setConnection(userType, false, {});

    if (result.success) {
      if (toggleBtn) {
        ButtonStates.setSuccess(toggleBtn, "Kesildi!", 1500);
      }
      Logger.panel(LogCategory.ENTRANCE, LogLevel.INFO, `${nickname} bağlantısı kesildi`);
      await this.updateRememberedConnectionState(userType as "ai1" | "ai2", "disconnected");
    } else {
      if (toggleBtn) {
        ButtonStates.setError(toggleBtn, "Hata!", 1500);
      }
      Logger.panel(
        LogCategory.ENTRANCE,
        LogLevel.ERROR,
        `${nickname} bağlantı kesme hatası: ${result.message ?? "bilinmeyen"}`
      );
    }

    setTimeout(() => {
      this.updateUserStatus(userType);
    }, 1600);
  }

  updateUserStatus(userType: string): void {
    const statusDot = document.getElementById(`${userType}-status-dot`);
    const statusText = document.getElementById(`${userType}-status-text`);
    const toggleBtn = document.getElementById(`${userType}-toggle-btn`);
    const avatarEl = document.getElementById(`${userType}-avatar`);

    if (userType === "user") {
      if (avatarEl) avatarEl.style.opacity = "1";
      return;
    }

    const hasAccount = !!AppState.getAccountForSlot(userType);
    const connected = SlotController.isConnected(userType) === true;

    if (avatarEl) {
      avatarEl.style.opacity = hasAccount && !connected ? "0.5" : "1";
    }

    if (statusDot) {
      if (!hasAccount) {
        statusDot.classList.remove("connected");
        statusDot.style.backgroundColor = "#999";
      } else if (connected) {
        statusDot.classList.add("connected");
        statusDot.style.backgroundColor = "#4CAF50";
      } else {
        statusDot.classList.remove("connected");
        statusDot.style.backgroundColor = "#FFA726";
      }
    }

    if (statusText) {
      statusText.textContent = !hasAccount ? "Hesap yok" : connected ? "Bağlı" : "Bağlı değil";
    }

    if (toggleBtn) {
      const btn = toggleBtn as HTMLButtonElement;
      if (!hasAccount) {
        btn.textContent = "Hesap Seçin";
        btn.disabled = true;
      } else if (connected) {
        btn.textContent = "Bağlantıyı Kes";
        btn.disabled = false;
        btn.classList.remove("btn-primary");
        btn.classList.add("btn-secondary");
      } else {
        btn.textContent = "Bağlan";
        btn.disabled = false;
        btn.classList.remove("btn-secondary");
        btn.classList.add("btn-primary");
      }
    }
  }

  updateUI(): void {
    ["user", "ai1", "ai2"].forEach((userType) => {
      this.updateUserStatus(userType);
    });
    void this.whisperPanel.render();
  }

  async onShow(): Promise<void> {
    await this.loadUserSettings();
    this.updateUI();
  }

  onHide(): void {
    CoreEngine.resumeWhispers(true);
  }

  async updateRememberedConnectionState(
    slotId: "ai1" | "ai2",
    state: "connected" | "disconnected"
  ): Promise<void> {
    const settings = SettingsManager.getSnapshot();
    const slotSettings = settings.slots[slotId];

    if (slotSettings.rememberConnectionStatus !== true) {
      return;
    }
    if (slotSettings.lastConnectionState === state) {
      return;
    }

    await SettingsManager.save({
      ...settings,
      slots: {
        ...settings.slots,
        [slotId]: {
          ...slotSettings,
          lastConnectionState: state,
        },
      },
    });
  }

  shouldAutoConnectSlot(slotId: "ai1" | "ai2", settings: AppSettings): boolean {
    const slotSettings = settings.slots[slotId];
    const hasAssignedAccount = slotSettings.accountId !== null && slotSettings.accountId !== "";

    return (
      hasAssignedAccount &&
      slotSettings.rememberConnectionStatus === true &&
      slotSettings.lastConnectionState === "connected"
    );
  }

  applyDefaultConnections(): void {
    this.defaultsApplied = true;
    const settings = SettingsManager.getSnapshot();

    (["ai1", "ai2"] as const).forEach((slotId) => {
      if (!this.shouldAutoConnectSlot(slotId, settings)) {
        return;
      }
      if (SlotController.isConnected(slotId) === true) {
        return;
      }

      const hasRegisteredWebview = SlotController.getWebview(slotId) !== null;
      if (!hasRegisteredWebview) {
        return;
      }

      const toggleBtn = document.getElementById(`${slotId}-toggle-btn`) as HTMLButtonElement | null;
      if (!toggleBtn || toggleBtn.disabled) {
        return;
      }

      queueMicrotask(() => {
        toggleBtn.click();
      });
    });
  }

  setupLogArea(): void {
    if (!window.electronAPI?.ipcRenderer) {
      Logger.warn(LogCategory.ENTRANCE, "IPC not available for log area");
      return;
    }

    const logContainer = document.getElementById("entrance-report-content");
    if (!logContainer) {
      Logger.debug(LogCategory.ENTRANCE, "Log container not found");
      return;
    }

    const MAX_LOGS = MAX_LOGS_TERMINAL;
    let logCount = 0;

    const logHandler = (
      _event: unknown,
      logData: {
        level: string;
        category: string;
        message: string;
        timestamp: string;
        visibility?: number;
        context?: Record<string, unknown>;
      }
    ): void => {
      const visibility = logData.visibility ?? 3;
      if (visibility > 2) {
        return;
      }

      const logEntry = document.createElement("div");
      logEntry.className = `log-entry log-level-${logData.level}`;

      const time = new Date(logData.timestamp).toLocaleTimeString("tr-TR");
      const category = this.formatLogCategory(logData.category);

      logEntry.innerHTML = `
        <span class="log-time">${time}</span>
        <span class="log-level log-level-badge-${logData.level}">${logData.level.toUpperCase()}</span>
        <span class="log-category">${category}</span>
        <span class="log-message">${this.escapeHtml(logData.message)}</span>
      `;

      logContainer.appendChild(logEntry);
      logCount++;

      if (logCount > MAX_LOGS) {
        const firstLog = logContainer.querySelector(".log-entry");
        if (firstLog) {
          firstLog.remove();
          logCount--;
        }
      }

      logContainer.scrollTop = logContainer.scrollHeight;
    };

    window.electronAPI.ipcRenderer.on("log:ui-notify", logHandler as (...args: unknown[]) => void);

    Logger.info(LogCategory.ENTRANCE, "Log area setup complete");
  }

  formatLogCategory(category: string): string {
    if (category === "") return "System";

    const cleaned = category
      .replace(/^(WEBVIEW|SLOT|TRAFFIC|ASISTAN|OPENCODE|DATABASE)_/, "$1: ")
      .replace(/_/g, " ")
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    return cleaned;
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  setupLiveLogOverlay(): void {
    const electronApi = window.electronAPI;
    if (electronApi == null) {
      Logger.warn(LogCategory.ENTRANCE, "IPC/filesystem bridge not available for live overlay");
      return;
    }

    type OverlayApp = "hayalet-ev" | "mcp-server" | "ghost-agent";

    interface OverlayLogEntry {
      id: string;
      app: OverlayApp;
      sessionId: string;
      timestamp: string;
      level: string;
      category: string;
      message: string;
      source: string;
      visibility?: number;
      correlationId?: string;
      context?: Record<string, unknown>;
    }

    const overlay = document.getElementById("live-log-overlay");
    const overlayBackdrop = document.getElementById("live-log-backdrop");
    const overlayContent = document.getElementById("live-log-content");
    const openBtn = document.getElementById("report-modal-open");
    const closeBtn = document.getElementById("live-log-close");
    const pauseBtn = document.getElementById("live-log-pause");
    const clearBtn = document.getElementById("live-log-clear");
    const appTabs = document.getElementById("live-log-app-tabs");
    const sessionSelect = document.getElementById(
      "live-log-session-select"
    ) as HTMLSelectElement | null;
    const levelSelect = document.getElementById(
      "live-log-level-select"
    ) as HTMLSelectElement | null;
    const searchInput = document.getElementById("live-log-search") as HTMLInputElement | null;
    const metrics = document.getElementById("live-log-metrics");
    const detailMeta = document.getElementById("live-log-meta");
    const detailContext = document.getElementById("live-log-context");

    if (
      !overlay ||
      !overlayBackdrop ||
      !overlayContent ||
      !openBtn ||
      !closeBtn ||
      !pauseBtn ||
      !clearBtn ||
      !appTabs ||
      !sessionSelect ||
      !levelSelect ||
      !searchInput ||
      !metrics ||
      !detailMeta ||
      !detailContext
    ) {
      Logger.debug(LogCategory.ENTRANCE, "Advanced live overlay elements not found");
      return;
    }

    const appButtons = Array.from(appTabs.querySelectorAll<HTMLButtonElement>("button[data-app]"));
    const MAX_LOGS = Math.max(MAX_LOGS_SERVER * 20, 500);
    const POLL_INTERVAL_MS = 2000;

    const state = {
      activeApp: "hayalet-ev" as OverlayApp,
      paused: false,
      baseLogsDir: "",
      entriesByApp: {
        "hayalet-ev": [],
        "mcp-server": [],
        "ghost-agent": [],
      } as Record<OverlayApp, OverlayLogEntry[]>,
      sessionsByApp: {
        "hayalet-ev": [],
        "mcp-server": [],
        "ghost-agent": [],
      } as Record<OverlayApp, string[]>,
      selectedSessionByApp: {
        "hayalet-ev": "",
        "mcp-server": "",
        "ghost-agent": "",
      } as Record<OverlayApp, string>,
      lastFingerprintByApp: {
        "hayalet-ev": "",
        "mcp-server": "",
        "ghost-agent": "",
      } as Record<OverlayApp, string>,
      selectedEntryId: "",
      pollTimer: null as ReturnType<typeof setInterval> | null,
    };

    const isRecord = (value: unknown): value is Record<string, unknown> => {
      return typeof value === "object" && value !== null;
    };

    const asText = (value: unknown): string => {
      return typeof value === "string" ? value : "";
    };

    const asRecord = (value: unknown): Record<string, unknown> | undefined => {
      return isRecord(value) ? value : undefined;
    };

    const joinPath = (...parts: string[]): string => {
      return parts
        .filter((part) => part !== "")
        .map((part, index) => {
          if (index === 0) {
            return part.replace(/[\\/]+$/g, "");
          }
          return part.replace(/^[\\/]+|[\\/]+$/g, "");
        })
        .join("/");
    };

    const decodeBase64ToUtf8 = (base64: string): string => {
      try {
        const binary = atob(base64);
        const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
        return new TextDecoder().decode(bytes);
      } catch {
        return "";
      }
    };

    const normalizeLogEntry = (
      app: OverlayApp,
      fallbackSessionId: string,
      raw: Record<string, unknown>
    ): OverlayLogEntry | null => {
      const rawTimestamp = asText(raw["timestamp"]);
      const fallbackTimestamp = asText(raw["isoTimestamp"]);
      const timestamp = rawTimestamp !== "" ? rawTimestamp : fallbackTimestamp;
      const message = asText(raw["message"]);

      if (timestamp === "" || message === "") {
        return null;
      }

      const rawLevel = asText(raw["level"]);
      const fallbackLevel = asText(raw["type"]);
      const levelRaw = rawLevel !== "" ? rawLevel : fallbackLevel;
      const level = levelRaw !== "" ? levelRaw.toLowerCase() : "info";
      const rawCategory = asText(raw["category"]);
      const category = rawCategory !== "" ? rawCategory : "system";
      const rawSource = asText(raw["source"]);
      const source = rawSource !== "" ? rawSource : app;
      const rawSessionId = asText(raw["sessionId"]);
      const sessionId = rawSessionId !== "" ? rawSessionId : fallbackSessionId;
      const correlationId = asText(raw["correlationId"]);

      const visibilityValue = raw["visibility"];
      const visibility = typeof visibilityValue === "number" ? visibilityValue : undefined;

      const context = asRecord(raw["context"]) ?? asRecord(raw["meta"]);
      const id = `${app}|${sessionId}|${timestamp}|${source}|${category}|${message}`;

      return {
        id,
        app,
        sessionId,
        timestamp,
        level,
        category,
        message,
        source,
        ...(visibility !== undefined ? { visibility } : {}),
        ...(correlationId !== "" ? { correlationId } : {}),
        ...(context !== undefined ? { context } : {}),
      };
    };

    const setActiveTabUI = (): void => {
      appButtons.forEach((button) => {
        const isActive = button.dataset["app"] === state.activeApp;
        button.classList.toggle("is-active", isActive);
      });
    };

    const setPauseButtonUI = (): void => {
      pauseBtn.textContent = state.paused ? "Resume" : "Pause";
      pauseBtn.classList.toggle("is-active", state.paused);
    };

    const renderDetail = (entry: OverlayLogEntry | null): void => {
      if (entry === null) {
        detailMeta.textContent = "No entry selected";
        detailContext.textContent = "";
        return;
      }

      const when = new Date(entry.timestamp).toLocaleString("tr-TR");
      const correlation = entry.correlationId ?? "-";
      detailMeta.textContent =
        `app=${entry.app} | session=${entry.sessionId} | level=${entry.level} | ` +
        `source=${entry.source} | category=${entry.category} | ts=${when} | corr=${correlation}`;
      detailContext.textContent =
        entry.context !== undefined ? JSON.stringify(entry.context, null, 2) : "No context";
    };

    const renderEntries = (): void => {
      const allEntries = state.entriesByApp[state.activeApp];
      const levelFilter = levelSelect.value;
      const searchFilter = searchInput.value.trim().toLowerCase();

      const filtered = allEntries.filter((entry) => {
        if (levelFilter !== "all" && entry.level !== levelFilter) {
          return false;
        }

        if (searchFilter === "") {
          return true;
        }

        const haystack =
          `${entry.message} ${entry.category} ${entry.source} ${entry.sessionId}`.toLowerCase();
        return haystack.includes(searchFilter);
      });

      metrics.textContent = `${filtered.length} / ${allEntries.length} entries`;
      overlayContent.innerHTML = "";

      if (filtered.length === 0) {
        const empty = document.createElement("div");
        empty.className = "log-empty-state";
        empty.textContent = "Log bulunamadi";
        overlayContent.appendChild(empty);
        renderDetail(null);
        return;
      }

      const fragment = document.createDocumentFragment();
      filtered.slice(0, MAX_LOGS).forEach((entry) => {
        const row = document.createElement("div");
        row.className =
          `log-entry log-level-${entry.level}` +
          (entry.id === state.selectedEntryId ? " is-selected" : "");
        row.dataset["entryId"] = entry.id;

        const time = new Date(entry.timestamp).toLocaleTimeString("tr-TR");
        const category = this.formatLogCategory(entry.category);
        const safeLevel = this.escapeHtml(entry.level.toUpperCase());

        row.innerHTML = `
          <div class="log-entry-header">
            <span class="log-time">${this.escapeHtml(time)}</span>
            <span class="log-level log-level-badge-${entry.level}">${safeLevel}</span>
            <span class="log-app">${this.escapeHtml(entry.app)}</span>
            <span class="log-category">${this.escapeHtml(category)}</span>
          </div>
          <div class="log-message">${this.escapeHtml(entry.message)}</div>
        `;

        row.addEventListener("click", () => {
          state.selectedEntryId = entry.id;
          renderEntries();
          renderDetail(entry);
        });

        fragment.appendChild(row);
      });

      overlayContent.appendChild(fragment);

      const selected = filtered.find((entry) => entry.id === state.selectedEntryId) ?? null;
      renderDetail(selected);
    };

    const appendEntries = (app: OverlayApp, incoming: OverlayLogEntry[]): void => {
      if (incoming.length === 0) {
        return;
      }

      const merged = [...incoming, ...state.entriesByApp[app]];
      const unique = new Map<string, OverlayLogEntry>();

      for (const entry of merged) {
        if (!unique.has(entry.id)) {
          unique.set(entry.id, entry);
        }
      }

      state.entriesByApp[app] = Array.from(unique.values())
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .slice(0, MAX_LOGS);
    };

    const ensureBaseLogsDir = async (): Promise<boolean> => {
      if (state.baseLogsDir !== "") {
        return true;
      }

      try {
        const pathsRaw = await electronApi.logger.getLogPaths();
        const hayaletLogDir =
          isRecord(pathsRaw) && typeof (pathsRaw as { logDir?: unknown }).logDir === "string"
            ? ((pathsRaw as { logDir?: unknown }).logDir as string)
            : "";

        if (hayaletLogDir === "") {
          return false;
        }

        const trimmed = hayaletLogDir.replace(/[\\/]hayalet-ev[\\/]?$/i, "");
        if (trimmed !== hayaletLogDir) {
          state.baseLogsDir = trimmed;
          return true;
        }

        const slashIndex = Math.max(
          hayaletLogDir.lastIndexOf("/"),
          hayaletLogDir.lastIndexOf("\\")
        );
        state.baseLogsDir = slashIndex > 0 ? hayaletLogDir.slice(0, slashIndex) : hayaletLogDir;
        return state.baseLogsDir !== "";
      } catch (error) {
        Logger.warn(
          LogCategory.ENTRANCE,
          `Base log path alinmadi: ${error instanceof Error ? error.message : String(error)}`
        );
        return false;
      }
    };

    const syncSessionSelect = (): void => {
      const sessions = state.sessionsByApp[state.activeApp];
      sessionSelect.innerHTML = "";

      if (sessions.length === 0) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "Session yok";
        sessionSelect.appendChild(option);
        sessionSelect.value = "";
        return;
      }

      sessions.forEach((sessionId) => {
        const option = document.createElement("option");
        option.value = sessionId;
        option.textContent = sessionId;
        sessionSelect.appendChild(option);
      });

      const selected = state.selectedSessionByApp[state.activeApp];
      if (selected !== "" && sessions.includes(selected)) {
        sessionSelect.value = selected;
      } else {
        const fallback = sessions[0] ?? "";
        state.selectedSessionByApp[state.activeApp] = fallback;
        sessionSelect.value = fallback;
      }
    };

    const loadSessions = async (app: OverlayApp): Promise<void> => {
      const ok = await ensureBaseLogsDir();
      if (!ok) {
        state.sessionsByApp[app] = [];
        return;
      }

      const appDir = joinPath(state.baseLogsDir, app);
      try {
        const entriesRaw = await electronApi.readDirectoryFiles(appDir);
        const entries = Array.isArray(entriesRaw) ? entriesRaw : [];

        const sessions = entries
          .filter((entry) => isRecord(entry) && entry["isDirectory"] === true)
          .map((entry) => asText((entry as Record<string, unknown>)["name"]))
          .filter((name) => name !== "" && !name.startsWith("."))
          .sort((a, b) => b.localeCompare(a));

        state.sessionsByApp[app] = sessions;

        const selected = state.selectedSessionByApp[app];
        if (selected === "" || !sessions.includes(selected)) {
          state.selectedSessionByApp[app] = sessions[0] ?? "";
        }
      } catch {
        state.sessionsByApp[app] = [];
        state.selectedSessionByApp[app] = "";
      }
    };

    const loadActiveSessionLogs = async (force = false): Promise<void> => {
      const app = state.activeApp;
      const sessionId = state.selectedSessionByApp[app];

      if (sessionId === "") {
        state.entriesByApp[app] = [];
        state.selectedEntryId = "";
        renderEntries();
        return;
      }

      const structuredPath = joinPath(state.baseLogsDir, app, sessionId, "structured.jsonl");
      const encoded = await electronApi.readFile(structuredPath);

      if (typeof encoded !== "string" || encoded === "") {
        if (force) {
          state.entriesByApp[app] = [];
          state.selectedEntryId = "";
          renderEntries();
        }
        return;
      }

      const content = decodeBase64ToUtf8(encoded);
      const fingerprint = `${content.length}:${content.slice(-160)}`;

      if (!force && fingerprint === state.lastFingerprintByApp[app]) {
        return;
      }

      state.lastFingerprintByApp[app] = fingerprint;

      const parsed = content
        .split("\n")
        .filter((line) => line.trim() !== "")
        .map((line) => {
          try {
            const raw = JSON.parse(line) as unknown;
            return isRecord(raw) ? normalizeLogEntry(app, sessionId, raw) : null;
          } catch {
            return null;
          }
        })
        .filter((entry): entry is OverlayLogEntry => entry !== null)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .slice(0, MAX_LOGS);

      state.entriesByApp[app] = parsed;
      renderEntries();
    };

    const refreshActiveApp = async (forceLogs = false): Promise<void> => {
      await loadSessions(state.activeApp);
      syncSessionSelect();
      await loadActiveSessionLogs(forceLogs);
    };

    const stopPolling = (): void => {
      if (state.pollTimer !== null) {
        clearInterval(state.pollTimer);
        state.pollTimer = null;
      }
    };

    const startPolling = (): void => {
      stopPolling();
      state.pollTimer = setInterval(() => {
        if (state.paused || overlay.classList.contains("hidden")) {
          return;
        }
        void loadActiveSessionLogs(false);
      }, POLL_INTERVAL_MS);
    };

    const openOverlay = (): void => {
      overlay.classList.remove("hidden");
      overlay.setAttribute("aria-hidden", "false");
      setActiveTabUI();
      setPauseButtonUI();
      void (async (): Promise<void> => {
        await refreshActiveApp(true);
        startPolling();
      })();
    };

    const closeOverlay = (): void => {
      overlay.classList.add("hidden");
      overlay.setAttribute("aria-hidden", "true");
      stopPolling();
    };

    const handleIncomingPayload = (payload: unknown): void => {
      if (state.paused) {
        return;
      }

      const packets = Array.isArray(payload) ? payload : [payload];
      const selectedSession = state.selectedSessionByApp["hayalet-ev"];
      const fallbackSession = selectedSession !== "" ? selectedSession : "live";

      const incoming = packets
        .map((packet) => {
          if (!isRecord(packet)) {
            return null;
          }
          return normalizeLogEntry("hayalet-ev", fallbackSession, packet);
        })
        .filter((entry): entry is OverlayLogEntry => entry !== null);

      appendEntries("hayalet-ev", incoming);

      if (!overlay.classList.contains("hidden") && state.activeApp === "hayalet-ev") {
        renderEntries();
      }
    };

    openBtn.addEventListener("click", () => {
      openOverlay();
    });

    closeBtn.addEventListener("click", () => {
      closeOverlay();
    });

    overlayBackdrop.addEventListener("click", () => {
      closeOverlay();
    });

    appButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const app = button.dataset["app"];
        if (app !== "hayalet-ev" && app !== "mcp-server" && app !== "ghost-agent") {
          return;
        }

        state.activeApp = app;
        state.selectedEntryId = "";
        setActiveTabUI();
        renderDetail(null);
        void refreshActiveApp(true);
      });
    });

    sessionSelect.addEventListener("change", () => {
      state.selectedSessionByApp[state.activeApp] = sessionSelect.value;
      state.lastFingerprintByApp[state.activeApp] = "";
      state.selectedEntryId = "";
      void loadActiveSessionLogs(true);
    });

    levelSelect.addEventListener("change", () => {
      renderEntries();
    });

    searchInput.addEventListener("input", () => {
      renderEntries();
    });

    pauseBtn.addEventListener("click", () => {
      state.paused = !state.paused;
      setPauseButtonUI();
      if (!state.paused) {
        void loadActiveSessionLogs(true);
      }
    });

    clearBtn.addEventListener("click", () => {
      state.entriesByApp[state.activeApp] = [];
      state.selectedEntryId = "";
      state.lastFingerprintByApp[state.activeApp] = "";
      renderEntries();
      renderDetail(null);
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !overlay.classList.contains("hidden")) {
        closeOverlay();
      }
    });

    electronApi.ipcRenderer.on("log:ui-notify", (_event: unknown, payload: unknown) => {
      handleIncomingPayload(payload);
    });

    electronApi.ipcRenderer.on("log:ui-notify-batch", (_event: unknown, payload: unknown) => {
      handleIncomingPayload(payload);
    });

    setPauseButtonUI();
    renderEntries();
    Logger.debug(LogCategory.ENTRANCE, "Advanced live log overlay setup complete");
  }
}
