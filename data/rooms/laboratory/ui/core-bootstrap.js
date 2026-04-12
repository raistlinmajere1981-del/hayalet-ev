export function createLaboratoryUiCoreBootstrapRuntime(deps) {
  const laboratoryUiStateRuntime = deps.createLaboratoryUiBootstrapStateRuntime({
    roomId: deps.roomId,
    featureId: deps.featureId,
    stageOrder: deps.stageOrder,
    documentRef: deps.documentRef,
    navigatorRef: deps.navigatorRef,
    resolveLocale: deps.resolveLaboratoryLocale
  });
  const state = laboratoryUiStateRuntime.state;
  function toRecord(value) {
    if (value !== null && typeof value === "object" && Array.isArray(value) === false) {
      return value;
    }
    return {};
  }
  function toRecordArray(value) {
    return Array.isArray(value) ? value.map(toRecord) : [];
  }
  const deepClone = deps.cloneLaboratoryValue;
  const readFormValue = deps.readLaboratoryFormValue;
  const readValue = deps.readLaboratoryValue;
  const escapeHtml = deps.escapeLaboratoryHtml;
  const laboratoryMarkupHelpersDeps = {
    escapeHtml
  };
  const laboratoryMarkupHelpers = deps.createLaboratoryMarkupHelpers(
    laboratoryMarkupHelpersDeps
  );
  const renderSummaryRows = laboratoryMarkupHelpers.renderSummaryRows;
  const renderTextField = laboratoryMarkupHelpers.renderTextField;
  const laboratoryUiNavigationRuntimeDeps = {
    defaultFeatureId: deps.featureId,
    documentRef: deps.documentRef,
    render: deps.render,
    resolveLocale: deps.resolveLaboratoryLocale,
    roomId: deps.roomId,
    stageOrder: deps.stageOrder,
    state,
    toRecord
  };
  const laboratoryUiNavigationRuntime = deps.createLaboratoryUiNavigationRuntime(
    laboratoryUiNavigationRuntimeDeps
  );
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
    snapshotSelectors: null
  };
  function getSnapshotSelectors() {
    const selectors = runtimeRefs.snapshotSelectors;
    if (!selectors) {
      throw new Error("Laboratory snapshot selectors are not initialized");
    }
    return selectors;
  }
  const laboratoryCopyRuntimeDeps = {
    audioFeatureId: deps.audioFeatureId,
    bootstrapCopy: deps.bootstrapCopy,
    defaultFeatureId: deps.featureId,
    featureNamespaces: deps.featureNamespaces,
    featurePreviewImages: deps.featurePreviewImages,
    getAudioAnalysisCapabilities() {
      return toRecord(getSnapshotSelectors().getAudioAnalysisCapabilities());
    },
    getAudioAnalysisPresets() {
      return toRecord(getSnapshotSelectors().getAudioAnalysisPresets());
    },
    readValue,
    sourceFormats: deps.sourceFormats,
    state,
    subtitleFeatureId: deps.subtitleFeatureId
  };
  const laboratoryCopyRuntime = deps.createLaboratoryCopyRuntime(
    laboratoryCopyRuntimeDeps
  );
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
  const laboratoryShellFrameUiDeps = {
    bootstrapText,
    escapeHtml,
    featureText,
    getActiveFeatureId,
    getActiveStage() {
      return state.activeStage;
    },
    getStageIndex,
    getTranslations() {
      return state.translations;
    },
    getWorkbench() {
      return state.context.workbench;
    },
    isSubtitleAnalysisFeature,
    readValue,
    stageOrder: deps.stageOrder,
    subtitleText,
    text,
    toRecord
  };
  const laboratoryShellFrameUi = deps.createLaboratoryShellFrameUi(
    laboratoryShellFrameUiDeps
  );
  const renderBootstrap = laboratoryShellFrameUi.renderBootstrap;
  const renderStageRail = laboratoryShellFrameUi.renderStageRail;
  const renderStageIntro = laboratoryShellFrameUi.renderStageIntro;
  const formatDuration = deps.formatLaboratoryDuration;
  function formatDateTime(value) {
    return deps.formatLaboratoryDateTime(value, state.locale);
  }
  const formatStatusLabel = deps.formatLaboratoryStatusLabel;
  const sourceSnapshotSelectorsDeps = {
    getState() {
      return state;
    },
    toRecord,
    subtitleText,
    subtitleTemplate,
    formatStatusLabel,
    getActiveFeatureId
  };
  const snapshotSelectors = deps.createSourceSnapshotSelectors(
    sourceSnapshotSelectorsDeps
  );
  runtimeRefs.snapshotSelectors = snapshotSelectors;
  const laboratorySnapshotAccessRuntimeDeps = {
    snapshotSelectors
  };
  const laboratorySnapshotAccessRuntime = deps.createLaboratorySnapshotAccessRuntime(
    laboratorySnapshotAccessRuntimeDeps
  );
  const laboratoryUiDraftRuntimeDeps = {
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
    getEditPresets: laboratorySnapshotAccessRuntime.getEditPresets
  };
  const laboratoryUiDraftRuntime = deps.createLaboratoryUiDraftRuntime(
    laboratoryUiDraftRuntimeDeps
  );
  const laboratoryUiDraftAccessRuntime = deps.createLaboratoryUiDraftAccessRuntime({
    laboratoryUiDraftRuntime
  });
  const laboratoryProfileProcessReportAccessorsRuntimeDeps = {
    getLaboratoryUiFeatureRuntime() {
      return runtimeRefs.laboratoryUiFeatureRuntime;
    }
  };
  const laboratoryProfileProcessReportAccessorsRuntime = deps.createLaboratoryProfileProcessReportAccessorsRuntime(
    laboratoryProfileProcessReportAccessorsRuntimeDeps
  );
  function getStageAccessors() {
    const accessors = runtimeRefs.laboratoryStageAccessorsRuntime;
    if (!accessors) {
      throw new Error("Laboratory stage accessors runtime is not initialized");
    }
    return accessors;
  }
  const laboratoryRequestRuntimeDeps = {
    bootstrapText,
    buildCurrentDraftPayload() {
      return toRecord(getStageAccessors().buildCurrentDraftPayload());
    },
    getActiveFeatureId,
    getRoomApi() {
      return window.roomAPI;
    },
    isSubtitleAnalysisFeature,
    render: deps.render,
    requestOverlayScrollReset: laboratoryUiNavigationRuntime.requestOverlayScrollReset,
    state,
    toRecord
  };
  const laboratoryRequestRuntime = deps.createLaboratoryRequestRuntime(
    laboratoryRequestRuntimeDeps
  );
  const laboratoryUiEditRuntimeDeps = {
    deepClone,
    isAudioAnalysisFeature,
    isSubtitleAnalysisFeature,
    laboratoryRequestRuntime,
    laboratoryUiDraftRuntime,
    toRecord
  };
  const laboratoryUiEditRuntime = deps.createLaboratoryUiEditRuntime(
    laboratoryUiEditRuntimeDeps
  );
  const mediaAnalysisUiRuntimeDeps = {
    ...laboratorySnapshotAccessRuntime,
    ...laboratoryProfileProcessReportAccessorsRuntime,
    state,
    text,
    featureText,
    toRecord,
    getAvailableSourceFormats,
    getDefaultSourceKind,
    getCurrentEditDraft() {
      return toRecord(laboratoryUiDraftAccessRuntime.getCurrentEditDraft());
    },
    isSubtitleAnalysisFeature,
    getProfileLaneMap() {
      return toRecord(laboratoryProfileProcessReportAccessorsRuntime.getProfileLaneMap());
    },
    getProfileReadiness() {
      return toRecord(laboratoryProfileProcessReportAccessorsRuntime.getProfileReadiness());
    },
    getProfileSignals() {
      return toRecordArray(laboratoryProfileProcessReportAccessorsRuntime.getProfileSignals());
    }
  };
  const mediaAnalysisUiRuntime = deps.createMediaAnalysisUiRuntime(
    mediaAnalysisUiRuntimeDeps
  );
  let getCurrentSourceKind = function() {
    return "";
  };
  let getCurrentSourceLabel = function() {
    return "";
  };
  let getEditOutputs = function() {
    return [];
  };
  let getProjectSource = function() {
    return toRecord(laboratorySnapshotAccessRuntime.getProjectSource());
  };
  const laboratoryViewBindingsRuntimeDeps = {
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
      return toRecord(getStageAccessors().getProfileTargetSummary());
    },
    getProjectSource() {
      return getProjectSource();
    },
    toRecord
  };
  const laboratoryViewBindingsRuntime = deps.createLaboratoryViewBindingsRuntime(
    laboratoryViewBindingsRuntimeDeps
  );
  function bindViewCompositionAccessors(uiRuntimeComposition) {
    getCurrentSourceKind = function() {
      const sourceKind = uiRuntimeComposition.getCurrentSourceKind();
      return typeof sourceKind === "string" ? sourceKind : "";
    };
    getCurrentSourceLabel = function() {
      const sourceLabel = uiRuntimeComposition.getCurrentSourceLabel();
      return typeof sourceLabel === "string" ? sourceLabel : "";
    };
    getEditOutputs = function() {
      const editOutputs = uiRuntimeComposition.getEditOutputs();
      return Array.isArray(editOutputs) ? editOutputs : [];
    };
    getProjectSource = function() {
      const projectSource = uiRuntimeComposition.getProjectSource();
      return toRecord(projectSource);
    };
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
    toRecord
  };
}
