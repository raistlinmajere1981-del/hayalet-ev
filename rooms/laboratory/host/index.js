const ROOM_STATE_KEY = "laboratory-room-state";
const POLL_TIMER_KEY = "laboratory-poll-timer";
const SOURCE_POLL_TIMER_KEY = "laboratory-source-poll-timer";
const DEFAULT_MODE = "balanced";

function getElectronApi() {
  return window.electronAPI || null;
}

function normalizeLocale(value) {
  return typeof value === "string" && value.toLowerCase().startsWith("tr") ? "tr" : "en";
}

function cloneSelection(selection) {
  if (!selection || typeof selection !== "object" || Array.isArray(selection)) {
    return {
      timeRange: null,
      region: null,
    };
  }

  return {
    timeRange:
      selection.timeRange &&
      typeof selection.timeRange === "object" &&
      Array.isArray(selection.timeRange) === false
        ? {
            startSec: Number(selection.timeRange.startSec) || 0,
            endSec: Number(selection.timeRange.endSec) || 0,
          }
        : null,
    region:
      selection.region &&
      typeof selection.region === "object" &&
      Array.isArray(selection.region) === false
        ? {
            xPct: Number(selection.region.xPct) || 0,
            yPct: Number(selection.region.yPct) || 0,
            widthPct: Number(selection.region.widthPct) || 0,
            heightPct: Number(selection.region.heightPct) || 0,
          }
        : null,
  };
}

function createDefaultWorkflowSettings() {
  return {
    downloadPreset: "balanced",
    previewPolicy: "smart",
    focus: {
      visual: true,
      audio: true,
      image: true,
      motion: true,
    },
  };
}

function cloneWorkflowSettings(settings) {
  const source =
    settings && typeof settings === "object" && Array.isArray(settings) === false
      ? settings
      : createDefaultWorkflowSettings();
  const focus =
    source.focus && typeof source.focus === "object" && Array.isArray(source.focus) === false
      ? source.focus
      : createDefaultWorkflowSettings().focus;

  return {
    downloadPreset:
      source.downloadPreset === "best" || source.downloadPreset === "fast"
        ? source.downloadPreset
        : "balanced",
    previewPolicy: source.previewPolicy === "dense" ? "dense" : "smart",
    focus: {
      visual: typeof focus.visual === "boolean" ? focus.visual : true,
      audio: typeof focus.audio === "boolean" ? focus.audio : true,
      image: typeof focus.image === "boolean" ? focus.image : true,
      motion: typeof focus.motion === "boolean" ? focus.motion : true,
    },
  };
}

function workflowSettingsFromProject(project, fallback) {
  const candidate =
    project &&
    typeof project === "object" &&
    Array.isArray(project) === false &&
    project.source &&
    typeof project.source === "object" &&
    Array.isArray(project.source) === false &&
    project.source.workflowSettings
      ? project.source.workflowSettings
      : project &&
          typeof project === "object" &&
          Array.isArray(project) === false &&
          project.latestEntry &&
          typeof project.latestEntry === "object" &&
          Array.isArray(project.latestEntry) === false &&
          project.latestEntry.technicalReport &&
          typeof project.latestEntry.technicalReport === "object" &&
          Array.isArray(project.latestEntry.technicalReport) === false &&
          project.latestEntry.technicalReport.workflowSettings
        ? project.latestEntry.technicalReport.workflowSettings
        : fallback;

  return cloneWorkflowSettings(candidate);
}

function toFileUrl(filePath) {
  if (typeof filePath !== "string" || filePath.trim() === "") {
    return null;
  }
  const normalized = filePath.replace(/\\/g, "/");
  return normalized.startsWith("file://")
    ? normalized
    : `file://${normalized.startsWith("/") ? "" : "/"}${encodeURI(normalized)}`;
}

function serializeSource(source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return null;
  }

  return {
    ...source,
    previewUrl: toFileUrl(source.previewPath),
  };
}

function serializeEntry(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return null;
  }

  return {
    ...entry,
    source: serializeSource(entry.source),
  };
}

function serializeProject(project) {
  if (!project || typeof project !== "object" || Array.isArray(project)) {
    return null;
  }

  return {
    ...project,
    source: serializeSource(project.source),
    latestEntry: serializeEntry(project.latestEntry),
  };
}

