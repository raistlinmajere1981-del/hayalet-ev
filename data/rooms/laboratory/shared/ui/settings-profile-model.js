export function createLaboratorySettingsProfileModelRuntime(deps) {
  const {
    escapeHtml,
    formatBytes,
    formatCleanupPolicy,
    formatPlatformList,
    getToolEntry,
    getToolRegistry,
    renderPreviewMetaRow,
    text,
    textFromKey,
    toRecord
  } = deps;
  function toModelRecord(value) {
    return toRecord(value);
  }
  function toToolStateRecord(value) {
    return toRecord(value);
  }
  function toToolDescriptorRecord(value) {
    return toRecord(value);
  }
  function toString(value, fallback = "") {
    return typeof value === "string" ? value : fallback;
  }
  function getDescriptor(toolId) {
    return getToolRegistry().find(function(entry) {
      return toString(toToolDescriptorRecord(entry).toolId) === toolId;
    }) || null;
  }
  function renderProfileModelCard(entry) {
    const model = toModelRecord(entry);
    const whisperTool = toToolStateRecord(getToolEntry("whisper.cpp"));
    const whisperDescriptor = getDescriptor("whisper.cpp");
    const whisperDescriptorRecord = whisperDescriptor === null ? {} : whisperDescriptor;
    const busy = model.busy === true;
    const canInstall = model.binarySupported === true && whisperTool.installed === true && model.runtimeCompatible !== false;
    const statusLabel = model.ready === true ? text(["mediaAnalysis", "settings", "status", "ready"]) : model.installed === true ? text(["mediaAnalysis", "settings", "status", "installed"]) : text(["mediaAnalysis", "settings", "status", "missing"]);
    const modelId = toString(model.modelId);
    const label = textFromKey(toString(model.labelKey)) || modelId || "--";
    const installStrategy = toString(whisperDescriptorRecord.installStrategy, "--");
    return `
      <article class="lab-tool-card">
        <div class="lab-tool-card__head">
          <div>
            <strong>${escapeHtml(label)}</strong>
            <span>${escapeHtml(statusLabel)}</span>
          </div>
          ${model.installed === true ? `
                <button
                  class="lab-button lab-button--ghost lab-button--tight"
                  type="button"
                  data-action="profile-model-remove"
                  data-value="${escapeHtml(modelId)}"
                  ${busy ? "disabled" : ""}
                >
                  ${escapeHtml(text(["mediaAnalysis", "profile", "modelActions", "remove"]))}
                </button>
              ` : `
                <button
                  class="lab-button lab-button--primary lab-button--tight"
                  type="button"
                  data-action="profile-model-install"
                  data-value="${escapeHtml(modelId)}"
                  ${busy || canInstall !== true ? "disabled" : ""}
                >
                  ${escapeHtml(text(["mediaAnalysis", "profile", "modelActions", "install"]))}
                </button>
              `}
        </div>
        <ul class="lab-summary-list">
          ${renderPreviewMetaRow(
      text(["mediaAnalysis", "profile", "modelSummary", "size"]),
      formatBytes(model.sizeBytes || model.expectedBytes)
    )}
          ${renderPreviewMetaRow(
      text(["mediaAnalysis", "profile", "modelSummary", "quantization"]),
      toString(model.quantization, "--")
    )}
          ${renderPreviewMetaRow(
      text(["mediaAnalysis", "profile", "modelSummary", "language"]),
      toString(model.language, "--")
    )}
          ${renderPreviewMetaRow(
      text(["mediaAnalysis", "profile", "modelSummary", "platforms"]),
      formatPlatformList(model.supportedPlatforms)
    )}
          ${renderPreviewMetaRow(
      text(["mediaAnalysis", "profile", "modelSummary", "cleanup"]),
      formatCleanupPolicy(model.cleanupPolicy)
    )}
          ${renderPreviewMetaRow(text(["workbench", "dependency", "strategy"]), installStrategy)}
          ${renderPreviewMetaRow(
      text(["mediaAnalysis", "profile", "modelSummary", "integrity"]),
      model.checksumValid === true ? text(["mediaAnalysis", "settings", "status", "ready"]) : model.installed === true ? text(["mediaAnalysis", "settings", "status", "installed"]) : "--"
    )}
        </ul>
        ${toString(model.summaryKey).trim() ? `<p class="lab-panel__hint">${escapeHtml(textFromKey(toString(model.summaryKey)))}</p>` : ""}
        ${canInstall !== true ? `<p class="lab-panel__hint">${escapeHtml(
      text(["mediaAnalysis", "profile", "modelUnavailable"])
    )}</p>` : ""}
        ${canInstall !== true ? `<p class="lab-panel__hint">${escapeHtml(
      text(["mediaAnalysis", "profile", "modelVerificationHint"])
    )}</p>` : ""}
      </article>
    `;
  }
  return {
    renderProfileModelCard
  };
}
