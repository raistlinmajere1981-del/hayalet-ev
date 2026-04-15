export function createMediaAnalysisEditModePanels(deps) {
  const {
    escapeHtml,
    formatDuration,
    getCurrentEditMode,
    getCurrentEditRecipe,
    getCurrentFocusRegionId,
    getCurrentSourceKind,
    getEditPresets,
    getPreferredSourceDuration,
    getProjectSource,
    renderEditRangeField,
    renderEditSelectField,
    renderEditTextField,
    renderEditToggle,
    text,
    textFromKey,
    toRecord
  } = deps;
  function asRecord(value) {
    return toRecord(value);
  }
  function asNonEmptyString(value) {
    return typeof value === "string" && value.trim() !== "" ? value : null;
  }
  function asNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }
  function toVideoRecipeRecord(value) {
    return asRecord(value);
  }
  function toAudioRecipeRecord(value) {
    return asRecord(value);
  }
  function toImageRecipeRecord(value) {
    return asRecord(value);
  }
  function toResizePresetRecord(value) {
    return asRecord(value);
  }
  function toFocusRegionRecord(value) {
    return asRecord(value);
  }
  function getSourceDurationFallback() {
    return getPreferredSourceDuration(asNonEmptyString(getProjectSource().previewUrl)) || 60;
  }
  function getResizePresetOptions() {
    const resizePresets = asRecord(getEditPresets()["resizePresets"]);
    return Object.keys(resizePresets).map(function(presetId) {
      const preset = toResizePresetRecord(resizePresets[presetId]);
      const labelKey = asNonEmptyString(preset.labelKey);
      return {
        label: labelKey ? textFromKey(labelKey) : presetId,
        value: presetId
      };
    });
  }
  function renderEditModePanel() {
    const mode = getCurrentEditMode();
    const modeSubtitle = text(["mediaAnalysis", "edit", "modeSubtitle"]);
    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "edit", "modeTitle"]))}</p>
            ${modeSubtitle ? `<h2 class="lab-panel__title">${escapeHtml(modeSubtitle)}</h2>` : ""}
          </div>
        </div>
        <div class="lab-segmented">
          ${["beginner", "advanced"].map(function(modeId) {
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
    }).join("")}
        </div>
      </section>
    `;
  }
  function renderAdvancedGroup(title, subtitle, content, extraClass = "") {
    const className = ["lab-edit-group-card", extraClass].filter(Boolean).join(" ");
    return `
      <section class="${className}">
        <div class="lab-edit-group-card__header">
          <p class="lab-panel__eyebrow">${escapeHtml(title)}</p>
          ${subtitle ? `<p class="lab-panel__hint">${escapeHtml(subtitle)}</p>` : ""}
        </div>
        <div class="lab-edit-group-card__body">
          ${content}
        </div>
      </section>
    `;
  }
  function renderFocusRegionButtons() {
    if (getCurrentSourceKind() === "audio") {
      return "";
    }
    const focusRegions = asRecord(getEditPresets()["focusRegions"]);
    const regionIds = Object.keys(focusRegions);
    if (regionIds.length === 0) {
      return "";
    }
    return `
      <div class="lab-edit-focus-grid">
        ${regionIds.map(function(regionId) {
      const focusRegion = toFocusRegionRecord(focusRegions[regionId]);
      const labelKey = asNonEmptyString(focusRegion.labelKey);
      return `
              <button
                class="lab-choice-chip"
                type="button"
                data-action="edit-focus-region"
                data-value="${regionId}"
                data-selected="${regionId === getCurrentFocusRegionId() ? "true" : "false"}"
              >
                ${escapeHtml(labelKey ? textFromKey(labelKey) : regionId)}
              </button>
            `;
    }).join("")}
      </div>
    `;
  }
  function renderOutputMetaFields() {
    const common = asRecord(getCurrentEditRecipe().common);
    return `
      <div class="lab-form-grid lab-edit-output-grid">
        <div class="lab-edit-output-field">
          ${renderEditTextField(
      "recipe.common.outputNameHint",
      asNonEmptyString(common["outputNameHint"]) || "",
      text(["mediaAnalysis", "edit", "fields", "outputNameHint"]),
      { placeholder: text(["mediaAnalysis", "edit", "placeholders", "outputNameHint"]) }
    )}
        </div>
        <div class="lab-edit-output-field lab-edit-output-field--notes">
          ${renderEditTextField(
      "recipe.common.notes",
      asNonEmptyString(common["notes"]) || "",
      text(["mediaAnalysis", "edit", "fields", "notes"]),
      { placeholder: text(["mediaAnalysis", "edit", "placeholders", "notes"]) }
    )}
        </div>
      </div>
    `;
  }
  function renderVideoAdvancedPanel() {
    const video = toVideoRecipeRecord(getCurrentEditRecipe().video);
    const duration = getSourceDurationFallback();
    const resizePresetOptions = getResizePresetOptions();
    const trimStartSeconds = asNumber(video.trimStartSeconds) || 0;
    const trimEndSeconds = asNumber(video.trimEndSeconds) || duration;
    const fpsLimit = asNumber(video.fpsLimit) || 24;
    const resizePreset = asNonEmptyString(video.resizePreset) || "keep";
    const showCustomSize = resizePreset === "custom" || asNonEmptyString(video.customWidth) !== null || asNonEmptyString(video.customHeight) !== null;
    return `
      <div class="lab-edit-advanced-grid">
        ${renderAdvancedGroup(
      text(["mediaAnalysis", "edit", "advancedGroups", "focus", "title"]),
      text(["mediaAnalysis", "edit", "advancedGroups", "focus", "subtitle"]),
      `
            ${renderFocusRegionButtons()}
            <div class="lab-toggle-grid lab-toggle-grid--compact">
              ${renderEditToggle(
        "recipe.video.blurFocusOutside",
        text(["mediaAnalysis", "edit", "fields", "blurFocusOutside"]),
        video.blurFocusOutside === true
      )}
            </div>
          `
    )}
        ${renderAdvancedGroup(
      text(["mediaAnalysis", "edit", "advancedGroups", "timing", "title"]),
      text(["mediaAnalysis", "edit", "advancedGroups", "timing", "subtitle"]),
      `
            <div class="lab-toggle-grid lab-toggle-grid--compact">
              ${renderEditToggle(
        "recipe.video.trimEnabled",
        text(["mediaAnalysis", "edit", "fields", "trimEnabled"]),
        video.trimEnabled === true
      )}
              ${renderEditToggle(
        "recipe.video.includeAudio",
        text(["mediaAnalysis", "edit", "fields", "includeAudio"]),
        video.includeAudio === true
      )}
            </div>
            <div class="lab-form-grid">
              ${renderEditRangeField(
        "recipe.video.trimStartSeconds",
        trimStartSeconds,
        text(["mediaAnalysis", "edit", "fields", "trimStartSeconds"]),
        {
          displayValue: formatDuration(trimStartSeconds),
          max: Math.max(1, Math.round(duration)),
          min: 0,
          step: 1
        }
      )}
              ${renderEditRangeField(
        "recipe.video.trimEndSeconds",
        trimEndSeconds,
        text(["mediaAnalysis", "edit", "fields", "trimEndSeconds"]),
        {
          displayValue: formatDuration(trimEndSeconds),
          max: Math.max(1, Math.round(duration)),
          min: 0,
          step: 1
        }
      )}
            </div>
          `
    )}
        ${renderAdvancedGroup(
      text(["mediaAnalysis", "edit", "advancedGroups", "sizing", "title"]),
      text(["mediaAnalysis", "edit", "advancedGroups", "sizing", "subtitle"]),
      `
            <div class="lab-form-grid">
              ${renderEditSelectField(
        "recipe.video.resizePreset",
        resizePreset,
        text(["mediaAnalysis", "edit", "fields", "resizePreset"]),
        resizePresetOptions
      )}
              ${renderEditRangeField(
        "recipe.video.fpsLimit",
        fpsLimit,
        text(["mediaAnalysis", "edit", "fields", "fpsLimit"]),
        {
          displayValue: `${fpsLimit} fps`,
          max: 60,
          min: 6,
          step: 1
        }
      )}
              ${showCustomSize ? renderEditTextField(
        "recipe.video.customWidth",
        asNonEmptyString(video.customWidth) || "",
        text(["mediaAnalysis", "edit", "fields", "customWidth"]),
        { type: "number" }
      ) + renderEditTextField(
        "recipe.video.customHeight",
        asNonEmptyString(video.customHeight) || "",
        text(["mediaAnalysis", "edit", "fields", "customHeight"]),
        { type: "number" }
      ) : ""}
              ${renderEditTextField(
        "recipe.video.frameGrabCount",
        asNumber(video.frameGrabCount) || 0,
        text(["mediaAnalysis", "edit", "fields", "frameGrabCount"]),
        { type: "number" }
      )}
            </div>
          `
    )}
        ${renderAdvancedGroup(
      text(["mediaAnalysis", "edit", "advancedGroups", "output", "title"]),
      text(["mediaAnalysis", "edit", "advancedGroups", "output", "subtitle"]),
      renderOutputMetaFields(),
      "lab-edit-group-card--wide"
    )}
      </div>
    `;
  }
  function renderAudioAdvancedPanel() {
    const audio = toAudioRecipeRecord(getCurrentEditRecipe().audio);
    const duration = getSourceDurationFallback();
    const trimStartSeconds = asNumber(audio.trimStartSeconds) || 0;
    const trimEndSeconds = asNumber(audio.trimEndSeconds) || duration;
    const normalizeTargetDb = asNumber(audio.normalizeTargetDb) || -16;
    return `
      <div class="lab-edit-advanced-grid">
        ${renderAdvancedGroup(
      text(["mediaAnalysis", "edit", "advancedGroups", "timing", "title"]),
      text(["mediaAnalysis", "edit", "advancedGroups", "timing", "subtitle"]),
      `
            <div class="lab-toggle-grid lab-toggle-grid--compact">
              ${renderEditToggle(
        "recipe.audio.trimEnabled",
        text(["mediaAnalysis", "edit", "fields", "trimEnabled"]),
        audio.trimEnabled === true
      )}
              ${renderEditToggle(
        "recipe.audio.silenceTrim",
        text(["mediaAnalysis", "edit", "fields", "silenceTrim"]),
        audio.silenceTrim === true
      )}
            </div>
            <div class="lab-form-grid">
              ${renderEditRangeField(
        "recipe.audio.trimStartSeconds",
        trimStartSeconds,
        text(["mediaAnalysis", "edit", "fields", "trimStartSeconds"]),
        {
          displayValue: formatDuration(trimStartSeconds),
          max: Math.max(1, Math.round(duration)),
          min: 0,
          step: 1
        }
      )}
              ${renderEditRangeField(
        "recipe.audio.trimEndSeconds",
        trimEndSeconds,
        text(["mediaAnalysis", "edit", "fields", "trimEndSeconds"]),
        {
          displayValue: formatDuration(trimEndSeconds),
          max: Math.max(1, Math.round(duration)),
          min: 0,
          step: 1
        }
      )}
            </div>
          `
    )}
        ${renderAdvancedGroup(
      text(["mediaAnalysis", "edit", "advancedGroups", "signal", "title"]),
      text(["mediaAnalysis", "edit", "advancedGroups", "signal", "subtitle"]),
      `
            <div class="lab-toggle-grid lab-toggle-grid--compact">
              ${renderEditToggle(
        "recipe.audio.normalize",
        text(["mediaAnalysis", "edit", "fields", "normalize"]),
        audio.normalize === true
      )}
              ${renderEditToggle(
        "recipe.audio.mono",
        text(["mediaAnalysis", "edit", "fields", "mono"]),
        audio.mono === true
      )}
              ${renderEditToggle(
        "recipe.audio.spectrogram",
        text(["mediaAnalysis", "edit", "fields", "spectrogram"]),
        audio.spectrogram === true
      )}
            </div>
            <div class="lab-form-grid">
              ${renderEditRangeField(
        "recipe.audio.normalizeTargetDb",
        normalizeTargetDb,
        text(["mediaAnalysis", "edit", "fields", "normalizeTargetDb"]),
        {
          displayValue: `${normalizeTargetDb} LUFS`,
          max: -8,
          min: -30,
          step: 1
        }
      )}
              ${renderEditTextField(
        "recipe.audio.highpassHz",
        asNumber(audio.highpassHz) || 0,
        text(["mediaAnalysis", "edit", "fields", "highpassHz"]),
        { type: "number" }
      )}
              ${renderEditTextField(
        "recipe.audio.lowpassHz",
        asNumber(audio.lowpassHz) || 0,
        text(["mediaAnalysis", "edit", "fields", "lowpassHz"]),
        { type: "number" }
      )}
            </div>
          `
    )}
        ${renderAdvancedGroup(
      text(["mediaAnalysis", "edit", "advancedGroups", "output", "title"]),
      text(["mediaAnalysis", "edit", "advancedGroups", "output", "subtitle"]),
      renderOutputMetaFields(),
      "lab-edit-group-card--wide"
    )}
      </div>
    `;
  }
  function renderImageAdvancedPanel() {
    const image = toImageRecipeRecord(getCurrentEditRecipe().image);
    const resizePreset = asNonEmptyString(image.resizePreset) || "keep";
    const resizePresetOptions = getResizePresetOptions();
    const brightness = asNumber(image.brightness) || 0;
    const contrast = asNumber(image.contrast) || 1;
    const blurStrength = asNumber(image.blurStrength) || 0;
    const sharpen = asNumber(image.sharpen) || 0;
    const showCustomSize = resizePreset === "custom" || asNonEmptyString(image.customWidth) !== null || asNonEmptyString(image.customHeight) !== null;
    return `
      <div class="lab-edit-advanced-grid">
        ${renderAdvancedGroup(
      text(["mediaAnalysis", "edit", "advancedGroups", "focus", "title"]),
      text(["mediaAnalysis", "edit", "advancedGroups", "focus", "subtitle"]),
      `${renderFocusRegionButtons()}`
    )}
        ${renderAdvancedGroup(
      text(["mediaAnalysis", "edit", "advancedGroups", "geometry", "title"]),
      text(["mediaAnalysis", "edit", "advancedGroups", "geometry", "subtitle"]),
      `
            <div class="lab-form-grid">
              ${renderEditSelectField(
        "recipe.image.resizePreset",
        resizePreset,
        text(["mediaAnalysis", "edit", "fields", "resizePreset"]),
        resizePresetOptions
      )}
              ${renderEditTextField(
        "recipe.image.rotateDegrees",
        asNumber(image.rotateDegrees) || 0,
        text(["mediaAnalysis", "edit", "fields", "rotateDegrees"]),
        { type: "number" }
      )}
              ${showCustomSize ? renderEditTextField(
        "recipe.image.customWidth",
        asNonEmptyString(image.customWidth) || "",
        text(["mediaAnalysis", "edit", "fields", "customWidth"]),
        { type: "number" }
      ) + renderEditTextField(
        "recipe.image.customHeight",
        asNonEmptyString(image.customHeight) || "",
        text(["mediaAnalysis", "edit", "fields", "customHeight"]),
        { type: "number" }
      ) : ""}
            </div>
          `
    )}
        ${renderAdvancedGroup(
      text(["mediaAnalysis", "edit", "advancedGroups", "imageTone", "title"]),
      text(["mediaAnalysis", "edit", "advancedGroups", "imageTone", "subtitle"]),
      `
            <div class="lab-form-grid">
              ${renderEditRangeField(
        "recipe.image.brightness",
        brightness,
        text(["mediaAnalysis", "edit", "fields", "brightness"]),
        {
          displayValue: brightness.toFixed(2),
          max: 0.3,
          min: -0.3,
          step: 0.01
        }
      )}
              ${renderEditRangeField(
        "recipe.image.contrast",
        contrast,
        text(["mediaAnalysis", "edit", "fields", "contrast"]),
        {
          displayValue: contrast.toFixed(2),
          max: 2.2,
          min: 0.4,
          step: 0.05
        }
      )}
              ${renderEditRangeField(
        "recipe.image.blurStrength",
        blurStrength,
        text(["mediaAnalysis", "edit", "fields", "blurStrength"]),
        {
          displayValue: blurStrength.toFixed(1),
          max: 3,
          min: 0,
          step: 0.1
        }
      )}
              ${renderEditRangeField(
        "recipe.image.sharpen",
        sharpen,
        text(["mediaAnalysis", "edit", "fields", "sharpen"]),
        {
          displayValue: sharpen.toFixed(1),
          max: 2,
          min: 0,
          step: 0.1
        }
      )}
            </div>
          `
    )}
        ${renderAdvancedGroup(
      text(["mediaAnalysis", "edit", "advancedGroups", "output", "title"]),
      text(["mediaAnalysis", "edit", "advancedGroups", "output", "subtitle"]),
      renderOutputMetaFields(),
      "lab-edit-group-card--wide"
    )}
      </div>
    `;
  }
  function renderEditAdvancedPanel() {
    switch (getCurrentSourceKind()) {
      case "audio":
        return renderAudioAdvancedPanel();
      case "image":
        return renderImageAdvancedPanel();
      case "video":
      default:
        return renderVideoAdvancedPanel();
    }
  }
  function renderVideoEditPanel() {
    const video = toVideoRecipeRecord(getCurrentEditRecipe().video);
    const duration = getSourceDurationFallback();
    const resizePresetOptions = getResizePresetOptions();
    const trimStartSeconds = asNumber(video.trimStartSeconds) || 0;
    const trimEndSeconds = asNumber(video.trimEndSeconds) || duration;
    const fpsLimit = asNumber(video.fpsLimit) || 24;
    const resizePreset = asNonEmptyString(video.resizePreset) || "keep";
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
          ${renderEditRangeField(
      "recipe.video.trimStartSeconds",
      trimStartSeconds,
      text(["mediaAnalysis", "edit", "fields", "trimStartSeconds"]),
      {
        displayValue: formatDuration(trimStartSeconds),
        max: Math.max(1, Math.round(duration)),
        min: 0,
        step: 1
      }
    )}
          ${renderEditRangeField(
      "recipe.video.trimEndSeconds",
      trimEndSeconds,
      text(["mediaAnalysis", "edit", "fields", "trimEndSeconds"]),
      {
        displayValue: formatDuration(trimEndSeconds),
        max: Math.max(1, Math.round(duration)),
        min: 0,
        step: 1
      }
    )}
          ${renderEditSelectField(
      "recipe.video.resizePreset",
      resizePreset,
      text(["mediaAnalysis", "edit", "fields", "resizePreset"]),
      resizePresetOptions
    )}
          ${renderEditRangeField(
      "recipe.video.fpsLimit",
      fpsLimit,
      text(["mediaAnalysis", "edit", "fields", "fpsLimit"]),
      {
        displayValue: `${fpsLimit} fps`,
        max: 60,
        min: 6,
        step: 1
      }
    )}
          ${resizePreset === "custom" || getCurrentEditMode() === "advanced" ? renderEditTextField(
      "recipe.video.customWidth",
      asNonEmptyString(video.customWidth) || "",
      text(["mediaAnalysis", "edit", "fields", "customWidth"]),
      { type: "number" }
    ) + renderEditTextField(
      "recipe.video.customHeight",
      asNonEmptyString(video.customHeight) || "",
      text(["mediaAnalysis", "edit", "fields", "customHeight"]),
      { type: "number" }
    ) : ""}
          ${getCurrentEditMode() === "advanced" ? renderEditTextField(
      "recipe.video.frameGrabCount",
      asNumber(video.frameGrabCount) || 0,
      text(["mediaAnalysis", "edit", "fields", "frameGrabCount"]),
      { type: "number" }
    ) : ""}
        </div>
      </section>
    `;
  }
  function renderAudioEditPanel() {
    const audio = toAudioRecipeRecord(getCurrentEditRecipe().audio);
    const duration = getSourceDurationFallback();
    const trimStartSeconds = asNumber(audio.trimStartSeconds) || 0;
    const trimEndSeconds = asNumber(audio.trimEndSeconds) || duration;
    const normalizeTargetDb = asNumber(audio.normalizeTargetDb) || -16;
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
          ${renderEditRangeField(
      "recipe.audio.trimStartSeconds",
      trimStartSeconds,
      text(["mediaAnalysis", "edit", "fields", "trimStartSeconds"]),
      {
        displayValue: formatDuration(trimStartSeconds),
        max: Math.max(1, Math.round(duration)),
        min: 0,
        step: 1
      }
    )}
          ${renderEditRangeField(
      "recipe.audio.trimEndSeconds",
      trimEndSeconds,
      text(["mediaAnalysis", "edit", "fields", "trimEndSeconds"]),
      {
        displayValue: formatDuration(trimEndSeconds),
        max: Math.max(1, Math.round(duration)),
        min: 0,
        step: 1
      }
    )}
          ${renderEditRangeField(
      "recipe.audio.normalizeTargetDb",
      normalizeTargetDb,
      text(["mediaAnalysis", "edit", "fields", "normalizeTargetDb"]),
      {
        displayValue: `${normalizeTargetDb} LUFS`,
        max: -8,
        min: -30,
        step: 1
      }
    )}
          ${getCurrentEditMode() === "advanced" ? renderEditTextField(
      "recipe.audio.highpassHz",
      asNumber(audio.highpassHz) || 0,
      text(["mediaAnalysis", "edit", "fields", "highpassHz"]),
      { type: "number" }
    ) + renderEditTextField(
      "recipe.audio.lowpassHz",
      asNumber(audio.lowpassHz) || 0,
      text(["mediaAnalysis", "edit", "fields", "lowpassHz"]),
      { type: "number" }
    ) : ""}
        </div>
      </section>
    `;
  }
  function renderImageEditPanel() {
    const image = toImageRecipeRecord(getCurrentEditRecipe().image);
    const resizePreset = asNonEmptyString(image.resizePreset) || "keep";
    const resizePresetOptions = getResizePresetOptions();
    const brightness = asNumber(image.brightness) || 0;
    const contrast = asNumber(image.contrast) || 1;
    const blurStrength = asNumber(image.blurStrength) || 0;
    const sharpen = asNumber(image.sharpen) || 0;
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
      resizePreset,
      text(["mediaAnalysis", "edit", "fields", "resizePreset"]),
      resizePresetOptions
    )}
          ${renderEditRangeField(
      "recipe.image.brightness",
      brightness,
      text(["mediaAnalysis", "edit", "fields", "brightness"]),
      {
        displayValue: brightness.toFixed(2),
        max: 0.3,
        min: -0.3,
        step: 0.01
      }
    )}
          ${renderEditRangeField(
      "recipe.image.contrast",
      contrast,
      text(["mediaAnalysis", "edit", "fields", "contrast"]),
      {
        displayValue: contrast.toFixed(2),
        max: 2.2,
        min: 0.4,
        step: 0.05
      }
    )}
          ${renderEditRangeField(
      "recipe.image.blurStrength",
      blurStrength,
      text(["mediaAnalysis", "edit", "fields", "blurStrength"]),
      {
        displayValue: blurStrength.toFixed(1),
        max: 3,
        min: 0,
        step: 0.1
      }
    )}
          ${resizePreset === "custom" || getCurrentEditMode() === "advanced" ? renderEditTextField(
      "recipe.image.customWidth",
      asNonEmptyString(image.customWidth) || "",
      text(["mediaAnalysis", "edit", "fields", "customWidth"]),
      { type: "number" }
    ) + renderEditTextField(
      "recipe.image.customHeight",
      asNonEmptyString(image.customHeight) || "",
      text(["mediaAnalysis", "edit", "fields", "customHeight"]),
      { type: "number" }
    ) : ""}
          ${getCurrentEditMode() === "advanced" ? renderEditTextField(
      "recipe.image.rotateDegrees",
      asNumber(image.rotateDegrees) || 0,
      text(["mediaAnalysis", "edit", "fields", "rotateDegrees"]),
      { type: "number" }
    ) + renderEditRangeField(
      "recipe.image.sharpen",
      sharpen,
      text(["mediaAnalysis", "edit", "fields", "sharpen"]),
      {
        displayValue: sharpen.toFixed(1),
        max: 2,
        min: 0,
        step: 0.1
      }
    ) : ""}
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
  return {
    renderEditAdvancedPanel,
    renderEditAudioPanel: renderAudioEditPanel,
    renderEditControlsPanel,
    renderEditModePanel,
    renderEditVideoPanel: renderVideoEditPanel,
    renderImageEditPanel
  };
}
