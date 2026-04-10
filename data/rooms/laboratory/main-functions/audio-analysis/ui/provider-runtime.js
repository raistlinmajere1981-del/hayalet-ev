export function createAudioAnalysisProviderRuntime(deps) {
  const {
    escapeHtml,
    featureText,
    formatStatusLabel,
    getAudioAnalysisOrderedResultEntries,
    getAudioAnalysisProviderEntries,
    getAudioAnalysisProviderState,
    getToolDisplayName,
    renderSummaryRows,
    text,
    textFromKey,
    toRecord
  } = deps;
  function toProviderEntryRecord(value) {
    return toRecord(value);
  }
  function toProviderStateRecord(value) {
    return toRecord(value);
  }
  function toModuleResultRecord(value) {
    return toRecord(value);
  }
  function toString(value, fallback = "") {
    return typeof value === "string" ? value : fallback;
  }
  function toStringArray(value) {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map(function(entry) {
      return typeof entry === "string" && entry.trim() !== "" ? entry : null;
    }).filter((entry) => entry !== null);
  }
  function getProviderEntries() {
    const providers = getAudioAnalysisProviderEntries();
    return Array.isArray(providers) ? providers.map(toProviderEntryRecord) : [];
  }
  function getProviderStateMap() {
    return toRecord(getAudioAnalysisProviderState());
  }
  function getOrderedResultEntries() {
    const entries = getAudioAnalysisOrderedResultEntries();
    return Array.isArray(entries) ? entries.map(toModuleResultRecord) : [];
  }
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
    const descriptor = getProviderEntries().find(function(entry) {
      return toString(entry.id) === providerId;
    }) || null;
    const providerState = toProviderStateRecord(getProviderStateMap()[providerId]);
    const title = textFromKey(toString(descriptor?.titleKey)) || providerId || "--";
    const suffix = toString(providerState.status) !== "" ? ` (${formatStatusLabel(toString(providerState.status))})` : "";
    return `${title}${suffix}`;
  }
  function getAudioAnalysisModuleTitle(moduleEntry) {
    return textFromKey(toString(moduleEntry.titleKey)) || toString(moduleEntry.moduleId) || "--";
  }
  function getAudioAnalysisModuleSummary(moduleEntry) {
    if (toString(moduleEntry.summary) !== "") {
      return toString(moduleEntry.summary);
    }
    return textFromKey(toString(moduleEntry.summaryKey)) || featureText(["report", "emptyBody"]);
  }
  function renderAudioAnalysisProviderPanel() {
    const providers = getProviderEntries();
    const providerStateMap = getProviderStateMap();
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
          ${providers.map(function(entry) {
      const providerId = toString(entry.id);
      const providerState = toProviderStateRecord(providerStateMap[providerId]);
      const status = toString(providerState.status) || toString(entry.status, "gated");
      const moduleIds = toStringArray(providerState.moduleIds).length > 0 ? toStringArray(providerState.moduleIds) : toStringArray(entry.moduleIds);
      const moduleLabels = moduleIds.map(function(moduleId) {
        const moduleEntry = getOrderedResultEntries().find(function(resultEntry) {
          return toString(resultEntry.moduleId) === moduleId;
        }) || { moduleId };
        return getAudioAnalysisModuleTitle(toModuleResultRecord(moduleEntry));
      }).filter(Boolean);
      const expectedArtifacts = toStringArray(providerState.expectedArtifacts).length > 0 ? toStringArray(providerState.expectedArtifacts) : toStringArray(entry.expectedArtifacts);
      const fallbackProviderIds = toStringArray(providerState.fallbackProviderIds).length > 0 ? toStringArray(providerState.fallbackProviderIds) : toStringArray(entry.fallbackProviderIds);
      const toolDisplayName = getToolDisplayName(
        toString(providerState.toolId) || toString(entry.toolId, "planned")
      );
      const blockers = toStringArray(providerState.blockers).slice(0, 3);
      const warnings = toStringArray(providerState.warnings).slice(0, 3);
      return `
                <article class="lab-tool-card">
                  <div class="lab-tool-card__head">
                    <div>
                      <strong>${escapeHtml(textFromKey(toString(entry.titleKey)) || providerId || "--")}</strong>
                      <span>${escapeHtml(getAudioAnalysisProviderStatusLabel(status))}</span>
                    </div>
                    <span class="lab-chip">${escapeHtml(toolDisplayName)}</span>
                  </div>
                  <p class="lab-panel__hint">${escapeHtml(textFromKey(toString(entry.summaryKey)) || "")}</p>
                  ${renderSummaryRows([
        [
          featureText(["settings", "providerMeta", "type"]),
          toString(providerState.providerType) || toString(entry.providerType) || "--"
        ],
        [
          featureText(["settings", "providerMeta", "install"]),
          toString(providerState.installStrategy) || toString(entry.installStrategy) || "--"
        ],
        [
          featureText(["settings", "providerMeta", "modules"]),
          moduleLabels.length > 0 ? moduleLabels.join(", ") : "--"
        ],
        [
          featureText(["settings", "providerMeta", "artifacts"]),
          expectedArtifacts.length > 0 ? expectedArtifacts.join(", ") : "--"
        ],
        [
          featureText(["settings", "providerMeta", "version"]),
          toString(providerState.version) || "--"
        ],
        [
          featureText(["settings", "providerMeta", "model"]),
          toString(providerState.modelId) || "--"
        ],
        [
          featureText(["settings", "providerMeta", "platform"]),
          providerState.platformSupported === false ? featureText(["settings", "providerMetaValues", "limited"]) : featureText(["settings", "providerMetaValues", "supported"])
        ],
        [
          featureText(["settings", "providerMeta", "fallbacks"]),
          fallbackProviderIds.length > 0 ? fallbackProviderIds.map(function(fallbackProviderId) {
            return getAudioAnalysisProviderLabel(fallbackProviderId);
          }).join(", ") : "--"
        ]
      ])}
                  ${blockers.length > 0 ? `
                        <div class="lab-list-block">
                          <strong>${escapeHtml(featureText(["report", "moduleMeta", "blockers"]))}</strong>
                          <ul class="lab-bullet-list">
                            ${blockers.map(function(item) {
        return `<li>${escapeHtml(item)}</li>`;
      }).join("")}
                          </ul>
                        </div>
                      ` : ""}
                  ${warnings.length > 0 ? `
                        <div class="lab-list-block">
                          <strong>${escapeHtml(featureText(["report", "moduleMeta", "warnings"]))}</strong>
                          <ul class="lab-bullet-list">
                            ${warnings.map(function(item) {
        return `<li>${escapeHtml(item)}</li>`;
      }).join("")}
                          </ul>
                        </div>
                      ` : ""}
                  ${toString(providerState.lastError) !== "" ? `<p class="lab-panel__hint lab-panel__hint--danger">${escapeHtml(toString(providerState.lastError))}</p>` : ""}
                </article>
              `;
    }).join("")}
        </div>
      </section>
    `;
  }
  return {
    getAudioAnalysisModuleSummary,
    getAudioAnalysisModuleTitle,
    getAudioAnalysisProviderLabel,
    getAudioAnalysisProviderStatusLabel,
    renderAudioAnalysisProviderPanel
  };
}