function createInitialState(locale) {
  return {
    locale: normalizeLocale(locale),
    reportLocale: normalizeLocale(locale),
    workflowSettings: createDefaultWorkflowSettings(),
    source: null,
    history: [],
    projects: [],
    activeEntryId: null,
    activeEntry: null,
    activeProjectId: null,
    activeProject: null,
    pendingSourceJobId: null,
    pendingJobId: null,
    progress: null,
    error: "",
    mode: DEFAULT_MODE,
    selection: {
      timeRange: null,
      region: null,
    },
  };
}

function loadState(api) {
  const saved = api.getState(ROOM_STATE_KEY);
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
    return createInitialState(api.getLocale());
  }

  return {
    ...createInitialState(api.getLocale()),
    ...saved,
    locale: normalizeLocale(saved.locale || api.getLocale()),
    reportLocale: normalizeLocale(saved.reportLocale || saved.locale || api.getLocale()),
    workflowSettings: cloneWorkflowSettings(saved.workflowSettings),
    selection: cloneSelection(saved.selection),
  };
}

function saveState(api, state) {
  api.setState(ROOM_STATE_KEY, state);
  return state;
}

function readPollTimer(api) {
  const timer = api.getState(POLL_TIMER_KEY);
  return typeof timer === "number" ? timer : null;
}

function readSourcePollTimer(api) {
  const timer = api.getState(SOURCE_POLL_TIMER_KEY);
  return typeof timer === "number" ? timer : null;
}

function stopPolling(api) {
  const timer = readPollTimer(api);
  if (timer !== null) {
    window.clearInterval(timer);
    api.deleteState(POLL_TIMER_KEY);
  }
}

function stopSourcePolling(api) {
  const timer = readSourcePollTimer(api);
  if (timer !== null) {
    window.clearInterval(timer);
    api.deleteState(SOURCE_POLL_TIMER_KEY);
  }
}

function buildPayload(state) {
  return {
    locale: state.locale,
    reportLocale: state.reportLocale,
    workflowSettings: cloneWorkflowSettings(state.workflowSettings),
    source: serializeSource(state.source),
    history: state.history,
    projects: state.projects,
    activeEntryId: state.activeEntryId,
    activeEntry: serializeEntry(state.activeEntry),
    activeProjectId: state.activeProjectId,
    activeProject: serializeProject(state.activeProject),
    pendingSourceJobId: state.pendingSourceJobId,
    pendingJobId: state.pendingJobId,
    progress: state.progress,
    error: state.error,
    mode: state.mode,
    selection: cloneSelection(state.selection),
  };
}

function notifyState(api, state) {
  saveState(api, state);
  api.notifyRoom("laboratory-state", buildPayload(state));
}

async function loadActiveProject(api, state, projectId, options) {
  const normalizedProjectId =
    typeof projectId === "string" && projectId.trim() !== "" ? projectId.trim() : "";
  if (normalizedProjectId === "") {
    state.activeProjectId = null;
    state.activeProject = null;
    if (!(options && options.suppressNotify === true)) {
      notifyState(api, state);
    }
    return;
  }

  const electronApi = getElectronApi();
  state.activeProjectId = normalizedProjectId;
  if (!electronApi || typeof electronApi.laboratoryReadProject !== "function") {
    state.activeProject = null;
    if (!(options && options.suppressNotify === true)) {
      notifyState(api, state);
    }
    return;
  }

  const result = await electronApi.laboratoryReadProject(normalizedProjectId);
  state.activeProject = result && result.success !== false && result.project ? result.project : null;
  if (state.activeProject) {
    state.workflowSettings = workflowSettingsFromProject(state.activeProject, state.workflowSettings);
    if (state.activeProject.source) {
      state.source = state.activeProject.source;
    }
    if (state.activeProject.latestEntry) {
      state.activeEntryId = state.activeProject.latestEntry.summary.entryId;
      state.activeEntry = state.activeProject.latestEntry;
    } else if (
      state.activeEntry &&
      state.activeEntry.summary &&
      state.activeEntry.summary.projectId === normalizedProjectId
    ) {
      state.activeEntryId = null;
      state.activeEntry = null;
    }
  }

  if (!(options && options.suppressNotify === true)) {
    notifyState(api, state);
  }
}

