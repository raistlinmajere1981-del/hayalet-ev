export function createLaboratoryUiCoreBootstrapRuntime(deps) {
  const laboratoryUiStateRuntime = deps.createLaboratoryUiBootstrapStateRuntime({
    roomId: deps.roomId,
    featureId: deps.featureId,
    stageOrder: deps.stageOrder,
    documentRef: deps.documentRef,
    navigatorRef: deps.navigatorRef,
    resolveLocale: deps.resolveLaboratoryLocale,
  });
  const state = laboratoryUiStateRuntime.state;

  function toRecord(value) {
    if (value !== null && typeof value === "object" && Array.isArray(value) === false) {
      return value;
    }
    return {};
  }

  const deepClone = deps.cloneLaboratoryValue;
  const readFormValue = deps.readLaboratoryFormValue;
  const readValue = deps.readLaboratoryValue;
  const escapeHtml = deps.escapeLaboratoryHtml;
  const laboratoryMarkupHelpers = deps.createLaboratoryMarkupHelpers({
    escapeHtml,
  });
  const renderSummaryRows = laboratoryMarkupHelpers.renderSummaryRows;
  const renderTextField = laboratoryMarkupHelpers.renderTextField;

  const laboratoryUiNavigationRuntime = deps.createLaboratoryUiNavigationRuntime({
    defaultFeatureId: deps.featureId,
    documentRef: deps.documentRef,
    render: deps.render,
    resolveLocale: deps.resolveLaboratoryLocale,
    roomId: deps.roomId,
    stageOrder: deps.stageOrder,
    state,
    toRecord,
  });
  const applyLocale = laboratoryUiNavigationRuntime.applyLocale;
  const applyPresentationMode = laboratoryUiNavigationRuntime.applyPresentationMode;
  const normalizeContext = laboratoryUiNavigationRuntime.normalizeContext;
  const getStageIndex = laboratoryUiNavigationRuntime.getStageIndex;
  const setStage = laboratoryUiNavigationRuntime.setStage;
  const advanceStage = laboratoryUiNavigationRuntime.advanceStage;
  const captureScrollState = laboratoryUiNavigationRuntime.captureScrollState;
  const restoreScrollState = laboratoryUiNavigationRuntime.restoreScrollState;

  const runtimeRefs = {
    laboratoryStageAccessorsRuntime: null,
    laboratoryUiFeatureRuntime: null,
    snapshotSelectors: null,
  };

  const laboratoryCopyRuntime = deps.createLaboratoryCopyRuntime({
    audioFeatureId: deps.audioFeatureId,
    bootstrapCopy: deps.bootstrapCopy,
    defaultFeatureId: deps.featureId,
    featureNamespaces: deps.featureNamespaces,
    featurePreviewImages: deps.featurePreviewImages,
    getAudioAnalysisCapabilities() {
      return runtimeRefs.snapshotSelectors.getAudioAnalysisCapabilities();
    },
    getAudioAnalysisPresets() {
      return runtimeRefs.snapshotSelectors.getAudioAnalysisPresets();
    },
    readValue,
    sourceFormats: deps.sourceFormats,
    state,
    subtitleFeatureId: deps.subtitleFeatureId,
  });
  const text = laboratoryCopyRuntime.text;
  const textFromKey = laboratoryCopyRuntime.textFromKey;
  const getActiveFeatureId = laboratoryCopyRuntime.getActiveFeatureId;
  const isSubtitleAnalysisFeature = laboratoryCopyRuntime.isSubtitleAnalysisFeature;
  const isAudioAnalysisFeature = laboratoryCopyRuntime.isAudioAnalysisFeature;
  const getFeaturePreviewImage = laboratoryCopyRuntime.getFeaturePreviewImage;
  const featureText = laboratoryCopyRuntime.featureText;
  const getAvailableSourceFormats = laboratoryCopyRuntime.getAvailableSourceFormats;
  const getDefaultSourceKind = laboratoryCopyRuntime.getDefaultSourceKind;
  const bootstrapText = laboratoryCopyRuntime.bootstrapText;
  const subtitleText = laboratoryCopyRuntime.subtitleText;
  const subtitleTemplate = laboratoryCopyRuntime.subtitleTemplate;

  const laboratoryShellFrameUi = deps.createLaboratoryShellFrameUi({
    bootstrapText,
    escapeHtml,
    featureText,
    getActiveStage() {
      return state.activeStage;
    },
    getStageIndex,
    getTranslations() {
      return state.translations;
    },
    isSubtitleAnalysisFeature,
    readValue,
    stageOrder: deps.stageOrder,
    subtitleText,
    toRecord,
  });
  const renderBootstrap = laboratoryShellFrameUi.renderBootstrap;
  const renderStageRail = laboratoryShellFrameUi.renderStageRail;
  const renderStageIntro = laboratoryShellFrameUi.renderStageIntro;

  const formatDuration = deps.formatLaboratoryDuration;

  function formatDateTime(value) {
    return deps.formatLaboratoryDateTime(value, state.locale);
  }

  const formatStatusLabel = deps.formatLaboratoryStatusLabel;

  const snapshotSelectors = deps.createSourceSnapshotSelectors({
    getState() {
      return state;
    },
    toRecord,
    subtitleText,
    subtitleTemplate,
    formatStatusLabel,
    getActiveFeatureId,
  });
  runtimeRefs.snapshotSelectors = snapshotSelectors;

  const laboratorySnapshotAccessRuntime = deps.createLaboratorySnapshotAccessRuntime({
    snapshotSelectors,
  });
  const laboratoryUiDraftRuntime = deps.createLaboratoryUiDraftRuntime({
    state,
    toRecord,
    deepClone,
    isSubtitleAnalysisFeature,
    getSourceSnapshot: laboratorySnapshotAccessRuntime.getSourceSnapshot,
    getProjectSource: laboratorySnapshotAccessRuntime.getProjectSource,
    getSubtitleWorkspace: laboratorySnapshotAccessRuntime.getSubtitleWorkspace,
    getActiveProject: laboratorySnapshotAccessRuntime.getActiveProject,
    getProjectEdit: laboratorySnapshotAccessRuntime.getProjectEdit,
    getSubtitleEditState: laboratorySnapshotAccessRuntime.getSubtitleEditState,
    getEditPresets: laboratorySnapshotAccessRuntime.getEditPresets,
  });
  const laboratoryUiDraftAccessRuntime = deps.createLaboratoryUiDraftAccessRuntime({
    laboratoryUiDraftRuntime,
  });
  const laboratoryProfileProcessReportAccessorsRuntime =
    deps.createLaboratoryProfileProcessReportAccessorsRuntime({
      getLaboratoryUiFeatureRuntime() {
        return runtimeRefs.laboratoryUiFeatureRuntime;
      },
    });
  const laboratoryRequestRuntime = deps.createLaboratoryRequestRuntime({
    bootstrapText,
    buildCurrentDraftPayload() {
      return runtimeRefs.laboratoryStageAccessorsRuntime.buildCurrentDraftPayload();
    },
    getActiveFeatureId,
    getRoomApi() {
      return window.roomAPI;
    },
    isSubtitleAnalysisFeature,
    render: deps.render,
    requestOverlayScrollReset:
      laboratoryUiNavigationRuntime.requestOverlayScrollReset,
    state,
    toRecord,
  });
  const laboratoryUiEditRuntime = deps.createLaboratoryUiEditRuntime({
    deepClone,
    isAudioAnalysisFeature,
    isSubtitleAnalysisFeature,
    laboratoryRequestRuntime,
    laboratoryUiDraftRuntime,
    toRecord,
  });
  const mediaAnalysisUiRuntime = deps.createMediaAnalysisUiRuntime({
    ...laboratorySnapshotAccessRuntime,
    ...laboratoryProfileProcessReportAccessorsRuntime,
    state,
    text,
    featureText,
    toRecord,
    getAvailableSourceFormats,
    getDefaultSourceKind,
    getCurrentEditDraft() {
      return laboratoryUiDraftAccessRuntime.getCurrentEditDraft();
    },
    isSubtitleAnalysisFeature,
    getProfileLaneMap() {
      return laboratoryProfileProcessReportAccessorsRuntime.getProfileLaneMap();
    },
    getProfileReadiness() {
      return laboratoryProfileProcessReportAccessorsRuntime.getProfileReadiness();
    },
    getProfileSignals() {
      return laboratoryProfileProcessReportAccessorsRuntime.getProfileSignals();
    },
  });

  let getCurrentSourceKind = function () {
    return "";
  };
  let getCurrentSourceLabel = function () {
    return "";
  };
  let getEditOutputs = function () {
    return [];
  };
  let getProjectSource = function () {
    return laboratorySnapshotAccessRuntime.getProjectSource();
  };

  const laboratoryViewBindingsRuntime = deps.createLaboratoryViewBindingsRuntime({
    laboratorySnapshotAccessRuntime,
    laboratoryProfileProcessReportAccessorsRuntime,
    getLaboratorySettingsUi() {
      return deps.getLaboratorySettingsUi();
    },
    getMediaAnalysisProfileTargetAsset: deps.getMediaAnalysisProfileTargetAsset,
    getCurrentSourceKind() {
      return getCurrentSourceKind();
    },
    getCurrentSourceLabel() {
      return getCurrentSourceLabel();
    },
    getEditOutputs() {
      return getEditOutputs();
    },
    getProfileTargetSummary() {
      return runtimeRefs.laboratoryStageAccessorsRuntime.getProfileTargetSummary();
    },
    getProjectSource() {
      return getProjectSource();
    },
    toRecord,
  });

  function bindViewCompositionAccessors(uiRuntimeComposition) {
    getCurrentSourceKind = uiRuntimeComposition.getCurrentSourceKind;
    getCurrentSourceLabel = uiRuntimeComposition.getCurrentSourceLabel;
    getEditOutputs = uiRuntimeComposition.getEditOutputs;
    getProjectSource = uiRuntimeComposition.getProjectSource;
  }

  return {
    advanceStage,
    applyLocale,
    applyPresentationMode,
    bindViewCompositionAccessors,
    bootstrapText,
    captureScrollState,
    escapeHtml,
    featureText,
    formatDateTime,
    formatDuration,
    formatStatusLabel,
    getActiveFeatureId,
    getAvailableSourceFormats,
    getDefaultSourceKind,
    getFeaturePreviewImage,
    getStageIndex,
    isAudioAnalysisFeature,
    isSubtitleAnalysisFeature,
    laboratoryProfileProcessReportAccessorsRuntime,
    laboratoryRequestRuntime,
    laboratorySnapshotAccessRuntime,
    laboratoryUiDraftAccessRuntime,
    laboratoryUiDraftRuntime,
    laboratoryUiEditRuntime,
    laboratoryViewBindingsRuntime,
    mediaAnalysisUiRuntime,
    normalizeContext,
    readFormValue,
    renderBootstrap,
    renderStageIntro,
    renderStageRail,
    renderSummaryRows,
    renderTextField,
    restoreScrollState,
    runtimeRefs,
    setStage,
    state,
    subtitleTemplate,
    subtitleText,
    text,
    textFromKey,
    toRecord,
  };
}
