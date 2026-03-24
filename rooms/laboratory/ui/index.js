(function () {
  const ROOM_ID = "laboratory";
  const FEATURE_ID = "media-analysis";
  const STAGE_ORDER = ["source", "edit", "profile", "process", "report"];
  const SOURCE_FORMATS = ["video", "audio", "image"];
  const PROFILE_PRESETS = ["quick", "balanced", "deep"];
  const PROFILE_FOCUS = ["video", "audio", "image"];
  const REGION_OPTIONS = ["containment", "corridor", "archive"];
  const PROCESS_STEPS = ["intake", "cleanup", "motion", "audio", "report"];
  const PROCESS_THRESHOLDS = [0, 18, 39, 62, 84, 100];
  const TOTAL_DURATION_MS = 9370;
  const PREVIEW_IMAGE = "../assets/media-analysis-view.webp";

  const BOOTSTRAP_COPY = {
    en: {
      loadingTitle: "Loading Laboratory",
      loadingBody: "Waiting for room context and room-local translations.",
      roomApiUnavailable: "Room API bridge is not connected.",
    },
    tr: {
      loadingTitle: "Laboratuvar Yukleniyor",
      loadingBody: "Oda baglami ve room-local ceviriler bekleniyor.",
      roomApiUnavailable: "Room API koprusu bagli degil.",
    },
  };

  const state = {
    locale: resolveLocale(document.documentElement.lang || navigator.language),
    translations: null,
    context: createContext(),
    presentation: {
      mode: "scene-view",
    },
    activeStage: "source",
    sourceSnapshot: createSourceSnapshot(),
    ui: {
      settingsOpen: false,
      pendingDeleteProjectId: null,
      lastRequestId: null,
      requestCounter: 0,
      latestRequestByDomain: {
        project: 0,
        "source-config": 0,
        "source-acquire": 0,
        tools: 0,
        misc: 0,
      },
      requestLookup: {},
      lastActionMessage: "",
      localDraftProjectId: null,
      localDrafts: createLocalDrafts(),
      previewMetrics: {
        url: null,
        duration: null,
        width: null,
        height: null,
      },
    },
    rangeStart: 18,
    rangeEnd: 72,
    region: "containment",
    cleanup: {
      audio: true,
      sharpness: true,
      aiSanitize: false,
    },
    profileFocus: "video",
    profilePreset: "balanced",
    process: {
      progress: 54,
      running: false,
    },
  };

  function resolveLocale(value) {
    return typeof value === "string" && value.toLowerCase().startsWith("tr") ? "tr" : "en";
  }

  function createContext() {
    return {
      room: {
        id: ROOM_ID,
        name: "Laboratory",
      },
      user: {
        nickname: "Operator",
      },
      presentation: {
        mode: "classic",
      },
    };
  }

  function createSourceSnapshot() {
    return {
      ready: false,
      sourcePresets: {},
      ytDlpForm: {},
      projects: [],
      activeProjectId: null,
      activeProject: null,
      toolState: {
        tools: {},
      },
      jobs: [],
    };
  }

  function createLocalDrafts() {
    return {
      urlInput: "",
      youtubeUrl: "",
      fileNameHint: "",
      youtubePreset: null,
      youtubeCustom: {},
    };
  }

  function toRecord(value) {
    if (value !== null && typeof value === "object" && Array.isArray(value) === false) {
      return value;
    }
    return {};
  }

  function readValue(source, path) {
    let current = source;
    for (let index = 0; index < path.length; index += 1) {
      const key = path[index];
      if (!current || typeof current !== "object" || Array.isArray(current)) {
        return undefined;
      }
      current = current[key];
    }
    return current;
  }

  function text(path) {
    const localized = readValue(state.translations, path);
    if (typeof localized === "string") {
      return localized;
    }
    const fallback = readValue(BOOTSTRAP_COPY[state.locale], path);
    if (typeof fallback === "string") {
      return fallback;
    }
    const englishFallback = readValue(BOOTSTRAP_COPY.en, path);
    if (typeof englishFallback === "string") {
      return englishFallback;
    }
    return path[path.length - 1] || "";
  }

  function textFromKey(key) {
    if (typeof key !== "string" || key.trim() === "") {
      return "";
    }
    return text(key.split("."));
  }

  function list(path) {
    const value = readValue(state.translations, path);
    return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function applyLocale(locale) {
    state.locale = resolveLocale(locale);
    document.documentElement.lang = state.locale;
  }

  function applyPresentationMode(mode) {
    state.presentation.mode = mode === "scene-view" ? "scene-view" : "classic";
    document.body.dataset.presentationMode = state.presentation.mode;
    document.documentElement.dataset.presentationMode = state.presentation.mode;
  }

  function normalizeContext(message) {
    const source =
      message && typeof message === "object" && Array.isArray(message) === false ? message : {};
    const room = toRecord(source.room);
    const user = toRecord(source.user);
    const presentation = toRecord(source.presentation);

    return {
      room: {
        id: typeof room.id === "string" && room.id.trim() !== "" ? room.id.trim() : ROOM_ID,
        name:
          typeof room.name === "string" && room.name.trim() !== ""
            ? room.name.trim()
            : "Laboratory",
      },
      user: {
        nickname:
          typeof user.nickname === "string" && user.nickname.trim() !== ""
            ? user.nickname.trim()
            : "Operator",
      },
      presentation: {
        mode: presentation.mode === "scene-view" ? "scene-view" : "classic",
      },
    };
  }

  function bootstrapText(key) {
    return (
      readValue(BOOTSTRAP_COPY[state.locale], [key]) ||
      readValue(BOOTSTRAP_COPY.en, [key]) ||
      key
    );
  }

  function getStageIndex(stageId) {
    return STAGE_ORDER.indexOf(stageId);
  }

  function setStage(stageId) {
    if (STAGE_ORDER.includes(stageId) === false) {
      return;
    }
    state.activeStage = stageId;
    if (stageId === "process" && state.process.progress < 100) {
      state.process.running = true;
    }
    render();
  }

  function advanceStage(direction) {
    const currentIndex = getStageIndex(state.activeStage);
    const nextIndex = Math.max(0, Math.min(STAGE_ORDER.length - 1, currentIndex + direction));
    setStage(STAGE_ORDER[nextIndex]);
  }

  function setRange(edge, value) {
    const numericValue = Math.max(0, Math.min(100, Number(value) || 0));
    if (edge === "start") {
      state.rangeStart = Math.min(numericValue, state.rangeEnd - 4);
    } else {
      state.rangeEnd = Math.max(numericValue, state.rangeStart + 4);
    }
    render();
  }

  function formatTime(ms) {
    const total = Math.max(0, Math.min(TOTAL_DURATION_MS, Math.round(ms)));
    const minutes = Math.floor(total / 60000);
    const seconds = Math.floor((total % 60000) / 1000);
    const centiseconds = Math.floor((total % 1000) / 10);
    return [
      String(minutes).padStart(2, "0"),
      String(seconds).padStart(2, "0"),
      String(centiseconds).padStart(2, "0"),
    ].join(":");
  }

  function formatDuration(seconds) {
    if (typeof seconds !== "number" || Number.isFinite(seconds) === false || seconds <= 0) {
      return "--";
    }
    const total = Math.floor(seconds);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const remainingSeconds = total % 60;
    if (hours > 0) {
      return [hours, minutes, remainingSeconds].map((item) => String(item).padStart(2, "0")).join(":");
    }
    return [minutes, remainingSeconds].map((item) => String(item).padStart(2, "0")).join(":");
  }

  function getRangeTimes() {
    return {
      start: formatTime((TOTAL_DURATION_MS * state.rangeStart) / 100),
      end: formatTime((TOTAL_DURATION_MS * state.rangeEnd) / 100),
    };
  }

  function setLastAction(message) {
    state.ui.lastActionMessage = message;
  }

  function getActionDomain(action) {
    switch (action) {
      case "project-create":
      case "project-select":
      case "project-delete":
        return "project";
      case "source-set-kind":
      case "source-set-mode":
      case "source-update-draft":
      case "refresh":
        return "source-config";
      case "source-pick-local":
      case "source-download-url":
      case "source-download-youtube":
        return "source-acquire";
      case "tool-install":
      case "tool-update":
      case "tools-refresh":
        return "tools";
      default:
        return "misc";
    }
  }

  function rememberRequest(requestId, action) {
    const domain = getActionDomain(action);
    const nextSequence = state.ui.requestCounter + 1;
    state.ui.requestCounter = nextSequence;
    state.ui.latestRequestByDomain[domain] = nextSequence;
    state.ui.requestLookup[requestId] = {
      domain: domain,
      sequence: nextSequence,
    };

    const lookupEntries = Object.entries(state.ui.requestLookup);
    if (lookupEntries.length > 120) {
      lookupEntries
        .sort(function (left, right) {
          return Number(toRecord(right[1]).sequence) - Number(toRecord(left[1]).sequence);
        })
        .slice(100)
        .forEach(function (entry) {
          delete state.ui.requestLookup[entry[0]];
        });
    }
  }

  function shouldIgnoreCorrelatedPayload(requestId, action) {
    if (typeof requestId !== "string" || requestId.trim() === "") {
      return false;
    }

    const tracked = toRecord(state.ui.requestLookup[requestId]);
    const trackedDomain =
      typeof tracked.domain === "string" && tracked.domain.trim() !== "" ? tracked.domain : null;
    const trackedSequence =
      typeof tracked.sequence === "number" && Number.isFinite(tracked.sequence)
        ? tracked.sequence
        : null;

    if (trackedDomain === null || trackedSequence === null) {
      return false;
    }

    const domain = getActionDomain(action || trackedDomain);
    const latestSequence = Number(state.ui.latestRequestByDomain[domain] || 0);
    return trackedDomain === domain && trackedSequence < latestSequence;
  }

  function getSourceSnapshot() {
    return toRecord(state.sourceSnapshot);
  }

  function getActiveProject() {
    const project = getSourceSnapshot().activeProject;
    return project && typeof project === "object" && Array.isArray(project) === false ? project : null;
  }

  function getProjectSummaries() {
    const projects = getSourceSnapshot().projects;
    return Array.isArray(projects) ? projects : [];
  }

  function getSourcePresets() {
    return toRecord(getSourceSnapshot().sourcePresets);
  }

  function getYtDlpForm() {
    return toRecord(getSourceSnapshot().ytDlpForm);
  }

  function getProjectSource() {
    const project = getActiveProject();
    return project ? toRecord(project.source) : {};
  }

  function getSourceMetadata() {
    return toRecord(getProjectSource().metadata);
  }

  function getToolEntry(toolId) {
    const tools = toRecord(toRecord(getSourceSnapshot().toolState).tools);
    return toRecord(tools[toolId]);
  }

  function getJobs() {
    const jobs = getSourceSnapshot().jobs;
    return Array.isArray(jobs) ? jobs : [];
  }

  function getRelevantJobs() {
    const project = getActiveProject();
    const toolJobs = [];
    const projectJobs = [];

    getJobs().forEach(function (job) {
      const jobRecord = toRecord(job);
      if (project && jobRecord.projectId === project.id) {
        projectJobs.push(jobRecord);
        return;
      }
      if (typeof jobRecord.toolId === "string" && jobRecord.toolId.trim() !== "") {
        toolJobs.push(jobRecord);
      }
    });

    return {
      project: projectJobs,
      tools: toolJobs,
    };
  }

  function getCurrentDrafts() {
    const source = getProjectSource();
    const drafts = toRecord(source.drafts);

    if (state.ui.localDraftProjectId !== getSourceSnapshot().activeProjectId) {
      state.ui.localDraftProjectId = getSourceSnapshot().activeProjectId;
      state.ui.localDrafts = {
        urlInput: typeof drafts.urlInput === "string" ? drafts.urlInput : "",
        youtubeUrl: typeof drafts.youtubeUrl === "string" ? drafts.youtubeUrl : "",
        fileNameHint: typeof drafts.fileNameHint === "string" ? drafts.fileNameHint : "",
        youtubePreset:
          typeof drafts.youtubePreset === "string" && drafts.youtubePreset.trim() !== ""
            ? drafts.youtubePreset
            : null,
        youtubeCustom: { ...toRecord(drafts.youtubeCustom) },
      };
    }

    return {
      ...drafts,
      ...state.ui.localDrafts,
      youtubeCustom: {
        ...toRecord(drafts.youtubeCustom),
        ...toRecord(state.ui.localDrafts.youtubeCustom),
      },
    };
  }

  function getSourceConfig(kind) {
    const sourceTypes = toRecord(getSourcePresets().sourceTypes);
    return toRecord(sourceTypes[kind]);
  }

  function getSourceModeOptions(kind) {
    const config = getSourceConfig(kind);
    return Array.isArray(config.modes) ? config.modes : [];
  }

  function getCurrentSourceKind() {
    const source = getProjectSource();
    const kind = typeof source.kind === "string" ? source.kind : null;
    return SOURCE_FORMATS.includes(kind) ? kind : "video";
  }

  function getCurrentSourceMode() {
    const kind = getCurrentSourceKind();
    const source = getProjectSource();
    const mode = typeof source.mode === "string" ? source.mode : null;
    const modes = getSourceModeOptions(kind);
    return modes.includes(mode) ? mode : modes[0] || "local";
  }

  function getCurrentSourceLabel() {
    return text(["mediaAnalysis", "source", "formats", getCurrentSourceKind(), "title"]);
  }

  function getProfileLabel() {
    return text(["mediaAnalysis", "profile", "presets", state.profilePreset, "title"]);
  }

  function getFocusLabel() {
    return text(["mediaAnalysis", "profile", "focusTabs", state.profileFocus]);
  }

  function getRegionLabel() {
    return text(["mediaAnalysis", "edit", "regions", state.region]);
  }

  function getPreferredSourceDuration(previewUrl) {
    const metadata = getSourceMetadata();
    if (typeof metadata.durationSeconds === "number" && metadata.durationSeconds > 0) {
      return metadata.durationSeconds;
    }
    return state.ui.previewMetrics.url === previewUrl ? state.ui.previewMetrics.duration : null;
  }

  function getPreferredSourceResolution(previewUrl) {
    const metadata = getSourceMetadata();
    const width =
      typeof metadata.width === "number" && metadata.width > 0
        ? metadata.width
        : state.ui.previewMetrics.url === previewUrl
          ? state.ui.previewMetrics.width
          : null;
    const height =
      typeof metadata.height === "number" && metadata.height > 0
        ? metadata.height
        : state.ui.previewMetrics.url === previewUrl
          ? state.ui.previewMetrics.height
          : null;

    if (typeof width === "number" && typeof height === "number") {
      return `${width} x ${height}`;
    }

    return "--";
  }

  function getPreferredSourceCodec() {
    const metadata = getSourceMetadata();
    return (
      (typeof metadata.codec === "string" && metadata.codec.trim() !== "" && metadata.codec) ||
      (typeof metadata.videoCodec === "string" &&
        metadata.videoCodec.trim() !== "" &&
        metadata.videoCodec) ||
      (typeof metadata.audioCodec === "string" &&
        metadata.audioCodec.trim() !== "" &&
        metadata.audioCodec) ||
      "--"
    );
  }

  function getPreferredSourceFormat() {
    const metadata = getSourceMetadata();
    const source = getProjectSource();
    return (
      (typeof metadata.formatName === "string" &&
        metadata.formatName.trim() !== "" &&
        metadata.formatName) ||
      (typeof source.mimeType === "string" && source.mimeType.trim() !== "" && source.mimeType) ||
      "--"
    );
  }

  function formatBitRate(bitsPerSecond) {
    if (
      typeof bitsPerSecond !== "number" ||
      Number.isFinite(bitsPerSecond) === false ||
      bitsPerSecond <= 0
    ) {
      return "--";
    }

    if (bitsPerSecond >= 1_000_000) {
      return `${(bitsPerSecond / 1_000_000).toFixed(1)} Mbps`;
    }

    return `${Math.round(bitsPerSecond / 1000)} kbps`;
  }

  function chooseRegion(regionId) {
    if (REGION_OPTIONS.includes(regionId) === false) {
      return;
    }
    state.region = regionId;
    render();
  }

  function chooseProfilePreset(profileId) {
    if (PROFILE_PRESETS.includes(profileId) === false) {
      return;
    }
    state.profilePreset = profileId;
    render();
  }

  function chooseProfileFocus(focusId) {
    if (PROFILE_FOCUS.includes(focusId) === false) {
      return;
    }
    state.profileFocus = focusId;
    render();
  }

  function toggleCleanup(key) {
    if (Object.prototype.hasOwnProperty.call(state.cleanup, key) === false) {
      return;
    }
    state.cleanup[key] = state.cleanup[key] !== true;
    render();
  }

  function restartProcess() {
    state.process.running = true;
    state.process.progress = 12;
    state.activeStage = "process";
    render();
  }

  function openReport() {
    state.process.progress = 100;
    state.process.running = false;
    state.activeStage = "report";
    render();
  }

  function resetJourney() {
    state.activeStage = "source";
    state.rangeStart = 18;
    state.rangeEnd = 72;
    state.region = "containment";
    state.cleanup.audio = true;
    state.cleanup.sharpness = true;
    state.cleanup.aiSanitize = false;
    state.profileFocus = "video";
    state.profilePreset = "balanced";
    state.process.progress = 54;
    state.process.running = false;
    render();
  }

  function nextRequestId(action) {
    return [action, Date.now(), Math.random().toString(36).slice(2, 8)].join("-");
  }

  function sendSourceAction(action, payload) {
    if (!window.roomAPI || typeof window.roomAPI.sendEvent !== "function") {
      setLastAction(bootstrapText("roomApiUnavailable"));
      render();
      return null;
    }

    const requestId = nextRequestId(action);
    state.ui.lastRequestId = requestId;
    rememberRequest(requestId, action);
    window.roomAPI.sendEvent("source-action", {
      requestId: requestId,
      action: action,
      payload: payload || {},
    });
    return requestId;
  }

  function syncDraftField(path, value) {
    if (path === "youtubePreset") {
      state.ui.localDrafts.youtubePreset = value;
      return;
    }
    if (path.indexOf("youtubeCustom.") === 0) {
      const key = path.replace("youtubeCustom.", "");
      state.ui.localDrafts.youtubeCustom[key] = value;
      return;
    }
    state.ui.localDrafts[path] = value;
  }

  function buildCurrentDraftPayload() {
    return {
      urlInput: state.ui.localDrafts.urlInput,
      youtubeUrl: state.ui.localDrafts.youtubeUrl,
      fileNameHint: state.ui.localDrafts.fileNameHint,
      youtubePreset: state.ui.localDrafts.youtubePreset,
      youtubeCustom: { ...state.ui.localDrafts.youtubeCustom },
    };
  }

  function persistDrafts(extraFields) {
    const nextFields = {
      ...buildCurrentDraftPayload(),
      ...toRecord(extraFields),
      youtubeCustom: {
        ...toRecord(buildCurrentDraftPayload().youtubeCustom),
        ...toRecord(toRecord(extraFields).youtubeCustom),
      },
    };
    sendSourceAction("source-update-draft", { fields: nextFields });
  }

  function openSettingsOverlay() {
    state.ui.settingsOpen = true;
    render();
    sendSourceAction("tools-refresh");
  }

  function closeSettingsOverlay() {
    state.ui.settingsOpen = false;
    render();
  }

  function getProjectStatusLabel(source) {
    if (source.status === "error") {
      return text(["mediaAnalysis", "settings", "status", "error"]);
    }
    if (typeof source.storedPath === "string" && source.storedPath.trim() !== "") {
      return text(["mediaAnalysis", "settings", "status", "ready"]);
    }
    return text(["mediaAnalysis", "settings", "status", "idle"]);
  }

  function renderBootstrap() {
    return `
      <section class="lab-bootstrap">
        <div class="lab-bootstrap__panel">
          <h1 class="lab-bootstrap__title">${escapeHtml(bootstrapText("loadingTitle"))}</h1>
          <p class="lab-bootstrap__body">${escapeHtml(bootstrapText("loadingBody"))}</p>
        </div>
      </section>
    `;
  }

  function renderStageRail() {
    const currentIndex = getStageIndex(state.activeStage);

    return `
      <header class="lab-topbar">
        <div class="lab-stage-rail">
          <button
            class="lab-stage-nav"
            type="button"
            data-action="nav-previous"
            ${currentIndex === 0 ? "disabled" : ""}
          >
            ${escapeHtml(text(["mediaAnalysis", "stageNav", "previous"]))}
          </button>
          <div class="lab-stage-rail__track" role="tablist" aria-label="Stages">
            ${STAGE_ORDER.map(function (stageId, index) {
              const stateName =
                stageId === state.activeStage
                  ? "active"
                  : index < currentIndex
                    ? "complete"
                    : "idle";
              return `
                <button
                  class="lab-stage-pill"
                  type="button"
                  role="tab"
                  aria-selected="${stageId === state.activeStage ? "true" : "false"}"
                  data-stage-target="${stageId}"
                  data-state="${stateName}"
                >
                  <span class="lab-stage-pill__index">${String(index + 1)}</span>
                  <span class="lab-stage-pill__label">${escapeHtml(
                    text(["mediaAnalysis", "stages", stageId])
                  )}</span>
                </button>
              `;
            }).join("")}
          </div>
          <button
            class="lab-stage-nav"
            type="button"
            data-action="nav-next"
            ${currentIndex === STAGE_ORDER.length - 1 ? "disabled" : ""}
          >
            ${escapeHtml(text(["mediaAnalysis", "stageNav", "next"]))}
          </button>
          <button
            class="lab-rail-icon"
            type="button"
            data-action="open-settings"
            aria-label="${escapeHtml(text(["mediaAnalysis", "settings", "title"]))}"
            title="${escapeHtml(text(["mediaAnalysis", "settings", "title"]))}"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10.4 2h3.2l.6 2.6a7.8 7.8 0 0 1 1.8.8L18.4 4l2.2 2.2-1.4 2.4c.3.6.6 1.2.8 1.8L22 11.2v3.2l-2.6.6a7.8 7.8 0 0 1-.8 1.8l1.4 2.4-2.2 2.2-2.4-1.4a7.8 7.8 0 0 1-1.8.8L13.6 22h-3.2l-.6-2.6a7.8 7.8 0 0 1-1.8-.8L5.6 20 3.4 17.8l1.4-2.4a7.8 7.8 0 0 1-.8-1.8L2 13.6v-3.2l2.6-.6a7.8 7.8 0 0 1 .8-1.8L4 5.6 6.2 3.4l2.4 1.4a7.8 7.8 0 0 1 1.8-.8L10.4 2Zm1.6 6a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"></path>
            </svg>
          </button>
        </div>
      </header>
    `;
  }

  function renderStageIntro(stageId) {
    return `
      <section class="lab-stage-copy">
        <h1 class="lab-stage-copy__title">${escapeHtml(text(["mediaAnalysis", stageId, "title"]))}</h1>
        <p class="lab-stage-copy__subtitle">${escapeHtml(
          text(["mediaAnalysis", stageId, "subtitle"])
        )}</p>
      </section>
    `;
  }

  function renderPreviewMetaRow(label, value) {
    return `
      <li>
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value || "--")}</strong>
      </li>
    `;
  }

  function renderPreviewSurface() {
    const project = getActiveProject();
    const source = getProjectSource();
    const previewUrl =
      typeof source.previewUrl === "string" && source.previewUrl.trim() !== "" ? source.previewUrl : null;
    const fileName =
      typeof source.storedFileName === "string" && source.storedFileName.trim() !== ""
        ? source.storedFileName
        : "--";
    const sourceMode = getCurrentSourceMode();
    const routeLabel =
      typeof source.routeLabel === "string" && source.routeLabel.trim() !== ""
        ? source.routeLabel
        : text(["mediaAnalysis", "source", "modes", sourceMode]);

    const projectJobs = getRelevantJobs().project;
    const activeJob = projectJobs.length > 0 ? projectJobs[0] : null;

    let mediaMarkup = `
      <div class="lab-empty-preview">
        <strong>${escapeHtml(text(["mediaAnalysis", "source", "previewEmptyTitle"]))}</strong>
        <p>${escapeHtml(text(["mediaAnalysis", "source", "previewEmptyBody"]))}</p>
      </div>
    `;

    if (previewUrl !== null) {
      if (getCurrentSourceKind() === "image") {
        mediaMarkup = `<img class="lab-preview-media lab-preview-media--image" data-preview-media="image" src="${previewUrl}" alt="" />`;
      } else if (getCurrentSourceKind() === "audio") {
        mediaMarkup = `<audio class="lab-preview-media lab-preview-media--audio" data-preview-media="audio" src="${previewUrl}" controls preload="metadata"></audio>`;
      } else {
        mediaMarkup = `<video class="lab-preview-media lab-preview-media--video" data-preview-media="video" src="${previewUrl}" controls preload="metadata"></video>`;
      }
    }

    const infoRows = [
      renderPreviewMetaRow(text(["mediaAnalysis", "source", "previewInfo", "route"]), routeLabel),
      renderPreviewMetaRow(text(["mediaAnalysis", "source", "previewInfo", "file"]), fileName),
      renderPreviewMetaRow(
        text(["mediaAnalysis", "source", "previewInfo", "status"]),
        getProjectStatusLabel(source)
      ),
      renderPreviewMetaRow(
        text(["mediaAnalysis", "source", "previewInfo", "source"]),
        typeof source.sourceUrl === "string" && source.sourceUrl.trim() !== "" ? source.sourceUrl : "--"
      ),
      renderPreviewMetaRow(
        text(["mediaAnalysis", "shared", "duration"]),
        formatDuration(getPreferredSourceDuration(previewUrl))
      ),
      renderPreviewMetaRow(
        text(["mediaAnalysis", "shared", "resolution"]),
        getPreferredSourceResolution(previewUrl)
      ),
      renderPreviewMetaRow(text(["mediaAnalysis", "shared", "codec"]), getPreferredSourceCodec()),
      renderPreviewMetaRow(text(["mediaAnalysis", "shared", "format"]), getPreferredSourceFormat()),
      renderPreviewMetaRow(
        text(["mediaAnalysis", "shared", "bitrate"]),
        formatBitRate(getSourceMetadata().bitRate)
      ),
    ];

    return `
      <section class="lab-panel lab-preview-panel">
        <div class="lab-preview-panel__header">
          <div>
            <p class="lab-panel__subtitle">${escapeHtml(project ? project.name : "--")}</p>
            <h2 class="lab-panel__title">${escapeHtml(getCurrentSourceLabel())}</h2>
          </div>
          <span class="lab-chip">${escapeHtml(getProjectStatusLabel(source))}</span>
        </div>
        <div class="lab-preview-card">
          <div class="lab-preview-frame">
            ${mediaMarkup}
          </div>
          <div class="lab-preview-copy">
            <ul class="lab-meta-list">${infoRows.join("")}</ul>
            ${
              activeJob
                ? `
                  <div class="lab-status-card">
                    <div class="lab-status-card__head">
                      <strong>${escapeHtml(text(["mediaAnalysis", "source", "jobs", "title"]))}</strong>
                      <span>${escapeHtml(
                        typeof activeJob.percent === "number" ? `${Math.round(activeJob.percent)}%` : activeJob.stage || "--"
                      )}</span>
                    </div>
                    <div class="lab-progress-bar">
                      <span style="width:${Math.max(4, Number(activeJob.percent) || 6)}%"></span>
                    </div>
                    <p class="lab-status-card__body">${escapeHtml(activeJob.message || activeJob.stage || "")}</p>
                  </div>
                `
                : ""
            }
          </div>
        </div>
      </section>
    `;
  }

  function renderProjectPanel() {
    const projects = getProjectSummaries();
    const activeProjectId = getSourceSnapshot().activeProjectId;
    const activeProject = getActiveProject();

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "projects", "eyebrow"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "projects", "title"]))}</h2>
          </div>
          <button class="lab-button lab-button--ghost lab-button--tight" type="button" data-action="project-create">
            ${escapeHtml(text(["mediaAnalysis", "projects", "newAction"]))}
          </button>
        </div>
        <div class="lab-project-card">
          <strong>${escapeHtml(activeProject ? activeProject.name : text(["mediaAnalysis", "projects", "empty"]))}</strong>
          <span>${escapeHtml(activeProject ? activeProject.updatedAt : "--")}</span>
        </div>
        <div class="lab-field">
          <label class="lab-field__label" for="project-select">${escapeHtml(
            text(["mediaAnalysis", "projects", "selectLabel"])
          )}</label>
          <select class="lab-select" id="project-select" data-select="project">
            ${projects
              .map(function (project) {
                return `
                  <option value="${escapeHtml(project.id)}" ${
                    project.id === activeProjectId ? "selected" : ""
                  }>
                    ${escapeHtml(project.name)}
                  </option>
                `;
              })
              .join("")}
          </select>
        </div>
        <div class="lab-action-stack">
          ${
            state.ui.pendingDeleteProjectId === activeProjectId
              ? `
                <button class="lab-button lab-button--danger" type="button" data-action="project-delete-confirm">
                  ${escapeHtml(text(["mediaAnalysis", "projects", "deleteConfirm"]))}
                </button>
                <button class="lab-button lab-button--ghost" type="button" data-action="project-delete-cancel">
                  ${escapeHtml(text(["mediaAnalysis", "projects", "deleteCancel"]))}
                </button>
              `
              : `
                <button class="lab-button lab-button--ghost" type="button" data-action="project-delete-arm">
                  ${escapeHtml(text(["mediaAnalysis", "projects", "deleteAction"]))}
                </button>
              `
          }
        </div>
      </section>
    `;
  }

  function renderSourceKindPanel() {
    const currentKind = getCurrentSourceKind();
    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "source", "formatLabel"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "source", "title"]))}</h2>
          </div>
        </div>
        <div class="lab-source-grid">
          ${SOURCE_FORMATS.map(function (sourceId) {
            return `
              <button
                class="lab-source-card"
                type="button"
                data-action="source-kind"
                data-value="${sourceId}"
                data-selected="${sourceId === currentKind ? "true" : "false"}"
              >
                <span class="lab-source-card__icon">${escapeHtml(sourceId.slice(0, 1).toUpperCase())}</span>
                <span class="lab-source-card__title">${escapeHtml(
                  text(["mediaAnalysis", "source", "formats", sourceId, "title"])
                )}</span>
                <span class="lab-source-card__subtitle">${escapeHtml(
                  text(["mediaAnalysis", "source", "formats", sourceId, "subtitle"])
                )}</span>
              </button>
            `;
          }).join("")}
        </div>
      </section>
    `;
  }

  function renderSourceModes() {
    const currentKind = getCurrentSourceKind();
    const currentMode = getCurrentSourceMode();
    const modes = getSourceModeOptions(currentKind);
    const ytDlpInstalled = getToolEntry("yt-dlp").installed === true;

    return `
      <div class="lab-segmented">
        ${modes
          .map(function (modeId) {
            const disabled = modeId === "youtube" && ytDlpInstalled !== true;
            return `
              <button
                class="lab-segmented__button"
                type="button"
                data-action="source-mode"
                data-value="${modeId}"
                data-selected="${modeId === currentMode ? "true" : "false"}"
                ${disabled ? "disabled" : ""}
              >
                ${escapeHtml(text(["mediaAnalysis", "source", "modes", modeId]))}
              </button>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderTextField(fieldId, value, label, placeholder, extra) {
    return `
      <label class="lab-field">
        <span class="lab-field__label">${escapeHtml(label)}</span>
        <input
          class="lab-input"
          type="${escapeHtml(extra && extra.type ? extra.type : "text")}"
          value="${escapeHtml(value || "")}"
          data-draft-field="${escapeHtml(fieldId)}"
          placeholder="${escapeHtml(placeholder || "")}"
        />
      </label>
    `;
  }

  function renderYoutubeCustomForm(drafts) {
    const sections = Array.isArray(getYtDlpForm().sections) ? getYtDlpForm().sections : [];
    return `
      <div class="lab-form-stack">
        ${sections
          .map(function (section) {
            const fields = Array.isArray(section.fields) ? section.fields : [];
            return `
              <div class="lab-form-section">
                <div class="lab-form-grid">
                  ${fields
                    .map(function (field) {
                      const value = toRecord(drafts.youtubeCustom)[field.id];
                      if (field.type === "toggle") {
                        return `
                          <button
                            class="lab-toggle"
                            type="button"
                            data-toggle-field="youtubeCustom.${field.id}"
                            data-active="${value === true ? "true" : "false"}"
                          >
                            <span class="lab-toggle__track"><span class="lab-toggle__thumb"></span></span>
                            <span class="lab-toggle__label">${escapeHtml(textFromKey(field.labelKey))}</span>
                          </button>
                        `;
                      }

                      if (field.type === "select") {
                        return `
                          <label class="lab-field">
                            <span class="lab-field__label">${escapeHtml(textFromKey(field.labelKey))}</span>
                            <select class="lab-select" data-draft-field="youtubeCustom.${field.id}">
                              ${(Array.isArray(field.options) ? field.options : [])
                                .map(function (option) {
                                  return `
                                    <option value="${escapeHtml(option.value)}" ${
                                      String(option.value) === String(value) ? "selected" : ""
                                    }>
                                      ${escapeHtml(textFromKey(option.labelKey))}
                                    </option>
                                  `;
                                })
                                .join("")}
                            </select>
                          </label>
                        `;
                      }

                      return renderTextField(
                        `youtubeCustom.${field.id}`,
                        value,
                        textFromKey(field.labelKey),
                        textFromKey(field.placeholderKey),
                        {
                          type: field.type === "number" ? "number" : "text",
                        }
                      );
                    })
                    .join("")}
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderSourceIntakePanel() {
    const currentMode = getCurrentSourceMode();
    const drafts = getCurrentDrafts();
    const ytDlpInstalled = getToolEntry("yt-dlp").installed === true;
    const youtubePreset = typeof drafts.youtubePreset === "string" && drafts.youtubePreset.trim() !== "" ? drafts.youtubePreset : "medium";

    let body = "";

    if (currentMode === "local") {
      body = `
        ${renderTextField(
          "fileNameHint",
          drafts.fileNameHint,
          text(["mediaAnalysis", "source", "fields", "fileNameHint"]),
          text(["mediaAnalysis", "source", "placeholders", "fileNameHint"])
        )}
        <button class="lab-button lab-button--primary" type="button" data-action="source-pick-local">
          ${escapeHtml(text(["mediaAnalysis", "source", "actions", "pickLocal"]))}
        </button>
      `;
    } else if (currentMode === "url") {
      body = `
        ${renderTextField(
          "urlInput",
          drafts.urlInput,
          text(["mediaAnalysis", "source", "fields", "urlInput"]),
          text(["mediaAnalysis", "source", "placeholders", "urlInput"])
        )}
        ${renderTextField(
          "fileNameHint",
          drafts.fileNameHint,
          text(["mediaAnalysis", "source", "fields", "fileNameHint"]),
          text(["mediaAnalysis", "source", "placeholders", "fileNameHint"])
        )}
        <button class="lab-button lab-button--primary" type="button" data-action="source-download-url">
          ${escapeHtml(text(["mediaAnalysis", "source", "actions", "downloadUrl"]))}
        </button>
      `;
    } else {
      body = `
        ${
          ytDlpInstalled !== true
            ? `<div class="lab-notice">${escapeHtml(text(["mediaAnalysis", "source", "youtubeDisabled"]))}</div>`
            : ""
        }
        ${renderTextField(
          "youtubeUrl",
          drafts.youtubeUrl,
          text(["mediaAnalysis", "source", "fields", "youtubeUrl"]),
          text(["mediaAnalysis", "source", "placeholders", "youtubeUrl"])
        )}
        <div class="lab-field">
          <span class="lab-field__label">${escapeHtml(text(["mediaAnalysis", "source", "youtubePresetLabel"]))}</span>
          <div class="lab-chip-row">
            ${["low", "medium", "best", "custom"]
              .map(function (presetId) {
                return `
                  <button
                    class="lab-choice-chip"
                    type="button"
                    data-action="youtube-preset"
                    data-value="${presetId}"
                    data-selected="${presetId === youtubePreset ? "true" : "false"}"
                  >
                    ${escapeHtml(text(["mediaAnalysis", "source", "youtubePresets", presetId]))}
                  </button>
                `;
              })
              .join("")}
          </div>
        </div>
        ${youtubePreset === "custom" ? renderYoutubeCustomForm(drafts) : ""}
        <button
          class="lab-button lab-button--primary"
          type="button"
          data-action="source-download-youtube"
          ${ytDlpInstalled !== true ? "disabled" : ""}
        >
          ${escapeHtml(text(["mediaAnalysis", "source", "actions", "downloadYoutube"]))}
        </button>
      `;
    }

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "source", "modeLabel"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "source", "intakeTitle"]))}</h2>
          </div>
        </div>
        ${renderSourceModes()}
        <div class="lab-form-stack">${body}</div>
      </section>
    `;
  }

  function renderToolCard(toolId) {
    const tool = getToolEntry(toolId);
    const busy = tool.busy === true;
    const updateAvailable = tool.updateAvailable === true;
    const statusLabel =
      tool.installed === true
        ? updateAvailable
          ? text(["mediaAnalysis", "settings", "status", "updateAvailable"])
          : text(["mediaAnalysis", "settings", "status", "installed"])
        : text(["mediaAnalysis", "settings", "status", "missing"]);

    return `
      <article class="lab-tool-card">
        <div class="lab-tool-card__head">
          <div>
            <strong>${escapeHtml(text(["mediaAnalysis", "settings", "tools", toolId]))}</strong>
            <span>${escapeHtml(statusLabel)}</span>
          </div>
          ${
            tool.installed === true
              ? `
                <button
                  class="lab-button lab-button--ghost lab-button--tight"
                  type="button"
                  data-action="tool-update"
                  data-value="${toolId}"
                  ${busy ? "disabled" : ""}
                >
                  ${escapeHtml(text(["mediaAnalysis", "settings", "updateAction"]))}
                </button>
              `
              : `
                <button
                  class="lab-button lab-button--primary lab-button--tight"
                  type="button"
                  data-action="tool-install"
                  data-value="${toolId}"
                  ${busy ? "disabled" : ""}
                >
                  ${escapeHtml(text(["mediaAnalysis", "settings", "installAction"]))}
                </button>
              `
          }
        </div>
        <ul class="lab-summary-list">
          ${renderPreviewMetaRow(text(["mediaAnalysis", "settings", "versionLabel"]), tool.version || "--")}
          ${renderPreviewMetaRow(
            text(["mediaAnalysis", "settings", "latestLabel"]),
            tool.latestVersion || tool.latestReleaseName || "--"
          )}
          ${renderPreviewMetaRow(
            text(["mediaAnalysis", "settings", "pathLabel"]),
            tool.binaryPath || "--"
          )}
        </ul>
        ${
          busy
            ? `<p class="lab-panel__hint">${escapeHtml(text(["mediaAnalysis", "settings", "busyHint"]))}</p>`
            : ""
        }
        ${
          typeof tool.lastError === "string" && tool.lastError.trim() !== ""
            ? `<p class="lab-panel__hint lab-panel__hint--danger">${escapeHtml(tool.lastError)}</p>`
            : ""
        }
      </article>
    `;
  }

  function renderSettingsOverlay() {
    if (state.ui.settingsOpen !== true) {
      return "";
    }

    return `
      <div class="lab-overlay" role="dialog" aria-modal="true" aria-label="${escapeHtml(
        text(["mediaAnalysis", "settings", "title"])
      )}">
        <div class="lab-overlay__scrim" data-action="close-settings"></div>
        <section class="lab-overlay__panel">
          <header class="lab-overlay__header">
            <div>
              <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "settings", "eyebrow"]))}</p>
              <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "settings", "title"]))}</h2>
              <p class="lab-panel__subtitle">${escapeHtml(text(["mediaAnalysis", "settings", "subtitle"]))}</p>
            </div>
            <div class="lab-overlay__actions">
              <button class="lab-button lab-button--ghost lab-button--tight" type="button" data-action="tools-refresh">
                ${escapeHtml(text(["mediaAnalysis", "settings", "refreshAction"]))}
              </button>
              <button class="lab-button lab-button--ghost lab-button--tight" type="button" data-action="close-settings">
                ${escapeHtml(text(["mediaAnalysis", "settings", "closeAction"]))}
              </button>
            </div>
          </header>
          <div class="lab-tool-grid">
            ${renderToolCard("yt-dlp")}
            ${renderToolCard("ffmpeg")}
          </div>
        </section>
      </div>
    `;
  }

  function renderSourceStage() {
    return `
      <div class="lab-layout lab-layout--source">
        <section class="lab-main-stack">
          ${renderStageIntro("source")}
          ${renderPreviewSurface()}
        </section>
        <aside class="lab-side-stack">
          ${renderProjectPanel()}
          ${renderSourceKindPanel()}
          ${renderSourceIntakePanel()}
        </aside>
      </div>
    `;
  }

  function renderSummaryRows(rows) {
    return `
      <ul class="lab-summary-list">
        ${rows
          .map(function (row) {
            return `
              <li>
                <span>${escapeHtml(row[0])}</span>
                <strong>${escapeHtml(row[1])}</strong>
              </li>
            `;
          })
          .join("")}
      </ul>
    `;
  }

  function renderToggle(id, label, active) {
    return `
      <button
        class="lab-toggle"
        type="button"
        data-toggle="${id}"
        data-active="${active ? "true" : "false"}"
      >
        <span class="lab-toggle__track"><span class="lab-toggle__thumb"></span></span>
        <span class="lab-toggle__label">${escapeHtml(label)}</span>
      </button>
    `;
  }

  function renderEditStage() {
    const rangeTimes = getRangeTimes();

    return `
      <div class="lab-layout">
        <section class="lab-main-stack">
          ${renderStageIntro("edit")}
          <section class="lab-panel lab-canvas-panel">
            <div class="lab-panel__header">
              <div>
                <p class="lab-panel__eyebrow">${escapeHtml(
                  text(["mediaAnalysis", "edit", "canvasTitle"])
                )}</p>
                <p class="lab-panel__subtitle">${escapeHtml(
                  text(["mediaAnalysis", "edit", "canvasHint"])
                )}</p>
              </div>
            </div>
            <div class="lab-canvas-frame">
              <img class="lab-canvas-frame__image" src="${PREVIEW_IMAGE}" alt="" />
              <div class="lab-canvas-frame__outer"></div>
              <div class="lab-canvas-frame__focus"></div>
            </div>
            <div class="lab-timeline">
              <span>${rangeTimes.start}</span>
              <div class="lab-timeline__track">
                <span
                  class="lab-timeline__window"
                  style="left:${state.rangeStart}%; width:${Math.max(4, state.rangeEnd - state.rangeStart)}%"
                ></span>
              </div>
              <span>${rangeTimes.end}</span>
            </div>
          </section>
          <div class="lab-subgrid">
            <section class="lab-panel">
              <div class="lab-panel__header">
                <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "edit", "timeTitle"]))}</p>
              </div>
              <label class="lab-range-group">
                <span>IN ${rangeTimes.start}</span>
                <input type="range" min="0" max="96" value="${state.rangeStart}" data-range="start" />
              </label>
              <label class="lab-range-group">
                <span>OUT ${rangeTimes.end}</span>
                <input type="range" min="4" max="100" value="${state.rangeEnd}" data-range="end" />
              </label>
            </section>
            <section class="lab-panel">
              <div class="lab-panel__header">
                <p class="lab-panel__eyebrow">${escapeHtml(
                  text(["mediaAnalysis", "edit", "regionTitle"])
                )}</p>
              </div>
              <div class="lab-chip-row">
                ${REGION_OPTIONS.map(function (regionId) {
                  return `
                    <button
                      class="lab-choice-chip"
                      type="button"
                      data-region="${regionId}"
                      data-selected="${regionId === state.region ? "true" : "false"}"
                    >
                      ${escapeHtml(text(["mediaAnalysis", "edit", "regions", regionId]))}
                    </button>
                  `;
                }).join("")}
              </div>
            </section>
            <section class="lab-panel">
              <div class="lab-panel__header">
                <p class="lab-panel__eyebrow">${escapeHtml(
                  text(["mediaAnalysis", "edit", "cleanupTitle"])
                )}</p>
              </div>
              <div class="lab-toggle-grid">
                ${renderToggle(
                  "cleanup-audio",
                  text(["mediaAnalysis", "edit", "cleanup", "audio"]),
                  state.cleanup.audio
                )}
                ${renderToggle(
                  "cleanup-sharpness",
                  text(["mediaAnalysis", "edit", "cleanup", "sharpness"]),
                  state.cleanup.sharpness
                )}
                ${renderToggle(
                  "cleanup-aiSanitize",
                  text(["mediaAnalysis", "edit", "cleanup", "aiSanitize"]),
                  state.cleanup.aiSanitize
                )}
              </div>
            </section>
          </div>
        </section>
        <aside class="lab-side-stack">
          <section class="lab-panel">
            <div class="lab-panel__header">
              <p class="lab-panel__eyebrow">${escapeHtml(
                text(["mediaAnalysis", "edit", "summaryTitle"])
              )}</p>
            </div>
            ${renderSummaryRows([
              [text(["mediaAnalysis", "edit", "selectedWindow"]), rangeTimes.start + " - " + rangeTimes.end],
              [text(["mediaAnalysis", "edit", "selectedRegion"]), getRegionLabel()],
              [text(["mediaAnalysis", "shared", "focus"]), getFocusLabel()],
            ])}
          </section>
        </aside>
      </div>
    `;
  }

  function renderProfileStage() {
    return `
      <div class="lab-layout">
        <section class="lab-main-stack">
          ${renderStageIntro("profile")}
          <section class="lab-panel">
            <div class="lab-tab-row">
              ${PROFILE_FOCUS.map(function (focusId) {
                return `
                  <button
                    class="lab-tab"
                    type="button"
                    data-focus-tab="${focusId}"
                    data-selected="${focusId === state.profileFocus ? "true" : "false"}"
                  >
                    ${escapeHtml(text(["mediaAnalysis", "profile", "focusTabs", focusId]))}
                  </button>
                `;
              }).join("")}
            </div>
            <div class="lab-profile-grid">
              ${PROFILE_PRESETS.map(function (presetId) {
                return `
                  <button
                    class="lab-profile-card"
                    type="button"
                    data-profile-preset="${presetId}"
                    data-selected="${presetId === state.profilePreset ? "true" : "false"}"
                  >
                    <span class="lab-profile-card__title">${escapeHtml(
                      text(["mediaAnalysis", "profile", "presets", presetId, "title"])
                    )}</span>
                    <span class="lab-profile-card__summary">${escapeHtml(
                      text(["mediaAnalysis", "profile", "presets", presetId, "summary"])
                    )}</span>
                    <span class="lab-profile-card__pace">${escapeHtml(
                      text(["mediaAnalysis", "profile", "presets", presetId, "pace"])
                    )}</span>
                  </button>
                `;
              }).join("")}
            </div>
          </section>
          <section class="lab-panel">
            <div class="lab-panel__header">
              <p class="lab-panel__eyebrow">${escapeHtml(
                text(["mediaAnalysis", "profile", "routeTitle"])
              )}</p>
            </div>
            <div class="lab-route-strip">
              ${list(["mediaAnalysis", "profile", "routeNodes"])
                .map(function (node, index) {
                  return `
                    <div class="lab-route-node">
                      <span class="lab-route-node__index">${String(index + 1)}</span>
                      <span class="lab-route-node__label">${escapeHtml(node)}</span>
                    </div>
                  `;
                })
                .join("")}
            </div>
          </section>
        </section>
        <aside class="lab-side-stack">
          <section class="lab-panel">
            <div class="lab-panel__header">
              <p class="lab-panel__eyebrow">${escapeHtml(
                text(["mediaAnalysis", "profile", "summaryTitle"])
              )}</p>
            </div>
            ${renderSummaryRows([
              [text(["mediaAnalysis", "shared", "focus"]), getFocusLabel()],
              [text(["mediaAnalysis", "shared", "preset"]), getProfileLabel()],
              [text(["mediaAnalysis", "shared", "route"]), text(["mediaAnalysis", "stages", "process"])],
            ])}
          </section>
        </aside>
      </div>
    `;
  }

  function getProcessStepProgress(index) {
    const start = PROCESS_THRESHOLDS[index];
    const end = PROCESS_THRESHOLDS[index + 1];
    if (typeof end !== "number") {
      return 0;
    }
    if (state.process.progress <= start) {
      return 0;
    }
    if (state.process.progress >= end) {
      return 100;
    }
    return Math.round(((state.process.progress - start) / (end - start)) * 100);
  }

  function renderProcessStage() {
    return `
      <div class="lab-layout">
        <section class="lab-main-stack">
          ${renderStageIntro("process")}
          <section class="lab-panel lab-process-panel">
            ${PROCESS_STEPS.map(function (stepId, index) {
              const progress = getProcessStepProgress(index);
              return `
                <article class="lab-process-row">
                  <div class="lab-process-row__head">
                    <div>
                      <p class="lab-process-row__eyebrow">${String(index + 1)}</p>
                      <h2 class="lab-process-row__title">${escapeHtml(
                        text(["mediaAnalysis", "process", "steps", stepId])
                      )}</h2>
                    </div>
                    <strong>${String(progress)}%</strong>
                  </div>
                  <div class="lab-progress-bar lab-progress-bar--wide">
                    <span style="width:${progress}%"></span>
                  </div>
                </article>
              `;
            }).join("")}
          </section>
        </section>
        <aside class="lab-side-stack">
          <section class="lab-panel">
            <div class="lab-panel__header">
              <p class="lab-panel__eyebrow">${escapeHtml(
                text(["mediaAnalysis", "process", "summaryTitle"])
              )}</p>
            </div>
            ${renderSummaryRows([
              [text(["mediaAnalysis", "shared", "status"]), String(Math.round(state.process.progress)) + "%"],
              [text(["mediaAnalysis", "shared", "focus"]), getFocusLabel()],
              [text(["mediaAnalysis", "shared", "preset"]), getProfileLabel()],
            ])}
            <div class="lab-action-stack">
              <button class="lab-button lab-button--ghost" type="button" data-action="restart-process">
                ${escapeHtml(text(["mediaAnalysis", "process", "controls", "restart"]))}
              </button>
              <button class="lab-button lab-button--primary" type="button" data-action="open-report">
                ${escapeHtml(text(["mediaAnalysis", "process", "controls", "jumpReport"]))}
              </button>
            </div>
          </section>
        </aside>
      </div>
    `;
  }

  function renderSignalCard(value, label) {
    return `
      <article class="lab-signal-card">
        <strong class="lab-signal-card__value">${escapeHtml(value)}</strong>
        <span class="lab-signal-card__label">${escapeHtml(label)}</span>
      </article>
    `;
  }

  function renderFinding(key) {
    return `
      <article class="lab-finding">
        <h3 class="lab-finding__title">${escapeHtml(
          text(["mediaAnalysis", "report", "findings", key, "title"])
        )}</h3>
        <p class="lab-finding__detail">${escapeHtml(
          text(["mediaAnalysis", "report", "findings", key, "detail"])
        )}</p>
      </article>
    `;
  }

  function renderReportStage() {
    const source = getProjectSource();
    const previewUrl =
      typeof source.previewUrl === "string" && source.previewUrl.trim() !== "" ? source.previewUrl : PREVIEW_IMAGE;

    return `
      <div class="lab-layout">
        <section class="lab-main-stack">
          ${renderStageIntro("report")}
          <section class="lab-panel lab-report-hero">
            <div class="lab-report-hero__media">
              <img class="lab-report-hero__image" src="${previewUrl}" alt="" />
            </div>
            <div class="lab-report-hero__copy">
              <div class="lab-panel__header">
                <h2 class="lab-panel__title">${escapeHtml(
                  text(["mediaAnalysis", "shared", "reportReady"])
                )}</h2>
              </div>
              ${renderSummaryRows([
                [text(["mediaAnalysis", "shared", "summary"]), getCurrentSourceLabel()],
                [
                  text(["mediaAnalysis", "shared", "duration"]),
                  formatDuration(getPreferredSourceDuration(getProjectSource().previewUrl || null)),
                ],
                [text(["mediaAnalysis", "shared", "score"]), "76 / 100"],
                [text(["mediaAnalysis", "shared", "risk"]), text(["mediaAnalysis", "shared", "elevatedRisk"])],
              ])}
            </div>
          </section>
          <section class="lab-signal-grid">
            ${renderSignalCard("00:59", text(["mediaAnalysis", "report", "signals", "frameJump"]))}
            ${renderSignalCard("31 ms", text(["mediaAnalysis", "report", "signals", "subcut"]))}
            ${renderSignalCard("2.4 dB", text(["mediaAnalysis", "report", "signals", "audioOffset"]))}
          </section>
          <section class="lab-panel">
            <div class="lab-panel__header">
              <p class="lab-panel__eyebrow">${escapeHtml(
                text(["mediaAnalysis", "report", "findingsTitle"])
              )}</p>
            </div>
            <div class="lab-findings">
              ${renderFinding("continuity")}
              ${renderFinding("metadata")}
              ${renderFinding("audio")}
            </div>
          </section>
        </section>
        <aside class="lab-side-stack">
          <section class="lab-panel">
            ${renderSummaryRows([
              [text(["mediaAnalysis", "shared", "score"]), "76 / 100"],
              [text(["mediaAnalysis", "shared", "risk"]), text(["mediaAnalysis", "shared", "elevatedRisk"])],
              [text(["mediaAnalysis", "shared", "preset"]), getProfileLabel()],
              [text(["mediaAnalysis", "shared", "focus"]), getFocusLabel()],
            ])}
            <div class="lab-action-stack">
              <button class="lab-button lab-button--ghost" type="button" data-action="reset-journey">
                ${escapeHtml(text(["mediaAnalysis", "report", "actions", "restart"]))}
              </button>
              <button class="lab-button lab-button--primary" type="button" data-action="export-report">
                ${escapeHtml(text(["mediaAnalysis", "report", "actions", "export"]))}
              </button>
            </div>
          </section>
        </aside>
      </div>
    `;
  }

  function renderStageContent() {
    switch (state.activeStage) {
      case "edit":
        return renderEditStage();
      case "profile":
        return renderProfileStage();
      case "process":
        return renderProcessStage();
      case "report":
        return renderReportStage();
      case "source":
      default:
        return renderSourceStage();
    }
  }

  function render() {
    const root = document.getElementById("app");
    if (!root) {
      return;
    }

    if (state.translations === null) {
      root.innerHTML = renderBootstrap();
      return;
    }

    root.innerHTML = `
      <main class="lab-shell" data-stage="${state.activeStage}">
        <div class="lab-shell__grain"></div>
        <div class="lab-shell__aura"></div>
        ${renderStageRail()}
        <section class="lab-surface">
          ${renderStageContent()}
        </section>
        <footer class="lab-footer">
          <p class="lab-footer__note">${escapeHtml(
            state.ui.lastActionMessage || text(["mediaAnalysis", "shared", "dummyHint"])
          )}</p>
        </footer>
        ${renderSettingsOverlay()}
      </main>
    `;

    bindPreviewMetrics();
  }

  function bindPreviewMetrics() {
    const media = document.querySelector("[data-preview-media]");
    if (!(media instanceof HTMLVideoElement || media instanceof HTMLAudioElement || media instanceof HTMLImageElement)) {
      state.ui.previewMetrics = {
        url: null,
        duration: null,
        width: null,
        height: null,
      };
      return;
    }

    const nextUrl =
      media instanceof HTMLImageElement
        ? media.currentSrc || media.src
        : media.currentSrc || media.src;

    if (state.ui.previewMetrics.url === nextUrl) {
      return;
    }

    state.ui.previewMetrics = {
      url: nextUrl,
      duration: null,
      width: null,
      height: null,
    };

    if (media instanceof HTMLImageElement) {
      const applyImageMetrics = function () {
        state.ui.previewMetrics.duration = null;
        state.ui.previewMetrics.width = media.naturalWidth || null;
        state.ui.previewMetrics.height = media.naturalHeight || null;
        render();
      };

      if (media.complete) {
        applyImageMetrics();
      } else {
        media.addEventListener("load", applyImageMetrics, { once: true });
      }
      return;
    }

    const applyMediaMetrics = function () {
      state.ui.previewMetrics.duration =
        typeof media.duration === "number" && Number.isFinite(media.duration) ? media.duration : null;
      state.ui.previewMetrics.width =
        media instanceof HTMLVideoElement && media.videoWidth > 0 ? media.videoWidth : null;
      state.ui.previewMetrics.height =
        media instanceof HTMLVideoElement && media.videoHeight > 0 ? media.videoHeight : null;
      render();
    };

    if (media.readyState >= 1) {
      applyMediaMetrics();
    } else {
      media.addEventListener("loadedmetadata", applyMediaMetrics, { once: true });
    }
  }

  function handleHostMessage(message) {
    if (!message || typeof message !== "object" || Array.isArray(message)) {
      return;
    }

    const payload =
      message.payload && typeof message.payload === "object" && Array.isArray(message.payload) === false
        ? message.payload
        : message;

    if (message.type === "host-context") {
      const presentation = toRecord(payload.presentation);
      applyPresentationMode(presentation.mode);
      if (typeof payload.locale === "string") {
        applyLocale(payload.locale);
      }
      if (
        payload.translations &&
        typeof payload.translations === "object" &&
        Array.isArray(payload.translations) === false
      ) {
        state.translations = payload.translations;
      }
      state.context = normalizeContext(payload);
      render();
      return;
    }

    if (message.type === "source-state") {
      if (shouldIgnoreCorrelatedPayload(payload.requestId, payload.action)) {
        return;
      }
      const snapshot =
        payload.snapshot && typeof payload.snapshot === "object" && Array.isArray(payload.snapshot) === false
          ? payload.snapshot
          : {};
      state.sourceSnapshot = snapshot;
      render();
      return;
    }

    if (message.type === "source-action-result") {
      if (shouldIgnoreCorrelatedPayload(payload.requestId, payload.action)) {
        return;
      }
      if (payload.success === true) {
        setLastAction(text(["mediaAnalysis", "messages", payload.action]) || payload.action || "");
      } else if (typeof payload.error === "string" && payload.error.trim() !== "") {
        setLastAction(payload.error);
      }
      render();
      return;
    }

    if (message.type === "source-job") {
      if (shouldIgnoreCorrelatedPayload(payload.requestId, payload.action)) {
        return;
      }
      if (typeof payload.message === "string" && payload.message.trim() !== "") {
        setLastAction(payload.message);
      }
      render();
    }
  }

  function handleAction(action, value) {
    switch (action) {
      case "nav-previous":
        advanceStage(-1);
        return;
      case "nav-next":
        advanceStage(1);
        return;
      case "open-settings":
        openSettingsOverlay();
        return;
      case "close-settings":
        closeSettingsOverlay();
        return;
      case "tools-refresh":
        sendSourceAction("tools-refresh");
        return;
      case "project-create":
        state.ui.pendingDeleteProjectId = null;
        sendSourceAction("project-create");
        return;
      case "project-delete-arm":
        state.ui.pendingDeleteProjectId = getSourceSnapshot().activeProjectId;
        render();
        return;
      case "project-delete-confirm":
        sendSourceAction("project-delete", {
          projectId: state.ui.pendingDeleteProjectId,
        });
        state.ui.pendingDeleteProjectId = null;
        render();
        return;
      case "project-delete-cancel":
        state.ui.pendingDeleteProjectId = null;
        render();
        return;
      case "source-kind":
        sendSourceAction("source-set-kind", { kind: value });
        return;
      case "source-mode":
        sendSourceAction("source-set-mode", { mode: value });
        return;
      case "youtube-preset":
        syncDraftField("youtubePreset", value);
        persistDrafts({ youtubePreset: value });
        return;
      case "source-pick-local":
        sendSourceAction("source-pick-local");
        return;
      case "source-download-url":
        sendSourceAction("source-download-url", {
          fields: buildCurrentDraftPayload(),
        });
        return;
      case "source-download-youtube":
        sendSourceAction("source-download-youtube", {
          fields: buildCurrentDraftPayload(),
        });
        return;
      case "tool-install":
        sendSourceAction("tool-install", { toolId: value });
        return;
      case "tool-update":
        sendSourceAction("tool-update", { toolId: value });
        return;
      case "restart-process":
        restartProcess();
        return;
      case "open-report":
        openReport();
        return;
      case "reset-journey":
        resetJourney();
        return;
      case "export-report":
        setLastAction(text(["mediaAnalysis", "report", "exportQueued"]));
        render();
        return;
      default:
        break;
    }
  }

  document.addEventListener("click", function (event) {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const actionButton = target.closest("[data-action]");
    if (actionButton instanceof HTMLElement) {
      handleAction(actionButton.dataset["action"] || "", actionButton.dataset["value"] || "");
      return;
    }

    const stageButton = target.closest("[data-stage-target]");
    if (stageButton instanceof HTMLElement) {
      setStage(stageButton.dataset["stageTarget"] || "");
      return;
    }

    const regionButton = target.closest("[data-region]");
    if (regionButton instanceof HTMLElement) {
      chooseRegion(regionButton.dataset["region"] || "");
      return;
    }

    const profileButton = target.closest("[data-profile-preset]");
    if (profileButton instanceof HTMLElement) {
      chooseProfilePreset(profileButton.dataset["profilePreset"] || "");
      return;
    }

    const focusButton = target.closest("[data-focus-tab]");
    if (focusButton instanceof HTMLElement) {
      chooseProfileFocus(focusButton.dataset["focusTab"] || "");
      return;
    }

    const toggleButton = target.closest("[data-toggle]");
    if (toggleButton instanceof HTMLElement) {
      const toggleId = toggleButton.dataset["toggle"] || "";
      if (toggleId.startsWith("cleanup-")) {
        toggleCleanup(toggleId.replace("cleanup-", ""));
        return;
      }
    }

    const draftToggle = target.closest("[data-toggle-field]");
    if (draftToggle instanceof HTMLElement) {
      const fieldId = draftToggle.dataset["toggleField"] || "";
      const currentValue = toRecord(state.ui.localDrafts.youtubeCustom)[fieldId.replace("youtubeCustom.", "")] === true;
      syncDraftField(fieldId, currentValue !== true);
      persistDrafts({
        youtubeCustom: {
          ...toRecord(state.ui.localDrafts.youtubeCustom),
        },
      });
      render();
    }
  });

  document.addEventListener("input", function (event) {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.dataset["range"]) {
      setRange(target.dataset["range"], target.value);
      return;
    }

    if (target instanceof HTMLInputElement && target.dataset["draftField"]) {
      syncDraftField(target.dataset["draftField"], target.type === "number" ? Number(target.value) : target.value);
      return;
    }

    if (target instanceof HTMLSelectElement && target.dataset["draftField"]) {
      syncDraftField(target.dataset["draftField"], target.value);
      return;
    }
  });

  document.addEventListener("change", function (event) {
    const target = event.target;

    if (target instanceof HTMLSelectElement && target.dataset["select"] === "project") {
      sendSourceAction("project-select", { projectId: target.value });
      return;
    }

    if (
      (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) &&
      target.dataset["draftField"]
    ) {
      persistDrafts();
    }
  });

  if (window.roomAPI && typeof window.roomAPI.onHostMessage === "function") {
    window.roomAPI.onHostMessage(handleHostMessage);
  } else {
    setLastAction(bootstrapText("roomApiUnavailable"));
  }

  globalThis.setInterval(function () {
    if (state.activeStage === "process" && state.process.running) {
      state.process.progress = Math.min(100, state.process.progress + 3);
      if (state.process.progress >= 100) {
        state.process.running = false;
      }
      render();
    }
  }, 480);

  applyPresentationMode(state.presentation.mode);
  applyLocale(state.locale);
  render();

  if (window.roomAPI && typeof window.roomAPI.ready === "function") {
    window.roomAPI.ready({
      room: ROOM_ID,
      feature: FEATURE_ID,
      stage: "ui-ready",
    });
  }
})();
