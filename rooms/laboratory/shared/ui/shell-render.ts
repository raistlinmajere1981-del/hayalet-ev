import type {
  LaboratoryShellEventLogItem,
  LaboratoryShellStatusChannel,
  LaboratoryStageSurface,
} from "../types/room-shell-contracts.js";

type LaboratoryStageRenderers = {
  renderEditStage: () => LaboratoryStageSurface;
  renderProcessStage: () => LaboratoryStageSurface;
  renderProfileStage: () => LaboratoryStageSurface;
  renderReportStage: () => LaboratoryStageSurface;
  renderSourceStage: () => LaboratoryStageSurface;
};

type LaboratoryShellRenderDeps = {
  activeStage: string;
  escapeHtml: (value: string) => string;
  eventLog: LaboratoryShellEventLogItem[];
  eventLogOpen: boolean;
  locale: string;
  renderSettingsOverlay: () => string;
  renderStageRail: () => string;
  stageSurface: LaboratoryStageSurface;
  status: {
    activity: LaboratoryShellStatusChannel;
    blocking: LaboratoryShellStatusChannel;
    result: LaboratoryShellStatusChannel;
  };
  text: (path: string[]) => string;
};

type LaboratoryShellRegions = {
  eventLogMarkup: string;
  eventLogOpen: boolean;
  inspectorClassName: string;
  inspectorMarkup: string;
  overlayMarkup: string;
  railMarkup: string;
  stageHasInspector: boolean;
  stageMainClassName: string;
  stageMainMarkup: string;
  statusMarkup: string;
};

function formatSourceLabel(
  source: LaboratoryShellStatusChannel["source"],
  text: (path: string[]) => string
): string {
  switch (source) {
    case "host":
      return text(["workbench", "statusLine", "sourceLabels", "host"]);
    case "request":
      return text(["workbench", "statusLine", "sourceLabels", "request"]);
    case "ui":
      return text(["workbench", "statusLine", "sourceLabels", "ui"]);
    case "system":
    default:
      return text(["workbench", "statusLine", "sourceLabels", "system"]);
  }
}

function renderStatusChannel(
  tone: "activity" | "blocking" | "result",
  channel: LaboratoryShellStatusChannel,
  deps: Pick<LaboratoryShellRenderDeps, "escapeHtml" | "text">
): string {
  if (channel.visible !== true || channel.message.trim() === "") {
    return "";
  }

  const labelKey =
    tone === "blocking" ? "blockingLabel" : tone === "activity" ? "activityLabel" : "resultLabel";
  const liveRole = tone === "blocking" ? "alert" : "status";
  const liveMode = tone === "blocking" ? "assertive" : "polite";
  const detailMarkup =
    typeof channel.detail === "string" && channel.detail.trim() !== ""
      ? `
          <span class="lab-status-line__detail-separator" aria-hidden="true">/</span>
          <span class="lab-status-line__detail">${deps.escapeHtml(channel.detail)}</span>
        `
      : "";

  return `
    <article
      class="lab-status-line__card"
      data-tone="${tone}"
      role="${liveRole}"
      aria-live="${liveMode}"
      aria-atomic="true"
    >
      <div class="lab-status-line__row">
        <div class="lab-status-line__summary">
          <span class="lab-status-line__label">${deps.escapeHtml(
            deps.text(["workbench", "statusLine", labelKey])
          )}</span>
          <span class="lab-status-line__text">
            <strong class="lab-status-line__message">${deps.escapeHtml(channel.message)}</strong>
            ${detailMarkup}
          </span>
        </div>
        <span class="lab-status-line__source">${deps.escapeHtml(
          formatSourceLabel(channel.source, deps.text)
        )}</span>
      </div>
    </article>
  `;
}

function getPrimaryStatusTone(
  status: LaboratoryShellRenderDeps["status"]
): "activity" | "result" | null {
  if (status.result.visible === true && status.result.message.trim() !== "") {
    return "result";
  }

  if (status.activity.visible === true && status.activity.message.trim() !== "") {
    return "activity";
  }

  return null;
}

function renderEventLog(
  deps: Pick<
    LaboratoryShellRenderDeps,
    "escapeHtml" | "eventLog" | "eventLogOpen" | "locale" | "text"
  >
): string {
  if (deps.eventLogOpen !== true) {
    return "";
  }

  const entries = deps.eventLog.slice(0, 24);
  return `
    <section
      class="lab-event-log"
      role="region"
      aria-labelledby="lab-event-log-title"
    >
      <div class="lab-event-log__head">
        <div>
          <p class="lab-panel__eyebrow">${deps.escapeHtml(
            deps.text(["workbench", "statusLine", "eventLogEyebrow"])
          )}</p>
          <h2 class="lab-panel__title" id="lab-event-log-title">${deps.escapeHtml(
            deps.text(["workbench", "statusLine", "eventLogTitle"])
          )}</h2>
        </div>
      </div>
      <div
        class="lab-event-log__list"
        id="lab-event-log-list"
        aria-hidden="false"
      >
        ${
          entries.length > 0
            ? entries
                .map(function (entry) {
                  const timeLabel = new Date(entry.timestamp).toLocaleTimeString(
                    deps.locale.toLowerCase().startsWith("tr") ? "tr-TR" : "en-US",
                    {
                      hour: "2-digit",
                      minute: "2-digit",
                    }
                  );
                  return `
                    <article class="lab-event-log__entry" data-tone="${entry.tone}">
                      <div class="lab-event-log__summary">
                        <strong>${deps.escapeHtml(entry.message)}</strong>
                        <span>${deps.escapeHtml(timeLabel)}</span>
                      </div>
                      <p class="lab-event-log__meta">${deps.escapeHtml(
                        `${formatSourceLabel(entry.source, deps.text)} / ${entry.tone}`
                      )}</p>
                      ${
                        entry.detail
                          ? `<p class="lab-event-log__detail">${deps.escapeHtml(entry.detail)}</p>`
                          : ""
                      }
                    </article>
                  `;
                })
                .join("")
            : `<p class="lab-panel__hint">${deps.escapeHtml(
                deps.text(["workbench", "statusLine", "eventLogEmpty"])
              )}</p>`
        }
      </div>
    </section>
  `;
}

