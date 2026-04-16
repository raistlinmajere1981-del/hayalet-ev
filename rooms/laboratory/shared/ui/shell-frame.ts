type LaboratoryRecord = Record<string, unknown>;

type LaboratoryStageCopyRecord = LaboratoryRecord & {
  subtitle?: unknown;
  title?: unknown;
};

type LaboratoryBootstrapStateRecord = LaboratoryRecord & {
  active?: unknown;
  currentStep?: unknown;
  currentStepId?: unknown;
  error?: unknown;
  message?: unknown;
  readyToDismiss?: unknown;
  status?: unknown;
  steps?: unknown;
  totalSteps?: unknown;
};

type LaboratoryBootstrapStepRecord = LaboratoryRecord & {
  id?: unknown;
  status?: unknown;
  visible?: unknown;
};

type LaboratoryShellFrameUiDeps = {
  bootstrapText: (key: string) => string;
  escapeHtml: (value: string) => string;
  featureText: (path: string[]) => string;
  getActiveFeatureId: () => string;
  getActiveStage: () => string;
  getBootstrapState: () => LaboratoryRecord;
  getStageGuard: (stageId: string) => {
    allowed: boolean;
    detail?: string | null;
    reason?: string | null;
  };
  getStageIndex: (stageId: string) => number;
  getTranslations: () => LaboratoryRecord;
  getWorkbench: () => LaboratoryRecord;
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
    getActiveStage,
    getBootstrapState,
    getStageGuard,
    getStageIndex,
    getTranslations,
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

  function readStageCopyText(value: unknown, fallback: string): string {
    return typeof value === "string" && value.trim() !== "" ? value : fallback;
  }

  function toBootstrapStateRecord(value: unknown): LaboratoryBootstrapStateRecord {
    return toRecord(value);
  }

  function toBootstrapStepRecord(value: unknown): LaboratoryBootstrapStepRecord {
    return toRecord(value);
  }

  function renderRailSummaryRow(label: string, value: string, valueClassName = "") {
    const summaryClassName =
      valueClassName.trim() !== "" ? ` class="${escapeHtml(valueClassName)}"` : "";
    return `
      <div class="lab-stage-rail__summary-row lab-stage-rail__summary-row--progress">
        <strong${summaryClassName}>${escapeHtml(`${label} ${value}`)}</strong>
      </div>
    `;
  }

  function renderStageCopy(title: string, subtitle: string) {
    const trimmedSubtitle = subtitle.trim();
    return `
      <section class="lab-stage-copy">
        <h1 class="lab-stage-copy__title">${escapeHtml(title)}</h1>
        ${
          trimmedSubtitle !== ""
            ? `<p class="lab-stage-copy__subtitle">${escapeHtml(trimmedSubtitle)}</p>`
            : ""
        }
      </section>
    `;
  }

  function renderBootstrap() {
    const bootstrap = toBootstrapStateRecord(getBootstrapState());
    const steps = Array.isArray(bootstrap.steps) ? bootstrap.steps.map(toBootstrapStepRecord) : [];
    const currentStepId =
      typeof bootstrap.currentStepId === "string" && bootstrap.currentStepId.trim() !== ""
        ? bootstrap.currentStepId.trim()
        : null;
    const currentStep =
      typeof bootstrap.currentStep === "number" && Number.isFinite(bootstrap.currentStep)
        ? bootstrap.currentStep
        : 0;
    const totalSteps =
      typeof bootstrap.totalSteps === "number" && Number.isFinite(bootstrap.totalSteps)
        ? bootstrap.totalSteps
        : steps.length;
    const status =
      typeof bootstrap.status === "string" && bootstrap.status.trim() !== ""
        ? bootstrap.status.trim()
        : "idle";
    const error =
      typeof bootstrap.error === "string" && bootstrap.error.trim() !== ""
        ? bootstrap.error.trim()
        : null;
    const effectiveSteps =
      steps.length > 0
        ? steps
        : [
            {
              id: "resolve-paths",
              status: currentStepId === "resolve-paths" ? "active" : "pending",
              visible: currentStepId === "resolve-paths",
            },
            {
              id: "load-config",
              status: currentStepId === "load-config" ? "active" : "pending",
              visible: currentStepId === "load-config",
            },
            {
              id: "load-tool-state",
              status: currentStepId === "load-tool-state" ? "active" : "pending",
              visible: currentStepId === "load-tool-state",
            },
            {
              id: "load-profile-model-state",
              status: currentStepId === "load-profile-model-state" ? "active" : "pending",
              visible: currentStepId === "load-profile-model-state",
            },
            {
              id: "load-projects",
              status: currentStepId === "load-projects" ? "active" : "pending",
              visible: currentStepId === "load-projects",
            },
            {
              id: "ensure-project",
              status: currentStepId === "ensure-project" ? "active" : "pending",
              visible: currentStepId === "ensure-project",
            },
            {
              id: "refresh-tools",
              status: currentStepId === "refresh-tools" ? "active" : "pending",
              visible: currentStepId === "refresh-tools",
            },
            {
              id: "refresh-profile-models",
              status: currentStepId === "refresh-profile-models" ? "active" : "pending",
              visible: currentStepId === "refresh-profile-models",
            },
          ];
    const visibleSteps = effectiveSteps.filter(function (step) {
      return step.visible === true;
    });
    const progressValue =
      totalSteps > 0 && currentStep > 0
        ? `${String(currentStep)} / ${String(totalSteps)}`
        : bootstrapText("loadingProgressPending");
    const progressPercent =
      totalSteps > 0
        ? Math.max(8, Math.min(100, Math.round((Math.max(0, currentStep) / totalSteps) * 100)))
        : 12;
    const currentStepLabel = (() => {
      if (status === "ready") {
        return bootstrapText("loadingReadyLabel");
      }
      if (status === "error") {
        return bootstrapText("loadingErrorLabel");
      }
      if (currentStepId === null) {
        return bootstrapText("loadingProgressPending");
      }
      return bootstrapText(`bootstrapStep.${currentStepId}`);
    })();
    const detailText =
      error ||
      (status === "ready"
        ? bootstrapText("loadingReadyBody")
        : status === "error"
          ? bootstrapText("loadingErrorBody")
          : bootstrapText("loadingBody"));

    return `
      <section class="lab-bootstrap" data-status="${escapeHtml(status)}">
        <div class="lab-bootstrap__shell">
          <div class="lab-bootstrap__brand">
            <p class="lab-bootstrap__eyebrow">${escapeHtml(bootstrapText("loadingEyebrow"))}</p>
            <strong class="lab-bootstrap__progress-pill">${escapeHtml(progressValue)}</strong>
          </div>
          <h1 class="lab-bootstrap__title">${escapeHtml(bootstrapText("loadingTitle"))}</h1>
          <p class="lab-bootstrap__body">${escapeHtml(detailText)}</p>
          <div class="lab-bootstrap__loader" aria-hidden="true">
            <span
              class="lab-bootstrap__loader-bar"
              style="width: ${escapeHtml(`${String(progressPercent)}%`)}"
            ></span>
          </div>
          <div class="lab-bootstrap__meta">
            <div class="lab-bootstrap__progress">
              <span class="lab-bootstrap__progress-label">${escapeHtml(
                bootstrapText("loadingProgressLabel")
              )}</span>
              <strong class="lab-bootstrap__progress-value">${escapeHtml(progressValue)}</strong>
            </div>
            <div class="lab-bootstrap__current">
              <span class="lab-bootstrap__current-label">${escapeHtml(
                bootstrapText("loadingCurrentStepLabel")
              )}</span>
              <strong class="lab-bootstrap__current-value">${escapeHtml(currentStepLabel)}</strong>
            </div>
          </div>
          <div class="lab-bootstrap__steps" aria-label="${escapeHtml(
            bootstrapText("loadingTimelineLabel")
          )}">
            ${
              visibleSteps.length > 0
                ? visibleSteps
                    .map(function (step) {
                      const stepId =
                        typeof step.id === "string" && step.id.trim() !== ""
                          ? step.id.trim()
                          : "unknown";
                      const stepStatus =
                        typeof step.status === "string" && step.status.trim() !== ""
                          ? step.status.trim()
                          : "pending";
                      return `
                        <article class="lab-bootstrap__step" data-status="${escapeHtml(stepStatus)}">
                          <span class="lab-bootstrap__step-dot" aria-hidden="true"></span>
                          <span class="lab-bootstrap__step-label">${escapeHtml(
                            bootstrapText(`bootstrapStep.${stepId}`)
                          )}</span>
                        </article>
                      `;
                    })
                    .join("")
                : `<article class="lab-bootstrap__step lab-bootstrap__step--placeholder" data-status="pending">
                    <span class="lab-bootstrap__step-dot" aria-hidden="true"></span>
                    <span class="lab-bootstrap__step-label">${escapeHtml(
                      bootstrapText("loadingTimelinePending")
                    )}</span>
                  </article>`
            }
          </div>
          <div class="lab-bootstrap__footer">
            <span class="lab-bootstrap__current-label">${escapeHtml(
              bootstrapText("loadingFooterLabel")
            )}</span>
            <strong class="lab-bootstrap__footer-value">${escapeHtml(currentStepLabel)}</strong>
          </div>
        </div>
      </section>
    `;
  }

  function renderStageRail() {
    const activeStage = getActiveStage();
    const currentIndex = getStageIndex(activeStage);
    const nextStageId = stageOrder.at(Math.min(stageOrder.length - 1, currentIndex + 1)) || null;
    const nextStageGuard =
      nextStageId && nextStageId !== activeStage ? getStageGuard(nextStageId) : null;
    const nextDisabled =
      currentIndex === stageOrder.length - 1 || (nextStageGuard && nextStageGuard.allowed !== true);
    const nextReason =
      nextStageGuard && typeof nextStageGuard.reason === "string" ? nextStageGuard.reason : "";
    return `
      <section class="lab-topbar">
        <div class="lab-stage-rail">
          <div class="lab-stage-rail__brand">
            <h1 class="lab-stage-rail__title">${escapeHtml(text(["title"]))}</h1>
          </div>
          <section class="lab-stage-rail__context">
            <div class="lab-stage-rail__summary">
              ${renderRailSummaryRow(
                text(["workbench", "railStepCount"]),
                `${String(currentIndex + 1)} / ${String(stageOrder.length)}`
              )}
            </div>
          </section>
          <div
            class="lab-stage-rail__track"
            aria-label="${escapeHtml(text(["workbench", "railJourneyLabel"]))}"
          >
            ${stageOrder
              .map(function (stageId, index) {
                const stageGuard = getStageGuard(stageId);
                const futureStageBlocked =
                  index > currentIndex && stageGuard.allowed !== true && stageId !== activeStage;
                const stateName =
                  stageId === activeStage
                    ? "active"
                    : index < currentIndex
                      ? "complete"
                      : futureStageBlocked
                        ? "blocked"
                        : "idle";
                const stageReason =
                  typeof stageGuard.reason === "string" && stageGuard.reason.trim() !== ""
                    ? `title="${escapeHtml(stageGuard.reason)}"`
                    : "";
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
              })
              .join("")}
          </div>
          <div class="lab-stage-rail__footer">
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

  function renderStageIntro(stageId: string) {
    const workbenchStageCopy = toStageCopyRecord(
      readValue(getTranslations(), ["workbench", "stages", stageId])
    );
    if (Object.keys(workbenchStageCopy).length > 0) {
      return renderStageCopy(
        readStageCopyText(workbenchStageCopy.title, featureText([stageId, "title"])),
        readStageCopyText(workbenchStageCopy.subtitle, featureText([stageId, "subtitle"]))
      );
    }

    if (isSubtitleAnalysisFeature()) {
      const copy = toStageCopyRecord(
        readValue(getTranslations(), ["subtitleAnalysis", "stages", stageId])
      );
      return renderStageCopy(
        readStageCopyText(copy.title, subtitleText(["labels", "subtitle"], "Altyazi", "Subtitle")),
        readStageCopyText(copy.subtitle, "")
      );
    }

    return renderStageCopy(featureText([stageId, "title"]), featureText([stageId, "subtitle"]));
  }

  return {
    renderBootstrap,
    renderStageIntro,
    renderStageRail,
  };
}
