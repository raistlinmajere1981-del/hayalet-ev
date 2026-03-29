export function createMediaAnalysisEditWorkspacePanels(deps) {
  const toRecord = deps.toRecord;
  const escapeHtml = deps.escapeHtml;
  const text = deps.text;
  const textFromKey = deps.textFromKey;
  const formatDuration = deps.formatDuration;
  const state = deps.state;
  const getCurrentSourceKind = deps.getCurrentSourceKind;
  const getCurrentEditPresetOptions = deps.getCurrentEditPresetOptions;
  const getCurrentEditDraft = deps.getCurrentEditDraft;
  const getProjectSource = deps.getProjectSource;
  const getCurrentEditRecipe = deps.getCurrentEditRecipe;
  const getEffectiveMediaAsset = deps.getEffectiveMediaAsset;
  const getEditPreview = deps.getEditPreview;
  const getRelevantJobs = deps.getRelevantJobs;
  const collectEditStageJobs = deps.collectEditStageJobs;
  const renderPreviewMetaRow = deps.renderPreviewMetaRow;
  const getPreferredSourceDuration = deps.getPreferredSourceDuration;
  const getPreferredSourceResolution = deps.getPreferredSourceResolution;
  const getPreferredSourceCodec = deps.getPreferredSourceCodec;
  const getPreferredSourceFormat = deps.getPreferredSourceFormat;
  const getEditJobLabel = deps.getEditJobLabel;
  const getEditPresets = deps.getEditPresets;
  const getCurrentFocusRegionId = deps.getCurrentFocusRegionId;
  const renderEditTextField = deps.renderEditTextField;

  function renderEditMediaMarkup(asset, cropNormalized) {
    const previewUrl =
      typeof asset.previewUrl === "string" && asset.previewUrl.trim() !== "" ? asset.previewUrl : null;
    if (previewUrl === null) {
      return `
        <div class="lab-empty-preview">
          <strong>${escapeHtml(text(["mediaAnalysis", "edit", "previewEmptyTitle"]))}</strong>
          <p>${escapeHtml(text(["mediaAnalysis", "edit", "previewEmptyBody"]))}</p>
        </div>
      `;
    }

    const kind = getCurrentSourceKind();
    const crop = toRecord(cropNormalized);
    const focusStyle =
      kind === "audio"
        ? ""
        : `style="left:${Math.max(0, Number(crop.x || 0) * 100)}%; top:${Math.max(
            0,
            Number(crop.y || 0) * 100
          )}%; width:${Math.max(2, Number(crop.width || 0) * 100)}%; height:${Math.max(
            2,
            Number(crop.height || 0) * 100
          )}%;"`;

    if (kind === "image") {
      return `
        <img class="lab-preview-media lab-preview-media--image" data-preview-media="image" src="${previewUrl}" alt="" />
        <div class="lab-edit-overlay__focus" ${focusStyle}></div>
      `;
    }

    if (kind === "audio") {
      const bars =
        state.ui.audioAnalysis.url === previewUrl && state.ui.audioAnalysis.bars.length > 0
          ? state.ui.audioAnalysis.bars
          : Array.from({ length: 42 }, function (_, index) {
              return 16 + ((index * 11) % 36);
            });
      const spectrogram =
        (Array.isArray(asset.artifacts) ? asset.artifacts : []).find(function (entry) {
          return entry.kind === "spectrogram" && typeof entry.previewUrl === "string";
        }) || null;
      return `
        <div class="lab-audio-workbench">
          ${
            spectrogram
              ? `<img class="lab-audio-spectrogram" src="${spectrogram.previewUrl}" alt="" />`
              : ""
          }
          <div class="lab-audio-bars">
            ${bars
              .map(function (height) {
                return `<span style="height:${height}px"></span>`;
              })
              .join("")}
          </div>
          <audio class="lab-preview-media lab-preview-media--audio" data-preview-media="audio" src="${previewUrl}" controls preload="metadata"></audio>
        </div>
      `;
    }

    return `
      <video class="lab-preview-media lab-preview-media--video" data-preview-media="video" src="${previewUrl}" controls preload="metadata"></video>
      <div class="lab-edit-overlay__focus" ${focusStyle}></div>
    `;
  }

  function renderEditPresetChooser() {
    const presetOptions = getCurrentEditPresetOptions();
    const activePresetId =
      typeof getCurrentEditDraft().activePresetId === "string" ? getCurrentEditDraft().activePresetId : null;

    if (presetOptions.length === 0) {
      return "";
    }

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "edit", "presetTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "edit", "presetSubtitle"]))}</h2>
          </div>
        </div>
        <div class="lab-chip-row">
          ${presetOptions
            .map(function (preset) {
              return `
                <button
                  class="lab-choice-chip"
                  type="button"
                  data-action="edit-preset"
                  data-value="${escapeHtml(preset.id)}"
                  data-selected="${preset.id === activePresetId ? "true" : "false"}"
                >
                  ${escapeHtml(textFromKey(preset.labelKey))}
                </button>
              `;
            })
            .join("")}
        </div>
      </section>
    `;
  }

  function renderEditWorkspacePanel() {
    const source = getProjectSource();
    const recipe = getCurrentEditRecipe();
    const common = toRecord(recipe.common);
    const asset = getEffectiveMediaAsset();
    const preview = getEditPreview();
    const projectJobs = getRelevantJobs().project;
    const activeEditJobs = collectEditStageJobs(projectJobs);

    return `
      <section class="lab-panel lab-preview-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "edit", "workspaceTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(asset.label || text(["mediaAnalysis", "edit", "sourceAsset"]))}</h2>
            <p class="lab-panel__subtitle">${escapeHtml(
              preview.status === "stale"
                ? text(["mediaAnalysis", "edit", "previewStates", "stale"])
                : text(["mediaAnalysis", "edit", "workspaceHint"])
            )}</p>
          </div>
          <span class="lab-chip">${escapeHtml(text(["mediaAnalysis", "settings", "status", source.status === "error" ? "error" : "ready"]))}</span>
        </div>
        <div class="lab-preview-card">
          <div class="lab-preview-frame lab-edit-frame">
            ${renderEditMediaMarkup(asset, common.cropNormalized)}
          </div>
          <div class="lab-preview-copy">
            <ul class="lab-meta-list">
              ${renderPreviewMetaRow(text(["mediaAnalysis", "shared", "status"]), preview.status || text(["mediaAnalysis", "shared", "idle"]))}
              ${renderPreviewMetaRow(text(["mediaAnalysis", "shared", "duration"]), formatDuration(typeof toRecord(asset.metadata).durationSeconds === "number" ? toRecord(asset.metadata).durationSeconds : getPreferredSourceDuration(asset.previewUrl)))}
              ${renderPreviewMetaRow(
                text(["mediaAnalysis", "shared", "resolution"]),
                typeof toRecord(asset.metadata).width === "number" && typeof toRecord(asset.metadata).height === "number"
                  ? `${asset.metadata.width} x ${asset.metadata.height}`
                  : getPreferredSourceResolution(getProjectSource().previewUrl || null)
              )}
              ${renderPreviewMetaRow(text(["mediaAnalysis", "shared", "codec"]), asset.metadata.codec || getPreferredSourceCodec())}
              ${renderPreviewMetaRow(text(["mediaAnalysis", "shared", "format"]), asset.metadata.formatName || asset.mimeType || getPreferredSourceFormat())}
            </ul>
            ${
              activeEditJobs.length > 0
                ? `
                  <div class="lab-status-stack">
                    ${activeEditJobs
                      .map(function (activeEditJob) {
                        return `
                          <div class="lab-status-card">
                            <div class="lab-status-card__head">
                              <strong>${escapeHtml(getEditJobLabel(activeEditJob))}</strong>
                              <span>${escapeHtml(
                                typeof activeEditJob.percent === "number"
                                  ? `${Math.round(activeEditJob.percent)}%`
                                  : activeEditJob.stage || "--"
                              )}</span>
                            </div>
                            <div class="lab-progress-bar">
                              <span style="width:${Math.max(6, Number(activeEditJob.percent) || 8)}%"></span>
                            </div>
                            <p class="lab-status-card__body">${escapeHtml(activeEditJob.message || activeEditJob.action || "")}</p>
                          </div>
                        `;
                      })
                      .join("")}
                  </div>
                `
                : ""
            }
          </div>
        </div>
      </section>
    `;
  }

  function renderEditCommonPanel() {
    const kind = getCurrentSourceKind();
    const recipe = getCurrentEditRecipe();
    const common = toRecord(recipe.common);
    const focusRegions = toRecord(getEditPresets().focusRegions);

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "edit", "commonTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "edit", "commonSubtitle"]))}</h2>
          </div>
        </div>
        ${kind !== "audio" ? `
          <div class="lab-chip-row">
            ${Object.keys(focusRegions)
              .map(function (regionId) {
                return `
                  <button
                    class="lab-choice-chip"
                    type="button"
                    data-action="edit-focus-region"
                    data-value="${regionId}"
                    data-selected="${regionId === getCurrentFocusRegionId() ? "true" : "false"}"
                  >
                    ${escapeHtml(textFromKey(toRecord(focusRegions[regionId]).labelKey))}
                  </button>
                `;
              })
              .join("")}
          </div>
        ` : ""}
        <div class="lab-form-grid">
          ${renderEditTextField(
            "recipe.common.outputNameHint",
            common.outputNameHint || "",
            text(["mediaAnalysis", "edit", "fields", "outputNameHint"]),
            { placeholder: text(["mediaAnalysis", "edit", "placeholders", "outputNameHint"]) }
          )}
          ${renderEditTextField(
            "recipe.common.notes",
            common.notes || "",
            text(["mediaAnalysis", "edit", "fields", "notes"]),
            { placeholder: text(["mediaAnalysis", "edit", "placeholders", "notes"]) }
          )}
        </div>
      </section>
    `;
  }

  return {
    renderEditCommonPanel,
    renderEditMediaMarkup,
    renderEditPresetChooser,
    renderEditWorkspacePanel,
  };
}
