// @ts-nocheck
export function createMediaAnalysisEditModePanels(deps) {
  const toRecord = deps.toRecord;
  const escapeHtml = deps.escapeHtml;
  const text = deps.text;
  const textFromKey = deps.textFromKey;
  const getCurrentSourceKind = deps.getCurrentSourceKind;
  const getCurrentEditRecipe = deps.getCurrentEditRecipe;
  const getProjectSource = deps.getProjectSource;
  const getPreferredSourceDuration = deps.getPreferredSourceDuration;
  const getCurrentEditMode = deps.getCurrentEditMode;
  const getEditPresets = deps.getEditPresets;
  const renderEditToggle = deps.renderEditToggle;
  const renderEditTextField = deps.renderEditTextField;
  const renderEditSelectField = deps.renderEditSelectField;
  const renderEditRangeField = deps.renderEditRangeField;
  const formatDuration = deps.formatDuration;

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

  return {
    renderEditAudioPanel: renderAudioEditPanel,
    renderEditControlsPanel,
    renderEditModePanel,
    renderEditVideoPanel: renderVideoEditPanel,
    renderImageEditPanel,
  };
}
