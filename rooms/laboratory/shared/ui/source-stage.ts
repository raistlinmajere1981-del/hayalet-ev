import { createLaboratorySourceStageIntakeRuntime } from "./source-stage-intake.js";
import { createLaboratorySourceStageProjectRuntime } from "./source-stage-project.js";

type LaboratorySourceStageUiDeps = Parameters<typeof createLaboratorySourceStageIntakeRuntime>[0] &
  Parameters<typeof createLaboratorySourceStageProjectRuntime>[0] & {
    isAudioAnalysisFeature: () => boolean;
    isSubtitleAnalysisFeature: () => boolean;
    renderAudioAnalysisCatalogPanel: () => string;
    renderAudioAnalysisNoticePanel: () => string;
    renderAudioAnalysisProviderPanel: () => string;
    renderPreviewSurface: () => string;
    renderStageIntro: (stageId: string) => string;
    renderSubtitleCatalogPanel: () => string;
    renderSubtitleDiscoveryPanel: () => string;
    renderSubtitleEntryPanel: () => string;
    renderSubtitleProviderPanel: () => string;
    renderSubtitleSourceIntakePanel: () => string;
    renderSubtitleSourceWorkspacePanel: () => string;
  };

export function createLaboratorySourceStageUi(deps: LaboratorySourceStageUiDeps) {
  const renderStageIntro = deps.renderStageIntro;
  const isSubtitleAnalysisFeature = deps.isSubtitleAnalysisFeature;
  const isAudioAnalysisFeature = deps.isAudioAnalysisFeature;
  const renderPreviewSurface = deps.renderPreviewSurface;
  const renderAudioAnalysisCatalogPanel = deps.renderAudioAnalysisCatalogPanel;
  const renderAudioAnalysisProviderPanel = deps.renderAudioAnalysisProviderPanel;
  const renderAudioAnalysisNoticePanel = deps.renderAudioAnalysisNoticePanel;
  const renderSubtitleSourceWorkspacePanel = deps.renderSubtitleSourceWorkspacePanel;
  const renderSubtitleDiscoveryPanel = deps.renderSubtitleDiscoveryPanel;
  const renderSubtitleCatalogPanel = deps.renderSubtitleCatalogPanel;
  const renderSubtitleProviderPanel = deps.renderSubtitleProviderPanel;
  const renderSubtitleSourceIntakePanel = deps.renderSubtitleSourceIntakePanel;
  const renderSubtitleEntryPanel = deps.renderSubtitleEntryPanel;
  const laboratorySourceStageProjectRuntime = createLaboratorySourceStageProjectRuntime(deps);
  const laboratorySourceStageIntakeRuntime = createLaboratorySourceStageIntakeRuntime(deps);

  function renderProjectPanel() {
    return laboratorySourceStageProjectRuntime.renderProjectPanel();
  }

  function renderSourceKindPanel() {
    return laboratorySourceStageProjectRuntime.renderSourceKindPanel();
  }

  function renderSourceIntakePanel() {
    return laboratorySourceStageIntakeRuntime.renderSourceIntakePanel();
  }

  function renderSourceStage() {
    if (isSubtitleAnalysisFeature()) {
      return `
        <div class="lab-layout lab-layout--source">
          <section class="lab-main-stack">
            ${renderStageIntro("source")}
            ${renderSubtitleSourceWorkspacePanel()}
            ${renderSubtitleDiscoveryPanel()}
            ${renderSubtitleCatalogPanel()}
            ${renderSubtitleProviderPanel()}
          </section>
          <aside class="lab-side-stack">
            ${renderProjectPanel()}
            ${renderSubtitleSourceIntakePanel()}
            ${renderSubtitleEntryPanel()}
          </aside>
        </div>
      `;
    }

    if (isAudioAnalysisFeature()) {
      return `
        <div class="lab-layout lab-layout--source">
          <section class="lab-main-stack">
            ${renderStageIntro("source")}
            ${renderPreviewSurface()}
            ${renderAudioAnalysisCatalogPanel()}
            ${renderAudioAnalysisProviderPanel()}
          </section>
          <aside class="lab-side-stack">
            ${renderProjectPanel()}
            ${renderSourceKindPanel()}
            ${renderSourceIntakePanel()}
            ${renderAudioAnalysisNoticePanel()}
          </aside>
        </div>
      `;
    }

    return `
      <div class="lab-layout lab-layout--source">
        <section class="lab-main-stack">
          ${renderStageIntro("source")}
          ${renderPreviewSurface()}
        </section>
        <aside class="lab-side-stack">
          ${renderProjectPanel()}
          ${renderSourceKindPanel()}
          ${renderSourceIntakePanel()}
        </aside>
      </div>
    `;
  }

  return {
    renderSourceStage: renderSourceStage,
  };
}
