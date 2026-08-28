import { asLabRecord, asNonEmptyString } from "../../domain/lab-types.js";
import type { LabAsset, LabComparisonSide, LabStoreState } from "../../domain/lab-types.js";
import { buildLaboratoryTemporalStressTestRequestFromWorkspaceSelection } from "../../shared/temporal-stress-test-model.js";
import { attachLaboratoryTransformStackRenderContext } from "../../shared/transform-stack-render-context.js";
import type {
  LaboratoryTransformPreviewMode,
  LaboratoryTransformStackSourceKind,
} from "../../shared/transform-stack-render-context.js";
import { normalizeAudioFocusSettings } from "../lab-audio-focus-normalization.js";
import {
  createLabComparisonInteractiveSettings,
  normalizeLabInteractiveSettings,
} from "../lab-workspace-defaults.js";
import { inferLabAssetSourceKind } from "../../shared/lab-asset-kind.js";
import {
  getWorkspaceSourceSelectionResetKey,
  isFullSourceWorkspaceSelection,
} from "../lab-workspace-selection.js";
import { getCurrentSourceAsset, getLinkedAudioAssets } from "./lab-source-selectors.js";

function findPreviewArtifactUrl(preview: Record<string, unknown>, kind: string) {
  const artifacts = Array.isArray(preview["artifacts"]) ? preview["artifacts"] : [];
  for (const entry of artifacts) {
    const artifact = asLabRecord(entry);
    if (asNonEmptyString(artifact["kind"]) !== kind) {
      continue;
    }
    return asNonEmptyString(artifact["previewUrl"]);
  }
  return null;
}

function getTransformPreviewMode(state: LabStoreState): LaboratoryTransformPreviewMode {
  if (state.ui.workspace.comparisonViewMode === "difference") {
    return "difference";
  }
  if (state.ui.workspace.comparisonViewMode === "stacked") {
    return "transform";
  }
  return "source";
}

function getMediaDurationSeconds(metadataValue: unknown) {
  const metadata = asLabRecord(metadataValue);
  const durationSeconds = metadata["durationSeconds"];
  if (typeof durationSeconds === "number" && Number.isFinite(durationSeconds)) {
    return Math.max(0, durationSeconds);
  }
  const durationMs = metadata["durationMs"];
  return typeof durationMs === "number" && Number.isFinite(durationMs)
    ? Math.max(0, durationMs / 1000)
    : null;
}

type TransformStackMediaContext = {
  durationSeconds: number | null;
  previewUrl: string | null;
  sourceKind: LaboratoryTransformStackSourceKind | null;
};

function getTransformStackMediaContext(state: LabStoreState): TransformStackMediaContext {
  const activeAssetId = asNonEmptyString(state.ui.activeWorkspaceAssetId);
  if (activeAssetId !== null) {
    const activeAsset =
      state.assets.find(function (asset) {
        return asset.id === activeAssetId;
      }) || null;
    if (activeAsset === null) {
      return {
        durationSeconds: null,
        previewUrl: null,
        sourceKind: null,
      };
    }
    return {
      durationSeconds: getMediaDurationSeconds(activeAsset.metadata),
      previewUrl: asNonEmptyString(activeAsset.url) || asNonEmptyString(activeAsset.localPath),
      sourceKind: inferLabAssetSourceKind(activeAsset),
    };
  }

  const source = asLabRecord(state.source);
  const rawSourceKind = asNonEmptyString(source["kind"]);
  return {
    durationSeconds: getMediaDurationSeconds(source["metadata"]),
    previewUrl: asNonEmptyString(source["previewUrl"]),
    sourceKind:
      rawSourceKind === "video" || rawSourceKind === "audio" || rawSourceKind === "image"
        ? rawSourceKind
        : null,
  };
}

function getTransformStackRenderContext(state: LabStoreState) {
  const mediaContext = getTransformStackMediaContext(state);
  const comparisonActive = asNonEmptyString(state.ui.workspace.comparisonReferenceAssetId) !== null;
  const sourceKind: LaboratoryTransformStackSourceKind | null =
    comparisonActive !== true ? mediaContext.sourceKind : null;
  const runState = state.run?.state;
  const preview = asLabRecord(asLabRecord(state.editConfig)["preview"]);
  const previewStatus = asNonEmptyString(preview["status"]) || "idle";
  const previewReady =
    asNonEmptyString(state.ui.activeWorkspaceAssetId) === null && previewStatus === "ready";
  const activeSelection = state.ui.workspace.activeSelection;
  const temporalRequest =
    sourceKind === "video" &&
    activeSelection !== null &&
    isFullSourceWorkspaceSelection(activeSelection) !== true
      ? buildLaboratoryTemporalStressTestRequestFromWorkspaceSelection(
          activeSelection,
          mediaContext.durationSeconds
        )
      : null;
  return {
    baselinePreviewUrl: previewReady
      ? findPreviewArtifactUrl(preview, "transform-source-baseline")
      : null,
    differencePreviewUrl: previewReady
      ? findPreviewArtifactUrl(preview, "transform-difference")
      : null,
    editConfig: state.editConfig,
    featureId: state.featureId,
    locked: runState === "running" || runState === "queued",
    previewStatus,
    sourceKind,
    sourcePreviewUrl: mediaContext.previewUrl,
    temporalRequest,
    transformPreviewMode: getTransformPreviewMode(state),
    transformPreviewUrl: previewReady ? asNonEmptyString(preview["previewUrl"]) : null,
  };
}

