export function createAudioAnalysisUi(deps) {
  const toRecord = deps.toRecord;
  const escapeHtml = deps.escapeHtml;
  const text = deps.text;
  const textFromKey = deps.textFromKey;
  const featureText = deps.featureText;
  const formatStatusLabel = deps.formatStatusLabel;
  const renderSummaryRows = deps.renderSummaryRows;
  const getToolDisplayName = deps.getToolDisplayName;
  const getAudioAnalysisModules = deps.getAudioAnalysisModules;
  const getAudioAnalysisCapabilities = deps.getAudioAnalysisCapabilities;
  const getAudioAnalysisProviderEntries = deps.getAudioAnalysisProviderEntries;
  const getAudioAnalysisProviderState = deps.getAudioAnalysisProviderState;
  const getAudioAnalysisOrderedResultEntries = deps.getAudioAnalysisOrderedResultEntries;

  function renderAudioAnalysisCatalogPanel() {
    const modules = getAudioAnalysisModules();
    if (modules.length === 0) {
      return "";
    }

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(featureText(["catalog", "eyebrow"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(featureText(["catalog", "title"]))}</h2>
            <p class="lab-panel__subtitle">${escapeHtml(featureText(["catalog", "subtitle"]))}</p>
          </div>
        </div>
        <div class="lab-tool-grid">
          ${modules
            .map(function (entry) {
              const status = typeof entry.status === "string" ? entry.status : "planned";
              const statusLabel =
                status === "implemented"
                  ? featureText(["catalog", "status", "implemented"])
                  : status === "gated"
                    ? featureText(["catalog", "status", "gated"])
                    : featureText(["catalog", "status", "planned"]);
              return `
                <article class="lab-tool-card">
                  <div class="lab-tool-card__head">
                    <div>
                      <strong>${escapeHtml(textFromKey(entry.titleKey || "") || entry.id || "--")}</strong>
                      <span>${escapeHtml(statusLabel)}</span>
                    </div>
                    <span class="lab-chip">${escapeHtml(String(entry.phase || "--").toUpperCase())}</span>
                  </div>
                  <p class="lab-panel__hint">${escapeHtml(textFromKey(entry.summaryKey || "") || "")}</p>
                </article>
              `;
            })
            .join("")}
        </div>
      </section>
    `;
  }

  function renderAudioAnalysisNoticePanel() {
    const providerCount = getAudioAnalysisProviderEntries().length;
    const capabilities = getAudioAnalysisCapabilities();
    const capabilityNotes = [];
    if (capabilities.sharedSettingsOverlay === true) {
      capabilityNotes.push(featureText(["settings", "title"]));
    }
    if (capabilities.sharedToolRegistry === true) {
      capabilityNotes.push(text(["mediaAnalysis", "settings", "otherToolsTitle"]));
    }

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(featureText(["shared", "toolingEyebrow"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(featureText(["shared", "toolingTitle"]))}</h2>
          </div>
        </div>
        <p class="lab-panel__hint">${escapeHtml(featureText(["shared", "toolingBody"]))}</p>
        <ul class="lab-meta-list">
          <li>
            <span>${escapeHtml(text(["mediaAnalysis", "shared", "status"]))}</span>
            <strong>${escapeHtml(
              capabilityNotes.length > 0 ? capabilityNotes.join(" + ") : featureText(["settings", "title"])
            )}</strong>
          </li>
          <li>
            <span>${escapeHtml(text(["mediaAnalysis", "report", "findingsTitle"]))}</span>
            <strong>${escapeHtml(String(providerCount))}</strong>
          </li>
        </ul>
      </section>
    `;
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

  function renderAudioAnalysisResultCard(moduleEntry) {
    const metrics = Array.isArray(moduleEntry.metrics) ? moduleEntry.metrics.map(toRecord) : [];
    const providerLabels = Array.isArray(moduleEntry.providerIds)
      ? moduleEntry.providerIds
          .map(function (providerId) {
            return getAudioAnalysisProviderLabel(providerId);
          })
          .filter(Boolean)
      : [];

    return `
      <article class="lab-tool-card">
        <div class="lab-tool-card__head">
          <div>
            <strong>${escapeHtml(getAudioAnalysisModuleTitle(moduleEntry))}</strong>
            <span>${escapeHtml(formatStatusLabel(moduleEntry.status || "planned"))}</span>
          </div>
          <span class="lab-chip">${escapeHtml(String(moduleEntry.phase || "v1").toUpperCase())}</span>
        </div>
        <p class="lab-panel__hint">${escapeHtml(getAudioAnalysisModuleSummary(moduleEntry))}</p>
        <ul class="lab-meta-list">
          <li>
            <span>${escapeHtml(featureText(["report", "moduleMeta", "phase"]))}</span>
            <strong>${escapeHtml(String(moduleEntry.phase || "v1").toUpperCase())}</strong>
          </li>
          <li>
            <span>${escapeHtml(featureText(["report", "moduleMeta", "confidence"]))}</span>
            <strong>${escapeHtml(moduleEntry.confidence ? formatStatusLabel(moduleEntry.confidence) : "--")}</strong>
          </li>
          <li>
            <span>${escapeHtml(featureText(["report", "moduleMeta", "providers"]))}</span>
            <strong>${escapeHtml(providerLabels.length > 0 ? providerLabels.join(", ") : "--")}</strong>
          </li>
          <li>
            <span>${escapeHtml(featureText(["report", "moduleMeta", "signals"]))}</span>
            <strong>${escapeHtml(String(moduleEntry.signals.length))}</strong>
          </li>
          <li>
            <span>${escapeHtml(featureText(["report", "moduleMeta", "artifacts"]))}</span>
            <strong>${escapeHtml(String(moduleEntry.artifacts.length))}</strong>
          </li>
        </ul>
        ${
          metrics.length > 0
            ? `
              <div class="lab-list-block">
                <strong>${escapeHtml(featureText(["report", "moduleMeta", "metrics"]))}</strong>
                <ul class="lab-bullet-list">
                  ${metrics
                    .slice(0, 4)
                    .map(function (metric) {
                      return `<li>${escapeHtml(
                        `${metric.label || textFromKey(metric.labelKey || "") || metric.id || "--"}: ${
                          metric.value || "--"
                        }`
                      )}</li>`;
                    })
                    .join("")}
                </ul>
              </div>
            `
            : ""
        }
        ${
          Array.isArray(moduleEntry.blockers) && moduleEntry.blockers.length > 0
            ? `
              <div class="lab-list-block">
                <strong>${escapeHtml(featureText(["report", "moduleMeta", "blockers"]))}</strong>
                <ul class="lab-bullet-list">
                  ${moduleEntry.blockers
                    .slice(0, 3)
                    .map(function (entry) {
                      return `<li>${escapeHtml(entry)}</li>`;
                    })
                    .join("")}
                </ul>
              </div>
            `
            : ""
        }
        ${
          Array.isArray(moduleEntry.warnings) && moduleEntry.warnings.length > 0
            ? `
              <div class="lab-list-block">
                <strong>${escapeHtml(featureText(["report", "moduleMeta", "warnings"]))}</strong>
                <ul class="lab-bullet-list">
                  ${moduleEntry.warnings
                    .slice(0, 3)
                    .map(function (entry) {
                      return `<li>${escapeHtml(entry)}</li>`;
                    })
                    .join("")}
                </ul>
              </div>
            `
            : ""
        }
      </article>
    `;
  }

  function renderAudioAnalysisModuleGrid() {
    const moduleEntries = getAudioAnalysisOrderedResultEntries();
    if (moduleEntries.length === 0) {
      return "";
    }

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(featureText(["report", "moduleRollupEyebrow"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(featureText(["report", "moduleRollupTitle"]))}</h2>
            <p class="lab-panel__subtitle">${escapeHtml(featureText(["report", "moduleRollupSubtitle"]))}</p>
          </div>
        </div>
        <div class="lab-tool-grid">
          ${moduleEntries
            .map(function (moduleEntry) {
              return renderAudioAnalysisResultCard(moduleEntry);
            })
            .join("")}
        </div>
      </section>
    `;
  }

  return {
    renderAudioAnalysisCatalogPanel,
    renderAudioAnalysisNoticePanel,
    getAudioAnalysisProviderStatusLabel,
    renderAudioAnalysisProviderPanel,
    getAudioAnalysisProviderLabel,
    getAudioAnalysisModuleTitle,
    getAudioAnalysisModuleSummary,
    renderAudioAnalysisResultCard,
    renderAudioAnalysisModuleGrid,
  };
}