async function refreshProjects(api, state, options) {
  const electronApi = getElectronApi();
  if (!electronApi || typeof electronApi.laboratoryListProjects !== "function") {
    state.projects = [];
    state.activeProject = null;
    state.activeProjectId = null;
    return;
  }

  const result = await electronApi.laboratoryListProjects();
  state.projects =
    result && result.success !== false && Array.isArray(result.projects) ? result.projects : [];

  const preferredProjectId =
    options && typeof options.preferredProjectId === "string" && options.preferredProjectId.trim() !== ""
      ? options.preferredProjectId.trim()
      : state.activeProjectId ||
        (state.source && state.source.projectId) ||
        (state.activeEntry && state.activeEntry.summary ? state.activeEntry.summary.projectId : "") ||
        "";
  if (preferredProjectId !== "") {
    await loadActiveProject(api, state, preferredProjectId, { suppressNotify: true });
    return;
  }

  if (state.projects[0]) {
    await loadActiveProject(api, state, state.projects[0].projectId, { suppressNotify: true });
    return;
  }

  state.activeProject = null;
  state.activeProjectId = null;
}

async function discardTransientSource(api, state) {
  const electronApi = getElectronApi();
  if (
    !electronApi ||
    typeof electronApi.laboratoryDiscardWorkspace !== "function" ||
    !state.source ||
    state.activeProjectId === state.source.projectId ||
    state.activeEntryId === state.source.workspaceId
  ) {
    return;
  }

  try {
    await electronApi.laboratoryDiscardWorkspace(state.source.workspaceId);
  } catch {
    // Ignore workspace discard errors for transient sources.
  }
}

async function openHistoryEntry(api, state, entryId, options) {
  const electronApi = getElectronApi();
  if (!electronApi || typeof electronApi.laboratoryReadHistoryEntry !== "function") {
    return;
  }

  const result = await electronApi.laboratoryReadHistoryEntry(entryId);
  if (result && result.success !== false && result.entry) {
    state.activeEntryId = entryId;
    state.activeEntry = result.entry;
    state.workflowSettings = workflowSettingsFromProject(
      { latestEntry: result.entry, source: result.entry.source },
      state.workflowSettings
    );
    state.activeProjectId =
      result.entry.summary && typeof result.entry.summary.projectId === "string"
        ? result.entry.summary.projectId
        : state.activeProjectId;
    state.error = "";
    if (state.activeProjectId) {
      await loadActiveProject(api, state, state.activeProjectId, { suppressNotify: true });
    }
    if (!(options && options.suppressNotify === true)) {
      notifyState(api, state);
    }
  }
}

async function refreshHistory(api, state, options) {
  const electronApi = getElectronApi();
  if (!electronApi || typeof electronApi.laboratoryListHistory !== "function") {
    return;
  }

  const result = await electronApi.laboratoryListHistory();
  state.history =
    result && result.success !== false && Array.isArray(result.entries) ? result.entries : [];

  const preferredEntryId =
    options && typeof options.preferredEntryId === "string" && options.preferredEntryId.trim() !== ""
      ? options.preferredEntryId.trim()
      : state.activeEntryId ||
        (state.activeProject && state.activeProject.summary
          ? state.activeProject.summary.latestEntryId
          : null);
  if (preferredEntryId) {
    await openHistoryEntry(api, state, preferredEntryId, { suppressNotify: true });
    if (!(options && options.suppressNotify === true)) {
      notifyState(api, state);
    }
    return;
  }

  if (!state.activeProject && state.history[0]) {
    await openHistoryEntry(api, state, state.history[0].entryId, { suppressNotify: true });
    if (!(options && options.suppressNotify === true)) {
      notifyState(api, state);
    }
    return;
  }

  if (!(options && options.suppressNotify === true)) {
    notifyState(api, state);
  }
}

