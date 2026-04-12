type LaboratoryRecord = Record<string, unknown>;

type LaboratoryStageCopyRecord = LaboratoryRecord & {
  subtitle?: unknown;
  title?: unknown;
};

type LaboratoryWorkbenchRecord = LaboratoryRecord & {
  activeModuleId?: unknown;
  availableModuleIds?: unknown;
};

type LaboratoryShellFrameUiDeps = {
  bootstrapText: (key: string) => string;
  escapeHtml: (value: string) => string;
  featureText: (path: string[]) => string;
  getActiveFeatureId: () => string;
  getActiveStage: () => string;
  getStageIndex: (stageId: string) => number;
  getTranslations: () => LaboratoryRecord;
  getWorkbench: () => LaboratoryWorkbenchRecord;
  isSubtitleAnalysisFeature: () => boolean;
  readValue: (source: unknown, path: readonly (string | number)[]) => unknown;
  stageOrder: string[];
  subtitleText: (path: string[], tr?: string, en?: string) => string;
  text: (path: string[]) => string;
  toRecord: (value: unknown) => LaboratoryRecord;
};

export function createLaboratoryShellFrameUi(deps: LaboratoryShellFrameUiDeps) {
  const {
    bootstrapText,
    escapeHtml,
    featureText,
    getActiveFeatureId,
    getActiveStage,
    getStageIndex,
    getTranslations,
    getWorkbench,
    isSubtitleAnalysisFeature,
    readValue,
    stageOrder,
    subtitleText,
    text,
    toRecord,
  } = deps;

  function toStageCopyRecord(value: unknown): LaboratoryStageCopyRecord {
    return toRecord(value);
  }

  function toWorkbenchRecord(value: unknown): LaboratoryWorkbenchRecord {
    return toRecord(value);
  }

  function readStageCopyText(value: unknown, fallback: string): string {
    return typeof value === "string" && value.trim() !== "" ? value : fallback;
  }

  function getFeatureLabel(featureId: string): string {
    return text(["features", featureId]) || featureId;
  }

  function getModuleSummary(featureId: string): string {
    const summary = readValue(getTranslations(), ["workbench", "modules", featureId, "summary"]);
    if (typeof summary === "string" && summary.trim() !== "") {
      return summary;
    }
    return featureId === "audio-analysis"
      ? subtitleText([], "Ses odakli tarama", "Audio-first analysis")
      : featureId === "subtitle-analysis"
        ? subtitleText([], "Altyazi kaynaklari ve QC", "Subtitle intake and QC")
        : subtitleText([], "Kaynak, edit ve profil akisi", "Source, edit, and profile flow");
  }

  function renderBootstrap() {
    return `
      <section class="lab-bootstrap">
        <div class="lab-bootstrap__panel">
          <h1 class="lab-bootstrap__title">${escapeHtml(bootstrapText("loadingTitle"))}</h1>
          <p class="lab-bootstrap__body">${escapeHtml(bootstrapText("loadingBody"))}</p>
        </div>
      </section>
    `;
  }

  function renderStageRail() {
    const activeStage = getActiveStage();
    const activeFeatureId = getActiveFeatureId();
    const currentIndex = getStageIndex(activeStage);
    const workbench = toWorkbenchRecord(getWorkbench());
    const selectedModuleIds = Array.isArray(workbench["selectedModuleIds"])
      ? workbench["selectedModuleIds"].filter(function (entry): entry is string {
          return typeof entry === "string" && entry.trim() !== "";
        })
      : [activeFeatureId];
    const selectedModuleMarkup =
      selectedModuleIds.length > 0
        ? selectedModuleIds
            .map(function (featureId) {
              return `<span class="lab-chip">${escapeHtml(getFeatureLabel(featureId))}</span>`;
            })
            .join("")
        : `<span class="lab-panel__hint">${escapeHtml(text(["workbench", "selectedModulesEmpty"]))}</span>`;

    return `
      <section class="lab-topbar">
        <div class="lab-stage-rail">
          <div class="lab-stage-rail__brand">
            <p class="lab-panel__eyebrow">${escapeHtml(text(["workbench", "eyebrow"]))}</p>
            <h1 class="lab-stage-rail__title">${escapeHtml(text(["workbench", "title"]))}</h1>
            <p class="lab-stage-rail__subtitle">${escapeHtml(text(["workbench", "subtitle"]))}</p>
          </div>
          <section class="lab-panel lab-panel--dense">
            <div class="lab-panel__header">
              <div>
                <p class="lab-panel__eyebrow">${escapeHtml(text(["workbench", "moduleRailLabel"]))}</p>
                <h2 class="lab-panel__title">${escapeHtml(getFeatureLabel(activeFeatureId))}</h2>
              </div>
            </div>
            <p class="lab-panel__hint">${escapeHtml(getModuleSummary(activeFeatureId))}</p>
            <div class="lab-list-block">
              <strong>${escapeHtml(text(["workbench", "selectedModulesTitle"]))}</strong>
              <div class="lab-chip-row">${selectedModuleMarkup}</div>
            </div>
          </section>
          <div class="lab-stage-rail__track" aria-label="Journey">
            ${stageOrder
              .map(function (stageId, index) {
                const stateName =
                  stageId === activeStage ? "active" : index < currentIndex ? "complete" : "idle";
                return `
                  <article
                    class="lab-stage-pill"
                    data-state="${stateName}"
                  >
                    <span class="lab-stage-pill__index">${String(index + 1)}</span>
                    <span class="lab-stage-pill__label">${escapeHtml(
                      featureText(["stages", stageId])
                    )}</span>
                  </article>
                `;
              })
              .join("")}
          </div>
          <div class="lab-stage-rail__footer">
            <button
              class="lab-rail-action"
              type="button"
              data-action="open-settings"
              aria-label="${escapeHtml(text(["workbench", "dependencyAction"]))}"
            >
              <span class="lab-rail-action__icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M10.4 2h3.2l.6 2.6a7.8 7.8 0 0 1 1.8.8L18.4 4l2.2 2.2-1.4 2.4c.3.6.6 1.2.8 1.8L22 11.2v3.2l-2.6.6a7.8 7.8 0 0 1-.8 1.8l1.4 2.4-2.2 2.2-2.4-1.4a7.8 7.8 0 0 1-1.8.8L13.6 22h-3.2l-.6-2.6a7.8 7.8 0 0 1-1.8-.8L5.6 20 3.4 17.8l1.4-2.4a7.8 7.8 0 0 1-.8-1.8L2 13.6v-3.2l2.6-.6a7.8 7.8 0 0 1 .8-1.8L4 5.6 6.2 3.4l2.4 1.4a7.8 7.8 0 0 1 1.8-.8L10.4 2Zm1.6 6a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"></path>
                </svg>
              </span>
              <span>${escapeHtml(text(["workbench", "dependencyAction"]))}</span>
            </button>
            <div class="lab-stage-nav-group">
              <button
                class="lab-stage-nav"
                type="button"
                data-action="nav-previous"
                ${currentIndex === 0 ? "disabled" : ""}
              >
                ${escapeHtml(featureText(["stageNav", "previous"]))}
              </button>
              <button
                class="lab-stage-nav"
                type="button"
                data-action="nav-next"
                ${currentIndex === stageOrder.length - 1 ? "disabled" : ""}
              >
                ${escapeHtml(featureText(["stageNav", "next"]))}
              </button>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function renderStageIntro(stageId: string) {
    const workbenchStageCopy = toStageCopyRecord(
      readValue(getTranslations(), ["workbench", "stages", stageId])
    );
    if (Object.keys(workbenchStageCopy).length > 0) {
      return `
        <section class="lab-stage-copy">
          <h1 class="lab-stage-copy__title">${escapeHtml(
            readStageCopyText(workbenchStageCopy.title, featureText([stageId, "title"]))
          )}</h1>
          <p class="lab-stage-copy__subtitle">${escapeHtml(
            readStageCopyText(workbenchStageCopy.subtitle, featureText([stageId, "subtitle"]))
          )}</p>
        </section>
      `;
    }

    if (isSubtitleAnalysisFeature()) {
      const copy = toStageCopyRecord(
        readValue(getTranslations(), ["subtitleAnalysis", "stages", stageId])
      );
      return `
        <section class="lab-stage-copy">
          <h1 class="lab-stage-copy__title">${escapeHtml(
            readStageCopyText(
              copy.title,
              subtitleText(["labels", "subtitle"], "Altyazi", "Subtitle")
            )
          )}</h1>
          <p class="lab-stage-copy__subtitle">${escapeHtml(readStageCopyText(copy.subtitle, ""))}</p>
        </section>
      `;
    }

    return `
      <section class="lab-stage-copy">
        <h1 class="lab-stage-copy__title">${escapeHtml(featureText([stageId, "title"]))}</h1>
        <p class="lab-stage-copy__subtitle">${escapeHtml(featureText([stageId, "subtitle"]))}</p>
      </section>
    `;
  }

  return {
    renderBootstrap,
    renderStageIntro,
    renderStageRail,
  };
}
