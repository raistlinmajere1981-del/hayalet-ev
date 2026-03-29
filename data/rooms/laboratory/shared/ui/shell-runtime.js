import { renderLaboratoryStageContent, renderLaboratoryShell } from "./shell-render.js";
export function createLaboratoryUiShellRuntime(deps) {
  const state = deps.state;
  const documentRef = deps.documentRef;
  function renderSourceStage() {
    return deps.renderSourceStage();
  }
  function renderEditStage() {
    return deps.renderEditStage();
  }
  function renderProfileStage() {
    return deps.renderProfileStage();
  }
  function renderProcessStage() {
    return deps.renderProcessStage();
  }
  function renderReportStage() {
    return deps.renderReportStage();
  }
  function renderStageContent() {
    return renderLaboratoryStageContent(state.activeStage, {
      renderEditStage,
      renderProcessStage,
      renderProfileStage,
      renderReportStage,
      renderSourceStage
    });
  }
  function render() {
    const root = documentRef.getElementById("app");
    if (!root) {
      return;
    }
    deps.captureScrollState(root);
    if (state.translations === null) {
      root.innerHTML = deps.renderBootstrap();
      return;
    }
    root.innerHTML = renderLaboratoryShell({
      activeStage: state.activeStage,
      escapeHtml: deps.escapeHtml,
      featureText: deps.featureText,
      lastActionMessage: state.ui.lastActionMessage,
      renderSettingsOverlay: deps.renderSettingsOverlay,
      renderStageContent,
      renderStageRail: deps.renderStageRail
    });
    deps.restoreScrollState(root);
    deps.bindPreviewMetrics();
    deps.bindAudioAnalysis();
  }
  return {
    render,
    renderEditStage,
    renderProcessStage,
    renderProfileStage,
    renderReportStage,
    renderSourceStage,
    renderStageContent
  };
}
