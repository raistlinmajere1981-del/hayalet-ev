(function () {
  const ROOM_ID = "laboratory";
  const FEATURE_ID = "media-analysis";
  const STAGE_ORDER = ["source", "edit", "profile", "process", "report"];
  const SOURCE_FORMATS = ["video", "audio", "image"];
  const PROFILE_PRESETS = ["quick", "balanced", "deep"];
  const PROFILE_FOCUS = ["video", "audio", "image"];
  const DOWNLOAD_PRESETS = ["archive", "evidence", "share"];
  const DOWNLOAD_QUALITIES = ["source", "balanced", "expedited"];
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
    sourceType: "video",
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
    download: {
      preset: "archive",
      quality: "source",
      captions: true,
      separateAudio: false,
      progress: 28,
      running: false,
    },
    process: {
      progress: 54,
      running: false,
    },
    lastAction: "",
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

  function list(path) {
    const value = readValue(state.translations, path);
    return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
  }

  function interpolate(value, params) {
    return value.replace(/\{([a-zA-Z0-9_]+)\}/g, function (_, key) {
      return Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : "";
    });
  }

  function templateText(path, params) {
    return interpolate(text(path), params);
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
    const room =
      source.room && typeof source.room === "object" && Array.isArray(source.room) === false
        ? source.room
        : {};
    const user =
      source.user && typeof source.user === "object" && Array.isArray(source.user) === false
        ? source.user
        : {};
    const presentation =
      source.presentation &&
      typeof source.presentation === "object" &&
      Array.isArray(source.presentation) === false
        ? source.presentation
        : {};

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

  function getRangeTimes() {
    return {
      start: formatTime((TOTAL_DURATION_MS * state.rangeStart) / 100),
      end: formatTime((TOTAL_DURATION_MS * state.rangeEnd) / 100),
    };
  }

  function getActiveSourceLabel() {
    return text(["mediaAnalysis", "source", "formats", state.sourceType, "title"]);
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

  function getDownloadPresetLabel() {
    return text(["mediaAnalysis", "download", "presets", state.download.preset]);
  }

  function getDownloadQualityLabel() {
    return text(["mediaAnalysis", "download", "qualities", state.download.quality]);
  }

  function getDownloadStatusLabel() {
    if (state.download.running) {
      return text(["mediaAnalysis", "download", "statusActive"]);
    }
    if (state.download.progress >= 100) {
      return text(["mediaAnalysis", "download", "statusDone"]);
    }
    return text(["mediaAnalysis", "download", "statusReady"]);
  }

  function getProcessStatusLabel() {
    return state.process.progress >= 100
      ? text(["mediaAnalysis", "process", "summaryStatusDone"])
      : text(["mediaAnalysis", "process", "summaryStatusActive"]);
  }

  function getProcessHintLabel() {
    return state.process.progress >= 100
      ? text(["mediaAnalysis", "process", "summaryHintDone"])
      : text(["mediaAnalysis", "process", "summaryHintActive"]);
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

  function setLastAction(message) {
    state.lastAction = message;
  }

  function chooseSourceFormat(sourceId) {
    if (SOURCE_FORMATS.includes(sourceId) === false) {
      return;
    }
    state.sourceType = sourceId;
    setLastAction(
      getActiveSourceLabel() + " " + text(["mediaAnalysis", "shared", "summary"])
    );
    render();
  }

  function chooseRegion(regionId) {
    if (REGION_OPTIONS.includes(regionId) === false) {
      return;
    }
    state.region = regionId;
    setLastAction(getRegionLabel() + " " + text(["mediaAnalysis", "shared", "status"]));
    render();
  }

  function chooseProfilePreset(profileId) {
    if (PROFILE_PRESETS.includes(profileId) === false) {
      return;
    }
    state.profilePreset = profileId;
    setLastAction(getProfileLabel() + " " + text(["mediaAnalysis", "shared", "preset"]));
    render();
  }

  function chooseProfileFocus(focusId) {
    if (PROFILE_FOCUS.includes(focusId) === false) {
      return;
    }
    state.profileFocus = focusId;
    render();
  }

  function chooseDownloadPreset(presetId) {
    if (DOWNLOAD_PRESETS.includes(presetId) === false) {
      return;
    }
    state.download.preset = presetId;
    setLastAction(
      templateText(["mediaAnalysis", "download", "presetActivated"], {
        preset: getDownloadPresetLabel(),
      })
    );
    render();
  }

  function chooseDownloadQuality(qualityId) {
    if (DOWNLOAD_QUALITIES.includes(qualityId) === false) {
      return;
    }
    state.download.quality = qualityId;
    render();
  }

  function toggleCleanup(key) {
    if (Object.prototype.hasOwnProperty.call(state.cleanup, key) === false) {
      return;
    }
    state.cleanup[key] = state.cleanup[key] !== true;
    render();
  }

  function toggleDownloadOption(key) {
    if (Object.prototype.hasOwnProperty.call(state.download, key) === false) {
      return;
    }
    state.download[key] = state.download[key] !== true;
    render();
  }

  function startDownload() {
    state.download.running = true;
    state.download.progress = Math.max(state.download.progress, 6);
    setLastAction(text(["mediaAnalysis", "download", "actionStarted"]));
    render();
  }

  function restartProcess() {
    state.process.running = true;
    state.process.progress = 12;
    state.activeStage = "process";
    setLastAction(text(["mediaAnalysis", "process", "summaryStatusActive"]));
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
    state.sourceType = "video";
    state.rangeStart = 18;
    state.rangeEnd = 72;
    state.region = "containment";
    state.cleanup.audio = true;
    state.cleanup.sharpness = true;
    state.cleanup.aiSanitize = false;
    state.profileFocus = "video";
    state.profilePreset = "balanced";
    state.download.preset = "archive";
    state.download.quality = "source";
    state.download.captions = true;
    state.download.separateAudio = false;
    state.download.progress = 28;
    state.download.running = false;
    state.process.progress = 54;
    state.process.running = false;
    setLastAction(text(["mediaAnalysis", "shared", "dummyHint"]));
    render();
  }

  function renderBootstrap() {
    return `
      <section class="lab-bootstrap">
        <div class="lab-bootstrap__panel">
          <p class="lab-bootstrap__eyebrow">${escapeHtml(FEATURE_ID)}</p>
          <h1 class="lab-bootstrap__title">${escapeHtml(bootstrapText("loadingTitle"))}</h1>
          <p class="lab-bootstrap__body">${escapeHtml(bootstrapText("loadingBody"))}</p>
        </div>
      </section>
    `;
  }

  function bootstrapText(key) {
    return (
      readValue(BOOTSTRAP_COPY[state.locale], [key]) ||
      readValue(BOOTSTRAP_COPY.en, [key]) ||
      key
    );
  }

  function renderStageRail() {
    const currentIndex = getStageIndex(state.activeStage);
    const operatorName = escapeHtml(state.context.user.nickname || "Operator");

    return `
      <header class="lab-topbar">
        <div class="lab-topbar__meta">
          <p class="lab-topbar__eyebrow">${escapeHtml(text(["mediaAnalysis", "eyebrow"]))}</p>
          <div class="lab-topbar__status">
            <span class="lab-chip lab-chip--operator">${escapeHtml(
              text(["mediaAnalysis", "operatorLabel"])
            )}: ${operatorName}</span>
            <span class="lab-chip">${escapeHtml(getActiveSourceLabel())}</span>
            <span class="lab-chip">${escapeHtml(getProfileLabel())}</span>
          </div>
        </div>
        <div class="lab-stage-rail">
          <button
            class="lab-stage-nav"
            type="button"
            data-stage-nav="previous"
            ${currentIndex === 0 ? "disabled" : ""}
          >
            <span class="lab-stage-nav__label">${escapeHtml(
              text(["mediaAnalysis", "stageNav", "previous"])
            )}</span>
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
            data-stage-nav="next"
            ${currentIndex === STAGE_ORDER.length - 1 ? "disabled" : ""}
          >
            <span class="lab-stage-nav__label">${escapeHtml(
              text(["mediaAnalysis", "stageNav", "next"])
            )}</span>
          </button>
        </div>
      </header>
    `;
  }

  function renderStageIntro(stageId) {
    return `
      <section class="lab-stage-copy">
        <p class="lab-stage-copy__eyebrow">${escapeHtml(text(["mediaAnalysis", "eyebrow"]))}</p>
        <h1 class="lab-stage-copy__title">${escapeHtml(text(["mediaAnalysis", stageId, "title"]))}</h1>
        <p class="lab-stage-copy__subtitle">${escapeHtml(
          text(["mediaAnalysis", stageId, "subtitle"])
        )}</p>
      </section>
    `;
  }

  function renderSourceCards() {
    return `
      <section class="lab-source-grid">
        ${SOURCE_FORMATS.map(function (sourceId) {
          return `
            <button
              class="lab-source-card"
              type="button"
              data-source-option="${sourceId}"
              data-selected="${sourceId === state.sourceType ? "true" : "false"}"
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
      </section>
    `;
  }

  function renderPreviewMetadata() {
    return `
      <ul class="lab-meta-list">
        <li><span>${escapeHtml(text(["mediaAnalysis", "shared", "route"]))}</span><strong>${escapeHtml(
          text(["mediaAnalysis", "shared", "localSample"])
        )}</strong></li>
        <li><span>${escapeHtml(text(["mediaAnalysis", "shared", "duration"]))}</span><strong>00:09.37</strong></li>
        <li><span>${escapeHtml(text(["mediaAnalysis", "shared", "resolution"]))}</span><strong>3840 x 1608</strong></li>
        <li><span>${escapeHtml(text(["mediaAnalysis", "shared", "codec"]))}</span><strong>H.264 / 30 fps</strong></li>
      </ul>
    `;
  }

  function renderSourceStage() {
    return `
      <div class="lab-layout lab-layout--source">
        <section class="lab-main-stack">
          ${renderStageIntro("source")}
          ${renderSourceCards()}
          <section class="lab-panel lab-preview-panel">
            <div class="lab-preview-panel__header">
              <div>
                <p class="lab-panel__eyebrow">${escapeHtml(
                  text(["mediaAnalysis", "source", "previewTitle"])
                )}</p>
                <h2 class="lab-panel__title">${escapeHtml(getActiveSourceLabel())}</h2>
              </div>
              <span class="lab-chip">${escapeHtml(text(["mediaAnalysis", "shared", "status"]))}: ${escapeHtml(
                text(["mediaAnalysis", "shared", "ready"])
              )}</span>
            </div>
            <div class="lab-preview-card">
              <div class="lab-preview-frame">
                <img class="lab-preview-frame__image" src="${PREVIEW_IMAGE}" alt="" />
                <div class="lab-preview-frame__scan"></div>
              </div>
              <div class="lab-preview-copy">
                ${renderPreviewMetadata()}
              </div>
            </div>
          </section>
          <section class="lab-panel lab-console-panel">
            <div class="lab-panel__header">
              <p class="lab-panel__eyebrow">${escapeHtml(
                text(["mediaAnalysis", "source", "consoleTitle"])
              )}</p>
            </div>
            <ul class="lab-console-list">
              ${list(["mediaAnalysis", "source", "consoleLines"])
                .map(function (line) {
                  return `<li>${escapeHtml(line)}</li>`;
                })
                .join("")}
            </ul>
          </section>
        </section>
        <aside class="lab-side-stack">
          <section class="lab-panel">
            <div class="lab-panel__header">
              <p class="lab-panel__eyebrow">${escapeHtml(
                text(["mediaAnalysis", "source", "summaryTitle"])
              )}</p>
            </div>
            ${renderSummaryRows([
              [text(["mediaAnalysis", "shared", "summary"]), getActiveSourceLabel()],
              [text(["mediaAnalysis", "shared", "duration"]), "00:09.37"],
              [text(["mediaAnalysis", "shared", "resolution"]), "3840 x 1608"],
              [text(["mediaAnalysis", "shared", "status"]), getDownloadStatusLabel()],
            ])}
            <p class="lab-panel__hint">${escapeHtml(
              text(["mediaAnalysis", "source", "summaryHint"])
            )}</p>
          </section>
          ${renderDownloadPanel()}
        </aside>
      </div>
    `;
  }

  function renderDownloadPanel() {
    return `
      <section class="lab-panel lab-download-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(
              text(["mediaAnalysis", "download", "title"])
            )}</p>
            <p class="lab-panel__subtitle">${escapeHtml(
              text(["mediaAnalysis", "download", "subtitle"])
            )}</p>
          </div>
        </div>
        <div class="lab-field">
          <span class="lab-field__label">${escapeHtml(
            text(["mediaAnalysis", "download", "presetLabel"])
          )}</span>
          <div class="lab-chip-row">
            ${DOWNLOAD_PRESETS.map(function (presetId) {
              return `
                <button
                  class="lab-choice-chip"
                  type="button"
                  data-download-preset="${presetId}"
                  data-selected="${presetId === state.download.preset ? "true" : "false"}"
                >
                  ${escapeHtml(text(["mediaAnalysis", "download", "presets", presetId]))}
                </button>
              `;
            }).join("")}
          </div>
        </div>
        <div class="lab-field">
          <label class="lab-field__label" for="download-quality">${escapeHtml(
            text(["mediaAnalysis", "download", "qualityLabel"])
          )}</label>
          <select class="lab-select" id="download-quality" data-download-quality="true">
            ${DOWNLOAD_QUALITIES.map(function (qualityId) {
              return `
                <option value="${qualityId}" ${
                  qualityId === state.download.quality ? "selected" : ""
                }>
                  ${escapeHtml(text(["mediaAnalysis", "download", "qualities", qualityId]))}
                </option>
              `;
            }).join("")}
          </select>
        </div>
        <div class="lab-toggle-grid">
          ${renderToggle(
            "download-captions",
            text(["mediaAnalysis", "download", "captions"]),
            state.download.captions
          )}
          ${renderToggle(
            "download-separateAudio",
            text(["mediaAnalysis", "download", "separateAudio"]),
            state.download.separateAudio
          )}
        </div>
        <div class="lab-progress-card">
          <div class="lab-progress-card__header">
            <span>${escapeHtml(text(["mediaAnalysis", "download", "progressLabel"]))}</span>
            <strong>${Math.round(state.download.progress)}%</strong>
          </div>
          <div class="lab-progress-bar">
            <span style="width:${Math.round(state.download.progress)}%"></span>
          </div>
          <p class="lab-progress-card__status">${escapeHtml(getDownloadStatusLabel())}</p>
        </div>
        <button class="lab-button lab-button--primary" type="button" data-action="start-download">
          ${escapeHtml(text(["mediaAnalysis", "download", "button"]))}
        </button>
      </section>
    `;
  }

  function renderEditStage() {
    const rangeTimes = getRangeTimes();

    return `
      <div class="lab-layout lab-layout--edit">
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
                  style="left:${state.rangeStart}%; width:${Math.max(
                    4,
                    state.rangeEnd - state.rangeStart
                  )}%"
                ></span>
              </div>
              <span>${rangeTimes.end}</span>
            </div>
          </section>
          <div class="lab-subgrid">
            <section class="lab-panel">
              <div class="lab-panel__header">
                <p class="lab-panel__eyebrow">${escapeHtml(
                  text(["mediaAnalysis", "edit", "timeTitle"])
                )}</p>
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
              [text(["mediaAnalysis", "shared", "status"]), text(["mediaAnalysis", "shared", "dummyHint"])],
            ])}
          </section>
        </aside>
      </div>
    `;
  }

  function renderProfileStage() {
    return `
      <div class="lab-layout lab-layout--profile">
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
          <section class="lab-panel lab-console-panel">
            <div class="lab-panel__header">
              <p class="lab-panel__eyebrow">${escapeHtml(
                text(["mediaAnalysis", "profile", "consoleTitle"])
              )}</p>
            </div>
            <ul class="lab-console-list">
              ${list(["mediaAnalysis", "profile", "consoleLines"])
                .map(function (line) {
                  return `<li>${escapeHtml(line)}</li>`;
                })
                .join("")}
            </ul>
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
            <p class="lab-panel__hint">${escapeHtml(
              text(["mediaAnalysis", "profile", "summaryHint"])
            )}</p>
          </section>
        </aside>
      </div>
    `;
  }

  function renderProcessStage() {
    return `
      <div class="lab-layout lab-layout--process">
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
              [text(["mediaAnalysis", "shared", "status"]), getProcessStatusLabel()],
              [text(["mediaAnalysis", "shared", "focus"]), getFocusLabel()],
              [text(["mediaAnalysis", "shared", "preset"]), getProfileLabel()],
              [text(["mediaAnalysis", "shared", "summary"]), String(Math.round(state.process.progress)) + "%"],
            ])}
            <p class="lab-panel__hint">${escapeHtml(getProcessHintLabel())}</p>
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

  function renderReportStage() {
    return `
      <div class="lab-layout lab-layout--report">
        <section class="lab-main-stack">
          ${renderStageIntro("report")}
          <section class="lab-panel lab-report-hero">
            <div class="lab-report-hero__media">
              <img class="lab-report-hero__image" src="${PREVIEW_IMAGE}" alt="" />
            </div>
            <div class="lab-report-hero__copy">
              <div class="lab-panel__header">
                <p class="lab-panel__eyebrow">${escapeHtml(
                  text(["mediaAnalysis", "report", "overviewTitle"])
                )}</p>
                <h2 class="lab-panel__title">${escapeHtml(
                  text(["mediaAnalysis", "shared", "reportReady"])
                )}</h2>
              </div>
              ${renderSummaryRows([
                [text(["mediaAnalysis", "shared", "summary"]), getActiveSourceLabel()],
                [text(["mediaAnalysis", "shared", "duration"]), "00:09.37"],
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
            <div class="lab-panel__header">
              <p class="lab-panel__eyebrow">${escapeHtml(
                text(["mediaAnalysis", "report", "sideTitle"])
              )}</p>
            </div>
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
            state.lastAction || text(["mediaAnalysis", "shared", "dummyHint"])
          )}</p>
        </footer>
      </main>
    `;
  }

  function handleHostMessage(message) {
    if (!message || typeof message !== "object" || Array.isArray(message)) {
      return;
    }

    if (message.type === "host-context") {
      const presentation =
        message.presentation &&
        typeof message.presentation === "object" &&
        Array.isArray(message.presentation) === false
          ? message.presentation
          : {};
      applyPresentationMode(presentation.mode);
      if (typeof message.locale === "string") {
        applyLocale(message.locale);
      }
      if (
        message.translations &&
        typeof message.translations === "object" &&
        Array.isArray(message.translations) === false
      ) {
        state.translations = message.translations;
      }
      state.context = normalizeContext(message);
      render();
    }
  }

  function handleAction(action) {
    switch (action) {
      case "start-download":
        startDownload();
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
      handleAction(actionButton.dataset["action"] || "");
      return;
    }

    const stageButton = target.closest("[data-stage-target]");
    if (stageButton instanceof HTMLElement) {
      setStage(stageButton.dataset["stageTarget"] || "");
      return;
    }

    const navButton = target.closest("[data-stage-nav]");
    if (navButton instanceof HTMLButtonElement) {
      advanceStage(navButton.dataset["stageNav"] === "previous" ? -1 : 1);
      return;
    }

    const sourceButton = target.closest("[data-source-option]");
    if (sourceButton instanceof HTMLElement) {
      chooseSourceFormat(sourceButton.dataset["sourceOption"] || "");
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

    const presetButton = target.closest("[data-download-preset]");
    if (presetButton instanceof HTMLElement) {
      chooseDownloadPreset(presetButton.dataset["downloadPreset"] || "");
      return;
    }

    const toggleButton = target.closest("[data-toggle]");
    if (toggleButton instanceof HTMLElement) {
      const toggleId = toggleButton.dataset["toggle"] || "";
      if (toggleId.startsWith("cleanup-")) {
        toggleCleanup(toggleId.replace("cleanup-", ""));
        return;
      }
      if (toggleId.startsWith("download-")) {
        toggleDownloadOption(toggleId.replace("download-", ""));
      }
    }
  });

  document.addEventListener("input", function (event) {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.dataset["range"]) {
      setRange(target.dataset["range"], target.value);
      return;
    }

    if (target instanceof HTMLSelectElement && target.dataset["downloadQuality"]) {
      chooseDownloadQuality(target.value);
    }
  });

  if (window.roomAPI && typeof window.roomAPI.onHostMessage === "function") {
    window.roomAPI.onHostMessage(handleHostMessage);
  } else {
    setLastAction(bootstrapText("roomApiUnavailable"));
  }

  globalThis.setInterval(function () {
    let shouldRender = false;

    if (state.download.running) {
      state.download.progress = Math.min(100, state.download.progress + 4);
      if (state.download.progress >= 100) {
        state.download.running = false;
      }
      shouldRender = true;
    }

    if (state.activeStage === "process" && state.process.running) {
      state.process.progress = Math.min(100, state.process.progress + 3);
      if (state.process.progress >= 100) {
        state.process.running = false;
      }
      shouldRender = true;
    }

    if (shouldRender) {
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
