export function createLaboratorySourceStageIntakeRuntime(deps) {
  const {
    escapeHtml,
    getCurrentDrafts,
    getCurrentSourceKind,
    getCurrentSourceMode,
    getSourceModeOptions,
    getToolEntry,
    getYtDlpForm,
    renderTextField,
    text,
    textFromKey,
    toRecord
  } = deps;
  function toDraftRecord(value) {
    return toRecord(value);
  }
  function toFormRecord(value) {
    return toRecord(value);
  }
  function toSectionRecord(value) {
    return toRecord(value);
  }
  function toFieldRecord(value) {
    return toRecord(value);
  }
  function toOptionRecord(value) {
    return toRecord(value);
  }
  function asString(value, fallback = "") {
    return typeof value === "string" ? value : fallback;
  }
  function getYoutubeCustomDrafts(drafts) {
    return toRecord(drafts.youtubeCustom);
  }
  function renderSourceModes() {
    const currentKind = getCurrentSourceKind();
    const currentMode = getCurrentSourceMode();
    const modes = getSourceModeOptions(currentKind);
    const ytDlpInstalled = getToolEntry("yt-dlp").installed === true;
    return `
      <div class="lab-segmented">
        ${modes.map(function(modeId) {
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
    }).join("")}
      </div>
    `;
  }
  function renderYoutubeCustomForm(drafts) {
    const form = toFormRecord(getYtDlpForm());
    const rawSections = form.sections;
    const sections = Array.isArray(rawSections) ? rawSections.map(function(section) {
      return toSectionRecord(section);
    }) : [];
    const youtubeCustomDrafts = getYoutubeCustomDrafts(drafts);
    return `
      <div class="lab-form-stack">
        ${sections.map(function(section) {
      const rawFields = section.fields;
      const fields = Array.isArray(rawFields) ? rawFields.map(function(field) {
        return toFieldRecord(field);
      }) : [];
      return `
              <div class="lab-form-section">
                <div class="lab-form-grid">
                  ${fields.map(function(field) {
        const fieldId = asString(field.id);
        const value = youtubeCustomDrafts[fieldId];
        if (field.type === "toggle") {
          return `
                          <button
                            class="lab-toggle"
                            type="button"
                            data-toggle-field="youtubeCustom.${fieldId}"
                            data-active="${value === true ? "true" : "false"}"
                          >
                            <span class="lab-toggle__track"><span class="lab-toggle__thumb"></span></span>
                            <span class="lab-toggle__label">${escapeHtml(textFromKey(asString(field.labelKey)))}</span>
                          </button>
                        `;
        }
        if (field.type === "select") {
          const rawOptions = field.options;
          const options = Array.isArray(rawOptions) ? rawOptions.map(function(option) {
            return toOptionRecord(option);
          }) : [];
          return `
                          <label class="lab-field">
                            <span class="lab-field__label">${escapeHtml(textFromKey(asString(field.labelKey)))}</span>
                            <select class="lab-select" data-draft-field="youtubeCustom.${fieldId}">
                              ${options.map(function(option) {
            const optionValue = asString(option.value);
            return `
                                    <option value="${escapeHtml(optionValue)}" ${optionValue === String(value || "") ? "selected" : ""}>
                                      ${escapeHtml(textFromKey(asString(option.labelKey)))}
                                    </option>
                                  `;
          }).join("")}
                            </select>
                          </label>
                        `;
        }
        return renderTextField(
          `youtubeCustom.${fieldId}`,
          value,
          textFromKey(asString(field.labelKey)),
          textFromKey(asString(field.placeholderKey)),
          {
            type: field.type === "number" ? "number" : "text"
          }
        );
      }).join("")}
                </div>
              </div>
            `;
    }).join("")}
      </div>
    `;
  }
  function renderSourceIntakePanel() {
    const currentMode = getCurrentSourceMode();
    const drafts = toDraftRecord(getCurrentDrafts());
    const ytDlpInstalled = getToolEntry("yt-dlp").installed === true;
    const youtubePreset = typeof drafts.youtubePreset === "string" && drafts.youtubePreset.trim() !== "" ? drafts.youtubePreset : "medium";
    const body = currentMode === "local" ? `
        ${renderTextField(
      "fileNameHint",
      drafts.fileNameHint,
      text(["mediaAnalysis", "source", "fields", "fileNameHint"]),
      text(["mediaAnalysis", "source", "placeholders", "fileNameHint"])
    )}
        <button class="lab-button lab-button--primary" type="button" data-action="source-pick-local">
          ${escapeHtml(text(["mediaAnalysis", "source", "actions", "pickLocal"]))}
        </button>
      ` : currentMode === "url" ? `
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
      ` : `
        ${ytDlpInstalled !== true ? `<div class="lab-notice">${escapeHtml(text(["mediaAnalysis", "source", "youtubeDisabled"]))}</div>` : ""}
        ${renderTextField(
      "youtubeUrl",
      drafts.youtubeUrl,
      text(["mediaAnalysis", "source", "fields", "youtubeUrl"]),
      text(["mediaAnalysis", "source", "placeholders", "youtubeUrl"])
    )}
        <div class="lab-field">
          <span class="lab-field__label">${escapeHtml(text(["mediaAnalysis", "source", "youtubePresetLabel"]))}</span>
          <div class="lab-chip-row">
            ${["low", "medium", "best", "custom"].map(function(presetId) {
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
    }).join("")}
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
  return {
    renderSourceIntakePanel
  };
}