async function resolveSource(api, state, payload) {
  const electronApi = getElectronApi();
  if (!electronApi || typeof electronApi.laboratoryResolveSource !== "function") {
    state.error = "Laboratory source resolver is unavailable.";
    notifyState(api, state);
    return;
  }

   if (state.pendingSourceJobId || state.pendingJobId) {
    state.error =
      state.locale === "tr"
        ? "Aktif is biter bitmez yeni kaynak hazirlayabilirsin."
        : "Wait for the active task to finish before preparing another source.";
    notifyState(api, state);
    return;
  }

  await discardTransientSource(api, state);

  state.progress = {
    jobId: "",
    workspaceId: "",
    status: "resolving-source",
    phase: "source-resolve",
    percent: 8,
    summary: state.locale === "tr" ? "Kaynak hazirlaniyor." : "Preparing source.",
    detail:
      state.locale === "tr"
        ? "Video kopyalaniyor, probelaniyor ve onizleme uyumlulugu kontrol ediliyor."
        : "Copying the video, probing media metadata, and checking preview compatibility.",
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    currentAnalyzer: null,
  };
  state.error = "";
  notifyState(api, state);

  const result = await electronApi.laboratoryResolveSource({
    ...payload,
    reportLocale: state.reportLocale,
    workflowSettings: cloneWorkflowSettings(state.workflowSettings),
  });
  if (result && result.success !== false && result.source) {
    state.source = result.source;
    state.activeProjectId = result.source.projectId;
    state.activeProject = null;
    state.pendingSourceJobId = null;
    state.progress = {
      jobId: "",
      workspaceId: result.source.workspaceId,
      status: "ready",
      phase: "preview-prep",
      percent: 100,
      summary: state.locale === "tr" ? "Kaynak hazir." : "Source ready.",
      detail:
        state.locale === "tr"
          ? "Onizleme ve analiz kontrolleri hazir. Aralik ve bolge secip baslatabilirsin."
          : "Preview and analysis controls are ready. Select a range or region and start when ready.",
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      currentAnalyzer: null,
    };
    state.activeEntryId = null;
    state.activeEntry = null;
    await refreshProjects(api, state, {
      preferredProjectId: result.source.projectId,
    });
    notifyState(api, state);
    return;
  }

  state.progress = null;
  state.error =
    result && typeof result.error === "string" && result.error.trim() !== ""
      ? result.error.trim()
      : state.locale === "tr"
        ? "Kaynak hazirlanamadi."
        : "Source could not be prepared.";
  notifyState(api, state);
}

async function syncJobSnapshot(api, state, snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    return;
  }

  state.progress = snapshot.progress || null;
  state.error = typeof snapshot.error === "string" ? snapshot.error : "";

  if (snapshot.status === "completed" && snapshot.result) {
    state.pendingJobId = null;
    state.activeEntry = snapshot.result;
    state.activeEntryId = snapshot.result.summary.entryId;
    state.source = snapshot.result.source;
    state.activeProjectId = snapshot.result.summary.projectId;
    stopPolling(api);
    await refreshProjects(api, state, {
      preferredProjectId: snapshot.result.summary.projectId,
    });
    await refreshHistory(api, state, {
      preferredEntryId: snapshot.result.summary.entryId,
      suppressNotify: true,
    });
    notifyState(api, state);
    return;
  }

  if (snapshot.status === "failed" || snapshot.status === "cancelled") {
    state.pendingJobId = null;
    stopPolling(api);
  }

  notifyState(api, state);
}

async function syncSourcePreparationSnapshot(api, state, snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    return;
  }

  state.progress = snapshot.progress || null;
  state.error = typeof snapshot.error === "string" ? snapshot.error : "";

  if (snapshot.status === "ready" && snapshot.source) {
    state.pendingSourceJobId = null;
    state.source = snapshot.source;
    state.activeProjectId = snapshot.projectId || snapshot.source.projectId;
    state.activeProject = null;
    state.activeEntryId = null;
    state.activeEntry = null;
    stopSourcePolling(api);
    await refreshProjects(api, state, {
      preferredProjectId: state.activeProjectId,
    });
    notifyState(api, state);
    return;
  }

  if (snapshot.status === "failed" || snapshot.status === "cancelled") {
    state.pendingSourceJobId = null;
    stopSourcePolling(api);
  }

  notifyState(api, state);
}

