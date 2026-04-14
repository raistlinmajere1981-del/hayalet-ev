import type { createMediaAnalysisUiRuntime } from "../main-functions/media-analysis/ui/runtime.js";
import type { createLaboratoryProfileProcessReportAccessorsRuntime } from "../shared/ui/profile-process-report-accessors.js";
import type { createLaboratoryCopyRuntime } from "../shared/ui/copy-runtime.js";
import type { LaboratoryUiFeatureRuntimeApi } from "../shared/ui/feature-runtime.js";
import type { createLaboratoryMarkupHelpers } from "../shared/ui/markup.js";
import type { createLaboratoryUiNavigationRuntime } from "../shared/ui/navigation-runtime.js";
import type { createLaboratoryRequestRuntime } from "../shared/ui/request-runtime.js";
import type { createLaboratoryShellFrameUi } from "../shared/ui/shell-frame.js";
import type { LaboratorySourceSnapshotSelectorsApi } from "../shared/ui/source-snapshot-selectors.js";
import type { createSourceSnapshotSelectors } from "../shared/ui/source-snapshot-selectors.js";
import type { createLaboratoryUiDraftRuntime } from "../shared/ui/draft-runtime.js";
import type { LaboratoryStageAccessorsRuntimeApi } from "./stage-accessors-runtime.js";
import type { createLaboratoryUiBootstrapStateRuntime } from "./bootstrap-state-runtime.js";
import type { createLaboratoryUiDraftAccessRuntime } from "./draft-access-runtime.js";
import type { createLaboratoryUiEditRuntime } from "./edit-runtime.js";
import type { createLaboratorySnapshotAccessRuntime } from "./snapshot-access-runtime.js";
import type { createLaboratoryViewBindingsRuntime } from "./view-bindings-runtime.js";

type LaboratoryRecord = Record<string, unknown>;

type LaboratoryUiBootstrapState = ReturnType<
  typeof createLaboratoryUiBootstrapStateRuntime
>["state"];
type LaboratoryMarkupHelpersDeps = Parameters<typeof createLaboratoryMarkupHelpers>[0];
type LaboratoryUiNavigationRuntimeDeps = Parameters<typeof createLaboratoryUiNavigationRuntime>[0];
type LaboratoryCopyRuntimeDeps = Parameters<typeof createLaboratoryCopyRuntime>[0];
type LaboratoryShellFrameUiDeps = Parameters<typeof createLaboratoryShellFrameUi>[0];
type LaboratorySourceSnapshotSelectorsDeps = Parameters<typeof createSourceSnapshotSelectors>[0];
type LaboratorySnapshotAccessRuntimeDeps = Parameters<
  typeof createLaboratorySnapshotAccessRuntime
>[0];
type LaboratoryUiDraftRuntimeDeps = Parameters<typeof createLaboratoryUiDraftRuntime>[0];
type LaboratoryProfileProcessReportAccessorsRuntimeDeps = Parameters<
  typeof createLaboratoryProfileProcessReportAccessorsRuntime
>[0];
type LaboratoryRequestRuntimeDeps = Parameters<typeof createLaboratoryRequestRuntime>[0];
type LaboratoryUiEditRuntimeDeps = Parameters<typeof createLaboratoryUiEditRuntime>[0];
type MediaAnalysisUiRuntimeDeps = Parameters<typeof createMediaAnalysisUiRuntime>[0];
type LaboratoryViewBindingsRuntimeDeps = Parameters<typeof createLaboratoryViewBindingsRuntime>[0];

type LaboratoryUiRuntimeCompositionAccessors = {
  getCurrentSourceKind: () => unknown;
  getCurrentSourceLabel: () => unknown;
  getEditOutputs: () => unknown;
  getProjectSource: () => unknown;
};

