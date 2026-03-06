import { LogCategory } from "@shared/logging-core";
import { MAX_LOGS_SERVER } from "@limits";
import { Logger } from "../../modules/logger/index.js";
import {
  appendEntries,
  asText,
  createInitialOverlayState,
  decodeBase64ToUtf8,
  isOverlayApp,
  isRecord,
  joinPath,
  normalizeLogEntry,
} from "./live-log-overlay-model.js";
import {
  renderDetail,
  renderEntries,
  setActiveTabUI,
  setPauseButtonUI,
  syncSessionSelect,
} from "./live-log-overlay-render.js";

interface SetupEntranceLiveLogOverlayOptions {
  formatLogCategory: (category: string) => string;
  escapeHtml: (text: string) => string;
}

export function setupEntranceLiveLogOverlay({
  formatLogCategory,
  escapeHtml,
}: SetupEntranceLiveLogOverlayOptions): void {
  const electronApi = window.electronAPI;
  if (electronApi == null) {
    Logger.warn(LogCategory.ENTRANCE, "IPC/filesystem bridge not available for live overlay");
    return;
  }

  const overlay = document.getElementById("live-log-overlay");
  const overlayBackdrop = document.getElementById("live-log-backdrop");
  const overlayContent = document.getElementById("live-log-content");
  const openBtn = document.getElementById("report-modal-open") as HTMLButtonElement | null;
  const closeBtn = document.getElementById("live-log-close") as HTMLButtonElement | null;
  const pauseBtn = document.getElementById("live-log-pause") as HTMLButtonElement | null;
  const clearBtn = document.getElementById("live-log-clear") as HTMLButtonElement | null;
  const appTabs = document.getElementById("live-log-app-tabs");
  const sessionSelect = document.getElementById(
    "live-log-session-select"
  ) as HTMLSelectElement | null;
  const levelSelect = document.getElementById("live-log-level-select") as HTMLSelectElement | null;
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
  const maxLogs = Math.max(MAX_LOGS_SERVER * 20, 500);
  const pollIntervalMs = 2000;
  const state = createInitialOverlayState();

  const render = (): void => {
    renderEntries({
      state,
      overlayContent,
      levelSelect,
      searchInput,
      metrics,
      detailMeta,
      detailContext,
      formatLogCategory,
      escapeHtml,
      maxLogs,
    });
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

      const slashIndex = Math.max(hayaletLogDir.lastIndexOf("/"), hayaletLogDir.lastIndexOf("\\"));
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

  const loadSessions = async (): Promise<void> => {
    const app = state.activeApp;
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
      render();
      return;
    }

    const structuredPath = joinPath(state.baseLogsDir, app, sessionId, "structured.jsonl");
    const encoded = await electronApi.readFile(structuredPath);

    if (typeof encoded !== "string" || encoded === "") {
      if (force) {
        state.entriesByApp[app] = [];
        state.selectedEntryId = "";
        render();
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
      .filter((entry) => entry !== null)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, maxLogs);

    state.entriesByApp[app] = parsed;
    render();
  };

  const refreshActiveApp = async (forceLogs = false): Promise<void> => {
    await loadSessions();
    syncSessionSelect(state, sessionSelect);
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
    }, pollIntervalMs);
  };

  const openOverlay = (): void => {
    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");
    setActiveTabUI(state, appButtons);
    setPauseButtonUI(state, pauseBtn);
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
      .filter((entry) => entry !== null);

    appendEntries(state, "hayalet-ev", incoming, maxLogs);

    if (!overlay.classList.contains("hidden") && state.activeApp === "hayalet-ev") {
      render();
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
      if (!isOverlayApp(app)) {
        return;
      }

      state.activeApp = app;
      state.selectedEntryId = "";
      setActiveTabUI(state, appButtons);
      renderDetail(detailMeta, detailContext, null);
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
    render();
  });

  searchInput.addEventListener("input", () => {
    render();
  });

  pauseBtn.addEventListener("click", () => {
    state.paused = !state.paused;
    setPauseButtonUI(state, pauseBtn);
    if (!state.paused) {
      void loadActiveSessionLogs(true);
    }
  });

  clearBtn.addEventListener("click", () => {
    state.entriesByApp[state.activeApp] = [];
    state.selectedEntryId = "";
    state.lastFingerprintByApp[state.activeApp] = "";
    render();
    renderDetail(detailMeta, detailContext, null);
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

  setPauseButtonUI(state, pauseBtn);
  render();
  Logger.debug(LogCategory.ENTRANCE, "Advanced live log overlay setup complete");
}