function startPolling(api, state, jobId) {
  const electronApi = getElectronApi();
  if (!electronApi || typeof electronApi.laboratoryGetJob !== "function") {
    return;
  }

  stopPolling(api);
  let polling = false;
  const timer = window.setInterval(async function () {
    if (polling) {
      return;
    }

    polling = true;
    try {
      const result = await electronApi.laboratoryGetJob(jobId);
      if (result && result.success !== false && result.job) {
        await syncJobSnapshot(api, state, result.job);
      }
    } catch (error) {
      state.pendingJobId = null;
      state.error =
        error && error.message
          ? error.message
          : state.locale === "tr"
            ? "Is ilerlemesi okunamadi."
            : "Job progress could not be read.";
      stopPolling(api);
      notifyState(api, state);
    } finally {
      polling = false;
    }
  }, 450);

  api.setState(POLL_TIMER_KEY, timer);
}

function startSourcePolling(api, state, jobId) {
  const electronApi = getElectronApi();
  if (!electronApi || typeof electronApi.laboratoryGetSourcePreparationJob !== "function") {
    return;
  }

  stopSourcePolling(api);
  let polling = false;
  const timer = window.setInterval(async function () {
    if (polling) {
      return;
    }

    polling = true;
    try {
      const result = await electronApi.laboratoryGetSourcePreparationJob(jobId);
      if (result && result.success !== false && result.job) {
        await syncSourcePreparationSnapshot(api, state, result.job);
      }
    } catch (error) {
      state.pendingSourceJobId = null;
      state.error =
        error && error.message
          ? error.message
          : state.locale === "tr"
            ? "Kaynak hazirlama ilerlemesi okunamadi."
            : "Source preparation progress could not be read.";
      stopSourcePolling(api);
      notifyState(api, state);
    } finally {
      polling = false;
    }
  }, 450);

  api.setState(SOURCE_POLL_TIMER_KEY, timer);
}

async function pickLocalFile(api, state) {
  const electronApi = getElectronApi();
  if (!electronApi || typeof electronApi.showOpenDialog !== "function") {
    state.error = "File picker is unavailable.";
    notifyState(api, state);
    return;
  }

  const selection = await electronApi.showOpenDialog({
    title: state.locale === "tr" ? "Video sec" : "Select video",
    properties: ["openFile"],
    filters: [
      {
        name: "Videos",
        extensions: ["mp4", "mov", "mkv", "webm", "avi", "mpeg", "mpg", "m4v"],
      },
    ],
  });
  const pickedPath =
    selection && selection.canceled !== true && Array.isArray(selection.filePaths)
      ? selection.filePaths[0]
      : "";
  if (typeof pickedPath !== "string" || pickedPath.trim() === "") {
    return;
  }

  await resolveSource(api, state, {
    kind: "local-file",
    filePath: pickedPath.trim(),
  });
}

async function prepareYouTubeSource(api, state, url) {
  const electronApi = getElectronApi();
  if (!electronApi || typeof electronApi.laboratoryStartSourcePreparation !== "function") {
    state.error =
      state.locale === "tr"
        ? "YouTube kaynak hazirlama kullanilamiyor."
        : "YouTube source preparation is unavailable.";
    notifyState(api, state);
    return;
  }

  if (state.pendingSourceJobId || state.pendingJobId) {
    state.error =
      state.locale === "tr"
        ? "Aktif is biter bitmez yeni kaynak hazirlayabilirsin."
        : "Wait for the active task to finish before preparing another source.";
    notifyState(api, state);
    return;
  }

  await discardTransientSource(api, state);
  state.source = null;
  state.activeEntryId = null;
  state.activeEntry = null;
  state.error = "";
  state.progress = {
    jobId: "",
    workspaceId: "",
    status: "resolving-source",
    phase: "source-resolve",
    percent: 6,
    summary: state.locale === "tr" ? "YouTube kaynagi hazirlaniyor." : "Preparing YouTube source.",
    detail:
      state.locale === "tr"
        ? "URL dogrulaniyor, video indiriliyor ve onizleme uyumlulugu hazirlaniyor."
        : "Validating the URL, downloading the video, and preparing preview compatibility.",
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    currentAnalyzer: null,
  };
  notifyState(api, state);

  const result = await electronApi.laboratoryStartSourcePreparation({
    kind: "youtube-url",
    url: url.trim(),
    reportLocale: state.reportLocale,
    workflowSettings: cloneWorkflowSettings(state.workflowSettings),
  });
  if (result && result.success !== false && result.job) {
    state.pendingSourceJobId = result.job.jobId;
    state.progress = result.job.progress || null;
    notifyState(api, state);
    startSourcePolling(api, state, result.job.jobId);
    return;
  }

  state.progress = null;
  state.error =
    result && typeof result.error === "string" && result.error.trim() !== ""
      ? result.error.trim()
      : state.locale === "tr"
        ? "YouTube kaynagi hazirlanamadi."
        : "YouTube source could not be prepared.";
  notifyState(api, state);
}