type LaboratoryCoreBootstrapDeps = {
  audioFeatureId: string;
  bootstrapCopy: LaboratoryRecord;
  cloneLaboratoryValue: <T>(value: T) => T;
  createLaboratoryCopyRuntime: typeof createLaboratoryCopyRuntime;
  createLaboratoryMarkupHelpers: typeof createLaboratoryMarkupHelpers;
  createLaboratoryProfileProcessReportAccessorsRuntime: typeof createLaboratoryProfileProcessReportAccessorsRuntime;
  createLaboratoryRequestRuntime: typeof createLaboratoryRequestRuntime;
  createLaboratoryShellFrameUi: typeof createLaboratoryShellFrameUi;
  createLaboratorySnapshotAccessRuntime: typeof createLaboratorySnapshotAccessRuntime;
  createLaboratoryUiBootstrapStateRuntime: typeof createLaboratoryUiBootstrapStateRuntime;
  createLaboratoryUiDraftAccessRuntime: typeof createLaboratoryUiDraftAccessRuntime;
  createLaboratoryUiDraftRuntime: typeof createLaboratoryUiDraftRuntime;
  createLaboratoryUiEditRuntime: typeof createLaboratoryUiEditRuntime;
  createLaboratoryUiNavigationRuntime: typeof createLaboratoryUiNavigationRuntime;
  createLaboratoryViewBindingsRuntime: typeof createLaboratoryViewBindingsRuntime;
  createMediaAnalysisUiRuntime: typeof createMediaAnalysisUiRuntime;
  createSourceSnapshotSelectors: typeof createSourceSnapshotSelectors;
  documentRef: Document;
  escapeLaboratoryHtml: (value: string) => string;
  featureId: string;
  featureNamespaces: Record<string, string>;
  featurePreviewImages: Record<string, string>;
  formatLaboratoryDateTime: (value: unknown, locale: unknown) => string;
  formatLaboratoryDuration: (value: number | null | undefined) => string;
  formatLaboratoryStatusLabel: (...args: unknown[]) => string;
  getLaboratorySettingsUi: () => unknown;
  getMediaAnalysisProfileTargetAsset: (...args: unknown[]) => unknown;
  navigatorRef: Navigator;
  readLaboratoryFormValue: (...args: unknown[]) => unknown;
  readLaboratoryValue: (...args: unknown[]) => unknown;
  render: () => unknown;
  resolveLaboratoryLocale: (...args: unknown[]) => string;
  roomId: string;
  sourceFormats: string[];
  stageOrder: string[];
  subtitleFeatureId: string;
};

export type LaboratoryCoreBootstrapRuntimeRefs = {
  laboratoryStageAccessorsRuntime: LaboratoryStageAccessorsRuntimeApi | null;
  laboratoryUiFeatureRuntime: LaboratoryUiFeatureRuntimeApi | null;
  snapshotSelectors: LaboratorySourceSnapshotSelectorsApi | null;
};

