export function createAudioAnalysisResultRuntime(deps) {
  const toRecord = deps.toRecord;
  const escapeHtml = deps.escapeHtml;
  const textFromKey = deps.textFromKey;
  const featureText = deps.featureText;
  const formatStatusLabel = deps.formatStatusLabel;
  const getAudioAnalysisOrderedResultEntries = deps.getAudioAnalysisOrderedResultEntries;
  const getAudioAnalysisProviderLabel = deps.getAudioAnalysisProviderLabel;
  const getAudioAnalysisModuleTitle = deps.getAudioAnalysisModuleTitle;
  const getAudioAnalysisModuleSummary = deps.getAudioAnalysisModuleSummary;
  function renderAudioAnalysisResultCard(moduleEntry) {
    const metrics = Array.isArray(moduleEntry.metrics) ? moduleEntry.metrics.map(toRecord) : [];
    const providerLabels = Array.isArray(moduleEntry.providerIds) ? moduleEntry.providerIds.map(function(providerId) {
      return getAudioAnalysisProviderLabel(providerId);
    }).filter(Boolean) : [];
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
        ${metrics.length > 0 ? `
              <div class="lab-list-block">
                <strong>${escapeHtml(featureText(["report", "moduleMeta", "metrics"]))}</strong>
                <ul class="lab-bullet-list">
                  ${metrics.slice(0, 4).map(function(metric) {
      return `<li>${escapeHtml(
        `${metric.label || textFromKey(metric.labelKey || "") || metric.id || "--"}: ${metric.value || "--"}`
      )}</li>`;
    }).join("")}
                </ul>
              </div>
            ` : ""}
        ${Array.isArray(moduleEntry.blockers) && moduleEntry.blockers.length > 0 ? `
              <div class="lab-list-block">
                <strong>${escapeHtml(featureText(["report", "moduleMeta", "blockers"]))}</strong>
                <ul class="lab-bullet-list">
                  ${moduleEntry.blockers.slice(0, 3).map(function(entry) {
      return `<li>${escapeHtml(entry)}</li>`;
    }).join("")}
                </ul>
              </div>
            ` : ""}
        ${Array.isArray(moduleEntry.warnings) && moduleEntry.warnings.length > 0 ? `
              <div class="lab-list-block">
                <strong>${escapeHtml(featureText(["report", "moduleMeta", "warnings"]))}</strong>
                <ul class="lab-bullet-list">
                  ${moduleEntry.warnings.slice(0, 3).map(function(entry) {
      return `<li>${escapeHtml(entry)}</li>`;
    }).join("")}
                </ul>
              </div>
            ` : ""}
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
