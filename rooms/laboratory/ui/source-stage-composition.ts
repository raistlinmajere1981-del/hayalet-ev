// @ts-nocheck
import { createLaboratorySourceStageUi } from "../shared/ui/source-stage.js";

export function createLaboratorySourceStageComposition(deps) {
  return createLaboratorySourceStageUi({
    state: deps.state,
    toRecord: deps.toRecord,
    escapeHtml: deps.escapeHtml,
    text: deps.text,
    textFromKey: deps.textFromKey,
    featureText: deps.featureText,
    renderStageIntro: deps.renderStageIntro,
    renderTextField: deps.renderTextField,
    isSubtitleAnalysisFeature: deps.isSubtitleAnalysisFeature,
    isAudioAnalysisFeature: deps.isAudioAnalysisFeature,
    getProjectSummaries: deps.getProjectSummaries,
    getSourceSnapshot: deps.getSourceSnapshot,
    getActiveProject: deps.getActiveProject,
    getAvailableSourceFormats: deps.getAvailableSourceFormats,
    getCurrentSourceKind: deps.getCurrentSourceKind,
    getCurrentSourceMode: deps.getCurrentSourceMode,
    getSourceModeOptions: deps.getSourceModeOptions,
    getToolEntry: deps.getToolEntry,
    getCurrentDrafts: deps.getCurrentDrafts,
    getYtDlpForm: deps.getYtDlpForm,
    renderPreviewSurface: deps.renderPreviewSurface,
    renderAudioAnalysisCatalogPanel: deps.renderAudioAnalysisCatalogPanel,
    renderAudioAnalysisProviderPanel: deps.renderAudioAnalysisProviderPanel,
    renderAudioAnalysisNoticePanel: deps.renderAudioAnalysisNoticePanel,
    renderSubtitleSourceWorkspacePanel: deps.renderSubtitleSourceWorkspacePanel,
    renderSubtitleDiscoveryPanel: deps.renderSubtitleDiscoveryPanel,
    renderSubtitleCatalogPanel: deps.renderSubtitleCatalogPanel,
    renderSubtitleProviderPanel: deps.renderSubtitleProviderPanel,
    renderSubtitleSourceIntakePanel: deps.renderSubtitleSourceIntakePanel,
    renderSubtitleEntryPanel: deps.renderSubtitleEntryPanel,
  });
}
