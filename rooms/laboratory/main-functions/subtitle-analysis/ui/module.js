export function createSubtitleAnalysisUi(deps) {
  const toRecord = deps.toRecord;
  const escapeHtml = deps.escapeHtml;
  const featureText = deps.featureText;
  const subtitleText = deps.subtitleText;
  const subtitleTemplate = deps.subtitleTemplate;
  const formatStatusLabel = deps.formatStatusLabel;
  const formatDuration = deps.formatDuration;
  const renderSummaryRows = deps.renderSummaryRows;
  const renderTextField = deps.renderTextField;
  const renderEditToggle = deps.renderEditToggle;
  const renderEditSelectField = deps.renderEditSelectField;
  const renderEditRangeField = deps.renderEditRangeField;
  const renderStageIntro = deps.renderStageIntro;
  const getCurrentDrafts = deps.getCurrentDrafts;
  const getCurrentEditDraft = deps.getCurrentEditDraft;
  const getToolEntry = deps.getToolEntry;
  const getSubtitleSourcePresets = deps.getSubtitleSourcePresets;
  const getSubtitleWorkspace = deps.getSubtitleWorkspace;
  const getSubtitleAnalysisCatalog = deps.getSubtitleAnalysisCatalog;
  const getSubtitleAnalysisProviders = deps.getSubtitleAnalysisProviders;
  const getSubtitleProcessStatusLabel = deps.getSubtitleProcessStatusLabel;
  const getSubtitleProcessModuleSummary = deps.getSubtitleProcessModuleSummary;
  const getSubtitleProcessModuleLabel = deps.getSubtitleProcessModuleLabel;
  const getSubtitleProviderStatusLabel = deps.getSubtitleProviderStatusLabel;
  const getSubtitleProviderSummary = deps.getSubtitleProviderSummary;
  const getSubtitleProviderLabel = deps.getSubtitleProviderLabel;
  const getSubtitleProviderModuleLabels = deps.getSubtitleProviderModuleLabels;
  const getActiveSubtitleEntry = deps.getActiveSubtitleEntry;
  const getSubtitleSelectedEntryIds = deps.getSubtitleSelectedEntryIds;
  const getSubtitleDiscoveryState = deps.getSubtitleDiscoveryState;
  const getSubtitleDiscoveryItems = deps.getSubtitleDiscoveryItems;
  const getSubtitleSelectedCandidateIds = deps.getSubtitleSelectedCandidateIds;
  const getSubtitleEntries = deps.getSubtitleEntries;
  const getSubtitleEditState = deps.getSubtitleEditState;
  const getSubtitleEditPresets = deps.getSubtitleEditPresets;
  const getSubtitleEditPreview = deps.getSubtitleEditPreview;
  const getSubtitleOutputs = deps.getSubtitleOutputs;

  function getSubtitleSourceModeOptions() {
    const modes = getSubtitleSourcePresets().modes;
    return Array.isArray(modes)
      ? modes.filter(function (entry) {
          return typeof entry === "string" && entry.trim() !== "";
        })
      : ["local-file", "local-folder", "url", "youtube-single", "youtube-playlist", "youtube-channel"];
  }

  function getCurrentSubtitleSourceMode() {
    const workspace = getSubtitleWorkspace();
    const currentMode = typeof workspace.mode === "string" ? workspace.mode : null;
    const modes = getSubtitleSourceModeOptions();
    return modes.includes(currentMode) ? currentMode : modes[0] || "local-file";
  }

  function getSubtitleSourceModeLabel(modeId) {
    switch (modeId) {
      case "local-folder":
        return subtitleText(["source", "modes", "localFolder"], "Klasor", "Folder");
      case "url":
        return "URL";
      case "youtube-single":
        return subtitleText(["source", "modes", "youtubeSingle"], "YouTube Tek Video", "YouTube Single");
      case "youtube-playlist":
        return subtitleText(["source", "modes", "youtubePlaylist"], "YouTube Playlist", "YouTube Playlist");
      case "youtube-channel":
        return subtitleText(["source", "modes", "youtubeChannel"], "YouTube Kanal", "YouTube Channel");
      case "local-file":
      default:
        return subtitleText(["source", "modes", "localFile"], "Tek Altyazi", "Single Subtitle");
    }
  }

  function renderSubtitleDraftSelect(fieldId, value, label, options) {
    return `
      <label class="lab-field">
        <span class="lab-field__label">${escapeHtml(label)}</span>
        <select class="lab-select" data-draft-field="${escapeHtml(fieldId)}">
          ${options
            .map(function (entry) {
              return `
                <option value="${escapeHtml(entry.value)}" ${
                  String(entry.value) === String(value) ? "selected" : ""
                }>
                  ${escapeHtml(entry.label)}
                </option>
              `;
            })
            .join("")}
        </select>
      </label>
    `;
  }

  function renderSubtitleCatalogPanel() {
    const modules = Array.isArray(getSubtitleAnalysisCatalog().modules)
      ? getSubtitleAnalysisCatalog().modules.map(toRecord)
      : [];
    if (modules.length === 0) {
      return "";
    }

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(subtitleText(["process", "catalog", "eyebrow"], "Analiz Plani", "Analysis Plan"))}</p>
            <h2 class="lab-panel__title">${escapeHtml(subtitleText(["process", "catalog", "title"], "Ilk Modul Seti", "Initial Module Set"))}</h2>
            <p class="lab-panel__subtitle">${escapeHtml(
              subtitleText(
                ["process", "catalog", "subtitle"],
                "QC, okunabilirlik, zamanlama ve batch ozet modulleri burada gorunur.",
                "QC, readability, timing, and batch summary modules live here."
              )
            )}</p>
          </div>
        </div>
        <div class="lab-tool-grid">
          ${modules
            .map(function (entry) {
              const statusLabel = getSubtitleProcessStatusLabel(entry.status || "planned");
              const summary = getSubtitleProcessModuleSummary(entry);
              return `
                <article class="lab-tool-card">
                  <div class="lab-tool-card__head">
                    <div>
                      <strong>${escapeHtml(getSubtitleProcessModuleLabel(entry))}</strong>
                      <span>${escapeHtml(statusLabel)}</span>
                    </div>
                    <span class="lab-chip">${escapeHtml(statusLabel)}</span>
                  </div>
                  ${summary ? `<p class="lab-panel__hint">${escapeHtml(summary)}</p>` : ""}
                </article>
              `;
            })
            .join("")}
        </div>
      </section>
    `;
  }

  function renderSubtitleProviderPanel() {
    const providers = Array.isArray(getSubtitleAnalysisProviders().providers)
      ? getSubtitleAnalysisProviders().providers.map(toRecord)
      : [];
    if (providers.length === 0) {
      return "";
    }

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(subtitleText(["process", "providers", "eyebrow"], "Saglayicilar", "Providers"))}</p>
            <h2 class="lab-panel__title">${escapeHtml(subtitleText(["process", "providers", "title"], "Calisma Katmani", "Execution Layer"))}</h2>
          </div>
        </div>
        <div class="lab-tool-grid">
          ${providers
            .map(function (entry) {
              const statusLabel = getSubtitleProviderStatusLabel(entry.status || "planned");
              const providerSummary = getSubtitleProviderSummary(entry);
              const moduleSummary = getSubtitleProviderModuleLabels(entry);
              return `
                <article class="lab-tool-card">
                  <div class="lab-tool-card__head">
                    <div>
                      <strong>${escapeHtml(getSubtitleProviderLabel(entry))}</strong>
                      <span>${escapeHtml(statusLabel)}</span>
                    </div>
                  </div>
                  ${providerSummary ? `<p class="lab-panel__hint">${escapeHtml(providerSummary)}</p>` : ""}
                  <p class="lab-panel__hint">${escapeHtml(moduleSummary)}</p>
                </article>
              `;
            })
            .join("")}
        </div>
      </section>
    `;
  }

  function renderSubtitleSourceWorkspacePanel() {
    const workspace = getSubtitleWorkspace();
    const discovery = getSubtitleDiscoveryState();
    const activeEntry = getActiveSubtitleEntry();
    const selectedCount = getSubtitleSelectedEntryIds().length;
    const candidateCount = getSubtitleDiscoveryItems().length;
    return `
      <section class="lab-panel lab-preview-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(subtitleText(["source", "summary", "eyebrow"], "Kaynak Ozet", "Source Summary"))}</p>
            <h2 class="lab-panel__title">${escapeHtml(
              activeEntry
                ? activeEntry.fileName || activeEntry.id || "--"
                : subtitleText(["source", "summary", "emptyTitle"], "Altyazi secilmedi", "No subtitle selected")
            )}</h2>
            <p class="lab-panel__subtitle">${escapeHtml(
              activeEntry
                ? subtitleText(
                    ["source", "summary", "activeSubtitle"],
                    "Aktif altyazi girisi ve secili batch durumu.",
                    "Active subtitle entry and current batch selection."
                  )
                : subtitleText(
                    ["source", "summary", "prepareHint"],
                    "Source asamasindan bir altyazi girisi hazirla.",
                    "Prepare a subtitle entry from the source stage."
                  )
            )}</p>
          </div>
        </div>
        ${renderSummaryRows([
          [subtitleText(["source", "summary", "labels", "workspaceMode"], "Calisma modu", "Workspace mode"), getSubtitleSourceModeLabel(getCurrentSubtitleSourceMode())],
          [subtitleText(["source", "summary", "labels", "selectedEntries"], "Secili giris", "Selected entries"), String(selectedCount || (activeEntry ? 1 : 0))],
          [subtitleText(["source", "summary", "labels", "discoveryCandidates"], "Kesif adayi", "Discovery candidates"), String(candidateCount)],
          [subtitleText(["source", "summary", "labels", "format"], "Format", "Format"), activeEntry ? String(activeEntry.format || "--").toUpperCase() : "--"],
          [subtitleText(["source", "summary", "labels", "language"], "Dil", "Language"), activeEntry ? activeEntry.language || "--" : "--"],
          [subtitleText(["source", "summary", "labels", "published"], "Yayin", "Published"), activeEntry ? activeEntry.publishedAt || "--" : "--"],
          [subtitleText(["source", "summary", "labels", "discovery"], "Kesif", "Discovery"), formatStatusLabel(discovery.status || "idle")],
          [subtitleText(["source", "summary", "labels", "status"], "Durum", "Status"), formatStatusLabel(workspace.lastError ? "error" : "ready")],
        ])}
        ${
          typeof workspace.lastError === "string" && workspace.lastError.trim() !== ""
            ? `<div class="lab-notice">${escapeHtml(workspace.lastError)}</div>`
            : ""
        }
      </section>
    `;
  }

  function renderSubtitleSourceIntakePanel() {
    const drafts = getCurrentDrafts();
    const currentMode = getCurrentSubtitleSourceMode();
    const ytDlpInstalled = getToolEntry("yt-dlp").installed === true;
    const discoveryItems = getSubtitleDiscoveryItems();
    const selectedCandidateCount = getSubtitleSelectedCandidateIds().length;
    let body = "";

    if (currentMode === "local-file") {
      body = `
        <button class="lab-button lab-button--primary" type="button" data-action="subtitle-source-pick-local">
          ${escapeHtml(subtitleText(["source", "actions", "pickLocal"], "Tek altyazi sec", "Pick subtitle file"))}
        </button>
      `;
    } else if (currentMode === "local-folder") {
      body = `
        <button class="lab-button lab-button--primary" type="button" data-action="subtitle-source-pick-folder">
          ${escapeHtml(subtitleText(["source", "actions", "pickFolder"], "Klasor sec", "Pick subtitle folder"))}
        </button>
      `;
    } else if (currentMode === "url") {
      body = `
        ${renderTextField(
          "urlInput",
          drafts.urlInput,
          subtitleText(["source", "fields", "subtitleUrl"], "Altyazi URL", "Subtitle URL"),
          subtitleText(["source", "placeholders", "subtitleUrl"], "https://example.com/file.vtt", "https://example.com/file.vtt")
        )}
        <button class="lab-button lab-button--primary" type="button" data-action="subtitle-source-download-url">
          ${escapeHtml(subtitleText(["source", "actions", "downloadUrl"], "URL indir", "Download URL"))}
        </button>
      `;
    } else {
      body = `
        ${
          ytDlpInstalled !== true
            ? `<div class="lab-notice">${escapeHtml(featureText(["source", "youtubeDisabled"]))}</div>`
            : ""
        }
        ${renderTextField(
          "youtubeUrl",
          drafts.youtubeUrl,
          subtitleText(["source", "fields", "youtubeUrl"], "YouTube URL", "YouTube URL"),
          subtitleText(["source", "placeholders", "youtubeUrl"], "Kanal, playlist ya da video linki", "Channel, playlist, or video URL")
        )}
        <div class="lab-form-grid">
          ${renderSubtitleDraftSelect("subtitleMode", drafts.subtitleMode || "manual", subtitleText(["source", "fields", "subtitleMode"], "Altyazi modu", "Subtitle mode"), [
            { value: "manual", label: subtitleText(["source", "options", "subtitleMode", "manual"], "Manual", "Manual") },
            { value: "auto", label: subtitleText(["source", "options", "subtitleMode", "auto"], "Otomatik", "Automatic") },
            { value: "both", label: subtitleText(["source", "options", "subtitleMode", "both"], "Ikisi de", "Both") },
          ])}
          ${renderTextField(
            "subtitlesLang",
            drafts.subtitlesLang || "all",
            subtitleText(["source", "fields", "languageFilter"], "Dil filtresi", "Language filter"),
            subtitleText(["source", "placeholders", "languageFilter"], "tr,en ya da all", "tr,en or all")
          )}
          ${renderTextField(
            "publishedAfter",
            drafts.publishedAfter || "",
            subtitleText(["source", "fields", "publishedAfter"], "Yayin tarihi baslangic", "Published after"),
            "",
            { type: "date" }
          )}
          ${renderTextField(
            "publishedBefore",
            drafts.publishedBefore || "",
            subtitleText(["source", "fields", "publishedBefore"], "Yayin tarihi bitis", "Published before"),
            "",
            { type: "date" }
          )}
          ${renderTextField(
            "weekdays",
            drafts.weekdays || "",
            subtitleText(["source", "fields", "weekdays"], "Haftanin gunleri", "Weekdays"),
            subtitleText(["source", "placeholders", "weekdays"], "mon wed fri", "mon wed fri")
          )}
          ${renderTextField(
            "durationMinSeconds",
            drafts.durationMinSeconds == null ? "" : String(drafts.durationMinSeconds),
            subtitleText(["source", "fields", "durationMin"], "Min sure sn", "Min duration sec"),
            "0",
            { type: "number" }
          )}
          ${renderTextField(
            "durationMaxSeconds",
            drafts.durationMaxSeconds == null ? "" : String(drafts.durationMaxSeconds),
            subtitleText(["source", "fields", "durationMax"], "Max sure sn", "Max duration sec"),
            "0",
            { type: "number" }
          )}
          ${renderSubtitleDraftSelect("shortsMode", drafts.shortsMode || "all", subtitleText(["source", "fields", "shorts"], "Shorts", "Shorts"), [
            { value: "all", label: subtitleText(["source", "options", "shorts", "all"], "Tum", "All") },
            { value: "only", label: subtitleText(["source", "options", "shorts", "only"], "Sadece shorts", "Only shorts") },
            { value: "exclude", label: subtitleText(["source", "options", "shorts", "exclude"], "Shorts haric", "Exclude shorts") },
          ])}
          ${renderSubtitleDraftSelect("liveMode", drafts.liveMode || "all", subtitleText(["source", "fields", "liveStatus"], "Canli durumu", "Live status"), [
            { value: "all", label: subtitleText(["source", "options", "liveStatus", "all"], "Tum yuklemeler", "All uploads") },
            { value: "exclude-live", label: subtitleText(["source", "options", "liveStatus", "excludeLive"], "Canli haric", "Exclude live") },
            { value: "only-live", label: subtitleText(["source", "options", "liveStatus", "onlyLive"], "Sadece canli", "Only live") },
          ])}
          ${renderTextField(
            "titleInclude",
            drafts.titleInclude || "",
            subtitleText(["source", "fields", "titleInclude"], "Baslik dahil", "Title include"),
            subtitleText(["source", "placeholders", "titleInclude"], "roportaj, ozet", "interview, summary")
          )}
          ${renderTextField(
            "titleExclude",
            drafts.titleExclude || "",
            subtitleText(["source", "fields", "titleExclude"], "Baslik haric", "Title exclude"),
            subtitleText(["source", "placeholders", "titleExclude"], "teaser, shorts", "teaser, shorts")
          )}
          ${renderTextField(
            "playlistItems",
            drafts.playlistItems || "",
            subtitleText(["source", "fields", "playlistItems"], "Playlist araligi", "Playlist items"),
            subtitleText(["source", "placeholders", "playlistItems"], "1-10 gibi", "for example 1-10")
          )}
          ${renderTextField(
            "limitCount",
            drafts.limitCount == null ? "" : String(drafts.limitCount),
            subtitleText(["source", "fields", "limitCount"], "Max video", "Max videos"),
            "0",
            { type: "number" }
          )}
        </div>
        <button
          class="lab-button lab-button--ghost"
          type="button"
          data-action="subtitle-source-discover-youtube"
          ${ytDlpInstalled !== true ? "disabled" : ""}
        >
          ${escapeHtml(subtitleText(["source", "actions", "discoverYoutube"], "Adaylari kesfet", "Discover candidates"))}
        </button>
        <button
          class="lab-button lab-button--primary"
          type="button"
          data-action="subtitle-source-download-youtube"
          ${ytDlpInstalled !== true || discoveryItems.length === 0 || selectedCandidateCount === 0 ? "disabled" : ""}
        >
          ${escapeHtml(subtitleText(["source", "actions", "downloadSelected"], "Secili altyazilari indir", "Download selected subtitles"))}
        </button>
        ${
          discoveryItems.length > 0
            ? `<p class="lab-panel__hint">${escapeHtml(
                subtitleTemplate(
                  ["source", "discovery", "selectionHint"],
                  { count: selectedCandidateCount },
                  `${selectedCandidateCount} secili aday indirilmeye hazir.`,
                  `${selectedCandidateCount} selected candidate(s) are ready for download.`
                )
              )}</p>`
            : ""
        }
      `;
    }

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(featureText(["source", "modeLabel"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(featureText(["source", "intakeTitle"]))}</h2>
          </div>
        </div>
        <div class="lab-segmented lab-segmented--subtitle-source">
          ${getSubtitleSourceModeOptions()
            .map(function (modeId) {
              const disabled = modeId.indexOf("youtube-") === 0 && ytDlpInstalled !== true;
              return `
                <button
                  class="lab-segmented__button"
                  type="button"
                  data-action="subtitle-source-mode"
                  data-value="${escapeHtml(modeId)}"
                  data-selected="${modeId === currentMode ? "true" : "false"}"
                  ${disabled ? "disabled" : ""}
                >
                  ${escapeHtml(getSubtitleSourceModeLabel(modeId))}
                </button>
              `;
            })
            .join("")}
        </div>
        <div class="lab-form-stack">${body}</div>
      </section>
    `;
  }

  function renderSubtitleEntryPanel() {
    const entries = getSubtitleEntries();
    const activeEntry = getActiveSubtitleEntry();
    const selectedIds = getSubtitleSelectedEntryIds();

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(subtitleText(["source", "entries", "eyebrow"], "Girisler", "Entries"))}</p>
            <h2 class="lab-panel__title">${escapeHtml(subtitleText(["source", "entries", "title"], "Altyazi Listesi", "Subtitle List"))}</h2>
          </div>
        </div>
        <div class="lab-output-list">
          ${
            entries.length > 0
              ? entries
                  .map(function (entry) {
                    return `
                      <article class="lab-output-card" data-selected="${
                        activeEntry && activeEntry.id === entry.id ? "true" : "false"
                      }">
                        <div>
                          <strong>${escapeHtml(entry.fileName || entry.id || "--")}</strong>
                          <span>${escapeHtml(
                            [String(entry.format || "--").toUpperCase(), entry.language || "--", entry.sourceType || "--"]
                              .filter(Boolean)
                              .join(" · ")
                          )}</span>
                        </div>
                        <div class="lab-action-stack">
                          <button
                            class="lab-button lab-button--ghost lab-button--tight"
                            type="button"
                            data-action="subtitle-source-select-entry"
                            data-value="${escapeHtml(entry.id || "")}"
                          >
                            ${escapeHtml(subtitleText(["source", "entries", "actions", "makeActive"], "Aktif yap", "Make active"))}
                          </button>
                          <button
                            class="lab-button lab-button--ghost lab-button--tight"
                            type="button"
                            data-action="subtitle-source-toggle-selection"
                            data-value="${escapeHtml(entry.id || "")}"
                          >
                            ${escapeHtml(
                              selectedIds.includes(entry.id)
                                ? subtitleText(["source", "entries", "actions", "removeFromBatch"], "Batchten cikar", "Remove from batch")
                                : subtitleText(["source", "entries", "actions", "addToBatch"], "Batche ekle", "Add to batch")
                            )}
                          </button>
                        </div>
                      </article>
                    `;
                  })
                  .join("")
              : `<p class="lab-panel__hint">${escapeHtml(subtitleText(["source", "entries", "empty"], "Henuz altyazi girisi yok.", "No subtitle entries yet."))}</p>`
          }
        </div>
      </section>
    `;
  }

  function renderSubtitleDiscoveryPanel() {
    const discovery = getSubtitleDiscoveryState();
    const items = getSubtitleDiscoveryItems();
    const selectedCandidateIds = getSubtitleSelectedCandidateIds();

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(subtitleText(["source", "discovery", "eyebrow"], "YouTube Kesfi", "YouTube Discovery"))}</p>
            <h2 class="lab-panel__title">${escapeHtml(subtitleText(["source", "discovery", "title"], "Aday Tablosu", "Candidate Table"))}</h2>
            <p class="lab-panel__subtitle">${escapeHtml(
              subtitleText(
                ["source", "discovery", "subtitle"],
                "Filtreye uyan videolari once inceleyip sonra secili altyazilari indirebilirsin.",
                "Inspect matching videos first, then download subtitles only for the selected rows."
              )
            )}</p>
          </div>
        </div>
        ${renderSummaryRows([
          [subtitleText(["source", "discovery", "labels", "status"], "Durum", "Status"), formatStatusLabel(discovery.status || "idle")],
          [subtitleText(["source", "discovery", "labels", "totalCandidates"], "Toplam aday", "Total candidates"), String(discovery.totalCandidateCount || items.length)],
          [subtitleText(["source", "discovery", "labels", "matched"], "Eslesen", "Matched"), String(items.length)],
          [subtitleText(["source", "discovery", "labels", "selected"], "Secili", "Selected"), String(selectedCandidateIds.length)],
        ])}
        ${
          typeof discovery.lastError === "string" && discovery.lastError.trim() !== ""
            ? `<div class="lab-notice">${escapeHtml(discovery.lastError)}</div>`
            : ""
        }
        ${
          items.length > 0
            ? `
              <div class="lab-action-stack lab-action-stack--inline">
                <button class="lab-button lab-button--ghost" type="button" data-action="subtitle-source-select-all-discovery">
                  ${escapeHtml(subtitleText(["source", "discovery", "actions", "selectAll"], "Tumunu sec", "Select all"))}
                </button>
                <button class="lab-button lab-button--ghost" type="button" data-action="subtitle-source-clear-discovery-selection">
                  ${escapeHtml(subtitleText(["source", "discovery", "actions", "clearSelection"], "Secimi temizle", "Clear selection"))}
                </button>
              </div>
              <div class="lab-discovery-table-wrap">
                <table class="lab-discovery-table">
                  <thead>
                    <tr>
                      <th>${escapeHtml(subtitleText(["source", "discovery", "headers", "select"], "Sec", "Select"))}</th>
                      <th>${escapeHtml(subtitleText(["source", "discovery", "headers", "title"], "Baslik", "Title"))}</th>
                      <th>${escapeHtml(subtitleText(["source", "discovery", "headers", "published"], "Yayin", "Published"))}</th>
                      <th>${escapeHtml(subtitleText(["source", "discovery", "headers", "duration"], "Sure", "Duration"))}</th>
                      <th>${escapeHtml(subtitleText(["source", "discovery", "headers", "languages"], "Dil", "Languages"))}</th>
                      <th>${escapeHtml(subtitleText(["source", "discovery", "headers", "live"], "Canli", "Live"))}</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${items
                      .map(function (entry) {
                        const languageList = Array.isArray(entry.subtitleLanguages) ? entry.subtitleLanguages.slice(0, 4) : [];
                        return `
                          <tr data-selected="${selectedCandidateIds.includes(entry.id) ? "true" : "false"}">
                            <td>
                              <button
                                class="lab-button lab-button--ghost lab-button--tight"
                                type="button"
                                data-action="subtitle-source-toggle-discovery"
                                data-value="${escapeHtml(entry.id || "")}"
                              >
                                ${escapeHtml(
                                  selectedCandidateIds.includes(entry.id)
                                    ? subtitleText(["source", "discovery", "actions", "remove"], "Cikar", "Remove")
                                    : subtitleText(["source", "discovery", "actions", "select"], "Sec", "Select")
                                )}
                              </button>
                            </td>
                            <td>
                              <div class="lab-discovery-table__title">${escapeHtml(entry.title || "--")}</div>
                              <div class="lab-discovery-table__meta">${escapeHtml(entry.channelTitle || entry.videoId || "--")}</div>
                            </td>
                            <td>${escapeHtml(entry.publishedAt || "--")}</td>
                            <td>${escapeHtml(formatDuration(entry.durationSeconds))}</td>
                            <td>${escapeHtml(languageList.length > 0 ? languageList.join(", ") : "--")}</td>
                            <td>${escapeHtml(formatStatusLabel(entry.liveStatus || "offline"))}</td>
                          </tr>
                        `;
                      })
                      .join("")}
                  </tbody>
                </table>
              </div>
            `
            : `<p class="lab-panel__hint">${escapeHtml(
                subtitleText(
                  ["source", "discovery", "empty"],
                  "YouTube modunda aday tablosunu doldurmak icin kesif calistir.",
                  "Run discovery in a YouTube mode to populate the candidate table."
                )
              )}</p>`
        }
      </section>
    `;
  }

  function renderSubtitlePreviewBody(textValue, emptyLabel) {
    const nextValue = typeof textValue === "string" ? textValue.trim() : "";
    return nextValue !== ""
      ? `<pre class="lab-subtitle-preview">${escapeHtml(nextValue)}</pre>`
      : `<p class="lab-panel__hint">${escapeHtml(emptyLabel)}</p>`;
  }

  function renderSubtitlePresetChooser() {
    const presetState = getSubtitleEditState();
    const presets = Array.isArray(getSubtitleEditPresets().presets)
      ? getSubtitleEditPresets().presets.map(toRecord)
      : [];
    if (presets.length === 0) {
      return "";
    }

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(subtitleText(["edit", "preset", "eyebrow"], "Preset", "Preset"))}</p>
            <h2 class="lab-panel__title">${escapeHtml(subtitleText(["edit", "preset", "title"], "Temizleme Profili", "Cleanup Profile"))}</h2>
          </div>
        </div>
        <div class="lab-chip-row">
          ${presets
            .map(function (preset) {
              return `
                <button
                  class="lab-choice-chip"
                  type="button"
                  data-action="subtitle-edit-preset"
                  data-value="${escapeHtml(preset.id || "")}"
                  data-selected="${preset.id === presetState.presetId ? "true" : "false"}"
                >
                  ${escapeHtml(preset.label || preset.id || "--")}
                </button>
              `;
            })
            .join("")}
        </div>
      </section>
    `;
  }

  function renderSubtitleEditWorkspacePanel() {
    const activeEntry = getActiveSubtitleEntry();
    const preview = getSubtitleEditPreview();
    const latestOutput = getSubtitleOutputs()[0] || null;
    const displayText =
      typeof preview.outputText === "string" && preview.outputText.trim() !== ""
        ? preview.outputText
        : "";
    const summary = toRecord(preview.summary);

    return `
      <section class="lab-panel lab-preview-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(featureText(["edit", "workspaceTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(
              activeEntry
                ? activeEntry.fileName || activeEntry.id || "--"
                : subtitleText(["edit", "workspace", "emptyTitle"], "Altyazi secilmedi", "No subtitle selected")
            )}</h2>
            <p class="lab-panel__subtitle">${escapeHtml(featureText(["edit", "workspaceHint"]))}</p>
          </div>
        </div>
        ${renderSubtitlePreviewBody(
          displayText,
          subtitleText(["edit", "workspace", "previewEmpty"], "Preview icin bir preset secip onizleme calistir.", "Choose a preset and run preview to inspect output.")
        )}
        ${renderSummaryRows([
          [subtitleText(["edit", "workspace", "labels", "cues"], "Cue", "Cues"), String(summary.outputCueCount || summary.sourceCueCount || 0)],
          [subtitleText(["edit", "workspace", "labels", "lines"], "Satir", "Lines"), String(summary.outputLineCount || summary.sourceLineCount || 0)],
          [subtitleText(["edit", "workspace", "labels", "maxLine"], "Max satir", "Max line"), String(summary.maxLineLength || 0)],
          [subtitleText(["edit", "workspace", "labels", "output"], "Cikti", "Output"), latestOutput ? latestOutput.label || latestOutput.fileName || latestOutput.id || "--" : "--"],
        ])}
      </section>
    `;
  }

  function renderSubtitleEditControlsPanel() {
    const recipe = toRecord(getCurrentEditDraft().recipe);
    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(subtitleText(["edit", "controls", "eyebrow"], "Temizleme Ayarlari", "Cleanup Controls"))}</p>
            <h2 class="lab-panel__title">${escapeHtml(subtitleText(["edit", "controls", "title"], "Satir ve metin islemleri", "Line and text operations"))}</h2>
          </div>
        </div>
        <div class="lab-toggle-grid">
          ${renderEditToggle("trimWhitespace", subtitleText(["edit", "controls", "toggles", "trimWhitespace"], "Bosluk temizle", "Trim whitespace"), recipe.trimWhitespace === true)}
          ${renderEditToggle("collapseBlankLines", subtitleText(["edit", "controls", "toggles", "collapseBlankLines"], "Bos satirlari daralt", "Collapse blank lines"), recipe.collapseBlankLines === true)}
          ${renderEditToggle("normalizeQuotes", subtitleText(["edit", "controls", "toggles", "normalizeQuotes"], "Tirnak normalize et", "Normalize quotes"), recipe.normalizeQuotes === true)}
          ${renderEditToggle("stripHtml", subtitleText(["edit", "controls", "toggles", "stripHtml"], "HTML etiketlerini sil", "Strip HTML"), recipe.stripHtml === true)}
          ${renderEditToggle("removeMusicTags", subtitleText(["edit", "controls", "toggles", "removeMusicTags"], "Muzik etiketlerini sil", "Remove music tags"), recipe.removeMusicTags === true)}
          ${renderEditToggle("mergeShortCues", subtitleText(["edit", "controls", "toggles", "mergeShortCues"], "Kisa satirlari birlestir", "Merge short cues"), recipe.mergeShortCues === true)}
          ${renderEditToggle("splitLongLines", subtitleText(["edit", "controls", "toggles", "splitLongLines"], "Uzun satirlari bol", "Split long lines"), recipe.splitLongLines === true)}
        </div>
        <div class="lab-form-grid">
          ${renderEditSelectField("outputFormat", recipe.outputFormat || "source", subtitleText(["edit", "fields", "outputFormat"], "Cikti formati", "Output format"), [
            { value: "source", label: subtitleText(["edit", "outputFormats", "source"], "Kaynak formati", "Keep source format") },
            { value: "srt", label: "SRT" },
            { value: "vtt", label: "VTT" },
            { value: "json", label: "JSON" },
          ])}
          ${renderEditRangeField("maxCharsPerLine", recipe.maxCharsPerLine || 42, subtitleText(["edit", "controls", "labels", "maxChars"], "Max karakter", "Max chars"), {
            min: 24,
            max: 64,
            step: 1,
            displayValue: String(recipe.maxCharsPerLine || 42),
          })}
        </div>
      </section>
    `;
  }

  function renderSubtitleEditActionsPanel() {
    const editState = getSubtitleEditState();
    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(subtitleText(["edit", "actions", "eyebrow"], "Aksiyonlar", "Actions"))}</p>
            <h2 class="lab-panel__title">${escapeHtml(subtitleText(["edit", "actions", "title"], "Preview ve cikti", "Preview and output"))}</h2>
          </div>
        </div>
        ${
          typeof editState.lastError === "string" && editState.lastError.trim() !== ""
            ? `<div class="lab-notice">${escapeHtml(editState.lastError)}</div>`
            : ""
        }
        <div class="lab-action-stack">
          <button class="lab-button lab-button--ghost" type="button" data-action="subtitle-edit-preview">
            ${escapeHtml(subtitleText(["edit", "actions", "preview"], "Onizleme uret", "Generate preview"))}
          </button>
          <button class="lab-button lab-button--primary" type="button" data-action="subtitle-edit-apply">
            ${escapeHtml(subtitleText(["edit", "actions", "apply"], "Temizlemeyi uygula", "Apply cleanup"))}
          </button>
        </div>
      </section>
    `;
  }

  function renderSubtitleOutputsPanel() {
    const outputs = getSubtitleOutputs();
    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(subtitleText(["edit", "outputs", "eyebrow"], "Ciktilar", "Outputs"))}</p>
            <h2 class="lab-panel__title">${escapeHtml(subtitleText(["edit", "outputs", "title"], "Temizlenmis dosyalar", "Cleaned files"))}</h2>
          </div>
        </div>
        <div class="lab-output-list">
          ${
            outputs.length > 0
              ? outputs
                  .map(function (entry) {
                    const summary = toRecord(entry.summary);
                    return `
                      <article class="lab-output-card">
                        <div>
                          <strong>${escapeHtml(entry.label || entry.fileName || entry.id || "--")}</strong>
                          <span>${escapeHtml(entry.path || entry.fileUrl || "--")}</span>
                        </div>
                        <span>${escapeHtml(
                          subtitleText(["edit", "outputs", "labels", "cues"], "Cue", "Cues")
                        )}: ${escapeHtml(String(summary.outputCueCount || 0))}</span>
                      </article>
                    `;
                  })
                  .join("")
              : `<p class="lab-panel__hint">${escapeHtml(subtitleText(["edit", "outputs", "empty"], "Henuz cikti yok.", "No outputs yet."))}</p>`
          }
        </div>
      </section>
    `;
  }

  function renderSubtitleEditSummaryPanel() {
    const preview = getSubtitleEditPreview();
    const summary = toRecord(preview.summary);
    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <p class="lab-panel__eyebrow">${escapeHtml(subtitleText(["edit", "summary", "eyebrow"], "Ozet", "Summary"))}</p>
        </div>
        ${renderSummaryRows([
          [subtitleText(["edit", "summary", "labels", "previewStatus"], "Preview durumu", "Preview status"), formatStatusLabel(preview.status || "idle")],
          [subtitleText(["edit", "summary", "labels", "changed"], "Degisti", "Changed"), summary.changed === true ? subtitleText(["edit", "summary", "values", "yes"], "Evet", "Yes") : subtitleText(["edit", "summary", "values", "no"], "Hayir", "No")],
          [subtitleText(["edit", "summary", "labels", "sourceCues"], "Kaynak cue", "Source cues"), String(summary.sourceCueCount || 0)],
          [subtitleText(["edit", "summary", "labels", "outputCues"], "Cikti cue", "Output cues"), String(summary.outputCueCount || 0)],
          [subtitleText(["edit", "summary", "labels", "maxLine"], "Max satir", "Max line"), String(summary.maxLineLength || 0)],
        ])}
      </section>
    `;
  }

  function renderSubtitleEditStage() {
    const activeEntry = getActiveSubtitleEntry();

    return `
      <div class="lab-layout">
        <section class="lab-main-stack">
          ${renderStageIntro("edit")}
          ${renderSubtitleEditWorkspacePanel()}
          ${renderSubtitlePresetChooser()}
          ${renderSubtitleEditControlsPanel()}
          ${renderSubtitleEditActionsPanel()}
          ${
            activeEntry === null
              ? `<div class="lab-notice">${escapeHtml(subtitleText(["edit", "emptySelection"], "Edit asamasi icin once bir altyazi girisi sec.", "Select a subtitle entry before using the edit stage."))}</div>`
              : ""
          }
        </section>
        <aside class="lab-side-stack">
          ${renderSubtitleEditSummaryPanel()}
          ${renderSubtitleOutputsPanel()}
        </aside>
      </div>
    `;
  }

  return {
    getSubtitleSourceModeOptions,
    getCurrentSubtitleSourceMode,
    getSubtitleSourceModeLabel,
    renderSubtitleDraftSelect,
    renderSubtitleCatalogPanel,
    renderSubtitleProviderPanel,
    renderSubtitleSourceWorkspacePanel,
    renderSubtitleSourceIntakePanel,
    renderSubtitleEntryPanel,
    renderSubtitleDiscoveryPanel,
    renderSubtitlePreviewBody,
    renderSubtitlePresetChooser,
    renderSubtitleEditWorkspacePanel,
    renderSubtitleEditControlsPanel,
    renderSubtitleEditActionsPanel,
    renderSubtitleOutputsPanel,
    renderSubtitleEditSummaryPanel,
    renderSubtitleEditStage,
  };
}
