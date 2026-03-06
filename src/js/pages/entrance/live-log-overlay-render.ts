import type { OverlayLogEntry, OverlayState } from "./live-log-overlay-model.js";

interface OverlayRenderParams {
  state: OverlayState;
  overlayContent: HTMLElement;
  levelSelect: HTMLSelectElement;
  searchInput: HTMLInputElement;
  metrics: HTMLElement;
  detailMeta: HTMLElement;
  detailContext: HTMLElement;
  formatLogCategory: (category: string) => string;
  escapeHtml: (text: string) => string;
  maxLogs: number;
}

export function setActiveTabUI(state: OverlayState, appButtons: HTMLButtonElement[]): void {
  appButtons.forEach((button) => {
    const isActive = button.dataset["app"] === state.activeApp;
    button.classList.toggle("is-active", isActive);
  });
}

export function setPauseButtonUI(state: OverlayState, pauseBtn: HTMLButtonElement): void {
  pauseBtn.textContent = state.paused ? "Resume" : "Pause";
  pauseBtn.classList.toggle("is-active", state.paused);
}

export function renderDetail(
  detailMeta: HTMLElement,
  detailContext: HTMLElement,
  entry: OverlayLogEntry | null
): void {
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
}

export function syncSessionSelect(state: OverlayState, sessionSelect: HTMLSelectElement): void {
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
}

export function renderEntries(params: OverlayRenderParams): void {
  const {
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
  } = params;

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
    renderDetail(detailMeta, detailContext, null);
    return;
  }

  const fragment = document.createDocumentFragment();
  filtered.slice(0, maxLogs).forEach((entry) => {
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
      renderEntries(params);
      renderDetail(detailMeta, detailContext, entry);
    });

    fragment.appendChild(row);
  });

  overlayContent.appendChild(fragment);

  const selected = filtered.find((entry) => entry.id === state.selectedEntryId) ?? null;
  renderDetail(detailMeta, detailContext, selected);
}
