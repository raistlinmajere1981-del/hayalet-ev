import { renderLaboratoryStageContent, renderLaboratoryShell } from "./shell-render.js";
export function createLaboratoryUiShellRuntime(deps) {
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
    state
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
      renderStageContent,
      renderStageRail
    });
    restoreScrollState(root);
    bindPreviewMetrics();
    bindAudioAnalysis();
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