export function getTransformPreviewSurfaceModel(state: LabStoreState) {
  return getTransformStackRenderContext(state);
}

export function getROIRegions(state: LabStoreState) {
  return state.ui.workspace.roiRegions;
}

export function getActiveROIRegions(state: LabStoreState) {
  return state.ui.workspace.roiRegions.filter(function (entry) {
    return entry.active;
  });
}

export function getComparisonInteractiveSettings(state: LabStoreState) {
  const baseSettings = normalizeLabInteractiveSettings(state.ui.workspace.interactiveSettings);
  const comparisonSettings =
    state.ui.workspace.comparisonInteractiveSettings ??
    createLabComparisonInteractiveSettings(baseSettings);
  return {
    primary: normalizeLabInteractiveSettings(comparisonSettings.primary, baseSettings),
    reference: normalizeLabInteractiveSettings(comparisonSettings.reference, baseSettings),
  };
}

export function getInteractiveSettingsForComparisonSide(
  state: LabStoreState,
  side?: LabComparisonSide | null
) {
  const comparisonReferenceAssetId = asNonEmptyString(
    state.ui.workspace.comparisonReferenceAssetId
  );
  if (comparisonReferenceAssetId === null) {
    return normalizeLabInteractiveSettings(state.ui.workspace.interactiveSettings);
  }
  const targetSide = side ?? state.ui.workspace.comparisonRois.activeSide;
  return getComparisonInteractiveSettings(state)[targetSide];
}

export function getInteractiveSettings(state: LabStoreState) {
  return attachLaboratoryTransformStackRenderContext(
    getInteractiveSettingsForComparisonSide(state),
    getTransformStackRenderContext(state)
  );
}

export function getAudioFocusSettings(state: LabStoreState) {
  return attachLaboratoryTransformStackRenderContext(
    normalizeAudioFocusSettings(state.ui.workspace.audioFocus),
    getTransformStackRenderContext(state)
  );
}

export function getEffectivePreviewAudioFocusSettings(state: LabStoreState) {
  return getAudioFocusSettings(state);
}

export function getPreviewVolume(state: LabStoreState) {
  return Math.max(0, Math.min(1, state.ui.workspace.previewVolume));
}

export function getDualPreviewVolume(state: LabStoreState) {
  const workspace = asLabRecord(state.ui.workspace);
  const legacyVolume = workspace["dualPreviewVolume"];
  return typeof legacyVolume === "number" && Number.isFinite(legacyVolume)
    ? Math.max(0, Math.min(1, legacyVolume))
    : getPreviewVolume(state);
}

export function getSelectedDualPreviewAudioAsset(state: LabStoreState): LabAsset | null {
  const currentSource = getCurrentSourceAsset(state);
  if (currentSource === null) {
    return null;
  }
  const linkedAudioAssets = getLinkedAudioAssets(state, currentSource.id);
  if (linkedAudioAssets.length === 0) {
    return null;
  }
  const workspace = asLabRecord(state.ui.workspace);
  const selectedAssetId = asNonEmptyString(workspace["dualPreviewAudioAssetId"]);
  return (
    linkedAudioAssets.find(function (asset) {
      return asset.id === selectedAssetId;
    }) ||
    linkedAudioAssets[0] ||
    null
  );
}

export function isDualPreviewAvailable(state: LabStoreState) {
  return getSelectedDualPreviewAudioAsset(state) !== null;
}

export function isDualPreviewActive(state: LabStoreState) {
  const workspace = asLabRecord(state.ui.workspace);
  return workspace["dualPreviewEnabled"] === true && isDualPreviewAvailable(state);
}

export function getBookmarks(state: LabStoreState) {
  const activeProjectId = state.projectIndex.activeProjectId;
  const activeSourceKey = getWorkspaceSourceSelectionResetKey(state.source);
  return state.ui.workspace.bookmarks.filter(function (bookmark) {
    const bookmarkRecord = asLabRecord(bookmark);
    const bookmarkProjectId = asNonEmptyString(bookmarkRecord["projectId"]);
    const bookmarkSourceKey = asNonEmptyString(bookmarkRecord["sourceKey"]);
    return bookmarkProjectId === activeProjectId && bookmarkSourceKey === activeSourceKey;
  });
}

export function getHypothesis(state: LabStoreState) {
  return state.ui.workspace.hypothesis;
}
