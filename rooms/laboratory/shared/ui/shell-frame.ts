// @ts-nocheck
export function createLaboratoryShellFrameUi(deps) {
  const {
    bootstrapText,
    escapeHtml,
    featureText,
    getActiveStage,
    getStageIndex,
    getTranslations,
    isSubtitleAnalysisFeature,
    readValue,
    stageOrder,
    subtitleText,
    toRecord,
  } = deps;

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
    const currentIndex = getStageIndex(activeStage);

    return `
      <header class="lab-topbar">
        <div class="lab-stage-rail">
          <button
            class="lab-stage-nav"
            type="button"
            data-action="nav-previous"
            ${currentIndex === 0 ? "disabled" : ""}
          >
            ${escapeHtml(featureText(["stageNav", "previous"]))}
          </button>
          <div class="lab-stage-rail__track" role="tablist" aria-label="Stages">
            ${stageOrder
              .map(function (stageId, index) {
                const stateName =
                  stageId === activeStage ? "active" : index < currentIndex ? "complete" : "idle";
                return `
                  <button
                    class="lab-stage-pill"
                    type="button"
                    role="tab"
                    aria-selected="${stageId === activeStage ? "true" : "false"}"
                    data-stage-target="${stageId}"
                    data-state="${stateName}"
                  >
                    <span class="lab-stage-pill__index">${String(index + 1)}</span>
                    <span class="lab-stage-pill__label">${escapeHtml(
                      featureText(["stages", stageId])
                    )}</span>
                  </button>
                `;
              })
              .join("")}
          </div>
          <button
            class="lab-stage-nav"
            type="button"
            data-action="nav-next"
            ${currentIndex === stageOrder.length - 1 ? "disabled" : ""}
          >
            ${escapeHtml(featureText(["stageNav", "next"]))}
          </button>
          <button
            class="lab-rail-icon"
            type="button"
            data-action="open-settings"
            aria-label="${escapeHtml(featureText(["settings", "title"]))}"
            title="${escapeHtml(featureText(["settings", "title"]))}"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10.4 2h3.2l.6 2.6a7.8 7.8 0 0 1 1.8.8L18.4 4l2.2 2.2-1.4 2.4c.3.6.6 1.2.8 1.8L22 11.2v3.2l-2.6.6a7.8 7.8 0 0 1-.8 1.8l1.4 2.4-2.2 2.2-2.4-1.4a7.8 7.8 0 0 1-1.8.8L13.6 22h-3.2l-.6-2.6a7.8 7.8 0 0 1-1.8-.8L5.6 20 3.4 17.8l1.4-2.4a7.8 7.8 0 0 1-.8-1.8L2 13.6v-3.2l2.6-.6a7.8 7.8 0 0 1 .8-1.8L4 5.6 6.2 3.4l2.4 1.4a7.8 7.8 0 0 1 1.8-.8L10.4 2Zm1.6 6a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"></path>
            </svg>
          </button>
        </div>
      </header>
    `;
  }

  function renderStageIntro(stageId) {
    if (isSubtitleAnalysisFeature()) {
      const copy = toRecord(readValue(getTranslations(), ["subtitleAnalysis", "stages", stageId]));
      return `
        <section class="lab-stage-copy">
          <h1 class="lab-stage-copy__title">${escapeHtml(
            copy.title || subtitleText(["labels", "subtitle"], "Altyazi", "Subtitle")
          )}</h1>
          <p class="lab-stage-copy__subtitle">${escapeHtml(copy.subtitle || "")}</p>
        </section>
      `;
    }

    return `
      <section class="lab-stage-copy">
        <h1 class="lab-stage-copy__title">${escapeHtml(featureText([stageId, "title"]))}</h1>
        <p class="lab-stage-copy__subtitle">${escapeHtml(
          featureText([stageId, "subtitle"])
        )}</p>
      </section>
    `;
  }

  return {
    renderBootstrap,
    renderStageIntro,
    renderStageRail,
  };
}
