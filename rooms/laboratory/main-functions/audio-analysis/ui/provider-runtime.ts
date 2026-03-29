// @ts-nocheck
export function createAudioAnalysisProviderRuntime(deps) {
  const toRecord = deps.toRecord;
  const escapeHtml = deps.escapeHtml;
  const text = deps.text;
  const textFromKey = deps.textFromKey;
  const featureText = deps.featureText;
  const formatStatusLabel = deps.formatStatusLabel;
  const renderSummaryRows = deps.renderSummaryRows;
  const getToolDisplayName = deps.getToolDisplayName;
  const getAudioAnalysisProviderEntries = deps.getAudioAnalysisProviderEntries;
  const getAudioAnalysisProviderState = deps.getAudioAnalysisProviderState;
  const getAudioAnalysisOrderedResultEntries = deps.getAudioAnalysisOrderedResultEntries;

  function getAudioAnalysisProviderStatusLabel(status) {
    const token = typeof status === "string" ? status : "gated";
    if (token === "ready") {
      return text(["mediaAnalysis", "settings", "status", "ready"]);
    }
    if (token === "planned") {
      return featureText(["catalog", "status", "planned"]);
    }
    if (token === "gated") {
      return featureText(["catalog", "status", "gated"]);
    }
    return formatStatusLabel(token);
  }

  function getAudioAnalysisProviderLabel(providerId) {
    const descriptor =
      getAudioAnalysisProviderEntries().find(function (entry) {
        return entry.id === providerId;
      }) || null;
    const providerState = toRecord(getAudioAnalysisProviderState()[providerId]);
    const title = textFromKey((descriptor && descriptor.titleKey) || "") || providerId || "--";
    const suffix =
      typeof providerState.status === "string" && providerState.status.trim() !== ""
        ? ` (${formatStatusLabel(providerState.status)})`
        : "";
    return `${title}${suffix}`;
  }

  function getAudioAnalysisModuleTitle(moduleEntry) {
    return textFromKey(moduleEntry.titleKey || "") || moduleEntry.moduleId || "--";
  }

  function getAudioAnalysisModuleSummary(moduleEntry) {
    if (typeof moduleEntry.summary === "string" && moduleEntry.summary.trim() !== "") {
      return moduleEntry.summary;
    }
    return textFromKey(moduleEntry.summaryKey || "") || featureText(["report", "emptyBody"]);
  }

  function renderAudioAnalysisProviderPanel() {
    const providers = getAudioAnalysisProviderEntries();
    const providerStateMap = getAudioAnalysisProviderState();
    if (providers.length === 0) {
      return "";
    }

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(featureText(["settings", "providersEyebrow"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(featureText(["settings", "providersTitle"]))}</h2>
            <p class="lab-panel__subtitle">${escapeHtml(featureText(["settings", "providersSubtitle"]))}</p>
          </div>
        </div>
        <div class="lab-tool-grid">
          ${providers
            .map(function (entry) {
              const providerState = toRecord(providerStateMap[entry.id]);
              const status =
                (typeof providerState.status === "string" && providerState.status.trim() !== ""
                  ? providerState.status
                  : typeof entry.status === "string"
                    ? entry.status
                    : "gated");
              const moduleIds = Array.isArray(providerState.moduleIds)
                ? providerState.moduleIds
                : Array.isArray(entry.moduleIds)
                  ? entry.moduleIds
                  : [];
              const moduleLabels = moduleIds
                .map(function (moduleId) {
                  return getAudioAnalysisModuleTitle(
                    getAudioAnalysisOrderedResultEntries().find(function (moduleEntry) {
                      return moduleEntry.moduleId === moduleId;
                    }) || { moduleId: moduleId }
                  );
                })
                .filter(Boolean);
              const expectedArtifacts = Array.isArray(providerState.expectedArtifacts)
                ? providerState.expectedArtifacts
                : Array.isArray(entry.expectedArtifacts)
                  ? entry.expectedArtifacts
                  : [];
              const fallbackProviderIds = Array.isArray(providerState.fallbackProviderIds)
                ? providerState.fallbackProviderIds
                : Array.isArray(entry.fallbackProviderIds)
                  ? entry.fallbackProviderIds
                  : [];
              const toolDisplayName = getToolDisplayName(providerState.toolId || entry.toolId || "planned");

              return `
                <article class="lab-tool-card">
                  <div class="lab-tool-card__head">
                    <div>
                      <strong>${escapeHtml(textFromKey(entry.titleKey || "") || entry.id || "--")}</strong>
                      <span>${escapeHtml(getAudioAnalysisProviderStatusLabel(status))}</span>
                    </div>
                    <span class="lab-chip">${escapeHtml(toolDisplayName)}</span>
                  </div>
                  <p class="lab-panel__hint">${escapeHtml(textFromKey(entry.summaryKey || "") || "")}</p>
                  ${renderSummaryRows([
                    [
                      featureText(["settings", "providerMeta", "type"]),
                      providerState.providerType || entry.providerType || "--",
                    ],
                    [
                      featureText(["settings", "providerMeta", "install"]),
                      providerState.installStrategy || entry.installStrategy || "--",
                    ],
                    [
                      featureText(["settings", "providerMeta", "modules"]),
                      moduleLabels.length > 0 ? moduleLabels.join(", ") : "--",
                    ],
                    [
                      featureText(["settings", "providerMeta", "artifacts"]),
                      expectedArtifacts.length > 0 ? expectedArtifacts.join(", ") : "--",
                    ],
                    [
                      featureText(["settings", "providerMeta", "version"]),
                      providerState.version || "--",
                    ],
                    [
                      featureText(["settings", "providerMeta", "model"]),
                      providerState.modelId || "--",
                    ],
                    [
                      featureText(["settings", "providerMeta", "platform"]),
                      providerState.platformSupported === false
                        ? featureText(["settings", "providerMetaValues", "limited"])
                        : featureText(["settings", "providerMetaValues", "supported"]),
                    ],
                    [
                      featureText(["settings", "providerMeta", "fallbacks"]),
                      fallbackProviderIds.length > 0
                        ? fallbackProviderIds
                            .map(function (providerId) {
                              return getAudioAnalysisProviderLabel(providerId);
                            })
                            .join(", ")
                        : "--",
                    ],
                  ])}
                  ${
                    Array.isArray(providerState.blockers) && providerState.blockers.length > 0
                      ? `
                        <div class="lab-list-block">
                          <strong>${escapeHtml(featureText(["report", "moduleMeta", "blockers"]))}</strong>
                          <ul class="lab-bullet-list">
                            ${providerState.blockers
                              .slice(0, 3)
                              .map(function (item) {
                                return `<li>${escapeHtml(item)}</li>`;
                              })
                              .join("")}
                          </ul>
                        </div>
                      `
                      : ""
                  }
                  ${
                    Array.isArray(providerState.warnings) && providerState.warnings.length > 0
                      ? `
                        <div class="lab-list-block">
                          <strong>${escapeHtml(featureText(["report", "moduleMeta", "warnings"]))}</strong>
                          <ul class="lab-bullet-list">
                            ${providerState.warnings
                              .slice(0, 3)
                              .map(function (item) {
                                return `<li>${escapeHtml(item)}</li>`;
                              })
                              .join("")}
                          </ul>
                        </div>
                      `
                      : ""
                  }
                  ${
                    typeof providerState.lastError === "string" && providerState.lastError.trim() !== ""
                      ? `<p class="lab-panel__hint lab-panel__hint--danger">${escapeHtml(providerState.lastError)}</p>`
                      : ""
                  }
                </article>
              `;
            })
            .join("")}
        </div>
      </section>
    `;
  }

  return {
    getAudioAnalysisModuleSummary,
    getAudioAnalysisModuleTitle,
    getAudioAnalysisProviderLabel,
    getAudioAnalysisProviderStatusLabel,
    renderAudioAnalysisProviderPanel,
  };
}
