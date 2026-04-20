import { createLabEventBus } from "../runtime/lab-event-bus.js";
import { createLabHostBridge } from "../runtime/lab-host-bridge.js";
import { loadLabPersistedState, saveLabPersistedState } from "../runtime/lab-persistence.js";
import { createLabStore } from "../runtime/lab-store.js";
import { renderLabCenterPanel } from "./lab-center-panel.js";
import { renderLabLayout } from "./lab-layout.js";
import { renderLabLeftRail } from "./lab-left-rail.js";
import { renderLabRightPanel } from "./lab-right-panel.js";
import { renderEditStage } from "./stages/edit-stage.js";
import { renderProcessStage } from "./stages/process-stage.js";
import { renderReportStage } from "./stages/report-stage.js";
import { renderSourceStage } from "./stages/source-stage.js";
import { createLabRunController } from "../runtime/lab-run-controller.js";
import { renderToolManagementOverlay } from "./tool-management-overlay.js";
function createBootSurface(state) {
  return {
    main: `
      <section class="labx-boot">
        <p class="labx-boot__eyebrow">Hayalet Ev Laboratuvar</p>
        <h1 class="labx-boot__title">Laboratuvar Yükleniyor</h1>
        <p class="labx-boot__body">Çalışma tezgahı, kayıtlı projeler ve yerel analiz hazırlığı yükleniyor.</p>
      </section>
    `,
    side: `
      <section class="labx-card">
        <div class="labx-card__header">
          <div>
            <p class="labx-card__eyebrow">Başlangıç</p>
            <h2 class="labx-card__title">Oda Kontratı</h2>
          </div>
        </div>
        <div class="labx-card__body">
          <p class="labx-panel-hint">Yeni shell hazırlanırken roomAPI.ready payload yapısı korunur.</p>
          <p class="labx-panel-hint">Geçerli aşama: ${state.currentStage}</p>
        </div>
      </section>
    `
  };
}
function readPersistableState(state) {
  return {
    schemaVersion: 4,
    artifactRenderCount: state.ui.artifactRenderCount,
    artifactListExpanded: state.ui.artifactListExpanded,
    activePreviewArtifactId: state.ui.activePreviewArtifactId,
    activityFeed: state.activityFeed.slice(0, 40),
    analysisControlsCollapsed: state.ui.analysisControlsCollapsed,
    currentStage: state.currentStage,
    editDrafts: state.ui.editDrafts,
    editConfig: state.editConfig,
    editSidePanelCollapsed: state.ui.editSidePanelCollapsed,
    eventFeedExpanded: state.ui.eventFeedExpanded,
    eventFeedCursor: state.ui.eventFeedCursor,
    featureId: state.featureId,
    selectedCapabilities: state.selectedCapabilities,
    lastRun: state.run ? {
      ...state.run,
      state: state.run.state === "running" || state.run.state === "queued" ? "cancelled" : state.run.state,
      events: [],
      rawLog: []
    } : null,
    profileConfig: state.profileConfig,
    profileDrafts: state.ui.profileDrafts,
    profileModels: state.profileModels,
    preflight: state.preflight,
    projectIndex: state.projectIndex,
    reportExports: state.reportExports,
    reports: state.reports,
    reportView: state.ui.reportView,
    source: state.source,
    sourceDrafts: state.ui.sourceDrafts,
    sourceProbeStatus: state.sourceProbeStatus,
    toolState: state.toolState,
    liveFindingsExpanded: state.ui.liveFindingsExpanded,
    rawLogCollapsed: state.ui.rawLogCollapsed,
    workbench: state.workbench
  };
}
export function startLaboratoryLabRoot() {
  const documentRef = document;
  const windowRef = window;
  const root = documentRef.getElementById("app");
  if (!root) {
    return;
  }
  const runtimeRoot = root;
  const eventBus = createLabEventBus();
  const store = createLabStore();
  eventBus.subscribe(store.dispatch);
  const controller = createLabRunController({
    documentRef,
    eventBus,
    store,
    windowRef: window
  });
  const hostBridge = createLabHostBridge({
    emit: eventBus.emit
  });
  let shellMounted = false;
  function renderSurface(state) {
    const primaryAction = controller.getPrimaryActionState();
    switch (state.currentStage) {
      case "source":
        return renderSourceStage({
          primaryDetail: primaryAction.detail,
          primaryDisabled: primaryAction.disabled,
          primaryLabel: primaryAction.label,
          state
        });
      case "edit":
        return renderEditStage({
          primaryDetail: primaryAction.detail,
          primaryDisabled: primaryAction.disabled,
          primaryLabel: primaryAction.label,
          state
        });
      case "process":
        return renderProcessStage({
          primaryDetail: primaryAction.detail,
          primaryDisabled: primaryAction.disabled,
          primaryLabel: primaryAction.label,
          state
        });
      case "report":
        return renderReportStage({
          primaryDetail: primaryAction.detail,
          primaryDisabled: primaryAction.disabled,
          primaryLabel: primaryAction.label,
          state
        });
      default:
        return createBootSurface(state);
    }
  }
  function render() {
    const state = store.getState();
    const hasCanonicalState = state.bootReady || state.source !== null || state.run !== null || state.reports.user !== null || state.reports.ai !== null || state.projectIndex.projects.length > 0;
    const surface = hasCanonicalState ? renderSurface(state) : createBootSurface(state);
    if (shellMounted !== true) {
      runtimeRoot.innerHTML = renderLabLayout(state, surface);
      shellMounted = true;
      return;
    }
    const shell = runtimeRoot.querySelector(".labx-shell");
    const leftRail = runtimeRoot.querySelector(".labx-left-rail");
    const centerPanel = runtimeRoot.querySelector(".labx-center-panel");
    const rightPanel = runtimeRoot.querySelector(".labx-right-panel");
    const overlayRoot = runtimeRoot.querySelector(".labx-overlay-root");
    if (!shell || !leftRail || !centerPanel || !rightPanel || !overlayRoot) {
      runtimeRoot.innerHTML = renderLabLayout(state, surface);
      return;
    }
    if (shell instanceof HTMLElement) {
      shell.dataset["stage"] = state.currentStage;
      shell.dataset["ready"] = state.bootReady ? "true" : "false";
    }
    leftRail.outerHTML = renderLabLeftRail(state);
    centerPanel.outerHTML = renderLabCenterPanel(surface);
    rightPanel.outerHTML = renderLabRightPanel(surface);
    overlayRoot.outerHTML = renderToolManagementOverlay(state);
  }
  store.subscribe(function(state) {
    saveLabPersistedState(
      window,
      readPersistableState(state)
    );
    render();
  });
  const persisted = loadLabPersistedState(window);
  eventBus.emit({
    type: "hydrate",
    payload: persisted
  });
  controller.attach();
  if (windowRef.roomAPI && typeof windowRef.roomAPI.onHostMessage === "function") {
    windowRef.roomAPI.onHostMessage(function(message) {
      hostBridge.handleHostMessage(message);
    });
  }
  render();
  if (windowRef.roomAPI && typeof windowRef.roomAPI.ready === "function") {
    windowRef.roomAPI.ready({
      feature: "media-analysis",
      room: "laboratory",
      stage: "ui-ready"
    });
    eventBus.emit({
      type: "bootstrap-ready-sent"
    });
  }
}
startLaboratoryLabRoot();