export function renderLaboratoryStageContent(
  activeStage: string,
  renderers: LaboratoryStageRenderers
): LaboratoryStageSurface {
  switch (activeStage) {
    case "edit":
      return renderers.renderEditStage();
    case "profile":
      return renderers.renderProfileStage();
    case "process":
      return renderers.renderProcessStage();
    case "report":
      return renderers.renderReportStage();
    case "source":
    default:
      return renderers.renderSourceStage();
  }
}

export function getLaboratoryShellRegions(deps: LaboratoryShellRenderDeps): LaboratoryShellRegions {
  const dependencyCenterMarkup = deps.renderSettingsOverlay();
  const stageHasInspector =
    typeof deps.stageSurface.inspector === "string" && deps.stageSurface.inspector.trim() !== "";
  const blockingMarkup = renderStatusChannel("blocking", deps.status.blocking, deps);
  const primaryTone = getPrimaryStatusTone(deps.status);
  const primaryMarkup =
    primaryTone === null ? "" : renderStatusChannel(primaryTone, deps.status[primaryTone], deps);
  const visibleCards = [blockingMarkup, primaryMarkup].filter(function (entry) {
    return entry.trim() !== "";
  });

  return {
    eventLogMarkup: renderEventLog(deps),
    eventLogOpen: deps.eventLogOpen,
    inspectorClassName: deps.stageSurface.inspectorClassName || "",
    inspectorMarkup: stageHasInspector ? deps.stageSurface.inspector || "" : "",
    overlayMarkup: dependencyCenterMarkup,
    railMarkup: deps.renderStageRail(),
    stageHasInspector,
    stageMainClassName: deps.stageSurface.mainClassName || "",
    stageMainMarkup: deps.stageSurface.main,
    statusMarkup: `
      <div class="lab-status-line__cards" data-card-count="${String(visibleCards.length || 1)}">
        ${
          visibleCards.length > 0
            ? visibleCards.join("")
            : `
                <article
                  class="lab-status-line__card lab-status-line__card--quiet"
                  data-tone="result"
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <div class="lab-status-line__row">
                    <div class="lab-status-line__summary">
                      <span class="lab-status-line__label">${deps.escapeHtml(
                        deps.text(["workbench", "statusLine", "resultLabel"])
                      )}</span>
                      <span class="lab-status-line__text">
                        <strong class="lab-status-line__message">${deps.escapeHtml(
                          deps.text(["workbench", "statusLine", "idleMessage"])
                        )}</strong>
                      </span>
                    </div>
                  </div>
                </article>
              `
        }
      </div>
      <div class="lab-status-line__actions">
        <button
          class="lab-button lab-button--ghost lab-button--tight"
          type="button"
          data-action="toggle-event-log"
          aria-expanded="${deps.eventLogOpen ? "true" : "false"}"
          aria-controls="lab-event-log-list"
        >
          ${deps.escapeHtml(
            deps.eventLogOpen
              ? deps.text(["workbench", "statusLine", "hideEventsAction"])
              : deps.text(["workbench", "statusLine", "showEventsAction"])
          )}
        </button>
      </div>
    `,
  };
}

export function renderLaboratoryShell(deps: LaboratoryShellRenderDeps): string {
  const regions = getLaboratoryShellRegions(deps);
  const overlayOpen = regions.overlayMarkup.trim() !== "";
  const overlayMarkup = overlayOpen ? regions.overlayMarkup : "";

  return `
    <main
      class="lab-shell"
      data-stage="${deps.activeStage}"
      data-center-open="${overlayOpen ? "true" : "false"}"
      data-shell-mounted="true"
    >
      <div class="lab-shell__grain"></div>
      <div class="lab-shell__aura"></div>
      <aside class="lab-shell__rail" id="lab-shell-rail">${regions.railMarkup}</aside>
      <section class="lab-shell__core">
        <section class="lab-workspace" data-has-inspector="${regions.stageHasInspector ? "true" : "false"}">
          <section class="lab-workspace__main ${regions.stageMainClassName}" id="lab-shell-main">
            ${regions.stageMainMarkup}
          </section>
          <aside class="lab-workspace__inspector ${regions.inspectorClassName}" id="lab-shell-inspector">
            ${regions.inspectorMarkup}
          </aside>
        </section>
        <footer class="lab-status-line" id="lab-shell-status">${regions.statusMarkup}</footer>
        <section id="lab-shell-log">${regions.eventLogMarkup}</section>
      </section>
      <section class="lab-shell__overlay" id="lab-shell-overlay">${overlayMarkup}</section>
    </main>
  `;
}
