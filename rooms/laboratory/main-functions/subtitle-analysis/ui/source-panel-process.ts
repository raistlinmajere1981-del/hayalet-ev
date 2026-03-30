type LaboratoryRecord = Record<string, unknown>;

type LaboratorySubtitleAnalysisCatalogRecord = LaboratoryRecord & {
  modules?: unknown;
};

type LaboratorySubtitleAnalysisProvidersRecord = LaboratoryRecord & {
  providers?: unknown;
};

type LaboratorySubtitleProcessModuleRecord = LaboratoryRecord & {
  status?: unknown;
};

type LaboratorySubtitleProviderRecord = LaboratoryRecord & {
  status?: unknown;
};

type SubtitleAnalysisSourceProcessPanelsDeps = {
  escapeHtml: (value: string) => string;
  getSubtitleAnalysisCatalog: () => LaboratorySubtitleAnalysisCatalogRecord;
  getSubtitleAnalysisProviders: () => LaboratorySubtitleAnalysisProvidersRecord;
  getSubtitleProcessModuleLabel: (entry: LaboratorySubtitleProcessModuleRecord) => string;
  getSubtitleProcessModuleSummary: (entry: LaboratorySubtitleProcessModuleRecord) => string;
  getSubtitleProcessStatusLabel: (status: unknown) => string;
  getSubtitleProviderLabel: (entry: LaboratorySubtitleProviderRecord) => string;
  getSubtitleProviderModuleLabels: (entry: LaboratorySubtitleProviderRecord) => string;
  getSubtitleProviderStatusLabel: (status: unknown) => string;
  getSubtitleProviderSummary: (entry: LaboratorySubtitleProviderRecord) => string;
  subtitleText: (path: string[], tr: string, en: string) => string;
  toRecord: (value: unknown) => LaboratoryRecord;
};

export function createSubtitleAnalysisSourceProcessPanels(
  deps: SubtitleAnalysisSourceProcessPanelsDeps
) {
  const toRecord = deps.toRecord;
  const escapeHtml = deps.escapeHtml;
  const subtitleText = deps.subtitleText;
  const getSubtitleAnalysisCatalog = deps.getSubtitleAnalysisCatalog;
  const getSubtitleAnalysisProviders = deps.getSubtitleAnalysisProviders;
  const getSubtitleProcessStatusLabel = deps.getSubtitleProcessStatusLabel;
  const getSubtitleProcessModuleSummary = deps.getSubtitleProcessModuleSummary;
  const getSubtitleProcessModuleLabel = deps.getSubtitleProcessModuleLabel;
  const getSubtitleProviderStatusLabel = deps.getSubtitleProviderStatusLabel;
  const getSubtitleProviderSummary = deps.getSubtitleProviderSummary;
  const getSubtitleProviderLabel = deps.getSubtitleProviderLabel;
  const getSubtitleProviderModuleLabels = deps.getSubtitleProviderModuleLabels;

  function toProcessModuleRecord(value: unknown): LaboratorySubtitleProcessModuleRecord {
    return toRecord(value);
  }

  function toProviderRecord(value: unknown): LaboratorySubtitleProviderRecord {
    return toRecord(value);
  }

  function getCatalogModules(): LaboratorySubtitleProcessModuleRecord[] {
    const modules = getSubtitleAnalysisCatalog().modules;
    return Array.isArray(modules) ? modules.map(toProcessModuleRecord) : [];
  }

  function getProviderEntries(): LaboratorySubtitleProviderRecord[] {
    const providers = getSubtitleAnalysisProviders().providers;
    return Array.isArray(providers) ? providers.map(toProviderRecord) : [];
  }

  function renderSubtitleCatalogPanel() {
    const modules = getCatalogModules();
    if (modules.length === 0) {
      return "";
    }

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(subtitleText(["process", "catalog", "eyebrow"], "Analiz Plani", "Analysis Plan"))}</p>
            <h2 class="lab-panel__title">${escapeHtml(subtitleText(["process", "catalog", "title"], "Ilk Modul Seti", "Initial Module Set"))}</h2>
            <p class="lab-panel__subtitle">${escapeHtml(
              subtitleText(
                ["process", "catalog", "subtitle"],
                "QC, okunabilirlik, zamanlama ve batch ozet modulleri burada gorunur.",
                "QC, readability, timing, and batch summary modules live here."
              )
            )}</p>
          </div>
        </div>
        <div class="lab-tool-grid">
          ${modules
            .map(function (entry) {
              const statusLabel = getSubtitleProcessStatusLabel(entry.status || "planned");
              const summary = getSubtitleProcessModuleSummary(entry);
              return `
                <article class="lab-tool-card">
                  <div class="lab-tool-card__head">
                    <div>
                      <strong>${escapeHtml(getSubtitleProcessModuleLabel(entry))}</strong>
                      <span>${escapeHtml(statusLabel)}</span>
                    </div>
                    <span class="lab-chip">${escapeHtml(statusLabel)}</span>
                  </div>
                  ${summary ? `<p class="lab-panel__hint">${escapeHtml(summary)}</p>` : ""}
                </article>
              `;
            })
            .join("")}
        </div>
      </section>
    `;
  }

  function renderSubtitleProviderPanel() {
    const providers = getProviderEntries();
    if (providers.length === 0) {
      return "";
    }

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(subtitleText(["process", "providers", "eyebrow"], "Saglayicilar", "Providers"))}</p>
            <h2 class="lab-panel__title">${escapeHtml(subtitleText(["process", "providers", "title"], "Calisma Katmani", "Execution Layer"))}</h2>
          </div>
        </div>
        <div class="lab-tool-grid">
          ${providers
            .map(function (entry) {
              const statusLabel = getSubtitleProviderStatusLabel(entry.status || "planned");
              const providerSummary = getSubtitleProviderSummary(entry);
              const moduleSummary = getSubtitleProviderModuleLabels(entry);
              return `
                <article class="lab-tool-card">
                  <div class="lab-tool-card__head">
                    <div>
                      <strong>${escapeHtml(getSubtitleProviderLabel(entry))}</strong>
                      <span>${escapeHtml(statusLabel)}</span>
                    </div>
                  </div>
                  ${providerSummary ? `<p class="lab-panel__hint">${escapeHtml(providerSummary)}</p>` : ""}
                  <p class="lab-panel__hint">${escapeHtml(moduleSummary)}</p>
                </article>
              `;
            })
            .join("")}
        </div>
      </section>
    `;
  }

  return {
    renderSubtitleCatalogPanel,
    renderSubtitleProviderPanel,
  };
}