async function startAnalysis(api, state, payload) {
  const electronApi = getElectronApi();
  if (!electronApi || typeof electronApi.laboratoryStartAnalysis !== "function" || !state.source) {
    state.error =
      state.locale === "tr"
        ? "Analiz baslatilamadi. Once bir kaynak hazirla."
        : "Analysis could not start. Prepare a source first.";
    notifyState(api, state);
    return;
  }

  if (state.pendingSourceJobId) {
    state.error =
      state.locale === "tr"
        ? "Kaynak hazirlama bitmeden analiz baslatilamaz."
        : "Wait for source preparation to finish before starting analysis.";
    notifyState(api, state);
    return;
  }

  const mode =
    payload && payload.mode === "fast" ? "fast" : payload && payload.mode === "deep" ? "deep" : DEFAULT_MODE;
  const selection = cloneSelection(payload && payload.selection ? payload.selection : state.selection);
  state.mode = mode;
  state.selection = selection;
  state.error = "";
  notifyState(api, state);

  const result = await electronApi.laboratoryStartAnalysis({
    source: state.source,
    mode,
    reportLocale: state.reportLocale,
    workflowSettings: cloneWorkflowSettings(state.workflowSettings),
    selection,
  });
  if (result && result.success !== false && result.job) {
    state.pendingJobId = result.job.jobId;
    state.progress = result.job.progress || null;
    notifyState(api, state);
    startPolling(api, state, result.job.jobId);
    return;
  }

  state.error =
    result && typeof result.error === "string" && result.error.trim() !== ""
      ? result.error.trim()
      : state.locale === "tr"
        ? "Analiz baslatilamadi."
        : "Analysis could not start.";
  notifyState(api, state);
}

async function cancelAnalysis(api, state) {
  const electronApi = getElectronApi();
  if (
    !electronApi ||
    typeof electronApi.laboratoryCancelJob !== "function" ||
    typeof state.pendingJobId !== "string" ||
    state.pendingJobId.trim() === ""
  ) {
    return;
  }

  const result = await electronApi.laboratoryCancelJob(state.pendingJobId);
  if (result && result.success !== false && result.job) {
    await syncJobSnapshot(api, state, result.job);
  }
}

async function cancelSourcePreparation(api, state) {
  const electronApi = getElectronApi();
  if (
    !electronApi ||
    typeof electronApi.laboratoryCancelSourcePreparationJob !== "function" ||
    typeof state.pendingSourceJobId !== "string" ||
    state.pendingSourceJobId.trim() === ""
  ) {
    return;
  }

  const result = await electronApi.laboratoryCancelSourcePreparationJob(state.pendingSourceJobId);
  if (result && result.success !== false && result.job) {
    await syncSourcePreparationSnapshot(api, state, result.job);
  }
}

async function cleanupEntryMedia(api, state, entryId) {
  const electronApi = getElectronApi();
  if (!electronApi || typeof electronApi.laboratoryCleanupWorkspaceMedia !== "function") {
    return;
  }

  const result = await electronApi.laboratoryCleanupWorkspaceMedia(entryId);
  if (result && result.success !== false && result.entry) {
    if (state.activeEntryId === entryId) {
      state.activeEntry = result.entry;
    }
    if (state.source && state.source.workspaceId === entryId) {
      state.source = result.entry.source;
    }
    if (result.entry.summary && typeof result.entry.summary.projectId === "string") {
      state.activeProjectId = result.entry.summary.projectId;
      await refreshProjects(api, state, {
        preferredProjectId: state.activeProjectId,
      });
    }
    await refreshHistory(api, state, {
      preferredEntryId: state.activeEntryId,
      suppressNotify: true,
    });
    notifyState(api, state);
  }
}

