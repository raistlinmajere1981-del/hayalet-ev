export function createLaboratoryShellFrameUi(deps) {
  const {
    bootstrapText,
    escapeHtml,
    featureText,
    getActiveFeatureId,
    getActiveStage,
    getStageGuard,
    getStageIndex,
    getTranslations,
    isSubtitleAnalysisFeature,
    readValue,
    stageOrder,
    subtitleText,
    text,
    toRecord
  } = deps;
  function toStageCopyRecord(value) {
    return toRecord(value);
  }
  function readStageCopyText(value, fallback) {
    return typeof value === "string" && value.trim() !== "" ? value : fallback;
  }
  function getFeatureLabel(featureId) {
    return text(["features", featureId]) || featureId;
  }
  function renderRailSummaryRow(label, value, valueClassName = "") {
    return `
      <div class="lab-stage-rail__summary-row">
        <span>${escapeHtml(label)}</span>
        <strong class="${escapeHtml(valueClassName)}">${escapeHtml(value)}</strong>
      </div>
    `;
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
    const activeModuleLabel = getFeatureLabel(activeFeatureId);
    const nextStageId = stageOrder.at(Math.min(stageOrder.length - 1, currentIndex + 1)) || null;
    const nextStageGuard = nextStageId && nextStageId !== activeStage ? getStageGuard(nextStageId) : null;
    const nextDisabled = currentIndex === stageOrder.length - 1 || nextStageGuard && nextStageGuard.allowed !== true;
    const nextReason = nextStageGuard && typeof nextStageGuard.reason === "string" ? nextStageGuard.reason : "";
    return `
      <section class="lab-topbar">
        <div class="lab-stage-rail">
          <div class="lab-stage-rail__brand">
            <p class="lab-panel__eyebrow">${escapeHtml(text(["workbench", "eyebrow"]))}</p>
            <h1 class="lab-stage-rail__title">${escapeHtml(text(["workbench", "title"]))}</h1>
          </div>
          <section class="lab-stage-rail__context" hidden>
            <div class="lab-stage-rail__summary">
              ${renderRailSummaryRow(
      text(["workbench", "railStepCount"]),
      `${String(currentIndex + 1)} / ${String(stageOrder.length)}`
    )}
            </div>
            <span class="lab-stage-rail__focus-label" hidden>${escapeHtml(activeModuleLabel)}</span>
          </section>
          <div
            class="lab-stage-rail__track"
            aria-label="${escapeHtml(text(["workbench", "railJourneyLabel"]))}"
          >
            ${stageOrder.map(function(stageId, index) {
      const stageGuard = getStageGuard(stageId);
      const futureStageBlocked = index > currentIndex && stageGuard.allowed !== true && stageId !== activeStage;
      const stateName = stageId === activeStage ? "active" : index < currentIndex ? "complete" : futureStageBlocked ? "blocked" : "idle";
      const stageReason = typeof stageGuard.reason === "string" && stageGuard.reason.trim() !== "" ? `title="${escapeHtml(stageGuard.reason)}"` : "";
      return `
                  <article
                    class="lab-stage-pill"
                    data-state="${stateName}"
                    ${stageReason}
                  >
                    <span class="lab-stage-pill__index">${String(index + 1)}</span>
                    <span class="lab-stage-pill__label">${escapeHtml(
        featureText(["stages", stageId])
      )}</span>
                  </article>
                `;
    }).join("")}
          </div>
          <div class="lab-stage-rail__footer">
            <div class="lab-stage-nav-group">
              <button
                class="lab-stage-nav"
                type="button"
                data-action="open-settings"
              >
                ${escapeHtml(text(["workbench", "dependencyAction"]))}
              </button>
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
                ${nextDisabled ? "disabled" : ""}
                ${nextReason ? `title="${escapeHtml(nextReason)}"` : ""}
              >
                ${escapeHtml(featureText(["stageNav", "next"]))}
              </button>
            </div>
          </div>
        </div>
      </section>
    `;
  }
  function renderStageIntro(stageId) {
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
    renderStageRail
  };
}