export function createLaboratoryUiCoreBootstrapRuntime(deps: LaboratoryCoreBootstrapDeps) {
  const laboratoryUiStateRuntime = deps.createLaboratoryUiBootstrapStateRuntime({
    roomId: deps.roomId,
    featureId: deps.featureId,
    stageOrder: deps.stageOrder,
    documentRef: deps.documentRef,
    navigatorRef: deps.navigatorRef,
    resolveLocale: deps.resolveLaboratoryLocale,
  });
  const state: LaboratoryUiBootstrapState = laboratoryUiStateRuntime.state;

  function toRecord(value: unknown): LaboratoryRecord {
    if (value !== null && typeof value === "object" && Array.isArray(value) === false) {
      return value as LaboratoryRecord;
    }
    return {};
  }

  function toRecordArray(value: unknown): LaboratoryRecord[] {
    return Array.isArray(value) ? value.map(toRecord) : [];
  }

  const deepClone = deps.cloneLaboratoryValue;
  const readFormValue = deps.readLaboratoryFormValue;
  const readValue = deps.readLaboratoryValue;
  const escapeHtml = deps.escapeLaboratoryHtml;
  const laboratoryMarkupHelpersDeps = {
    escapeHtml,
  };
  const laboratoryMarkupHelpers = deps.createLaboratoryMarkupHelpers(
    laboratoryMarkupHelpersDeps as unknown as LaboratoryMarkupHelpersDeps
  );
  const renderSummaryRows = laboratoryMarkupHelpers.renderSummaryRows;
  const renderTextField = laboratoryMarkupHelpers.renderTextField;
  const navigationRuntimeRefs: {
    getStageGuard: (stageId: string) => {
      allowed: boolean;
      detail: string | null;
      reason: string | null;
    };
    onStageBlocked: (
      stageId: string,
      guard: {
        allowed: boolean;
        detail?: string | null;
        reason?: string | null;
      }
    ) => void;
  } = {
    getStageGuard() {
      return {
        allowed: true,
        detail: null,
        reason: null,
      };
    },
    onStageBlocked() {},
  };

  const laboratoryUiNavigationRuntimeDeps = {
    defaultFeatureId: deps.featureId,
    documentRef: deps.documentRef,
    getStageGuard(stageId: string) {
      return navigationRuntimeRefs.getStageGuard(stageId);
    },
    onStageBlocked(
      stageId: string,
      guard: { allowed: boolean; detail?: string | null; reason?: string | null }
    ) {
      navigationRuntimeRefs.onStageBlocked(stageId, guard);
    },
    render: deps.render,
    resolveLocale: deps.resolveLaboratoryLocale,
    roomId: deps.roomId,
    stageOrder: deps.stageOrder,
    state,
    toRecord,
  };
  const laboratoryUiNavigationRuntime = deps.createLaboratoryUiNavigationRuntime(
    laboratoryUiNavigationRuntimeDeps as unknown as LaboratoryUiNavigationRuntimeDeps
  );
  const applyLocale = laboratoryUiNavigationRuntime.applyLocale;
  const applyPresentationMode = laboratoryUiNavigationRuntime.applyPresentationMode;
  const normalizeContext = laboratoryUiNavigationRuntime.normalizeContext;
  const getStageIndex = laboratoryUiNavigationRuntime.getStageIndex;
  const setStage = laboratoryUiNavigationRuntime.setStage;
  const advanceStage = laboratoryUiNavigationRuntime.advanceStage;
  const captureScrollState = laboratoryUiNavigationRuntime.captureScrollState;
  const restoreScrollState = laboratoryUiNavigationRuntime.restoreScrollState;

  const runtimeRefs: LaboratoryCoreBootstrapRuntimeRefs = {
    laboratoryStageAccessorsRuntime: null,
    laboratoryUiFeatureRuntime: null,
    snapshotSelectors: null,
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
    subtitleFeatureId: deps.subtitleFeatureId,
  };
  const laboratoryCopyRuntime = deps.createLaboratoryCopyRuntime(
    laboratoryCopyRuntimeDeps as unknown as LaboratoryCopyRuntimeDeps
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
    getBootstrapState() {
      return toRecord(state.ui.bootstrap);
    },
    getStageGuard(stageId: string) {
      return navigationRuntimeRefs.getStageGuard(stageId);
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
    toRecord,
  };
  const laboratoryShellFrameUi = deps.createLaboratoryShellFrameUi(
    laboratoryShellFrameUiDeps as unknown as LaboratoryShellFrameUiDeps
  );
  const renderBootstrap = laboratoryShellFrameUi.renderBootstrap;
  const renderStageRail = laboratoryShellFrameUi.renderStageRail;
  const renderStageIntro = laboratoryShellFrameUi.renderStageIntro;

  const formatDuration = deps.formatLaboratoryDuration;

  function formatDateTime(value: unknown) {
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
    getActiveFeatureId,
  };
  const snapshotSelectors = deps.createSourceSnapshotSelectors(
    sourceSnapshotSelectorsDeps as unknown as LaboratorySourceSnapshotSelectorsDeps
  );
  runtimeRefs.snapshotSelectors = snapshotSelectors;

  const laboratorySnapshotAccessRuntimeDeps = {
    snapshotSelectors,
  };
  const laboratorySnapshotAccessRuntime = deps.createLaboratorySnapshotAccessRuntime(
    laboratorySnapshotAccessRuntimeDeps as unknown as LaboratorySnapshotAccessRuntimeDeps
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
    getEditPresets: laboratorySnapshotAccessRuntime.getEditPresets,
  };
  const laboratoryUiDraftRuntime = deps.createLaboratoryUiDraftRuntime(
    laboratoryUiDraftRuntimeDeps as unknown as LaboratoryUiDraftRuntimeDeps
  );
  const laboratoryUiDraftAccessRuntime = deps.createLaboratoryUiDraftAccessRuntime({
    laboratoryUiDraftRuntime,
  });
  const laboratoryProfileProcessReportAccessorsRuntimeDeps = {
    getLaboratoryUiFeatureRuntime() {
      return runtimeRefs.laboratoryUiFeatureRuntime;
    },
  };
  const laboratoryProfileProcessReportAccessorsRuntime =
    deps.createLaboratoryProfileProcessReportAccessorsRuntime(
      laboratoryProfileProcessReportAccessorsRuntimeDeps as unknown as LaboratoryProfileProcessReportAccessorsRuntimeDeps
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
    toRecord,
  };
  const laboratoryRequestRuntime = deps.createLaboratoryRequestRuntime(
    laboratoryRequestRuntimeDeps as unknown as LaboratoryRequestRuntimeDeps
  );
  const laboratoryUiEditRuntimeDeps = {
    deepClone,
    isAudioAnalysisFeature,
    isSubtitleAnalysisFeature,
    laboratoryRequestRuntime,
    laboratoryUiDraftRuntime,
    toRecord,
  };
  const laboratoryUiEditRuntime = deps.createLaboratoryUiEditRuntime(
    laboratoryUiEditRuntimeDeps as unknown as LaboratoryUiEditRuntimeDeps
  );
  const mediaAnalysisUiRuntimeDeps = {
    ...laboratorySnapshotAccessRuntime,
    ...laboratoryProfileProcessReportAccessorsRuntime,
    state,
    subtitleText,
    text,
    textFromKey,
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
    },
  };
  const mediaAnalysisUiRuntime = deps.createMediaAnalysisUiRuntime(
    mediaAnalysisUiRuntimeDeps as unknown as MediaAnalysisUiRuntimeDeps
  );

  let getCurrentSourceKind = function () {
    return "";
  };
  let getCurrentSourceLabel = function () {
    return "";
  };
  let getEditOutputs = function (): unknown[] {
    return [];
  };
  let getProjectSource = function () {
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
    toRecord,
  };
  const laboratoryViewBindingsRuntime = deps.createLaboratoryViewBindingsRuntime(
    laboratoryViewBindingsRuntimeDeps as unknown as LaboratoryViewBindingsRuntimeDeps
  );

  function readActiveProjectRecord() {
    return toRecord(laboratorySnapshotAccessRuntime.getActiveProject());
  }

  function hasActiveProject() {
    const activeProject = readActiveProjectRecord();
    if (typeof activeProject["id"] === "string" && activeProject["id"].trim() !== "") {
      return true;
    }
    return (
      typeof state.sourceSnapshot.activeProjectId === "string" &&
      state.sourceSnapshot.activeProjectId.trim() !== ""
    );
  }

  function hasPreparedSourceForFeature() {
    if (isSubtitleAnalysisFeature()) {
      const subtitleWorkspace = toRecord(laboratorySnapshotAccessRuntime.getSubtitleWorkspace());
      const selection = toRecord(subtitleWorkspace["selection"]);
      const selectedEntryIds = Array.isArray(selection["selectedEntryIds"])
        ? selection["selectedEntryIds"].filter(function (entry): entry is string {
            return typeof entry === "string" && entry.trim() !== "";
          })
        : [];
      const subtitleEntries = laboratorySnapshotAccessRuntime.getSubtitleEntries();
      return selectedEntryIds.length > 0 || (Array.isArray(subtitleEntries) && subtitleEntries.length > 0);
    }

    const projectSource = toRecord(laboratorySnapshotAccessRuntime.getProjectSource());
    return typeof projectSource["storedPath"] === "string" && projectSource["storedPath"].trim() !== "";
  }

  function getCurrentFeatureProcessStatus() {
    const processRecords = toRecord(toRecord(laboratorySnapshotAccessRuntime.getProjectProcess())["records"]);
    const processRecord = toRecord(processRecords[getActiveFeatureId()]);
    return typeof processRecord["status"] === "string" ? processRecord["status"].trim() : "";
  }

  function getCurrentFeatureReportStatus() {
    const reportRecords = toRecord(toRecord(laboratorySnapshotAccessRuntime.getProjectReport())["records"]);
    const reportRecord = toRecord(reportRecords[getActiveFeatureId()]);
    return typeof reportRecord["status"] === "string" ? reportRecord["status"].trim() : "";
  }

  function getProfileGuardReason() {
    if (isAudioAnalysisFeature() || isSubtitleAnalysisFeature()) {
      return null;
    }

    const readiness = toRecord(laboratoryProfileProcessReportAccessorsRuntime.getProfileReadiness());
    const blockers = Array.isArray(readiness["blockers"])
      ? readiness["blockers"].filter(function (entry): entry is string {
          return typeof entry === "string" && entry.trim() !== "";
        })
      : [];
    if (readiness["stageReady"] !== true) {
      return blockers[0] || text(["workbench", "stageGuards", "profileRequired"]);
    }

    const preflight = toRecord(laboratoryProfileProcessReportAccessorsRuntime.getProfilePreflight());
    return preflight["status"] === "ready"
      ? null
      : text(["workbench", "stageGuards", "preflightRequired"]);
  }

  navigationRuntimeRefs.getStageGuard = function (stageId: string) {
    if (stageId === "source") {
      return {
        allowed: true,
        detail: null,
        reason: null,
      };
    }

    if (hasActiveProject() !== true) {
      return {
        allowed: false,
        detail: null,
        reason: text(["workbench", "stageGuards", "noProject"]),
      };
    }

    if (hasPreparedSourceForFeature() !== true) {
      return {
        allowed: false,
        detail: null,
        reason: isSubtitleAnalysisFeature()
          ? text(["workbench", "stageGuards", "subtitleSourceRequired"])
          : text(["workbench", "stageGuards", "sourceRequired"]),
      };
    }

    if (stageId === "process") {
      const profileReason = getProfileGuardReason();
      return {
        allowed: profileReason === null,
        detail: null,
        reason: profileReason,
      };
    }

    if (stageId === "report") {
      const reportStatus = getCurrentFeatureReportStatus();
      const processStatus = getCurrentFeatureProcessStatus();
      const reportReady = ["ready", "stale"].includes(reportStatus);
      const processFinished = ["ready", "stale"].includes(processStatus);
      return {
        allowed: reportReady,
        detail: null,
        reason: processFinished
          ? text(["workbench", "stageGuards", "reportPending"])
          : text(["workbench", "stageGuards", "processRequired"]),
      };
    }

    return {
      allowed: true,
      detail: null,
      reason: null,
    };
  };

  navigationRuntimeRefs.onStageBlocked = function (
    _stageId: string,
    guard: { allowed: boolean; detail?: string | null; reason?: string | null }
  ) {
    const reason =
      typeof guard.reason === "string" && guard.reason.trim() !== ""
        ? guard.reason
        : text(["workbench", "statusLine", "idleMessage"]);
    laboratoryRequestRuntime.setBlockingStatus(reason, guard.detail ?? null, "ui");
    deps.render();
  };

  function bindViewCompositionAccessors(
    uiRuntimeComposition: LaboratoryUiRuntimeCompositionAccessors
  ) {
    getCurrentSourceKind = function () {
      const sourceKind: unknown = uiRuntimeComposition.getCurrentSourceKind();
      return typeof sourceKind === "string" ? sourceKind : "";
    };
    getCurrentSourceLabel = function () {
      const sourceLabel: unknown = uiRuntimeComposition.getCurrentSourceLabel();
      return typeof sourceLabel === "string" ? sourceLabel : "";
    };
    getEditOutputs = function () {
      const editOutputs: unknown = uiRuntimeComposition.getEditOutputs();
      return Array.isArray(editOutputs) ? editOutputs : [];
    };
    getProjectSource = function () {
      const projectSource: unknown = uiRuntimeComposition.getProjectSource();
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
    toRecord,
  };
}
