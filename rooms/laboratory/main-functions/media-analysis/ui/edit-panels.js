export function createMediaAnalysisEditPanels(deps) {
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
  const getCurrentEditMode = deps.getCurrentEditMode;
  const getEditPresets = deps.getEditPresets;
  const getCurrentFocusRegionId = deps.getCurrentFocusRegionId;
  const getEditOutputs = deps.getEditOutputs;
  const getActiveEditOutput = deps.getActiveEditOutput;
  const getToolEntry = deps.getToolEntry;
  const getProjectEdit = deps.getProjectEdit;
  const renderSummaryRows = deps.renderSummaryRows;
  const formatEditWindowLabel = deps.formatEditWindowLabel;
  const getCurrentFocusLabel = deps.getCurrentFocusLabel;
  const getCurrentResizeLabel = deps.getCurrentResizeLabel;

  function renderEditToggle(fieldId, label, active) {
    return `
      <button
        class="lab-toggle"
        type="button"
        data-edit-toggle="${escapeHtml(fieldId)}"
        data-active="${active ? "true" : "false"}"
      >
        <span class="lab-toggle__track"><span class="lab-toggle__thumb"></span></span>
        <span class="lab-toggle__label">${escapeHtml(label)}</span>
      </button>
    `;
  }

  function renderEditTextField(fieldId, value, label, extra) {
    const options = toRecord(extra);
    return `
      <label class="lab-field">
        <span class="lab-field__label">${escapeHtml(label)}</span>
        <input
          class="lab-input"
          type="${escapeHtml(options.type || "text")}"
          value="${escapeHtml(value == null ? "" : value)}"
          placeholder="${escapeHtml(options.placeholder || "")}"
          data-edit-field="${escapeHtml(fieldId)}"
          data-edit-commit="${escapeHtml(options.commit || "change")}"
        />
      </label>
    `;
  }

  function renderEditSelectField(fieldId, value, label, optionEntries) {
    return `
      <label class="lab-field">
        <span class="lab-field__label">${escapeHtml(label)}</span>
        <select class="lab-select" data-edit-field="${escapeHtml(fieldId)}">
          ${optionEntries
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

  function renderEditRangeField(fieldId, value, label, options) {
    const config = toRecord(options);
    return `
      <label class="lab-range-group">
        <span>${escapeHtml(label)} <strong>${escapeHtml(String(config.displayValue || value || 0))}</strong></span>
        <input
          type="range"
          min="${escapeHtml(String(config.min ?? 0))}"
          max="${escapeHtml(String(config.max ?? 100))}"
          step="${escapeHtml(String(config.step ?? 1))}"
          value="${escapeHtml(String(value ?? config.min ?? 0))}"
          data-edit-field="${escapeHtml(fieldId)}"
          data-edit-commit="change"
        />
      </label>
    `;
  }

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

  function renderEditModePanel() {
    const mode = getCurrentEditMode();
    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "edit", "modeTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "edit", "modeSubtitle"]))}</h2>
          </div>
        </div>
        <div class="lab-segmented">
          ${["beginner", "advanced"]
            .map(function (modeId) {
              return `
                <button
                  class="lab-segmented__button"
                  type="button"
                  data-action="edit-mode"
                  data-value="${modeId}"
                  data-selected="${modeId === mode ? "true" : "false"}"
                >
                  ${escapeHtml(text(["mediaAnalysis", "edit", "modes", modeId]))}
                </button>
              `;
            })
            .join("")}
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

  function renderVideoEditPanel() {
    const recipe = getCurrentEditRecipe();
    const video = toRecord(recipe.video);
    const duration = getPreferredSourceDuration(getProjectSource().previewUrl || null) || 60;
    const resizePresets = toRecord(getEditPresets().resizePresets);

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "edit", "videoTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "edit", "videoSubtitle"]))}</h2>
          </div>
        </div>
        <div class="lab-toggle-grid">
          ${renderEditToggle("recipe.video.trimEnabled", text(["mediaAnalysis", "edit", "fields", "trimEnabled"]), video.trimEnabled === true)}
          ${renderEditToggle("recipe.video.includeAudio", text(["mediaAnalysis", "edit", "fields", "includeAudio"]), video.includeAudio === true)}
          ${renderEditToggle("recipe.video.blurFocusOutside", text(["mediaAnalysis", "edit", "fields", "blurFocusOutside"]), video.blurFocusOutside === true)}
        </div>
        <div class="lab-form-grid">
          ${renderEditRangeField("recipe.video.trimStartSeconds", video.trimStartSeconds || 0, text(["mediaAnalysis", "edit", "fields", "trimStartSeconds"]), {
            min: 0,
            max: Math.max(1, Math.round(duration)),
            step: 1,
            displayValue: formatDuration(video.trimStartSeconds || 0),
          })}
          ${renderEditRangeField("recipe.video.trimEndSeconds", video.trimEndSeconds || duration, text(["mediaAnalysis", "edit", "fields", "trimEndSeconds"]), {
            min: 0,
            max: Math.max(1, Math.round(duration)),
            step: 1,
            displayValue: formatDuration(video.trimEndSeconds || duration),
          })}
          ${renderEditSelectField(
            "recipe.video.resizePreset",
            video.resizePreset || "keep",
            text(["mediaAnalysis", "edit", "fields", "resizePreset"]),
            Object.keys(resizePresets).map(function (presetId) {
              return {
                value: presetId,
                label: textFromKey(toRecord(resizePresets[presetId]).labelKey),
              };
            })
          )}
          ${renderEditRangeField("recipe.video.fpsLimit", video.fpsLimit || 24, text(["mediaAnalysis", "edit", "fields", "fpsLimit"]), {
            min: 6,
            max: 60,
            step: 1,
            displayValue: `${video.fpsLimit || 24} fps`,
          })}
          ${video.resizePreset === "custom" || getCurrentEditMode() === "advanced"
            ? renderEditTextField("recipe.video.customWidth", video.customWidth || "", text(["mediaAnalysis", "edit", "fields", "customWidth"]), { type: "number" }) +
              renderEditTextField("recipe.video.customHeight", video.customHeight || "", text(["mediaAnalysis", "edit", "fields", "customHeight"]), { type: "number" })
            : ""}
          ${getCurrentEditMode() === "advanced"
            ? renderEditTextField("recipe.video.frameGrabCount", video.frameGrabCount || 0, text(["mediaAnalysis", "edit", "fields", "frameGrabCount"]), { type: "number" })
            : ""}
        </div>
      </section>
    `;
  }

  function renderAudioEditPanel() {
    const recipe = getCurrentEditRecipe();
    const audio = toRecord(recipe.audio);
    const duration = getPreferredSourceDuration(getProjectSource().previewUrl || null) || 60;

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "edit", "audioTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "edit", "audioSubtitle"]))}</h2>
          </div>
        </div>
        <div class="lab-toggle-grid">
          ${renderEditToggle("recipe.audio.trimEnabled", text(["mediaAnalysis", "edit", "fields", "trimEnabled"]), audio.trimEnabled === true)}
          ${renderEditToggle("recipe.audio.normalize", text(["mediaAnalysis", "edit", "fields", "normalize"]), audio.normalize === true)}
          ${renderEditToggle("recipe.audio.silenceTrim", text(["mediaAnalysis", "edit", "fields", "silenceTrim"]), audio.silenceTrim === true)}
          ${renderEditToggle("recipe.audio.mono", text(["mediaAnalysis", "edit", "fields", "mono"]), audio.mono === true)}
          ${renderEditToggle("recipe.audio.spectrogram", text(["mediaAnalysis", "edit", "fields", "spectrogram"]), audio.spectrogram === true)}
        </div>
        <div class="lab-form-grid">
          ${renderEditRangeField("recipe.audio.trimStartSeconds", audio.trimStartSeconds || 0, text(["mediaAnalysis", "edit", "fields", "trimStartSeconds"]), {
            min: 0,
            max: Math.max(1, Math.round(duration)),
            step: 1,
            displayValue: formatDuration(audio.trimStartSeconds || 0),
          })}
          ${renderEditRangeField("recipe.audio.trimEndSeconds", audio.trimEndSeconds || duration, text(["mediaAnalysis", "edit", "fields", "trimEndSeconds"]), {
            min: 0,
            max: Math.max(1, Math.round(duration)),
            step: 1,
            displayValue: formatDuration(audio.trimEndSeconds || duration),
          })}
          ${renderEditRangeField("recipe.audio.normalizeTargetDb", audio.normalizeTargetDb || -16, text(["mediaAnalysis", "edit", "fields", "normalizeTargetDb"]), {
            min: -30,
            max: -8,
            step: 1,
            displayValue: `${audio.normalizeTargetDb || -16} LUFS`,
          })}
          ${getCurrentEditMode() === "advanced"
            ? renderEditTextField("recipe.audio.highpassHz", audio.highpassHz || 0, text(["mediaAnalysis", "edit", "fields", "highpassHz"]), { type: "number" }) +
              renderEditTextField("recipe.audio.lowpassHz", audio.lowpassHz || 0, text(["mediaAnalysis", "edit", "fields", "lowpassHz"]), { type: "number" })
            : ""}
        </div>
      </section>
    `;
  }

  function renderImageEditPanel() {
    const recipe = getCurrentEditRecipe();
    const image = toRecord(recipe.image);
    const resizePresets = toRecord(getEditPresets().resizePresets);

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "edit", "imageTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "edit", "imageSubtitle"]))}</h2>
          </div>
        </div>
        <div class="lab-form-grid">
          ${renderEditSelectField(
            "recipe.image.resizePreset",
            image.resizePreset || "keep",
            text(["mediaAnalysis", "edit", "fields", "resizePreset"]),
            Object.keys(resizePresets).map(function (presetId) {
              return {
                value: presetId,
                label: textFromKey(toRecord(resizePresets[presetId]).labelKey),
              };
            })
          )}
          ${renderEditRangeField("recipe.image.brightness", image.brightness || 0, text(["mediaAnalysis", "edit", "fields", "brightness"]), {
            min: -0.3,
            max: 0.3,
            step: 0.01,
            displayValue: Number(image.brightness || 0).toFixed(2),
          })}
          ${renderEditRangeField("recipe.image.contrast", image.contrast || 1, text(["mediaAnalysis", "edit", "fields", "contrast"]), {
            min: 0.4,
            max: 2.2,
            step: 0.05,
            displayValue: Number(image.contrast || 1).toFixed(2),
          })}
          ${renderEditRangeField("recipe.image.blurStrength", image.blurStrength || 0, text(["mediaAnalysis", "edit", "fields", "blurStrength"]), {
            min: 0,
            max: 3,
            step: 0.1,
            displayValue: Number(image.blurStrength || 0).toFixed(1),
          })}
          ${(image.resizePreset === "custom" || getCurrentEditMode() === "advanced")
            ? renderEditTextField("recipe.image.customWidth", image.customWidth || "", text(["mediaAnalysis", "edit", "fields", "customWidth"]), { type: "number" }) +
              renderEditTextField("recipe.image.customHeight", image.customHeight || "", text(["mediaAnalysis", "edit", "fields", "customHeight"]), { type: "number" })
            : ""}
          ${getCurrentEditMode() === "advanced"
            ? renderEditTextField("recipe.image.rotateDegrees", image.rotateDegrees || 0, text(["mediaAnalysis", "edit", "fields", "rotateDegrees"]), { type: "number" }) +
              renderEditRangeField("recipe.image.sharpen", image.sharpen || 0, text(["mediaAnalysis", "edit", "fields", "sharpen"]), {
                min: 0,
                max: 2,
                step: 0.1,
                displayValue: Number(image.sharpen || 0).toFixed(1),
              })
            : ""}
        </div>
      </section>
    `;
  }

  function renderEditControlsPanel() {
    switch (getCurrentSourceKind()) {
      case "audio":
        return renderAudioEditPanel();
      case "image":
        return renderImageEditPanel();
      case "video":
      default:
        return renderVideoEditPanel();
    }
  }

  function renderEditActionsPanel() {
    const source = getProjectSource();
    const edit = getProjectEdit();
    const activeOutput = getActiveEditOutput();
    const ffmpegInstalled = getToolEntry("ffmpeg").installed === true;
    const previewJob =
      getRelevantJobs().project.find(function (entry) {
        return entry.action === "edit-preview";
      }) || null;
    const applyJob =
      getRelevantJobs().project.find(function (entry) {
        return entry.action === "edit-apply";
      }) || null;

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "edit", "actionsTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "edit", "actionsSubtitle"]))}</h2>
          </div>
        </div>
        ${
          ffmpegInstalled !== true
            ? `<div class="lab-notice">${escapeHtml(text(["mediaAnalysis", "edit", "ffmpegMissing"]))}</div>`
            : ""
        }
        ${
          typeof edit.lastError === "string" && edit.lastError.trim() !== ""
            ? `<div class="lab-notice">${escapeHtml(edit.lastError)}</div>`
            : ""
        }
        <div class="lab-action-stack">
          <button
            class="lab-button lab-button--ghost"
            type="button"
            data-action="edit-preview"
            ${ffmpegInstalled !== true || typeof source.storedPath !== "string" || previewJob ? "disabled" : ""}
          >
            ${escapeHtml(text(["mediaAnalysis", "edit", "actions", "preview"]))}
          </button>
          <button
            class="lab-button lab-button--ghost"
            type="button"
            data-action="edit-cancel-preview"
            ${previewJob ? "" : "disabled"}
          >
            ${escapeHtml(text(["mediaAnalysis", "edit", "actions", "cancelPreview"]))}
          </button>
          <button
            class="lab-button lab-button--primary"
            type="button"
            data-action="edit-apply"
            ${ffmpegInstalled !== true || typeof source.storedPath !== "string" || applyJob ? "disabled" : ""}
          >
            ${escapeHtml(text(["mediaAnalysis", "edit", "actions", "apply"]))}
          </button>
          <button
            class="lab-button lab-button--ghost"
            type="button"
            data-action="edit-cancel-apply"
            ${applyJob ? "" : "disabled"}
          >
            ${escapeHtml(text(["mediaAnalysis", "edit", "actions", "cancelApply"]))}
          </button>
        </div>
        <div class="lab-segmented">
          ${["source", "derived"]
            .map(function (modeId) {
              const disabled = modeId === "derived" && activeOutput === null;
              return `
                <button
                  class="lab-segmented__button"
                  type="button"
                  data-action="edit-handoff"
                  data-value="${modeId}"
                  data-selected="${edit.handoffMode === modeId ? "true" : "false"}"
                  ${disabled ? "disabled" : ""}
                >
                  ${escapeHtml(text(["mediaAnalysis", "edit", "handoffModes", modeId]))}
                </button>
              `;
            })
            .join("")}
        </div>
      </section>
    `;
  }

  function renderEditOutputsPanel() {
    const outputs = getEditOutputs();
    const activeOutput = getActiveEditOutput();

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "edit", "outputsTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "edit", "outputsSubtitle"]))}</h2>
          </div>
        </div>
        <div class="lab-output-list">
          ${
            outputs.length > 0
              ? outputs
                  .map(function (entry) {
                    return `
                      <article class="lab-output-card" data-selected="${activeOutput && activeOutput.id === entry.id ? "true" : "false"}">
                        <div>
                          <strong>${escapeHtml(entry.label || entry.fileName || entry.id)}</strong>
                          <span>${escapeHtml(entry.fileName || "--")}</span>
                        </div>
                        <button
                          class="lab-button lab-button--ghost lab-button--tight"
                          type="button"
                          data-action="edit-select-output"
                          data-value="${escapeHtml(entry.id)}"
                        >
                          ${escapeHtml(text(["mediaAnalysis", "edit", "actions", "selectOutput"]))}
                        </button>
                      </article>
                    `;
                  })
                  .join("")
              : `<p class="lab-panel__hint">${escapeHtml(text(["mediaAnalysis", "edit", "outputsEmpty"]))}</p>`
          }
        </div>
      </section>
    `;
  }

  function renderEditSummaryPanel() {
    const edit = getProjectEdit();
    const activeOutput = getActiveEditOutput();
    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "edit", "summaryTitle"]))}</p>
        </div>
        ${renderSummaryRows([
          [text(["mediaAnalysis", "edit", "selectedWindow"]), formatEditWindowLabel()],
          [text(["mediaAnalysis", "edit", "selectedRegion"]), getCurrentFocusLabel()],
          [text(["mediaAnalysis", "edit", "selectedResize"]), getCurrentResizeLabel()],
          [
            text(["mediaAnalysis", "edit", "selectedOutput"]),
            activeOutput ? activeOutput.label || activeOutput.fileName || activeOutput.id : "--",
          ],
          [text(["mediaAnalysis", "edit", "handoffLabel"]), text(["mediaAnalysis", "edit", "handoffModes", edit.handoffMode === "derived" ? "derived" : "source"])],
        ])}
      </section>
    `;
  }

  return {
    renderEditActionsPanel,
    renderEditAudioPanel: renderAudioEditPanel,
    renderEditCommonPanel,
    renderEditControlsPanel,
    renderEditMediaMarkup,
    renderEditModePanel,
    renderEditOutputsPanel,
    renderEditPresetChooser,
    renderEditRangeField,
    renderEditSelectField,
    renderEditSummaryPanel,
    renderEditTextField,
    renderEditToggle,
    renderEditVideoPanel: renderVideoEditPanel,
    renderEditWorkspacePanel,
    renderImageEditPanel,
  };
}
