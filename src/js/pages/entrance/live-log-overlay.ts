import { LogCategory } from "@shared/logging-core";
import { MAX_LOGS_SERVER } from "@limits";
import { Logger } from "../../modules/logger/index.js";

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
  const sessionSelect = document.getElementById("live-log-session-select") as HTMLSelectElement | null;
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
      const category = formatLogCategory(entry.category);
      const safeLevel = escapeHtml(entry.level.toUpperCase());

      row.innerHTML = `
          <div class="log-entry-header">
            <span class="log-time">${escapeHtml(time)}</span>
            <span class="log-level log-level-badge-${entry.level}">${safeLevel}</span>
            <span class="log-app">${escapeHtml(entry.app)}</span>
            <span class="log-category">${escapeHtml(category)}</span>
          </div>
          <div class="log-message">${escapeHtml(entry.message)}</div>
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
