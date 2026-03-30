import { renderLaboratoryStageContent, renderLaboratoryShell } from "./shell-render.js";
import type { createLaboratoryUiBootstrapStateRuntime } from "../../ui/bootstrap-state-runtime.js";

type LaboratoryUiState = ReturnType<typeof createLaboratoryUiBootstrapStateRuntime>["state"];

type LaboratoryUiShellRuntimeDeps = {
  bindAudioAnalysis: () => void;
  bindPreviewMetrics: () => void;
  captureScrollState: (root: Element) => void;
  documentRef: Document;
  escapeHtml: (value: string) => string;
  featureText: (path: string[]) => string;
  renderBootstrap: () => string;
  renderEditStage: () => string;
  renderProcessStage: () => string;
  renderProfileStage: () => string;
  renderReportStage: () => string;
  renderSettingsOverlay: () => string;
  renderSourceStage: () => string;
  renderStageRail: () => string;
  restoreScrollState: (root: Element) => void;
  state: LaboratoryUiState;
};

export function createLaboratoryUiShellRuntime(deps: LaboratoryUiShellRuntimeDeps) {
  const {
    bindAudioAnalysis,
    bindPreviewMetrics,
    captureScrollState,
    documentRef,
    escapeHtml,
    featureText,
    renderBootstrap,
    renderEditStage: getEditStageMarkup,
    renderProcessStage: getProcessStageMarkup,
    renderProfileStage: getProfileStageMarkup,
    renderReportStage: getReportStageMarkup,
    renderSettingsOverlay,
    renderSourceStage: getSourceStageMarkup,
    renderStageRail,
    restoreScrollState,
    state,
  } = deps;

  function renderSourceStage() {
    return getSourceStageMarkup();
  }

  function renderEditStage() {
    return getEditStageMarkup();
  }

  function renderProfileStage() {
    return getProfileStageMarkup();
  }

  function renderProcessStage() {
    return getProcessStageMarkup();
  }

  function renderReportStage() {
    return getReportStageMarkup();
  }

  function renderStageContent() {
    return renderLaboratoryStageContent(state.activeStage, {
      renderEditStage: renderEditStage,
      renderProcessStage: renderProcessStage,
      renderProfileStage: renderProfileStage,
      renderReportStage: renderReportStage,
      renderSourceStage: renderSourceStage,
    });
  }

  function render() {
    const root = documentRef.getElementById("app");
    if (!root) {
      return;
    }

    captureScrollState(root);

    if (state.translations === null) {
      root.innerHTML = renderBootstrap();
      return;
    }

    root.innerHTML = renderLaboratoryShell({
      activeStage: state.activeStage,
      escapeHtml,
      featureText,
      lastActionMessage: state.ui.lastActionMessage,
      renderSettingsOverlay,
      renderStageContent: renderStageContent,
      renderStageRail,
    });

    restoreScrollState(root);
    bindPreviewMetrics();
    bindAudioAnalysis();
  }

  return {
    render: render,
    renderEditStage: renderEditStage,
    renderProcessStage: renderProcessStage,
    renderProfileStage: renderProfileStage,
    renderReportStage: renderReportStage,
    renderSourceStage: renderSourceStage,
    renderStageContent: renderStageContent,
  };
}

export type LaboratoryUiShellRuntimeApi = ReturnType<typeof createLaboratoryUiShellRuntime>;
