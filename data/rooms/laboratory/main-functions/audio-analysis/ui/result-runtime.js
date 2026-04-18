export function createAudioAnalysisResultRuntime(deps) {
  const {
    escapeHtml,
    featureText,
    formatStatusLabel,
    getAudioAnalysisModuleSummary,
    getAudioAnalysisModuleTitle,
    getAudioAnalysisOrderedResultEntries,
    getAudioAnalysisProviderLabel,
    textFromKey,
    toRecord
  } = deps;
  function toMetricRecord(value) {
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
  function getOrderedResultEntries() {
    const entries = getAudioAnalysisOrderedResultEntries();
    return Array.isArray(entries) ? entries.map(toModuleResultRecord) : [];
  }
  function renderAudioAnalysisResultCard(moduleEntry) {
    const metrics = Array.isArray(moduleEntry.metrics) ? moduleEntry.metrics.map(toMetricRecord) : [];
    const providerLabels = toStringArray(moduleEntry.providerIds).map(function(providerId) {
      return getAudioAnalysisProviderLabel(providerId);
    }).filter(Boolean);
    const signalCount = Array.isArray(moduleEntry.signals) ? moduleEntry.signals.length : 0;
    const artifactCount = Array.isArray(moduleEntry.artifacts) ? moduleEntry.artifacts.length : 0;
    const blockers = toStringArray(moduleEntry.blockers).slice(0, 3);
    const warnings = toStringArray(moduleEntry.warnings).slice(0, 3);
    const phaseLabel = toString(moduleEntry.phase, "v1").toUpperCase();
    const statusLabel = formatStatusLabel(toString(moduleEntry.status, "planned"));
    return `
      <article class="lab-tool-card">
        <div class="lab-tool-card__head">
          <div>
            <strong>${escapeHtml(getAudioAnalysisModuleTitle(moduleEntry))}</strong>
            <span>${escapeHtml(statusLabel)}</span>
          </div>
          <span class="lab-chip">${escapeHtml(phaseLabel)}</span>
        </div>
        <p class="lab-panel__hint">${escapeHtml(getAudioAnalysisModuleSummary(moduleEntry))}</p>
        <ul class="lab-meta-list">
          <li>
            <span>${escapeHtml(featureText(["report", "moduleMeta", "phase"]))}</span>
            <strong>${escapeHtml(phaseLabel)}</strong>
          </li>
          <li>
            <span>${escapeHtml(featureText(["report", "moduleMeta", "confidence"]))}</span>
            <strong>${escapeHtml(
      toString(moduleEntry.confidence) !== "" ? formatStatusLabel(moduleEntry.confidence) : "--"
    )}</strong>
          </li>
          <li>
            <span>${escapeHtml(featureText(["report", "moduleMeta", "providers"]))}</span>
            <strong>${escapeHtml(providerLabels.length > 0 ? providerLabels.join(", ") : "--")}</strong>
          </li>
          <li>
            <span>${escapeHtml(featureText(["report", "moduleMeta", "signals"]))}</span>
            <strong>${escapeHtml(String(signalCount))}</strong>
          </li>
          <li>
            <span>${escapeHtml(featureText(["report", "moduleMeta", "artifacts"]))}</span>
            <strong>${escapeHtml(String(artifactCount))}</strong>
          </li>
        </ul>
        ${metrics.length > 0 ? `
              <div class="lab-list-block">
                <strong>${escapeHtml(featureText(["report", "moduleMeta", "metrics"]))}</strong>
                <ul class="lab-bullet-list">
                  ${metrics.slice(0, 4).map(function(metric) {
      const label = toString(metric.label) || textFromKey(toString(metric.labelKey)) || toString(metric.id) || "--";
      return `<li>${escapeHtml(`${label}: ${toString(metric.value, "--")}`)}</li>`;
    }).join("")}
                </ul>
              </div>
            ` : ""}
        ${blockers.length > 0 ? `
              <div class="lab-list-block">
                <strong>${escapeHtml(featureText(["report", "moduleMeta", "blockers"]))}</strong>
                <ul class="lab-bullet-list">
                  ${blockers.map(function(entry) {
      return `<li>${escapeHtml(entry)}</li>`;
    }).join("")}
                </ul>
              </div>
            ` : ""}
        ${warnings.length > 0 ? `
              <div class="lab-list-block">
                <strong>${escapeHtml(featureText(["report", "moduleMeta", "warnings"]))}</strong>
                <ul class="lab-bullet-list">
                  ${warnings.map(function(entry) {
      return `<li>${escapeHtml(entry)}</li>`;
    }).join("")}
                </ul>
              </div>
            ` : ""}
      </article>
    `;
  }
  function renderAudioAnalysisModuleGrid() {
    const moduleEntries = getOrderedResultEntries();
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
          ${moduleEntries.map(function(moduleEntry) {
      return renderAudioAnalysisResultCard(moduleEntry);
    }).join("")}
        </div>
      </section>
    `;
  }
  return {
    renderAudioAnalysisModuleGrid,
    renderAudioAnalysisResultCard
  };
}
