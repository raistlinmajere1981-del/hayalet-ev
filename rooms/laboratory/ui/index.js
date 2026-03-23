(function () {
  const DEFAULT_MODE = "balanced";
  const REPORT_TAB_USER = "user";
  const REPORT_TAB_TECHNICAL = "technical";
  const PROGRESS_STEPS = [
    "source-resolve",
    "source-copy",
    "probe",
    "preview-prep",
    "frame-extraction",
    "metadata-analysis",
    "motion-analysis",
    "visual-analysis",
    "audio-analysis",
    "report-build",
    "persist",
    "complete",
  ];

  const FALLBACK_COPY = {
    en: {
      roomTitle: "Laboratory",
      roomSubtitle:
        "Offline-first video forensics with guided progress, readable evidence, and durable report workspaces.",
      sourceTitle: "Source intake",
      sourceBody:
        "Bring in a local video or a direct media URL. Every prepared source gets its own workspace folder.",
      pickFile: "Pick local file",
      youtubeLabel: "YouTube URL",
      youtubePlaceholder: "https://www.youtube.com/watch?v=...",
      prepareYoutube: "Prepare YouTube",
      directUrlLabel: "Direct media URL",
      directUrlPlaceholder: "https://example.com/video.mp4",
      prepareUrl: "Prepare URL",
      sourceReady: "Prepared source",
      sourceCleared: "Current source cleared.",
      clearSource: "Clear source",
      previewTitle: "Preview and selection",
      previewEmpty: "Select or prepare a source to unlock preview, time range, and region targeting.",
      previewCacheMissing: "Media cache was cleaned. Reports remain readable, but preview media is no longer available.",
      fullVideo: "Full video",
      customRange: "Custom range",
      resetRange: "Reset range",
      fullFrame: "Full frame",
      resetRegion: "Reset region",
      dragHint: "Drag inside the frame to mark the area you want to inspect more closely.",
      modeTitle: "Analysis mode",
      fast: "Fast",
      balanced: "Balanced",
      deep: "Deep",
      fastMeta: "Low CPU, lighter sampling",
      balancedMeta: "Recommended for most clips",
      deepMeta: "Denser sampling, slower run",
      startAnalysis: "Start analysis",
      cancelAnalysis: "Cancel analysis",
      progressTitle: "Progress",
      progressIdle: "No active analysis yet.",
      cancelSourcePreparation: "Cancel preparation",
      historyTitle: "Workspace history",
      historyEmpty: "Completed analyses will appear here.",
      historyReload: "Reload history",
      historyCleanup: "Clean media cache",
      historyCleaned: "Media cache cleaned",
      historyCached: "Media cache available",
      reportsTitle: "Reports",
      userReport: "User report",
      technicalReport: "Technical report",
      copyUser: "Copy user report",
      copyJson: "Copy technical JSON",
      noReports: "Run an analysis or open a previous workspace to review reports.",
      riskLow: "Low risk",
      riskMedium: "Medium risk",
      riskHigh: "High risk",
      selectionTitle: "Current selection",
      selectionVideoDefault: "Analyzing the full video by default.",
      selectionRegionDefault: "Analyzing the full frame by default.",
      metricsTitle: "Metrics",
      evidenceTitle: "Evidence",
      findingsTitle: "Findings",
      caveatsTitle: "Caveats",
      technicalEmpty: "No technical report loaded yet.",
      copyOk: "Copied to clipboard.",
      copyFail: "Clipboard copy failed.",
      analysisWorkspace: "Workspace",
      duration: "Duration",
      resolution: "Resolution",
      modeLabel: "Mode",
      noSource: "No source prepared",
      latestReport: "Latest report",
      progressDetailDefault: "Waiting for the next job phase.",
      sourceKindLocal: "Local file",
      sourceKindUrl: "Direct URL",
      sourceKindYouTube: "YouTube",
      projectsTitle: "Projects",
      projectsEmpty: "Prepared and completed analyses will appear here as resumable projects.",
      projectContinue: "Open",
      projectDelete: "Delete",
      projectLatest: "Latest report",
      projectNoScore: "No completed report yet",
      projectDraft: "Draft",
      projectReady: "Ready",
      projectCompleted: "Completed",
      activeProjectTitle: "Active project",
      noProjectSelected: "Select a project or prepare a new source to begin.",
      activityTitle: "Runs and revisions",
      activityEmpty: "Project runs will appear here after analysis starts.",
      processConsoleTitle: "Process console",
      processWaiting: "Preparation and analysis progress will stream here step by step.",
      settingsTitle: "Controls",
      settingsBasic: "Basic",
      settingsAdvanced: "Advanced",
      reportLocaleLabel: "Report language",
      reportLocaleEnglish: "English",
      reportLocaleTurkish: "Turkce",
      downloadTitle: "Preparation profile",
      downloadPresetLabel: "Download profile",
      downloadPresetBalanced: "Balanced",
      downloadPresetBest: "Archive quality",
      downloadPresetFast: "Fast staging",
      previewPolicyLabel: "Preview policy",
      previewPolicySmart: "Smart preview",
      previewPolicyDense: "Dense preview",
      focusTitle: "Analysis focus",
      focusVisual: "Visual traces",
      focusAudio: "Audio anomalies",
      focusImage: "Frame/image review",
      focusMotion: "Motion patterns",
      focusHint: "These focus tags shape the operator workflow now and map to deeper analyzers next.",
      reportReaderTitle: "Report reader",
      reportReaderHint: "Open the report in a focused overlay for comfortable reading and copying.",
      openReader: "Open reader",
      closeReader: "Close reader",
      readerStatus: "Reader",
      projectDeleteConfirm: "Delete this project and its saved reports?",
      projectCountLabel: "Projects",
      revisionCountLabel: "Runs",
      workspaceStatusIdle: "Idle",
      workspaceStatusReady: "Ready",
      workspaceStatusBusy: "Processing",
    },
    tr: {
      roomTitle: "Laboratuvar",
      roomSubtitle:
        "Offline-oncelikli video analiz odasi: detayli ilerleme, okunabilir kanitlar ve kalici rapor klasorleri.",
      sourceTitle: "Kaynak girisi",
      sourceBody:
        "Yerel bir video ya da dogrudan medya URL'si hazirla. Hazirlanan her kaynak kendi workspace klasorune gider.",
      pickFile: "Yerel dosya sec",
      youtubeLabel: "YouTube URL",
      youtubePlaceholder: "https://www.youtube.com/watch?v=...",
      prepareYoutube: "YouTube hazirla",
      directUrlLabel: "Dogrudan medya URL",
      directUrlPlaceholder: "https://ornek.com/video.mp4",
      prepareUrl: "URL hazirla",
      sourceReady: "Hazir kaynak",
      sourceCleared: "Guncel kaynak temizlendi.",
      clearSource: "Kaynagi temizle",
      previewTitle: "Onizleme ve secim",
      previewEmpty: "Onizleme, zaman araligi ve bolge secimi icin once bir kaynak hazirla.",
      previewCacheMissing:
        "Medya cache temizlendi. Raporlar okunabilir durumda, fakat onizleme medyasi artik mevcut degil.",
      fullVideo: "Tum video",
      customRange: "Ozel aralik",
      resetRange: "Araligi sifirla",
      fullFrame: "Tum kare",
      resetRegion: "Bolgeyi sifirla",
      dragHint: "Daha yakindan incelemek istedigin alani secmek icin kare icinde surukle.",
      modeTitle: "Analiz modu",
      fast: "Hizli",
      balanced: "Dengeli",
      deep: "Derin",
      fastMeta: "Dusuk CPU, hafif ornekleme",
      balancedMeta: "Cogu klip icin onerilen",
      deepMeta: "Daha yogun ornekleme, daha yavas",
      startAnalysis: "Analizi baslat",
      cancelAnalysis: "Analizi iptal et",
      progressTitle: "Ilerleme",
      progressIdle: "Henuz aktif bir analiz yok.",
      cancelSourcePreparation: "Hazirlamayi iptal et",
      historyTitle: "Workspace gecmisi",
      historyEmpty: "Tamamlanan analizler burada listelenecek.",
      historyReload: "Gecmisi yenile",
      historyCleanup: "Medya cache temizle",
      historyCleaned: "Medya cache temizlendi",
      historyCached: "Medya cache hazir",
      reportsTitle: "Raporlar",
      userReport: "Kullanici raporu",
      technicalReport: "Teknik rapor",
      copyUser: "Kullanici raporunu kopyala",
      copyJson: "Teknik JSON'u kopyala",
      noReports: "Raporlari incelemek icin bir analiz calistir veya onceki bir workspace ac.",
      riskLow: "Dusuk risk",
      riskMedium: "Orta risk",
      riskHigh: "Yuksek risk",
      selectionTitle: "Guncel secim",
      selectionVideoDefault: "Varsayilan olarak tum video analiz edilecek.",
      selectionRegionDefault: "Varsayilan olarak tum kare analiz edilecek.",
      metricsTitle: "Metrikler",
      evidenceTitle: "Kanitlar",
      findingsTitle: "Bulgular",
      caveatsTitle: "Notlar",
      technicalEmpty: "Henuz yuklu bir teknik rapor yok.",
      copyOk: "Panoya kopyalandi.",
      copyFail: "Pano kopyasi basarisiz oldu.",
      analysisWorkspace: "Workspace",
      duration: "Sure",
      resolution: "Cozunurluk",
      modeLabel: "Mod",
      noSource: "Hazir kaynak yok",
      latestReport: "Son rapor",
      progressDetailDefault: "Siradaki analiz adimi bekleniyor.",
      sourceKindLocal: "Yerel dosya",
      sourceKindUrl: "Dogrudan URL",
      sourceKindYouTube: "YouTube",
      projectsTitle: "Projeler",
      projectsEmpty: "Hazirlanan ve tamamlanan analizler buraya devam edilebilir projeler olarak duser.",
      projectContinue: "Ac",
      projectDelete: "Sil",
      projectLatest: "Son rapor",
      projectNoScore: "Henuz tamamlanmis rapor yok",
      projectDraft: "Taslak",
      projectReady: "Hazir",
      projectCompleted: "Tamamlandi",
      activeProjectTitle: "Aktif proje",
      noProjectSelected: "Baslamak icin bir proje sec veya yeni bir kaynak hazirla.",
      activityTitle: "Kosular ve revizyonlar",
      activityEmpty: "Analiz basladiktan sonra proje kosulari burada gorunur.",
      processConsoleTitle: "Surec konsolu",
      processWaiting: "Hazirlama ve analiz ilerlemesi burada adim adim akar.",
      settingsTitle: "Kontroller",
      settingsBasic: "Temel",
      settingsAdvanced: "Gelismis",
      reportLocaleLabel: "Rapor dili",
      reportLocaleEnglish: "English",
      reportLocaleTurkish: "Turkce",
      downloadTitle: "Hazirlama profili",
      downloadPresetLabel: "Indirme profili",
      downloadPresetBalanced: "Dengeli",
      downloadPresetBest: "Arsiv kalitesi",
      downloadPresetFast: "Hizli hazirlama",
      previewPolicyLabel: "Onizleme politikasi",
      previewPolicySmart: "Akilli onizleme",
      previewPolicyDense: "Yogun onizleme",
      focusTitle: "Analiz odagi",
      focusVisual: "Gorsel izler",
      focusAudio: "Ses anomalleri",
      focusImage: "Kare/resim inceleme",
      focusMotion: "Hareket desenleri",
      focusHint: "Bu odak etiketleri bugun operator akisina yon verir, sonraki dilimde daha derin analyzer'lara baglanir.",
      reportReaderTitle: "Rapor okuyucu",
      reportReaderHint: "Raporu rahat okumak ve kopyalamak icin odakli bir overlay ac.",
      openReader: "Okuyucuyu ac",
      closeReader: "Kapat",
      readerStatus: "Okuyucu",
      projectDeleteConfirm: "Bu projeyi ve kayitli raporlarini silmek istiyor musun?",
      projectCountLabel: "Proje",
      revisionCountLabel: "Kosu",
      workspaceStatusIdle: "Bos",
      workspaceStatusReady: "Hazir",
      workspaceStatusBusy: "Isleniyor",
    },
  };

  const state = {
    locale: "tr",
    translations: null,
    context: null,
    room: {
      locale: "tr",
      reportLocale: "tr",
      workflowSettings: {
        downloadPreset: "balanced",
        previewPolicy: "smart",
        focus: {
          visual: true,
          audio: true,
          image: true,
          motion: true,
        },
      },
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
    },
    ui: {
      youtubeUrl: "",
      directUrl: "",
      mode: DEFAULT_MODE,
      settingsView: "basic",
      reportOverlayOpen: false,
      downloadPreset: "balanced",
      previewPolicy: "smart",
      analysisFocus: {
        visual: true,
        audio: true,
        image: true,
        motion: true,
      },
      selection: {
        timeRange: null,
        region: null,
      },
      reportTab: REPORT_TAB_USER,
      draggingRegion: false,
      dragStart: null,
      toast: "",
    },
  };

  function createRoomState() {
    return {
      locale: "tr",
      reportLocale: "tr",
      workflowSettings: {
        downloadPreset: "balanced",
        previewPolicy: "smart",
        focus: {
          visual: true,
          audio: true,
          image: true,
          motion: true,
        },
      },
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

  function readPath(source, path) {
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

  function text(path, fallbackKey) {
    const contextLocale =
      state.context && typeof state.context.locale === "string"
        ? normalizeLocale(state.context.locale)
        : state.locale;
    const roomValue =
      contextLocale === state.locale ? readPath(state.translations, path) : undefined;
    if (typeof roomValue === "string" && roomValue.trim() !== "") {
      return roomValue;
    }
    const fallback =
      readPath(FALLBACK_COPY[state.locale], [fallbackKey]) ||
      readPath(FALLBACK_COPY.en, [fallbackKey]) ||
      fallbackKey;
    return typeof fallback === "string" ? fallback : fallbackKey;
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

  function cloneWorkflowSettings(value) {
    const raw = value && typeof value === "object" && Array.isArray(value) === false ? value : {};
    const focus =
      raw.focus && typeof raw.focus === "object" && Array.isArray(raw.focus) === false
        ? raw.focus
        : {};

    return {
      downloadPreset:
        raw.downloadPreset === "best" || raw.downloadPreset === "fast"
          ? raw.downloadPreset
          : "balanced",
      previewPolicy: raw.previewPolicy === "dense" ? "dense" : "smart",
      focus: {
        visual: typeof focus.visual === "boolean" ? focus.visual : true,
        audio: typeof focus.audio === "boolean" ? focus.audio : true,
        image: typeof focus.image === "boolean" ? focus.image : true,
        motion: typeof focus.motion === "boolean" ? focus.motion : true,
      },
    };
  }

  function readUiWorkflowSettings() {
    return {
      downloadPreset:
        state.ui.downloadPreset === "best" || state.ui.downloadPreset === "fast"
          ? state.ui.downloadPreset
          : "balanced",
      previewPolicy: state.ui.previewPolicy === "dense" ? "dense" : "smart",
      focus: {
        visual: Boolean(state.ui.analysisFocus.visual),
        audio: Boolean(state.ui.analysisFocus.audio),
        image: Boolean(state.ui.analysisFocus.image),
        motion: Boolean(state.ui.analysisFocus.motion),
      },
    };
  }

  function syncUiWorkflowSettings(workflowSettings) {
    const normalized = cloneWorkflowSettings(workflowSettings);
    state.room.workflowSettings = normalized;
    state.ui.downloadPreset = normalized.downloadPreset;
    state.ui.previewPolicy = normalized.previewPolicy;
    state.ui.analysisFocus = {
      visual: normalized.focus.visual,
      audio: normalized.focus.audio,
      image: normalized.focus.image,
      motion: normalized.focus.motion,
    };
  }

  function durationForSource(source) {
    return source && source.probe ? Number(source.probe.durationSec) || 0 : 0;
  }

  function getWorkingSource() {
    return state.room.source;
  }

  function getDisplayEntry() {
    return state.room.activeEntry;
  }

  function getDisplayProject() {
    return state.room.activeProject;
  }

  function getDisplaySource() {
    return (
      state.room.source ||
      (state.room.activeProject ? state.room.activeProject.source : null) ||
      (state.room.activeEntry ? state.room.activeEntry.source : null)
    );
  }

  function getProjectEntries() {
    const project = getDisplayProject();
    if (project && Array.isArray(project.entries) && project.entries.length > 0) {
      return project.entries;
    }
    if (state.room.activeProjectId) {
      return state.room.history.filter(function (entry) {
        return entry && entry.projectId === state.room.activeProjectId;
      });
    }
    return state.room.history;
  }

  function syncSelectionForSource(source) {
    if (!source || !source.workspaceId) {
      state.ui.selection = {
        timeRange: null,
        region: null,
      };
      return;
    }

    const duration = durationForSource(source);
    const current = cloneSelection(state.room.selection || state.ui.selection);
    const validTimeRange =
      current.timeRange &&
      current.timeRange.endSec > current.timeRange.startSec &&
      current.timeRange.endSec <= duration + 0.01
        ? current.timeRange
        : null;
    state.ui.selection = {
      timeRange: validTimeRange,
      region: current.region,
    };
    state.ui.mode = state.room.mode || state.ui.mode;
  }

  function formatTime(seconds) {
    const safe = Math.max(0, Number(seconds) || 0);
    const totalSeconds = Math.round(safe);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hours > 0) {
      return [hours, minutes, secs]
        .map(function (value, index) {
          return index === 0 ? String(value) : String(value).padStart(2, "0");
        })
        .join(":");
    }
    return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  function formatPercent(value) {
    const safe = Math.max(0, Math.min(1, Number(value) || 0));
    return `${Math.round(safe * 100)}%`;
  }

  function formatDateTime(value) {
    if (typeof value !== "string" || value.trim() === "") {
      return "";
    }
    try {
      return new Date(value).toLocaleString(state.locale);
    } catch {
      return value;
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function resolveRiskLabel(riskLevel) {
    if (riskLevel === "high") {
      return text(["videoAnalysis", "risk", "high"], "riskHigh");
    }
    if (riskLevel === "medium") {
      return text(["videoAnalysis", "risk", "medium"], "riskMedium");
    }
    return text(["videoAnalysis", "risk", "low"], "riskLow");
  }

  function resolveProjectStatusLabel(status) {
    if (status === "completed") {
      return text(["videoAnalysis", "projects", "completed"], "projectCompleted");
    }
    if (status === "ready") {
      return text(["videoAnalysis", "projects", "ready"], "projectReady");
    }
    return text(["videoAnalysis", "projects", "draft"], "projectDraft");
  }

  function resolveWorkspaceStatusLabel() {
    if (state.room.pendingJobId || state.room.pendingSourceJobId || state.room.progress) {
      return text(["videoAnalysis", "workspace", "busy"], "workspaceStatusBusy");
    }
    if (getDisplaySource()) {
      return text(["videoAnalysis", "workspace", "ready"], "workspaceStatusReady");
    }
    return text(["videoAnalysis", "workspace", "idle"], "workspaceStatusIdle");
  }

  function progressPhaseLabel(phase) {
    if (typeof phase !== "string" || phase.trim() === "") {
      return "";
    }
    return phase.replace(/-/g, " ");
  }

  function currentRangeValues(source) {
    const duration = durationForSource(source);
    const selected = state.ui.selection.timeRange;
    return {
      startSec: selected ? Math.max(0, Math.min(duration, selected.startSec)) : 0,
      endSec: selected ? Math.max(0, Math.min(duration, selected.endSec)) : duration,
      duration,
    };
  }

  function selectionSummaryMarkup(source) {
    const range = currentRangeValues(source);
    const region = state.ui.selection.region;
    return [
      '<section class="lab-card lab-selection">',
      `<h3 class="lab-card__title">${escapeHtml(text(["videoAnalysis", "selection", "title"], "selectionTitle"))}</h3>`,
      '<div class="lab-selection__grid">',
      `<div class="lab-selection__cell"><span>${escapeHtml(text(["videoAnalysis", "selection", "rangeTitle"], "customRange"))}</span><strong>${escapeHtml(
        range.duration > 0 && state.ui.selection.timeRange
          ? `${formatTime(range.startSec)} - ${formatTime(range.endSec)}`
          : text(["videoAnalysis", "selection", "defaultVideo"], "selectionVideoDefault")
      )}</strong></div>`,
      `<div class="lab-selection__cell"><span>${escapeHtml(text(["videoAnalysis", "selection", "regionTitle"], "fullFrame"))}</span><strong>${escapeHtml(
        region
          ? `${Math.round(region.xPct)}% / ${Math.round(region.yPct)}% / ${Math.round(region.widthPct)}% / ${Math.round(region.heightPct)}%`
          : text(["videoAnalysis", "selection", "defaultRegion"], "selectionRegionDefault")
      )}</strong></div>`,
      "</div>",
      "</section>",
    ].join("");
  }

  function sourceMetaMarkup(source) {
    if (!source) {
      return `<p class="lab-source-meta">${escapeHtml(text(["videoAnalysis", "source", "empty"], "noSource"))}</p>`;
    }

    const kindLabel =
      source.kind === "youtube-url"
        ? text(["videoAnalysis", "source", "kindYouTube"], "sourceKindYouTube")
        : source.kind === "direct-url"
        ? text(["videoAnalysis", "source", "kindUrl"], "sourceKindUrl")
        : text(["videoAnalysis", "source", "kindLocal"], "sourceKindLocal");
    return [
      '<div class="lab-source-meta">',
      `<div><span>${escapeHtml(text(["videoAnalysis", "source", "workspace"], "analysisWorkspace"))}</span><strong>${escapeHtml(source.workspaceId)}</strong></div>`,
      `<div><span>${escapeHtml(text(["videoAnalysis", "source", "duration"], "duration"))}</span><strong>${escapeHtml(formatTime(source.probe.durationSec))}</strong></div>`,
      `<div><span>${escapeHtml(text(["videoAnalysis", "source", "resolution"], "resolution"))}</span><strong>${escapeHtml(`${source.probe.width}x${source.probe.height}`)}</strong></div>`,
      `<div><span>${escapeHtml(text(["videoAnalysis", "source", "kind"], "modeLabel"))}</span><strong>${escapeHtml(kindLabel)}</strong></div>`,
      "</div>",
    ].join("");
  }

  function modeCardMarkup(mode, titleKey, metaKey) {
    return [
      `<button class="lab-mode-card" type="button" data-action="set-mode" data-mode="${escapeHtml(mode)}" data-selected="${String(state.ui.mode === mode)}">`,
      `<strong>${escapeHtml(text(["videoAnalysis", "modes", mode, "title"], titleKey))}</strong>`,
      `<span>${escapeHtml(text(["videoAnalysis", "modes", mode, "meta"], metaKey))}</span>`,
      "</button>",
    ].join("");
  }

  function progressStepsMarkup(progress) {
    const activeIndex = progress ? Math.max(0, PROGRESS_STEPS.indexOf(progress.phase)) : -1;
    return PROGRESS_STEPS.map(function (phase, index) {
      const stateLabel =
        activeIndex === index ? "active" : activeIndex > index ? "done" : "idle";
      return [
        `<div class="lab-step" data-state="${stateLabel}">`,
        `<span class="lab-step__dot"></span>`,
        `<span class="lab-step__label">${escapeHtml(progressPhaseLabel(phase))}</span>`,
        "</div>",
      ].join("");
    }).join("");
  }

  function progressMarkup() {
    const progress = state.room.progress;
    const source = getDisplaySource();
    const summary = progress
      ? progress.summary
      : text(["videoAnalysis", "progress", "idle"], "progressIdle");
    const detail = progress
      ? progress.detail
      : text(["videoAnalysis", "progress", "idleDetail"], "progressDetailDefault");
    const percent = progress ? Math.max(0, Math.min(100, Number(progress.percent) || 0)) : 0;
    const focusTags = Object.keys(state.ui.analysisFocus).filter(function (key) {
      return state.ui.analysisFocus[key];
    });

    return [
      '<section class="lab-card lab-progress lab-console">',
      `<div class="lab-card__head"><div><h3 class="lab-card__title">${escapeHtml(text(["videoAnalysis", "progress", "title"], "processConsoleTitle"))}</h3>`,
      `<p class="lab-card__body">${escapeHtml(
        progress
          ? progressPhaseLabel(progress.phase)
          : text(["videoAnalysis", "progress", "idle"], "processWaiting")
      )}</p></div>`,
      `<span class="lab-progress__percent">${String(percent)}%</span></div>`,
      '<div class="lab-console__meta">',
      `<div><span>${escapeHtml(text(["videoAnalysis", "source", "workspace"], "analysisWorkspace"))}</span><strong>${escapeHtml(
        source ? source.workspaceId : "—"
      )}</strong></div>`,
      `<div><span>${escapeHtml(text(["videoAnalysis", "source", "kind"], "modeLabel"))}</span><strong>${escapeHtml(resolveWorkspaceStatusLabel())}</strong></div>`,
      `<div><span>${escapeHtml(text(["videoAnalysis", "modes", "title"], "modeTitle"))}</span><strong>${escapeHtml(state.ui.mode)}</strong></div>`,
      `<div><span>${escapeHtml(text(["videoAnalysis", "controls", "reportLocale"], "reportLocaleLabel"))}</span><strong>${escapeHtml(
        state.room.reportLocale === "tr"
          ? text(["videoAnalysis", "controls", "reportLocaleTurkish"], "reportLocaleTurkish")
          : text(["videoAnalysis", "controls", "reportLocaleEnglish"], "reportLocaleEnglish")
      )}</strong></div>`,
      "</div>",
      '<div class="lab-progress__bar"><span class="lab-progress__bar-fill" style="width:',
      `${String(percent)}%"></span></div>`,
      `<p class="lab-progress__summary">${escapeHtml(summary)}</p>`,
      `<p class="lab-progress__detail">${escapeHtml(detail)}</p>`,
      focusTags.length > 0
        ? `<div class="lab-console__tags">${focusTags
            .map(function (tag) {
              const fallbackKey =
                tag === "audio"
                  ? "focusAudio"
                  : tag === "image"
                    ? "focusImage"
                    : tag === "motion"
                      ? "focusMotion"
                      : "focusVisual";
              return `<span class="lab-soft-tag">${escapeHtml(
                text(["videoAnalysis", "focus", tag], fallbackKey)
              )}</span>`;
            })
            .join("")}</div>`
        : "",
      '<div class="lab-step-list">',
      progressStepsMarkup(progress),
      "</div>",
      "</section>",
    ].join("");
  }

  function historyMarkup() {
    const items = getProjectEntries();
    const activeProject = getDisplayProject();
    return [
      '<section class="lab-card lab-history">',
      '<div class="lab-card__head">',
      `<div><h3 class="lab-card__title">${escapeHtml(text(["videoAnalysis", "activity", "title"], "activityTitle"))}</h3>`,
      `<p class="lab-card__body">${escapeHtml(
        activeProject ? activeProject.summary.sourceLabel : text(["videoAnalysis", "projects", "activeEmpty"], "noProjectSelected")
      )}</p></div>`,
      `<button class="lab-pill-button" type="button" data-action="reload-history">${escapeHtml(text(["videoAnalysis", "history", "reload"], "historyReload"))}</button>`,
      "</div>",
      items.length === 0
        ? `<p class="lab-history__empty">${escapeHtml(text(["videoAnalysis", "activity", "empty"], "activityEmpty"))}</p>`
        : [
            '<div class="lab-history__list">',
            items
              .map(function (entry) {
                const entryId = entry.entryId;
                const active = state.room.activeEntryId === entryId;
                return [
                  `<article class="lab-history-item" data-active="${String(active)}">`,
                  '<button class="lab-history-item__main" type="button" data-action="select-history-entry" data-entry-id="',
                  `${escapeHtml(entryId)}">`,
                  `<strong>${escapeHtml(entry.sourceLabel)}</strong>`,
                  `<span>${escapeHtml(resolveRiskLabel(entry.riskLevel))} · ${escapeHtml(formatPercent(entry.overallScore))}</span>`,
                  `<span>${escapeHtml(formatDateTime(entry.updatedAt))}</span>`,
                  "</button>",
                  `<div class="lab-history-item__meta"><span>${escapeHtml(
                    entry.cacheState && (entry.cacheState.previewPresent || entry.cacheState.sourcePresent)
                      ? text(["videoAnalysis", "history", "cached"], "historyCached")
                      : text(["videoAnalysis", "history", "cleaned"], "historyCleaned")
                  )}</span>`,
                  `<button class="lab-mini-button" type="button" data-action="cleanup-entry-media" data-entry-id="${escapeHtml(entryId)}">${escapeHtml(text(["videoAnalysis", "history", "cleanup"], "historyCleanup"))}</button></div>`,
                  "</article>",
                ].join("");
              })
              .join(""),
            "</div>",
          ].join(""),
      "</section>",
    ].join("");
  }

  function topbarMarkup() {
    const activeProject = getDisplayProject();
    const projectCount = state.room.projects.length;
    const revisionCount = getProjectEntries().length;

    return [
      '<header class="lab-topbar">',
      '<div class="lab-topbar__titleblock">',
      `<span class="lab-topbar__eyebrow">${escapeHtml(text(["videoAnalysis", "heroBadge"], "roomTitle"))}</span>`,
      `<h1 class="lab-topbar__title">${escapeHtml(text(["videoAnalysis", "heroTitle"], "roomTitle"))}</h1>`,
      `<p class="lab-topbar__subtitle">${escapeHtml(
        activeProject ? activeProject.summary.sourceLabel : text(["videoAnalysis", "projects", "activeEmpty"], "noProjectSelected")
      )}</p>`,
      "</div>",
      '<div class="lab-topbar__stats">',
      `<div class="lab-stat-chip"><span>${escapeHtml(text(["videoAnalysis", "stats", "projects"], "projectCountLabel"))}</span><strong>${String(projectCount)}</strong></div>`,
      `<div class="lab-stat-chip"><span>${escapeHtml(text(["videoAnalysis", "stats", "runs"], "revisionCountLabel"))}</span><strong>${String(revisionCount)}</strong></div>`,
      `<div class="lab-stat-chip"><span>${escapeHtml(text(["videoAnalysis", "reader", "status"], "readerStatus"))}</span><strong>${escapeHtml(
        state.ui.reportOverlayOpen
          ? text(["videoAnalysis", "reader", "close"], "closeReader")
          : text(["videoAnalysis", "reader", "open"], "openReader")
      )}</strong></div>`,
      "</div>",
      "</header>",
    ].join("");
  }

  function projectsMarkup() {
    const items = state.room.projects;
    return [
      '<section class="lab-card lab-projects">',
      '<div class="lab-card__head">',
      `<h2 class="lab-card__title">${escapeHtml(text(["videoAnalysis", "projects", "title"], "projectsTitle"))}</h2>`,
      `<span class="lab-score-pill">${String(items.length)}</span>`,
      "</div>",
      items.length === 0
        ? `<p class="lab-history__empty">${escapeHtml(text(["videoAnalysis", "projects", "empty"], "projectsEmpty"))}</p>`
        : `<div class="lab-projects__list">${items
            .map(function (project) {
              const active = state.room.activeProjectId === project.projectId;
              const scoreText =
                typeof project.latestOverallScore === "number"
                  ? `${resolveRiskLabel(project.latestRiskLevel || "low")} · ${formatPercent(project.latestOverallScore)}`
                  : text(["videoAnalysis", "projects", "noScore"], "projectNoScore");
              return [
                `<article class="lab-project-item" data-active="${String(active)}">`,
                `<button class="lab-project-item__main" type="button" data-action="select-project" data-project-id="${escapeHtml(project.projectId)}">`,
                `<div class="lab-project-item__head"><strong>${escapeHtml(project.sourceLabel)}</strong><span class="lab-soft-tag">${escapeHtml(resolveProjectStatusLabel(project.status))}</span></div>`,
                `<span>${escapeHtml(scoreText)}</span>`,
                `<span>${escapeHtml(formatDateTime(project.updatedAt))}</span>`,
                "</button>",
                `<div class="lab-project-item__meta"><span>${escapeHtml(project.projectId)}</span><button class="lab-mini-button" type="button" data-action="delete-project" data-project-id="${escapeHtml(project.projectId)}">${escapeHtml(text(["videoAnalysis", "projects", "delete"], "projectDelete"))}</button></div>`,
                "</article>",
              ].join("");
            })
            .join("")}</div>`,
      "</section>",
    ].join("");
  }

  function focusToggleMarkup(key, fallbackKey) {
    const selected = Boolean(state.ui.analysisFocus[key]);
    return `<button class="lab-toggle-pill" type="button" data-action="toggle-focus" data-focus="${escapeHtml(
      key
    )}" data-selected="${String(selected)}">${escapeHtml(
      text(["videoAnalysis", "focus", key], fallbackKey)
    )}</button>`;
  }

  function controlsMarkup() {
    const source = getWorkingSource();
    const busy = Boolean(state.room.pendingSourceJobId || state.room.pendingJobId);
    const selectedLocale = state.room.reportLocale === "tr" ? "tr" : "en";

    return [
      '<section class="lab-card lab-controls">',
      '<div class="lab-card__head">',
      `<div><h2 class="lab-card__title">${escapeHtml(text(["videoAnalysis", "controls", "title"], "settingsTitle"))}</h2>`,
      `<p class="lab-card__body">${escapeHtml(text(["videoAnalysis", "reader", "hint"], "reportReaderHint"))}</p></div>`,
      '<div class="lab-report-tabs">',
      `<button class="lab-tab-button" type="button" data-action="set-settings-view" data-view="basic" data-selected="${String(state.ui.settingsView === "basic")}">${escapeHtml(text(["videoAnalysis", "controls", "basic"], "settingsBasic"))}</button>`,
      `<button class="lab-tab-button" type="button" data-action="set-settings-view" data-view="advanced" data-selected="${String(state.ui.settingsView === "advanced")}">${escapeHtml(text(["videoAnalysis", "controls", "advanced"], "settingsAdvanced"))}</button>`,
      "</div></div>",
      '<div class="lab-intake__actions">',
      `<button class="lab-primary-button" type="button" data-action="pick-local-file" ${busy ? 'disabled="disabled"' : ""}>${escapeHtml(text(["videoAnalysis", "source", "pickFile"], "pickFile"))}</button>`,
      `<button class="lab-secondary-button" type="button" data-action="cancel-source-preparation" ${state.room.pendingSourceJobId ? "" : 'disabled="disabled"'}>${escapeHtml(text(["videoAnalysis", "source", "cancelPreparation"], "cancelSourcePreparation"))}</button>`,
      "</div>",
      '<label class="lab-field">',
      `<span>${escapeHtml(text(["videoAnalysis", "source", "youtubeLabel"], "youtubeLabel"))}</span>`,
      `<input class="lab-input" type="url" data-input="youtube-url" value="${escapeHtml(state.ui.youtubeUrl)}" placeholder="${escapeHtml(text(["videoAnalysis", "source", "youtubePlaceholder"], "youtubePlaceholder"))}" ${busy ? 'disabled="disabled"' : ""} />`,
      "</label>",
      `<button class="lab-secondary-button" type="button" data-action="submit-youtube-url" ${busy || state.ui.youtubeUrl.trim() === "" ? 'disabled="disabled"' : ""}>${escapeHtml(text(["videoAnalysis", "source", "prepareYoutube"], "prepareYoutube"))}</button>`,
      '<label class="lab-field">',
      `<span>${escapeHtml(text(["videoAnalysis", "source", "directUrlLabel"], "directUrlLabel"))}</span>`,
      `<input class="lab-input" type="url" data-input="direct-url" value="${escapeHtml(state.ui.directUrl)}" placeholder="${escapeHtml(text(["videoAnalysis", "source", "directUrlPlaceholder"], "directUrlPlaceholder"))}" ${busy ? 'disabled="disabled"' : ""} />`,
      "</label>",
      `<button class="lab-secondary-button" type="button" data-action="submit-direct-url" ${busy || state.ui.directUrl.trim() === "" ? 'disabled="disabled"' : ""}>${escapeHtml(text(["videoAnalysis", "source", "prepareUrl"], "prepareUrl"))}</button>`,
      source
        ? `<div class="lab-source-ready"><strong>${escapeHtml(text(["videoAnalysis", "source", "ready"], "sourceReady"))}</strong><span>${escapeHtml(source.label)}</span><button class="lab-link-button" type="button" data-action="clear-source">${escapeHtml(text(["videoAnalysis", "source", "clear"], "clearSource"))}</button></div>`
        : "",
      state.ui.settingsView === "advanced"
        ? [
            '<div class="lab-settings-grid">',
            '<label class="lab-field">',
            `<span>${escapeHtml(text(["videoAnalysis", "download", "presetLabel"], "downloadPresetLabel"))}</span>`,
            `<select class="lab-input lab-select" data-select="download-preset"><option value="balanced"${
              state.ui.downloadPreset === "balanced" ? ' selected="selected"' : ""
            }>${escapeHtml(text(["videoAnalysis", "download", "balanced"], "downloadPresetBalanced"))}</option><option value="best"${
              state.ui.downloadPreset === "best" ? ' selected="selected"' : ""
            }>${escapeHtml(text(["videoAnalysis", "download", "best"], "downloadPresetBest"))}</option><option value="fast"${
              state.ui.downloadPreset === "fast" ? ' selected="selected"' : ""
            }>${escapeHtml(text(["videoAnalysis", "download", "fast"], "downloadPresetFast"))}</option></select>`,
            "</label>",
            '<label class="lab-field">',
            `<span>${escapeHtml(text(["videoAnalysis", "download", "previewPolicy"], "previewPolicyLabel"))}</span>`,
            `<select class="lab-input lab-select" data-select="preview-policy"><option value="smart"${
              state.ui.previewPolicy === "smart" ? ' selected="selected"' : ""
            }>${escapeHtml(text(["videoAnalysis", "download", "previewSmart"], "previewPolicySmart"))}</option><option value="dense"${
              state.ui.previewPolicy === "dense" ? ' selected="selected"' : ""
            }>${escapeHtml(text(["videoAnalysis", "download", "previewDense"], "previewPolicyDense"))}</option></select>`,
            "</label>",
            "</div>",
            '<div class="lab-focus-panel">',
            `<span class="lab-field__label">${escapeHtml(text(["videoAnalysis", "focus", "title"], "focusTitle"))}</span>`,
            '<div class="lab-console__tags">',
            focusToggleMarkup("visual", "focusVisual"),
            focusToggleMarkup("audio", "focusAudio"),
            focusToggleMarkup("image", "focusImage"),
            focusToggleMarkup("motion", "focusMotion"),
            "</div>",
            `<p class="lab-range-card__hint">${escapeHtml(text(["videoAnalysis", "focus", "hint"], "focusHint"))}</p>`,
            "</div>",
          ].join("")
        : [
            '<div class="lab-mode-grid">',
            modeCardMarkup("fast", "fast", "fastMeta"),
            modeCardMarkup("balanced", "balanced", "balancedMeta"),
            modeCardMarkup("deep", "deep", "deepMeta"),
            "</div>",
            '<label class="lab-field">',
            `<span>${escapeHtml(text(["videoAnalysis", "controls", "reportLocale"], "reportLocaleLabel"))}</span>`,
            `<select class="lab-input lab-select" data-select="report-locale"><option value="tr"${
              selectedLocale === "tr" ? ' selected="selected"' : ""
            }>${escapeHtml(text(["videoAnalysis", "controls", "reportLocaleTurkish"], "reportLocaleTurkish"))}</option><option value="en"${
              selectedLocale === "en" ? ' selected="selected"' : ""
            }>${escapeHtml(text(["videoAnalysis", "controls", "reportLocaleEnglish"], "reportLocaleEnglish"))}</option></select>`,
            "</label>",
          ].join(""),
      '<div class="lab-intake__actions">',
      `<button class="lab-primary-button" type="button" data-action="start-analysis" ${source && !busy ? "" : 'disabled="disabled"'}>${escapeHtml(text(["videoAnalysis", "actions", "start"], "startAnalysis"))}</button>`,
      `<button class="lab-secondary-button" type="button" data-action="cancel-analysis" ${state.room.pendingJobId ? "" : 'disabled="disabled"'}>${escapeHtml(text(["videoAnalysis", "actions", "cancel"], "cancelAnalysis"))}</button>`,
      "</div>",
      "</section>",
    ].join("");
  }

  function reportLauncherMarkup() {
    const entry = getDisplayEntry();
    return [
      '<section class="lab-card lab-report-launcher">',
      '<div class="lab-card__head">',
      `<div><h2 class="lab-card__title">${escapeHtml(text(["videoAnalysis", "reports", "title"], "reportsTitle"))}</h2>`,
      `<p class="lab-card__body">${escapeHtml(text(["videoAnalysis", "reader", "hint"], "reportReaderHint"))}</p></div>`,
      entry && entry.userReport
        ? `<div class="lab-risk-chip" data-risk="${escapeHtml(entry.userReport.riskLevel)}">${escapeHtml(resolveRiskLabel(entry.userReport.riskLevel))}</div>`
        : "",
      "</div>",
      entry && entry.userReport
        ? `<div class="lab-report-launcher__summary"><strong>${escapeHtml(entry.userReport.headline)}</strong><span>${escapeHtml(
            entry.userReport.summary
          )}</span></div>`
        : `<p class="lab-report__empty">${escapeHtml(text(["videoAnalysis", "reports", "empty"], "noReports"))}</p>`,
      `<div class="lab-intake__actions"><button class="lab-primary-button" type="button" data-action="open-report-overlay" ${
        entry ? "" : 'disabled="disabled"'
      }>${escapeHtml(text(["videoAnalysis", "reader", "open"], "openReader"))}</button>`,
      `<button class="lab-pill-button" type="button" data-action="copy-user-report" ${
        entry && entry.userReport ? "" : 'disabled="disabled"'
      }>${escapeHtml(text(["videoAnalysis", "reports", "copyUser"], "copyUser"))}</button></div>`,
      "</section>",
    ].join("");
  }

  function userReportMarkup(entry) {
    if (!entry || !entry.userReport) {
      return `<p class="lab-report__empty">${escapeHtml(text(["videoAnalysis", "reports", "empty"], "noReports"))}</p>`;
    }

    return [
      '<div class="lab-user-report">',
      `<div class="lab-risk-chip" data-risk="${escapeHtml(entry.userReport.riskLevel)}">${escapeHtml(resolveRiskLabel(entry.userReport.riskLevel))}</div>`,
      `<h3 class="lab-report__headline">${escapeHtml(entry.userReport.headline)}</h3>`,
      `<p class="lab-report__summary">${escapeHtml(entry.userReport.summary)}</p>`,
      `<h4 class="lab-report__section-title">${escapeHtml(text(["videoAnalysis", "reports", "findingsTitle"], "findingsTitle"))}</h4>`,
      `<ul class="lab-report__list">${entry.userReport.highlights
        .map(function (item) {
          return `<li>${escapeHtml(item)}</li>`;
        })
        .join("")}</ul>`,
      `<h4 class="lab-report__section-title">${escapeHtml(text(["videoAnalysis", "reports", "caveatsTitle"], "caveatsTitle"))}</h4>`,
      `<ul class="lab-report__list">${entry.userReport.caveats
        .map(function (item) {
          return `<li>${escapeHtml(item)}</li>`;
        })
        .join("")}</ul>`,
      "</div>",
    ].join("");
  }

  function technicalReportMarkup(entry) {
    if (!entry || !entry.technicalReport) {
      return `<p class="lab-report__empty">${escapeHtml(text(["videoAnalysis", "reports", "technicalEmpty"], "technicalEmpty"))}</p>`;
    }

    return entry.technicalReport.sections
      .map(function (section) {
        return [
          '<section class="lab-technical-section">',
          `<header class="lab-technical-section__head"><div><h3>${escapeHtml(section.title)}</h3><p>${escapeHtml(section.summary)}</p></div><div class="lab-score-pill">${escapeHtml(formatPercent(section.score))}</div></header>`,
          `<div class="lab-technical-grid"><div><h4>${escapeHtml(text(["videoAnalysis", "reports", "metricsTitle"], "metricsTitle"))}</h4><ul class="lab-metric-list">${section.metrics
            .map(function (metric) {
              return `<li><span>${escapeHtml(metric.label)}</span><strong>${escapeHtml(metric.value)}</strong></li>`;
            })
            .join("")}</ul></div>`,
          `<div><h4>${escapeHtml(text(["videoAnalysis", "reports", "findingsTitle"], "findingsTitle"))}</h4><ul class="lab-report__list">${section.findings
            .map(function (item) {
              return `<li>${escapeHtml(item)}</li>`;
            })
            .join("")}</ul></div></div>`,
          `<div class="lab-evidence"><h4>${escapeHtml(text(["videoAnalysis", "reports", "evidenceTitle"], "evidenceTitle"))}</h4>${
            section.evidence.length === 0
              ? `<p class="lab-evidence__empty">${escapeHtml(text(["videoAnalysis", "reports", "empty"], "noReports"))}</p>`
              : section.evidence
                  .map(function (item) {
                    const timestamps =
                      typeof item.timestampStartSec === "number"
                        ? ` @ ${formatTime(item.timestampStartSec)}${
                            typeof item.timestampEndSec === "number"
                              ? ` - ${formatTime(item.timestampEndSec)}`
                              : ""
                          }`
                        : "";
                    return `<article class="lab-evidence-item"><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.summary + timestamps)}</p></article>`;
                  })
                  .join("")
          }</div>`,
          "</section>",
        ].join("");
      })
      .join("");
  }

  function reportPanelMarkup(options) {
    const entry = getDisplayEntry();
    const overlayMode = options && options.overlay === true;
    return [
      '<section class="lab-card lab-reports">',
      overlayMode
        ? ""
        : [
            '<div class="lab-card__head">',
            `<h3 class="lab-card__title">${escapeHtml(text(["videoAnalysis", "reports", "title"], "reportsTitle"))}</h3>`,
            '<div class="lab-report-tabs">',
            `<button class="lab-tab-button" type="button" data-action="switch-tab" data-tab="${REPORT_TAB_USER}" data-selected="${String(state.ui.reportTab === REPORT_TAB_USER)}">${escapeHtml(text(["videoAnalysis", "reports", "user"], "userReport"))}</button>`,
            `<button class="lab-tab-button" type="button" data-action="switch-tab" data-tab="${REPORT_TAB_TECHNICAL}" data-selected="${String(state.ui.reportTab === REPORT_TAB_TECHNICAL)}">${escapeHtml(text(["videoAnalysis", "reports", "technical"], "technicalReport"))}</button>`,
            "</div></div>",
          ].join(""),
      '<div class="lab-report-actions">',
      `<button class="lab-pill-button" type="button" data-action="copy-user-report">${escapeHtml(text(["videoAnalysis", "reports", "copyUser"], "copyUser"))}</button>`,
      `<button class="lab-pill-button" type="button" data-action="copy-technical-json">${escapeHtml(text(["videoAnalysis", "reports", "copyJson"], "copyJson"))}</button>`,
      "</div>",
      state.ui.reportTab === REPORT_TAB_TECHNICAL ? technicalReportMarkup(entry) : userReportMarkup(entry),
      "</section>",
    ].join("");
  }

  function reportOverlayMarkup() {
    if (!state.ui.reportOverlayOpen) {
      return "";
    }

    return [
      '<div class="lab-overlay" data-visible="true">',
      '<div class="lab-overlay__backdrop" data-action="close-report-overlay"></div>',
      '<section class="lab-overlay__panel">',
      '<header class="lab-overlay__header">',
      `<div><h2 class="lab-overlay__title">${escapeHtml(text(["videoAnalysis", "reader", "title"], "reportReaderTitle"))}</h2>`,
      `<p class="lab-card__body">${escapeHtml(text(["videoAnalysis", "reader", "hint"], "reportReaderHint"))}</p></div>`,
      '<div class="lab-overlay__actions">',
      '<div class="lab-report-tabs">',
      `<button class="lab-tab-button" type="button" data-action="switch-tab" data-tab="${REPORT_TAB_USER}" data-selected="${String(state.ui.reportTab === REPORT_TAB_USER)}">${escapeHtml(text(["videoAnalysis", "reports", "user"], "userReport"))}</button>`,
      `<button class="lab-tab-button" type="button" data-action="switch-tab" data-tab="${REPORT_TAB_TECHNICAL}" data-selected="${String(state.ui.reportTab === REPORT_TAB_TECHNICAL)}">${escapeHtml(text(["videoAnalysis", "reports", "technical"], "technicalReport"))}</button>`,
      "</div>",
      `<button class="lab-pill-button" type="button" data-action="close-report-overlay">${escapeHtml(text(["videoAnalysis", "reader", "close"], "closeReader"))}</button>`,
      "</div>",
      "</header>",
      reportPanelMarkup({ overlay: true }),
      "</section>",
      "</div>",
    ].join("");
  }

  function previewMarkup() {
    const source = getDisplaySource();
    const workingSource = getWorkingSource();
    const entry = getDisplayEntry();
    const previewUrl = source && source.previewUrl ? source.previewUrl : null;
    const ratio =
      source && source.probe && source.probe.width > 0 && source.probe.height > 0
        ? `${source.probe.width} / ${source.probe.height}`
        : "16 / 9";
    const range = source ? currentRangeValues(source) : { startSec: 0, endSec: 0, duration: 0 };
    const region = state.ui.selection.region;

    return [
      '<section class="lab-card lab-preview">',
      '<div class="lab-card__head lab-preview__head">',
      `<div><h3 class="lab-card__title">${escapeHtml(text(["videoAnalysis", "preview", "title"], "previewTitle"))}</h3>`,
      `<p class="lab-card__body">${escapeHtml(
        source ? source.label : text(["videoAnalysis", "heroSubtitle"], "roomSubtitle")
      )}</p></div>`,
      entry && entry.userReport
        ? `<div class="lab-risk-chip" data-risk="${escapeHtml(entry.userReport.riskLevel)}">${escapeHtml(resolveRiskLabel(entry.userReport.riskLevel))}</div>`
        : source
          ? `<div class="lab-score-pill">${escapeHtml(text(["videoAnalysis", "source", "ready"], "sourceReady"))}</div>`
          : "",
      "</div>",
      '<div class="lab-preview__layout">',
      '<div class="lab-preview__stage">',
      previewUrl
        ? [
            `<div class="lab-preview-frame" style="--lab-video-ratio:${ratio};">`,
            `<video class="lab-preview-frame__video" data-preview-video="true" src="${escapeHtml(previewUrl)}" controls preload="metadata"></video>`,
            workingSource
              ? `<div class="lab-preview-frame__overlay" data-roi-canvas="true">${
                  region
                    ? `<div class="lab-roi-box" style="left:${region.xPct}%;top:${region.yPct}%;width:${region.widthPct}%;height:${region.heightPct}%;"></div>`
                    : ""
                }</div>`
              : "",
            "</div>",
          ].join("")
        : `<p class="lab-preview__empty">${
            source
              ? escapeHtml(text(["videoAnalysis", "preview", "cacheMissing"], "previewCacheMissing"))
              : escapeHtml(text(["videoAnalysis", "preview", "empty"], "previewEmpty"))
          }</p>`,
      "</div>",
      '<div class="lab-preview__sidebar">',
      source ? sourceMetaMarkup(source) : "",
      workingSource
        ? [
            '<div class="lab-range-card">',
            `<div class="lab-range-card__head"><strong>${escapeHtml(text(["videoAnalysis", "selection", "rangeTitle"], "customRange"))}</strong><button class="lab-link-button" type="button" data-action="reset-range">${escapeHtml(text(["videoAnalysis", "selection", "resetRange"], "resetRange"))}</button></div>`,
            `<div class="lab-range-card__values"><span>${escapeHtml(formatTime(range.startSec))}</span><span>${escapeHtml(formatTime(range.endSec))}</span></div>`,
            `<input type="range" min="0" max="${String(range.duration || 0)}" step="0.1" value="${String(range.startSec)}" data-input="range-start" />`,
            `<input type="range" min="0" max="${String(range.duration || 0)}" step="0.1" value="${String(range.endSec)}" data-input="range-end" />`,
            "</div>",
            '<div class="lab-range-card">',
            `<div class="lab-range-card__head"><strong>${escapeHtml(text(["videoAnalysis", "selection", "regionTitle"], "fullFrame"))}</strong><button class="lab-link-button" type="button" data-action="reset-region">${escapeHtml(text(["videoAnalysis", "selection", "resetRegion"], "resetRegion"))}</button></div>`,
            `<p class="lab-range-card__hint">${escapeHtml(text(["videoAnalysis", "selection", "dragHint"], "dragHint"))}</p>`,
            "</div>",
          ].join("")
        : `<div class="lab-range-card"><p class="lab-range-card__hint">${escapeHtml(text(["videoAnalysis", "source", "body"], "sourceBody"))}</p></div>`,
      "</div>",
      "</div>",
      "</section>",
    ].join("");
  }

  function sourcePanelMarkup() {
    const source = getWorkingSource();
    const busy = Boolean(state.room.pendingSourceJobId || state.room.pendingJobId);
    return [
      '<section class="lab-card lab-intake">',
      `<div class="lab-card__head"><h2 class="lab-card__title">${escapeHtml(text(["videoAnalysis", "source", "title"], "sourceTitle"))}</h2></div>`,
      `<p class="lab-card__body">${escapeHtml(text(["videoAnalysis", "source", "body"], "sourceBody"))}</p>`,
      '<div class="lab-intake__actions">',
      `<button class="lab-primary-button" type="button" data-action="pick-local-file" ${busy ? 'disabled="disabled"' : ""}>${escapeHtml(text(["videoAnalysis", "source", "pickFile"], "pickFile"))}</button>`,
      `<button class="lab-secondary-button" type="button" data-action="cancel-source-preparation" ${state.room.pendingSourceJobId ? "" : 'disabled="disabled"'}>${escapeHtml(text(["videoAnalysis", "source", "cancelPreparation"], "cancelSourcePreparation"))}</button>`,
      "</div>",
      '<label class="lab-field">',
      `<span>${escapeHtml(text(["videoAnalysis", "source", "youtubeLabel"], "youtubeLabel"))}</span>`,
      `<input class="lab-input" type="url" data-input="youtube-url" value="${escapeHtml(state.ui.youtubeUrl)}" placeholder="${escapeHtml(text(["videoAnalysis", "source", "youtubePlaceholder"], "youtubePlaceholder"))}" ${busy ? 'disabled="disabled"' : ""} />`,
      "</label>",
      `<button class="lab-secondary-button" type="button" data-action="submit-youtube-url" ${busy || state.ui.youtubeUrl.trim() === "" ? 'disabled="disabled"' : ""}>${escapeHtml(text(["videoAnalysis", "source", "prepareYoutube"], "prepareYoutube"))}</button>`,
      '<label class="lab-field">',
      `<span>${escapeHtml(text(["videoAnalysis", "source", "directUrlLabel"], "directUrlLabel"))}</span>`,
      `<input class="lab-input" type="url" data-input="direct-url" value="${escapeHtml(state.ui.directUrl)}" placeholder="${escapeHtml(text(["videoAnalysis", "source", "directUrlPlaceholder"], "directUrlPlaceholder"))}" ${busy ? 'disabled="disabled"' : ""} />`,
      "</label>",
      `<button class="lab-secondary-button" type="button" data-action="submit-direct-url" ${busy || state.ui.directUrl.trim() === "" ? 'disabled="disabled"' : ""}>${escapeHtml(text(["videoAnalysis", "source", "prepareUrl"], "prepareUrl"))}</button>`,
      source
        ? `<div class="lab-source-ready"><strong>${escapeHtml(text(["videoAnalysis", "source", "ready"], "sourceReady"))}</strong><span>${escapeHtml(source.label)}</span><button class="lab-link-button" type="button" data-action="clear-source">${escapeHtml(text(["videoAnalysis", "source", "clear"], "clearSource"))}</button></div>`
        : "",
      "</section>",
      selectionSummaryMarkup(source),
      '<section class="lab-card lab-mode-picker">',
      `<h3 class="lab-card__title">${escapeHtml(text(["videoAnalysis", "modes", "title"], "modeTitle"))}</h3>`,
      '<div class="lab-mode-grid">',
      modeCardMarkup("fast", "fast", "fastMeta"),
      modeCardMarkup("balanced", "balanced", "balancedMeta"),
      modeCardMarkup("deep", "deep", "deepMeta"),
      "</div>",
      '<div class="lab-intake__actions">',
      `<button class="lab-primary-button" type="button" data-action="start-analysis" ${source && !busy ? "" : 'disabled="disabled"'}>${escapeHtml(text(["videoAnalysis", "actions", "start"], "startAnalysis"))}</button>`,
      `<button class="lab-secondary-button" type="button" data-action="cancel-analysis" ${state.room.pendingJobId ? "" : 'disabled="disabled"'}>${escapeHtml(text(["videoAnalysis", "actions", "cancel"], "cancelAnalysis"))}</button>`,
      "</div>",
      "</section>",
    ].join("");
  }

  function buildUserReportCopy(entry) {
    if (!entry || !entry.userReport) {
      return "";
    }
    return [
      `${entry.userReport.headline}`,
      "",
      entry.userReport.summary,
      "",
      `${text(["videoAnalysis", "reports", "findingsTitle"], "findingsTitle")}:`,
      entry.userReport.highlights.map(function (item) {
        return `- ${item}`;
      }).join("\n"),
      "",
      `${text(["videoAnalysis", "reports", "caveatsTitle"], "caveatsTitle")}:`,
      entry.userReport.caveats.map(function (item) {
        return `- ${item}`;
      }).join("\n"),
    ].join("\n");
  }

  function noticeMarkup() {
    if (!state.room.error && !state.ui.toast) {
      return "";
    }

    return [
      '<div class="lab-notice-stack">',
      state.room.error ? `<p class="lab-error-banner">${escapeHtml(state.room.error)}</p>` : "",
      state.ui.toast ? `<p class="lab-toast">${escapeHtml(state.ui.toast)}</p>` : "",
      "</div>",
    ].join("");
  }

  async function copyText(value) {
    try {
      await navigator.clipboard.writeText(value);
      state.ui.toast = text(["videoAnalysis", "copy", "ok"], "copyOk");
      render();
      window.setTimeout(function () {
        state.ui.toast = "";
        render();
      }, 1400);
      return;
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.className = "lab-copy-proxy";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      state.ui.toast = copied
        ? text(["videoAnalysis", "copy", "ok"], "copyOk")
        : text(["videoAnalysis", "copy", "fail"], "copyFail");
      render();
      window.setTimeout(function () {
        state.ui.toast = "";
        render();
      }, 1400);
    }
  }

  function render() {
    const app = document.getElementById("app");
    if (!app) {
      return;
    }

    document.documentElement.lang = state.locale;
    document.body.dataset.presentationMode =
      state.context && state.context.presentation && state.context.presentation.mode === "classic"
        ? "classic"
        : "scene-view";
    document.title = `${text(["title"], "Laboratory")} - ${text(["videoAnalysis", "heroTitle"], "roomTitle")}`;

    app.innerHTML = [
      '<main class="lab-shell">',
      '<section class="lab-surface">',
      topbarMarkup(),
      '<section class="lab-workbench">',
      '<aside class="lab-pane lab-pane--projects">',
      noticeMarkup(),
      projectsMarkup(),
      "</aside>",
      '<section class="lab-pane lab-pane--workspace">',
      previewMarkup(),
      progressMarkup(),
      `<section class="lab-activity">${historyMarkup()}</section>`,
      "</section>",
      '<aside class="lab-pane lab-pane--inspector">',
      controlsMarkup(),
      selectionSummaryMarkup(getDisplaySource()),
      reportLauncherMarkup(),
      "</section>",
      "</section>",
      reportOverlayMarkup(),
      "</section>",
      "</main>",
    ].join("");

    bindRegionSelection();
  }

  function updateRange(which, nextValue) {
    const source = getWorkingSource();
    if (!source) {
      return;
    }
    const duration = durationForSource(source);
    const current = currentRangeValues(source);
    if (which === "start") {
      current.startSec = Math.max(0, Math.min(nextValue, current.endSec - 0.25));
    } else {
      current.endSec = Math.min(duration, Math.max(nextValue, current.startSec + 0.25));
    }
    state.ui.selection.timeRange =
      current.startSec <= 0.001 && Math.abs(current.endSec - duration) <= 0.25
        ? null
        : current;
    render();
  }

  function normalizeRegion(region) {
    if (!region) {
      return null;
    }
    return {
      xPct: Math.max(0, Math.min(100, region.xPct)),
      yPct: Math.max(0, Math.min(100, region.yPct)),
      widthPct: Math.max(0, Math.min(100 - region.xPct, region.widthPct)),
      heightPct: Math.max(0, Math.min(100 - region.yPct, region.heightPct)),
    };
  }

  function bindRegionSelection() {
    const overlay = document.querySelector("[data-roi-canvas='true']");
    if (!overlay) {
      return;
    }

    overlay.addEventListener("pointerdown", function (event) {
      const rect = overlay.getBoundingClientRect();
      state.ui.draggingRegion = true;
      state.ui.dragStart = {
        x: ((event.clientX - rect.left) / rect.width) * 100,
        y: ((event.clientY - rect.top) / rect.height) * 100,
      };
      overlay.setPointerCapture(event.pointerId);
    });

    overlay.addEventListener("pointermove", function (event) {
      if (!state.ui.draggingRegion || !state.ui.dragStart) {
        return;
      }
      const rect = overlay.getBoundingClientRect();
      const current = {
        x: ((event.clientX - rect.left) / rect.width) * 100,
        y: ((event.clientY - rect.top) / rect.height) * 100,
      };
      const nextRegion = normalizeRegion({
        xPct: Math.min(state.ui.dragStart.x, current.x),
        yPct: Math.min(state.ui.dragStart.y, current.y),
        widthPct: Math.abs(current.x - state.ui.dragStart.x),
        heightPct: Math.abs(current.y - state.ui.dragStart.y),
      });
      state.ui.selection.region =
        nextRegion && nextRegion.widthPct >= 3 && nextRegion.heightPct >= 3 ? nextRegion : null;
      render();
    });

    function finishDrag() {
      state.ui.draggingRegion = false;
      state.ui.dragStart = null;
    }

    overlay.addEventListener("pointerup", finishDrag);
    overlay.addEventListener("pointercancel", finishDrag);
  }

  function sendAction(action, payload) {
    if (!window.roomAPI || typeof window.roomAPI.sendEvent !== "function") {
      state.room.error = "Room API bridge is not connected.";
      render();
      return;
    }
    window.roomAPI.sendEvent("laboratory-action", {
      action: action,
      ...(payload || {}),
    });
  }

  function sendHostContext(payload) {
    if (!window.roomAPI || typeof window.roomAPI.sendEvent !== "function") {
      state.room.error = "Room API bridge is not connected.";
      render();
      return;
    }
    window.roomAPI.sendEvent("host-context", payload || {});
  }

  function syncWorkflowSettingsToHost() {
    const workflowSettings = readUiWorkflowSettings();
    state.room.workflowSettings = cloneWorkflowSettings(workflowSettings);
    sendAction("sync-workflow-settings", {
      workflowSettings,
    });
  }

  document.addEventListener("click", function (event) {
    const target = event.target.closest("[data-action]");
    if (!target) {
      return;
    }

    const action = target.getAttribute("data-action");
    if (action === "pick-local-file") {
      sendAction("pick-local-file");
      return;
    }
    if (action === "submit-direct-url") {
      if (state.ui.directUrl.trim() !== "") {
        sendAction("submit-direct-url", { url: state.ui.directUrl.trim() });
      }
      return;
    }
    if (action === "submit-youtube-url") {
      if (state.ui.youtubeUrl.trim() !== "") {
        sendAction("submit-youtube-url", { url: state.ui.youtubeUrl.trim() });
      }
      return;
    }
    if (action === "set-mode") {
      state.ui.mode = target.getAttribute("data-mode") || DEFAULT_MODE;
      render();
      return;
    }
    if (action === "set-settings-view") {
      state.ui.settingsView = target.getAttribute("data-view") === "advanced" ? "advanced" : "basic";
      render();
      return;
    }
    if (action === "start-analysis") {
      sendAction("start-analysis", {
        mode: state.ui.mode,
        selection: cloneSelection(state.ui.selection),
      });
      return;
    }
    if (action === "cancel-analysis") {
      sendAction("cancel-analysis");
      return;
    }
    if (action === "cancel-source-preparation") {
      sendAction("cancel-source-preparation");
      return;
    }
    if (action === "reset-range") {
      state.ui.selection.timeRange = null;
      render();
      return;
    }
    if (action === "reset-region") {
      state.ui.selection.region = null;
      render();
      return;
    }
    if (action === "switch-tab") {
      state.ui.reportTab = target.getAttribute("data-tab") === REPORT_TAB_TECHNICAL ? REPORT_TAB_TECHNICAL : REPORT_TAB_USER;
      render();
      return;
    }
    if (action === "open-report-overlay") {
      state.ui.reportOverlayOpen = true;
      render();
      return;
    }
    if (action === "close-report-overlay") {
      state.ui.reportOverlayOpen = false;
      render();
      return;
    }
    if (action === "reload-history") {
      sendAction("reload-history");
      return;
    }
    if (action === "select-project") {
      const projectId = target.getAttribute("data-project-id");
      if (projectId) {
        sendAction("select-project", { projectId: projectId });
      }
      return;
    }
    if (action === "select-history-entry") {
      const entryId = target.getAttribute("data-entry-id");
      if (entryId) {
        sendAction("select-history-entry", { entryId: entryId });
      }
      return;
    }
    if (action === "delete-project") {
      const projectId = target.getAttribute("data-project-id");
      if (projectId && window.confirm(text(["videoAnalysis", "projects", "deleteConfirm"], "projectDeleteConfirm"))) {
        sendAction("delete-project", { projectId: projectId });
      }
      return;
    }
    if (action === "cleanup-entry-media") {
      const entryId = target.getAttribute("data-entry-id");
      if (entryId) {
        sendAction("cleanup-entry-media", { entryId: entryId });
      }
      return;
    }
    if (action === "clear-source") {
      sendAction("clear-source");
      return;
    }
    if (action === "copy-user-report") {
      void copyText(buildUserReportCopy(getDisplayEntry()));
      return;
    }
    if (action === "copy-technical-json") {
      const entry = getDisplayEntry();
      if (entry && entry.technicalReport) {
        void copyText(JSON.stringify(entry.technicalReport, null, 2));
      }
      return;
    }
    if (action === "toggle-focus") {
      const focusKey = target.getAttribute("data-focus");
      if (
        focusKey === "visual" ||
        focusKey === "audio" ||
        focusKey === "image" ||
        focusKey === "motion"
      ) {
        state.ui.analysisFocus[focusKey] = !state.ui.analysisFocus[focusKey];
        syncWorkflowSettingsToHost();
        render();
      }
    }
  });

  document.addEventListener("input", function (event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    if (target.getAttribute("data-input") === "direct-url") {
      state.ui.directUrl = target.value;
      render();
      return;
    }
    if (target.getAttribute("data-input") === "youtube-url") {
      state.ui.youtubeUrl = target.value;
      render();
      return;
    }
    if (target.getAttribute("data-input") === "range-start") {
      updateRange("start", Number(target.value) || 0);
      return;
    }
    if (target.getAttribute("data-input") === "range-end") {
      updateRange("end", Number(target.value) || 0);
    }
  });

  document.addEventListener("change", function (event) {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) {
      return;
    }

    if (target.getAttribute("data-select") === "report-locale") {
      const nextLocale = target.value === "tr" ? "tr" : "en";
      state.locale = nextLocale;
      state.room.locale = nextLocale;
      state.room.reportLocale = nextLocale;
      sendHostContext({ locale: nextLocale });
      render();
      return;
    }

    if (target.getAttribute("data-select") === "download-preset") {
      state.ui.downloadPreset =
        target.value === "best" || target.value === "fast" ? target.value : "balanced";
      syncWorkflowSettingsToHost();
      render();
      return;
    }

    if (target.getAttribute("data-select") === "preview-policy") {
      state.ui.previewPolicy = target.value === "dense" ? "dense" : "smart";
      syncWorkflowSettingsToHost();
      render();
    }
  });

  function handleHostMessage(message) {
    if (!message || typeof message !== "object") {
      return;
    }

    if (message.type === "host-context") {
      state.locale = normalizeLocale(message.locale || state.locale);
      state.translations = message.translations || null;
      state.context = message;
      render();
      return;
    }

    if (message.type === "laboratory-state") {
      const payload =
        message.payload && typeof message.payload === "object" && Array.isArray(message.payload) === false
          ? message.payload
          : {};
      state.room = {
        ...createRoomState(),
        ...payload,
        workflowSettings: cloneWorkflowSettings(payload.workflowSettings),
        selection: cloneSelection(payload.selection),
      };
      state.locale = normalizeLocale(payload.locale || state.locale);
      syncUiWorkflowSettings(state.room.workflowSettings);
      syncSelectionForSource(state.room.source);
      if (!state.room.activeEntry) {
        state.ui.reportOverlayOpen = false;
      }
      render();
    }
  }

  if (window.roomAPI && typeof window.roomAPI.onHostMessage === "function") {
    window.roomAPI.onHostMessage(handleHostMessage);
  }

  render();

  if (window.roomAPI && typeof window.roomAPI.ready === "function") {
    window.roomAPI.ready({
      featureId: "video-analysis",
      state: "booted",
    });
  }
})();
