export function createAudioAnalysisCatalogRuntime(deps: any) {
  const escapeHtml = deps.escapeHtml;
  const text = deps.text;
  const textFromKey = deps.textFromKey;
  const featureText = deps.featureText;
  const getAudioAnalysisModules = deps.getAudioAnalysisModules;
  const getAudioAnalysisCapabilities = deps.getAudioAnalysisCapabilities;
  const getAudioAnalysisProviderEntries = deps.getAudioAnalysisProviderEntries;

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
            .map(function (entry: any) {
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
              capabilityNotes.length > 0
                ? capabilityNotes.join(" + ")
                : featureText(["settings", "title"])
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

  return {
    renderAudioAnalysisCatalogPanel,
    renderAudioAnalysisNoticePanel,
  };
}
