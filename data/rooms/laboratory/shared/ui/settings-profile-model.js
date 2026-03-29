export function createLaboratorySettingsProfileModelRuntime(deps) {
  const toRecord = deps.toRecord;
  const escapeHtml = deps.escapeHtml;
  const text = deps.text;
  const textFromKey = deps.textFromKey;
  const formatBytes = deps.formatBytes;
  const formatCleanupPolicy = deps.formatCleanupPolicy;
  const formatPlatformList = deps.formatPlatformList;
  const getToolEntry = deps.getToolEntry;
  const renderPreviewMetaRow = deps.renderPreviewMetaRow;
  function renderProfileModelCard(entry) {
    const model = toRecord(entry);
    const busy = model.busy === true;
    const canInstall = model.binarySupported === true && getToolEntry("whisper.cpp").installed === true && model.runtimeCompatible !== false;
    const statusLabel = model.ready === true ? text(["mediaAnalysis", "settings", "status", "ready"]) : model.installed === true ? text(["mediaAnalysis", "settings", "status", "installed"]) : text(["mediaAnalysis", "settings", "status", "missing"]);
    return `
      <article class="lab-tool-card">
        <div class="lab-tool-card__head">
          <div>
            <strong>${escapeHtml(textFromKey(model.labelKey || "") || model.modelId || "--")}</strong>
            <span>${escapeHtml(statusLabel)}</span>
          </div>
          ${model.installed === true ? `
                <button
                  class="lab-button lab-button--ghost lab-button--tight"
                  type="button"
                  data-action="profile-model-remove"
                  data-value="${escapeHtml(model.modelId || "")}"
                  ${busy ? "disabled" : ""}
                >
                  ${escapeHtml(text(["mediaAnalysis", "profile", "modelActions", "remove"]))}
                </button>
              ` : `
                <button
                  class="lab-button lab-button--primary lab-button--tight"
                  type="button"
                  data-action="profile-model-install"
                  data-value="${escapeHtml(model.modelId || "")}"
                  ${busy || canInstall !== true ? "disabled" : ""}
                >
                  ${escapeHtml(text(["mediaAnalysis", "profile", "modelActions", "install"]))}
                </button>
              `}
        </div>
        <ul class="lab-summary-list">
          ${renderPreviewMetaRow(text(["mediaAnalysis", "profile", "modelSummary", "size"]), formatBytes(model.sizeBytes || model.expectedBytes))}
          ${renderPreviewMetaRow(text(["mediaAnalysis", "profile", "modelSummary", "quantization"]), model.quantization || "--")}
          ${renderPreviewMetaRow(text(["mediaAnalysis", "profile", "modelSummary", "language"]), model.language || "--")}
          ${renderPreviewMetaRow(
      text(["mediaAnalysis", "profile", "modelSummary", "platforms"]),
      formatPlatformList(model.supportedPlatforms)
    )}
          ${renderPreviewMetaRow(
      text(["mediaAnalysis", "profile", "modelSummary", "cleanup"]),
      formatCleanupPolicy(model.cleanupPolicy)
    )}
          ${renderPreviewMetaRow(
      text(["mediaAnalysis", "profile", "modelSummary", "integrity"]),
      model.checksumValid === true ? text(["mediaAnalysis", "settings", "status", "ready"]) : model.installed === true ? text(["mediaAnalysis", "settings", "status", "installed"]) : "--"
    )}
        </ul>
        ${typeof model.summaryKey === "string" && model.summaryKey.trim() !== "" ? `<p class="lab-panel__hint">${escapeHtml(textFromKey(model.summaryKey))}</p>` : ""}
        ${canInstall !== true ? `<p class="lab-panel__hint">${escapeHtml(text(["mediaAnalysis", "profile", "modelUnavailable"]))}</p>` : ""}
        ${typeof model.compatibilityReason === "string" && model.compatibilityReason.trim() !== "" ? `<p class="lab-panel__hint">${escapeHtml(model.compatibilityReason)}</p>` : ""}
        ${typeof model.lastError === "string" && model.lastError.trim() !== "" ? `<p class="lab-panel__hint lab-panel__hint--danger">${escapeHtml(model.lastError)}</p>` : ""}
      </article>
    `;
  }
  return {
    renderProfileModelCard
  };
}
