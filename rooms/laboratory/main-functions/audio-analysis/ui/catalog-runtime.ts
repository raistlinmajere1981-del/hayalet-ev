type LaboratoryRecord = Record<string, unknown>;

type LaboratoryAudioCatalogModuleRecord = LaboratoryRecord & {
  id?: unknown;
  phase?: unknown;
  status?: unknown;
  summaryKey?: unknown;
  titleKey?: unknown;
};

type LaboratoryAudioCapabilitiesRecord = LaboratoryRecord & {
  sharedSettingsOverlay?: unknown;
  sharedToolRegistry?: unknown;
};

type AudioAnalysisCatalogRuntimeDeps = {
  escapeHtml: (value: string) => string;
  featureText: (path: string[]) => string;
  getAudioAnalysisCapabilities: () => unknown;
  getAudioAnalysisModules: () => unknown;
  getAudioAnalysisProviderEntries: () => unknown;
  text: (path: string[]) => string;
  textFromKey: (key: string) => string;
  toRecord?: (value: unknown) => LaboratoryRecord;
};

export function createAudioAnalysisCatalogRuntime(deps: AudioAnalysisCatalogRuntimeDeps) {
  const {
    escapeHtml,
    featureText,
    getAudioAnalysisCapabilities,
    getAudioAnalysisModules,
    getAudioAnalysisProviderEntries,
    text,
    textFromKey,
  } = deps;

  function toRecord(value: unknown): LaboratoryRecord {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }
    return value as LaboratoryRecord;
  }

  function toCatalogModuleRecord(value: unknown): LaboratoryAudioCatalogModuleRecord {
    return toRecord(value);
  }

  function toCapabilitiesRecord(value: unknown): LaboratoryAudioCapabilitiesRecord {
    return toRecord(value);
  }

  function toString(value: unknown, fallback = ""): string {
    return typeof value === "string" ? value : fallback;
  }

  function getModules(): LaboratoryAudioCatalogModuleRecord[] {
    const modules = getAudioAnalysisModules();
    return Array.isArray(modules) ? modules.map(toCatalogModuleRecord) : [];
  }

  function renderAudioAnalysisCatalogPanel() {
    const modules = getModules();
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
              const status = toString(entry.status, "planned");
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
                      <strong>${escapeHtml(textFromKey(toString(entry.titleKey)) || toString(entry.id) || "--")}</strong>
                      <span>${escapeHtml(statusLabel)}</span>
                    </div>
                    <span class="lab-chip">${escapeHtml(toString(entry.phase, "--").toUpperCase())}</span>
                  </div>
                  <p class="lab-panel__hint">${escapeHtml(textFromKey(toString(entry.summaryKey)) || "")}</p>
                </article>
              `;
            })
            .join("")}
        </div>
      </section>
    `;
  }

  function renderAudioAnalysisNoticePanel() {
    const providerEntries = getAudioAnalysisProviderEntries();
    const providerCount = Array.isArray(providerEntries) ? providerEntries.length : 0;
    const capabilities = toCapabilitiesRecord(getAudioAnalysisCapabilities());
    const capabilityNotes: string[] = [];
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
