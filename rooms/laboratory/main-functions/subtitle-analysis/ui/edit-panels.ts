// @ts-nocheck
export function createSubtitleAnalysisEditPanels(deps) {
  const toRecord = deps.toRecord;
  const escapeHtml = deps.escapeHtml;
  const featureText = deps.featureText;
  const subtitleText = deps.subtitleText;
  const formatStatusLabel = deps.formatStatusLabel;
  const renderSummaryRows = deps.renderSummaryRows;
  const renderEditToggle = deps.renderEditToggle;
  const renderEditSelectField = deps.renderEditSelectField;
  const renderEditRangeField = deps.renderEditRangeField;
  const renderStageIntro = deps.renderStageIntro;
  const getCurrentEditDraft = deps.getCurrentEditDraft;
  const getActiveSubtitleEntry = deps.getActiveSubtitleEntry;
  const getSubtitleEditState = deps.getSubtitleEditState;
  const getSubtitleEditPresets = deps.getSubtitleEditPresets;
  const getSubtitleEditPreview = deps.getSubtitleEditPreview;
  const getSubtitleOutputs = deps.getSubtitleOutputs;

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