async function deleteProject(api, state, projectId) {
  const electronApi = getElectronApi();
  if (!electronApi || typeof electronApi.laboratoryDeleteProject !== "function") {
    return;
  }

  await electronApi.laboratoryDeleteProject(projectId);
  if (state.activeProjectId === projectId) {
    state.activeProjectId = null;
    state.activeProject = null;
    state.activeEntryId = null;
    state.activeEntry = null;
    state.source = null;
    state.progress = null;
  }
  await refreshProjects(api, state, {
    preferredProjectId: state.activeProjectId,
  });
  await refreshHistory(api, state, {
    preferredEntryId: state.activeEntryId,
    suppressNotify: true,
  });
  notifyState(api, state);
}

function unwrapRoomEventPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }

  if (
    payload.payload &&
    typeof payload.payload === "object" &&
    Array.isArray(payload.payload) === false
  ) {
    return payload.payload;
  }

  return payload;
}

async function handleAction(api, state, payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return;
  }

  const actionPayload = unwrapRoomEventPayload(payload);

  if (payload.type === "host-context") {
    state.locale = normalizeLocale(payload.locale || api.getLocale());
    state.reportLocale = normalizeLocale(payload.locale || state.reportLocale || api.getLocale());
    notifyState(api, state);
    return;
  }

  if (payload.type !== "laboratory-action" || typeof actionPayload.action !== "string") {
    return;
  }

  if (actionPayload.action === "pick-local-file") {
    await pickLocalFile(api, state);
    return;
  }

  if (actionPayload.action === "sync-workflow-settings") {
    state.workflowSettings = cloneWorkflowSettings(actionPayload.workflowSettings);
    notifyState(api, state);
    return;
  }

  if (actionPayload.action === "submit-direct-url" && typeof actionPayload.url === "string") {
    await resolveSource(api, state, {
      kind: "direct-url",
      url: actionPayload.url.trim(),
    });
    return;
  }

  if (actionPayload.action === "submit-youtube-url" && typeof actionPayload.url === "string") {
    await prepareYouTubeSource(api, state, actionPayload.url);
    return;
  }

  if (actionPayload.action === "start-analysis") {
    await startAnalysis(api, state, actionPayload);
    return;
  }

  if (actionPayload.action === "cancel-analysis") {
    await cancelAnalysis(api, state);
    return;
  }

  if (actionPayload.action === "cancel-source-preparation") {
    await cancelSourcePreparation(api, state);
    return;
  }

  if (actionPayload.action === "select-history-entry" && typeof actionPayload.entryId === "string") {
    await openHistoryEntry(api, state, actionPayload.entryId.trim());
    return;
  }

  if (actionPayload.action === "select-project" && typeof actionPayload.projectId === "string") {
    await loadActiveProject(api, state, actionPayload.projectId.trim());
    return;
  }

  if (actionPayload.action === "cleanup-entry-media" && typeof actionPayload.entryId === "string") {
    await cleanupEntryMedia(api, state, actionPayload.entryId.trim());
    return;
  }

  if (actionPayload.action === "reload-history") {
    await refreshProjects(api, state, {
      preferredProjectId: state.activeProjectId,
    });
    await refreshHistory(api, state, {
      preferredEntryId: state.activeEntryId,
      suppressNotify: true,
    });
    notifyState(api, state);
    return;
  }

  if (actionPayload.action === "delete-project" && typeof actionPayload.projectId === "string") {
    await deleteProject(api, state, actionPayload.projectId.trim());
    return;
  }

  if (actionPayload.action === "clear-source") {
    await discardTransientSource(api, state);
    state.source = null;
    state.progress = null;
    state.error = "";
    if (state.activeProject && state.activeProject.source === null) {
      state.activeProject = null;
      state.activeProjectId = null;
    }
    notifyState(api, state);
  }
}

module.exports = {
  activate: function activate(api) {
    api.log("info", "Laboratory host activated.");
    const state = saveState(api, loadState(api));

    return {
      onRoomReady: async function onRoomReady() {
        await refreshProjects(api, state, {
          preferredProjectId: state.activeProjectId,
        });
        await refreshHistory(api, state, {
          preferredEntryId: state.activeEntryId,
          suppressNotify: true,
        });
        notifyState(api, state);
      },
      onRoomEvent: async function onRoomEvent(payload) {
        await handleAction(api, state, payload || {});
      },
      dispose: async function dispose() {
        stopPolling(api);
        stopSourcePolling(api);
        await discardTransientSource(api, state);
        api.log("info", "Laboratory host disposed.");
      },
    };
  },
};
