export function createLaboratorySourceStageUi(deps) {
  const toRecord = deps.toRecord;
  const escapeHtml = deps.escapeHtml;
  const text = deps.text;
  const textFromKey = deps.textFromKey;
  const featureText = deps.featureText;
  const renderStageIntro = deps.renderStageIntro;
  const renderTextField = deps.renderTextField;
  const isSubtitleAnalysisFeature = deps.isSubtitleAnalysisFeature;
  const isAudioAnalysisFeature = deps.isAudioAnalysisFeature;
  const getProjectSummaries = deps.getProjectSummaries;
  const getSourceSnapshot = deps.getSourceSnapshot;
  const getActiveProject = deps.getActiveProject;
  const getAvailableSourceFormats = deps.getAvailableSourceFormats;
  const getCurrentSourceKind = deps.getCurrentSourceKind;
  const getCurrentSourceMode = deps.getCurrentSourceMode;
  const getSourceModeOptions = deps.getSourceModeOptions;
  const getToolEntry = deps.getToolEntry;
  const getCurrentDrafts = deps.getCurrentDrafts;
  const getYtDlpForm = deps.getYtDlpForm;
  const renderPreviewSurface = deps.renderPreviewSurface;
  const renderAudioAnalysisCatalogPanel = deps.renderAudioAnalysisCatalogPanel;
  const renderAudioAnalysisProviderPanel = deps.renderAudioAnalysisProviderPanel;
  const renderAudioAnalysisNoticePanel = deps.renderAudioAnalysisNoticePanel;
  const renderSubtitleSourceWorkspacePanel = deps.renderSubtitleSourceWorkspacePanel;
  const renderSubtitleDiscoveryPanel = deps.renderSubtitleDiscoveryPanel;
  const renderSubtitleCatalogPanel = deps.renderSubtitleCatalogPanel;
  const renderSubtitleProviderPanel = deps.renderSubtitleProviderPanel;
  const renderSubtitleSourceIntakePanel = deps.renderSubtitleSourceIntakePanel;
  const renderSubtitleEntryPanel = deps.renderSubtitleEntryPanel;

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
            deps.state.ui.pendingDeleteProjectId === activeProjectId
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
            <p class="lab-panel__eyebrow">${escapeHtml(featureText(["source", "formatLabel"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(featureText(["source", "title"]))}</h2>
          </div>
        </div>
        <div class="lab-source-grid">
          ${getAvailableSourceFormats().map(function (sourceId) {
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
                  featureText(["source", "formats", sourceId, "title"])
                )}</span>
                <span class="lab-source-card__subtitle">${escapeHtml(
                  featureText(["source", "formats", sourceId, "subtitle"])
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
    const youtubePreset =
      typeof drafts.youtubePreset === "string" && drafts.youtubePreset.trim() !== ""
        ? drafts.youtubePreset
        : "medium";

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

  function renderSourceStage() {
    if (isSubtitleAnalysisFeature()) {
      return `
        <div class="lab-layout lab-layout--source">
          <section class="lab-main-stack">
            ${renderStageIntro("source")}
            ${renderSubtitleSourceWorkspacePanel()}
            ${renderSubtitleDiscoveryPanel()}
            ${renderSubtitleCatalogPanel()}
            ${renderSubtitleProviderPanel()}
          </section>
          <aside class="lab-side-stack">
            ${renderProjectPanel()}
            ${renderSubtitleSourceIntakePanel()}
            ${renderSubtitleEntryPanel()}
          </aside>
        </div>
      `;
    }

    if (isAudioAnalysisFeature()) {
      return `
        <div class="lab-layout lab-layout--source">
          <section class="lab-main-stack">
            ${renderStageIntro("source")}
            ${renderPreviewSurface()}
            ${renderAudioAnalysisCatalogPanel()}
            ${renderAudioAnalysisProviderPanel()}
          </section>
          <aside class="lab-side-stack">
            ${renderProjectPanel()}
            ${renderSourceKindPanel()}
            ${renderSourceIntakePanel()}
            ${renderAudioAnalysisNoticePanel()}
          </aside>
        </div>
      `;
    }

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

  return {
    renderSourceStage: renderSourceStage,
  };
}
