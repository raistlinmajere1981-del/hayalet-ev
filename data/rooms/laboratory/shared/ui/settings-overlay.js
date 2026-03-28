export function createLaboratorySettingsUi(deps) {
  const stageOrder = Array.isArray(deps.stageOrder) ? deps.stageOrder : [];
  const state = deps.state;
  const toRecord = deps.toRecord;
  const escapeHtml = deps.escapeHtml;
  const text = deps.text;
  const textFromKey = deps.textFromKey;
  const featureText = deps.featureText;
  const formatBytes = deps.formatBytes;
  const formatCleanupPolicy = deps.formatCleanupPolicy;
  const formatPlatformList = deps.formatPlatformList;
  const getToolEntry = deps.getToolEntry;
  const getToolRegistry = deps.getToolRegistry;
  const getStageToolIds = deps.getStageToolIds;
  const getProfileModelEntries = deps.getProfileModelEntries;
  const getProfileSelectedModel = deps.getProfileSelectedModel;
  const renderPreviewMetaRow = deps.renderPreviewMetaRow;
  const renderAudioAnalysisProviderPanel = deps.renderAudioAnalysisProviderPanel;
  const isAudioAnalysisFeature = deps.isAudioAnalysisFeature;

  function renderToolCard(toolId, stageId) {
    const tool = getToolEntry(toolId);
    const descriptor =
      getToolRegistry().find(function (entry) {
        return entry.toolId === toolId;
      }) || {};
    const details = toRecord(tool.details);
    const busy = tool.busy === true;
    const updateAvailable = tool.updateAvailable === true;
    const stageSupport = toRecord(descriptor.stageSupport)[stageId] || "unsupported";
    const availability =
      (typeof details.availability === "string" && details.availability.trim() !== ""
        ? details.availability
        : typeof descriptor.availability === "string" && descriptor.availability.trim() !== ""
          ? descriptor.availability
          : "installable");
    const planned = availability === "planned";
    const systemCommand = availability === "system-command";
    const plannedReason =
      (typeof details.plannedReason === "string" && details.plannedReason.trim() !== ""
        ? details.plannedReason
        : typeof descriptor.plannedReason === "string" && descriptor.plannedReason.trim() !== ""
          ? descriptor.plannedReason
          : null);
    const setupHint =
      (typeof details.setupHint === "string" && details.setupHint.trim() !== ""
        ? details.setupHint
        : typeof descriptor.setupHint === "string" && descriptor.setupHint.trim() !== ""
          ? descriptor.setupHint
          : null);
    const statusLabel =
      planned
        ? text(["mediaAnalysis", "settings", "status", "planned"])
        : systemCommand
          ? tool.installed === true
            ? text(["mediaAnalysis", "settings", "status", "manualReady"])
            : text(["mediaAnalysis", "settings", "status", "manualSetup"])
          : tool.installed === true
            ? updateAvailable
              ? text(["mediaAnalysis", "settings", "status", "updateAvailable"])
              : text(["mediaAnalysis", "settings", "status", "installed"])
            : text(["mediaAnalysis", "settings", "status", "missing"]);
    const actionMarkup =
      planned
        ? `
                <button
                  class="lab-button lab-button--ghost lab-button--tight"
                  type="button"
                  disabled
                >
                  ${escapeHtml(text(["mediaAnalysis", "settings", "status", "planned"]))}
                </button>
              `
        : systemCommand
          ? `
                <button
                  class="lab-button lab-button--ghost lab-button--tight"
                  type="button"
                  data-action="${tool.installed === true ? "tool-update" : "tool-install"}"
                  data-value="${toolId}"
                  ${busy ? "disabled" : ""}
                >
                  ${escapeHtml(
                    tool.installed === true
                      ? text(["mediaAnalysis", "settings", "manualRefreshAction"])
                      : text(["mediaAnalysis", "settings", "manualCheckAction"])
                  )}
                </button>
              `
          : tool.installed === true
            ? `
                <button
                  class="lab-button lab-button--ghost lab-button--tight"
                  type="button"
                  data-action="tool-update"
                  data-value="${toolId}"
                  ${busy ? "disabled" : ""}
                >
                  ${escapeHtml(text(["mediaAnalysis", "settings", "updateAction"]))}
                </button>
              `
            : `
                <button
                  class="lab-button lab-button--primary lab-button--tight"
                  type="button"
                  data-action="tool-install"
                  data-value="${toolId}"
                  ${busy ? "disabled" : ""}
                >
                  ${escapeHtml(text(["mediaAnalysis", "settings", "installAction"]))}
                </button>
              `;

    return `
      <article class="lab-tool-card">
        <div class="lab-tool-card__head">
          <div>
            <strong>${escapeHtml(text(["mediaAnalysis", "settings", "tools", toolId]) || descriptor.displayName || toolId)}</strong>
            <span>${escapeHtml(statusLabel)}</span>
          </div>
          ${actionMarkup}
        </div>
        <ul class="lab-summary-list">
          ${renderPreviewMetaRow(
            text(["mediaAnalysis", "settings", "stageSupportLabel"]),
            text(["mediaAnalysis", "settings", "support", stageSupport])
          )}
          ${renderPreviewMetaRow(text(["mediaAnalysis", "settings", "versionLabel"]), tool.version || "--")}
          ${renderPreviewMetaRow(
            text(["mediaAnalysis", "settings", "latestLabel"]),
            tool.latestVersion || tool.latestReleaseName || "--"
          )}
          ${renderPreviewMetaRow(text(["mediaAnalysis", "settings", "pathLabel"]), tool.binaryPath || "--")}
        </ul>
        ${
          busy
            ? `<p class="lab-panel__hint">${escapeHtml(text(["mediaAnalysis", "settings", "busyHint"]))}</p>`
            : ""
        }
        ${
          plannedReason
            ? `<p class="lab-panel__hint">${escapeHtml(plannedReason)}</p>`
            : ""
        }
        ${
          setupHint
            ? `<p class="lab-panel__hint">${escapeHtml(setupHint)}</p>`
            : ""
        }
        ${
          typeof tool.lastError === "string" && tool.lastError.trim() !== ""
            ? `<p class="lab-panel__hint lab-panel__hint--danger">${escapeHtml(tool.lastError)}</p>`
            : ""
        }
      </article>
    `;
  }

  function renderProfileModelCard(entry) {
    const model = toRecord(entry);
    const busy = model.busy === true;
    const canInstall =
      model.binarySupported === true &&
      getToolEntry("whisper.cpp").installed === true &&
      model.runtimeCompatible !== false;
    const statusLabel =
      model.ready === true
        ? text(["mediaAnalysis", "settings", "status", "ready"])
        : model.installed === true
          ? text(["mediaAnalysis", "settings", "status", "installed"])
          : text(["mediaAnalysis", "settings", "status", "missing"]);

    return `
      <article class="lab-tool-card">
        <div class="lab-tool-card__head">
          <div>
            <strong>${escapeHtml(textFromKey(model.labelKey || "") || model.modelId || "--")}</strong>
            <span>${escapeHtml(statusLabel)}</span>
          </div>
          ${
            model.installed === true
              ? `
                <button
                  class="lab-button lab-button--ghost lab-button--tight"
                  type="button"
                  data-action="profile-model-remove"
                  data-value="${escapeHtml(model.modelId || "")}"
                  ${busy ? "disabled" : ""}
                >
                  ${escapeHtml(text(["mediaAnalysis", "profile", "modelActions", "remove"]))}
                </button>
              `
              : `
                <button
                  class="lab-button lab-button--primary lab-button--tight"
                  type="button"
                  data-action="profile-model-install"
                  data-value="${escapeHtml(model.modelId || "")}"
                  ${busy || canInstall !== true ? "disabled" : ""}
                >
                  ${escapeHtml(text(["mediaAnalysis", "profile", "modelActions", "install"]))}
                </button>
              `
          }
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
            model.checksumValid === true
              ? text(["mediaAnalysis", "settings", "status", "ready"])
              : model.installed === true
                ? text(["mediaAnalysis", "settings", "status", "installed"])
                : "--"
          )}
        </ul>
        ${
          typeof model.summaryKey === "string" && model.summaryKey.trim() !== ""
            ? `<p class="lab-panel__hint">${escapeHtml(textFromKey(model.summaryKey))}</p>`
            : ""
        }
        ${
          canInstall !== true
            ? `<p class="lab-panel__hint">${escapeHtml(text(["mediaAnalysis", "profile", "modelUnavailable"]))}</p>`
            : ""
        }
        ${
          typeof model.compatibilityReason === "string" && model.compatibilityReason.trim() !== ""
            ? `<p class="lab-panel__hint">${escapeHtml(model.compatibilityReason)}</p>`
            : ""
        }
        ${
          typeof model.lastError === "string" && model.lastError.trim() !== ""
            ? `<p class="lab-panel__hint lab-panel__hint--danger">${escapeHtml(model.lastError)}</p>`
            : ""
        }
      </article>
    `;
  }

  function renderSettingsOverlay() {
    if (state.ui.settingsOpen !== true) {
      return "";
    }

    const stageId = stageOrder.includes(state.activeStage) ? state.activeStage : "source";
    const allToolIds = getToolRegistry().map(function (entry) {
      return entry.toolId;
    });
    const currentStageToolIds = getStageToolIds(stageId);
    const otherToolIds = allToolIds.filter(function (toolId) {
      return currentStageToolIds.includes(toolId) === false;
    });

    return `
      <div class="lab-overlay" role="dialog" aria-modal="true" aria-label="${escapeHtml(
        featureText(["settings", "title"])
      )}">
        <div class="lab-overlay__scrim" data-action="close-settings"></div>
        <section class="lab-overlay__panel">
          <header class="lab-overlay__header">
            <div>
              <p class="lab-panel__eyebrow">${escapeHtml(featureText(["settings", "eyebrow"]))}</p>
              <h2 class="lab-panel__title">${escapeHtml(featureText(["settings", "title"]))}</h2>
              <p class="lab-panel__subtitle">${escapeHtml(
                `${featureText(["settings", "subtitle"])} ${featureText(["stages", stageId])}`
              )}</p>
            </div>
            <div class="lab-overlay__actions">
              <button class="lab-button lab-button--ghost lab-button--tight" type="button" data-action="tools-refresh">
                ${escapeHtml(text(["mediaAnalysis", "settings", "refreshAction"]))}
              </button>
              <button class="lab-button lab-button--ghost lab-button--tight" type="button" data-action="close-settings">
                ${escapeHtml(text(["mediaAnalysis", "settings", "closeAction"]))}
              </button>
            </div>
          </header>
          <section class="lab-panel">
            <div class="lab-panel__header">
              <div>
                <p class="lab-panel__eyebrow">${escapeHtml(featureText(["settings", "currentStageTitle"]))}</p>
                <h2 class="lab-panel__title">${escapeHtml(featureText(["stages", stageId]))}</h2>
              </div>
            </div>
            <div class="lab-tool-grid">
              ${
                currentStageToolIds.length > 0
                  ? currentStageToolIds
                      .map(function (toolId) {
                        return renderToolCard(toolId, stageId);
                      })
                      .join("")
                  : `<p class="lab-panel__hint">${escapeHtml(
                      text(["mediaAnalysis", "settings", "noStageTools"])
                    )}</p>`
              }
            </div>
          </section>
          ${
            otherToolIds.length > 0
              ? `
                <section class="lab-panel">
                  <div class="lab-panel__header">
                    <div>
                      <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "settings", "otherToolsTitle"]))}</p>
                      <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "settings", "otherToolsSubtitle"]))}</h2>
                    </div>
                  </div>
                  <div class="lab-tool-grid">
                    ${otherToolIds
                      .map(function (toolId) {
                        return renderToolCard(toolId, stageId);
                      })
                      .join("")}
                  </div>
                </section>
              `
              : ""
          }
          ${isAudioAnalysisFeature() ? renderAudioAnalysisProviderPanel() : ""}
          ${
            stageId === "profile" && getProfileModelEntries().length > 0
              ? `
                <section class="lab-panel">
                  <div class="lab-panel__header">
                    <div>
                      <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "profile", "modelTitle"]))}</p>
                      <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "profile", "modelSubtitle"]))}</h2>
                    </div>
                  </div>
                  <div class="lab-tool-grid">
                    ${getProfileModelEntries()
                      .map(function (entry) {
                        return renderProfileModelCard(entry);
                      })
                      .join("")}
                  </div>
                </section>
              `
              : ""
          }
        </section>
      </div>
    `;
  }

  function getSelectedProfileModelId() {
    const selectedModel = getProfileSelectedModel();
    return selectedModel && typeof selectedModel.modelId === "string" ? selectedModel.modelId : null;
  }

  return {
    getSelectedProfileModelId: getSelectedProfileModelId,
    renderToolCard: renderToolCard,
    renderProfileModelCard: renderProfileModelCard,
    renderSettingsOverlay: renderSettingsOverlay,
  };
}
