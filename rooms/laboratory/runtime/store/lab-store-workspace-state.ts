import {
  asLabRecord,
  asNonEmptyString,
  asStringArray,
  createLabEventId,
  getModuleIdsForCapabilityFamily,
  WORKSPACE_INTENTS,
} from "../../models/lab-types.js";
import type {
  CapabilityFamilyId,
  LabBookmark,
  LabEventFeedItem,
  LabFocusLayer,
  LabInspectionMode,
  LabIntentId,
  LabRecord,
  LabSelection,
  LabStoreState,
} from "../../models/lab-types.js";
import { getWorkspaceSourceSelectionResetKey } from "../lab-workspace-selection.js";

export function scopeWorkspaceBookmark(state: LabStoreState, bookmark: LabBookmark): LabBookmark {
  const bookmarkRecord = asLabRecord(bookmark);
  return {
    ...bookmark,
    projectId: asNonEmptyString(bookmarkRecord["projectId"]) ?? state.projectIndex.activeProjectId,
    sourceKey:
      asNonEmptyString(bookmarkRecord["sourceKey"]) ??
      getWorkspaceSourceSelectionResetKey(state.source),
  };
}

export function normalizeWorkspaceIntentIds(value: unknown) {
  const knownIntentIds = new Set<string>(
    WORKSPACE_INTENTS.map(function (intent) {
      return intent.id;
    })
  );
  return asStringArray(value).filter(function (intentId, index, allIntentIds) {
    return knownIntentIds.has(intentId) && allIntentIds.indexOf(intentId) === index;
  }) as Array<(typeof WORKSPACE_INTENTS)[number]["id"]>;
}

export function deriveCapabilitiesFromIntentIds(intentIds: unknown): CapabilityFamilyId[] {
  const normalizedIntentIds = normalizeWorkspaceIntentIds(intentIds);
  const capabilitySet = new Set<CapabilityFamilyId>();
  WORKSPACE_INTENTS.forEach(function (intent) {
    if (!normalizedIntentIds.includes(intent.id)) {
      return;
    }
    intent.internalCapabilities.forEach(function (capabilityId) {
      capabilitySet.add(capabilityId);
    });
  });
  return Array.from(capabilitySet);
}

export function getAnalysisModuleIdsForIntentId(intentId: LabIntentId): string[] {
  const intent = WORKSPACE_INTENTS.find(function (entry) {
    return entry.id === intentId;
  });
  if (!intent) {
    return [];
  }
  return Array.from(
    new Set(
      intent.internalCapabilities.flatMap(function (capabilityId) {
        return getModuleIdsForCapabilityFamily(capabilityId);
      })
    )
  );
}

function deriveAnalysisModuleIdsFromIntentIds(intentIds: unknown): string[] {
  return Array.from(
    new Set(
      normalizeWorkspaceIntentIds(intentIds).flatMap(function (intentId) {
        return getAnalysisModuleIdsForIntentId(intentId);
      })
    )
  );
}

export function replaceAnalysisPreparationModuleToggles(
  workbench: LabRecord,
  selectedIntentIds: unknown
): LabRecord {
  const selectedModuleIds = new Set(deriveAnalysisModuleIdsFromIntentIds(selectedIntentIds));
  const moduleToggles = {
    ...asLabRecord(workbench["moduleToggles"]),
  };
  deriveAnalysisModuleIdsFromIntentIds(
    WORKSPACE_INTENTS.map(function (intent) {
      return intent.id;
    })
  ).forEach(function (moduleId) {
    moduleToggles[moduleId] = selectedModuleIds.has(moduleId);
  });
  return {
    ...workbench,
    moduleToggles,
  };
}

export function patchAnalysisPreparationIntentModuleToggles(
  workbench: LabRecord,
  intentId: LabIntentId,
  selectedIntentIds: unknown,
  enabled: boolean
): LabRecord {
  const selectedIntentSet = new Set(normalizeWorkspaceIntentIds(selectedIntentIds));
  const moduleToggles = {
    ...asLabRecord(workbench["moduleToggles"]),
  };
  getAnalysisModuleIdsForIntentId(intentId).forEach(function (moduleId) {
    if (enabled) {
      moduleToggles[moduleId] = true;
      return;
    }
    const neededByAnotherSelectedIntent = WORKSPACE_INTENTS.some(function (intent) {
      return (
        intent.id !== intentId &&
        selectedIntentSet.has(intent.id) &&
        getAnalysisModuleIdsForIntentId(intent.id).includes(moduleId)
      );
    });
    moduleToggles[moduleId] = neededByAnotherSelectedIntent;
  });
  return {
    ...workbench,
    moduleToggles,
  };
}

export function isLabFocusLayer(value: unknown): value is LabFocusLayer {
  return value === "preview" || value === "timeline" || value === "inspector";
}

export function normalizeInspectionMode(value: unknown): LabInspectionMode {
  switch (value) {
    case "visual":
    case "audio":
    case "motion":
      return value;
    default:
      return "none";
  }
}

export function resetInspectionMode(state: LabStoreState) {
  state.ui.inspectionMode = "none";
}

function isLabIntentId(value: unknown): value is LabIntentId {
  return (
    typeof value === "string" &&
    WORKSPACE_INTENTS.some(function (intent) {
      return intent.id === value;
    })
  );
}

export function normalizeLabIntentIds(values: unknown): LabIntentId[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return Array.from(
    new Set(
      values.filter(function (value): value is LabIntentId {
        return isLabIntentId(value);
      })
    )
  );
}

export function clearRoiFocus(state: LabStoreState) {
  state.ui.roiFocusActive = false;
}

export function clearInspectionSnapshot(state: LabStoreState) {
  state.ui.activeInspectionSnapshot = null;
}

export function clearInspectionDepth(state: LabStoreState) {
  clearRoiFocus(state);
  clearInspectionSnapshot(state);
}

export function createImageInspectionSelection(
  roi: NonNullable<LabSelection["roi"]>
): LabSelection {
  return {
    id: createLabEventId("selection"),
    startMs: 0,
    endMs: 1,
    type: "inspect",
    intent: "general",
    roi,
    createdAt: Math.max(0, Date.now()),
  };
}

export function createSnapshotEvent(
  message: string,
  severity: LabEventFeedItem["severity"],
  detail: string | null = null,
  scope: LabEventFeedItem["scope"] = "global"
): LabEventFeedItem {
  return {
    id: createLabEventId("ui"),
    kind: "activity",
    severity,
    message,
    detail,
    percent: null,
    timestamp: Date.now(),
    source: "ui",
    action: null,
    stage: null,
    scope,
    moduleId: null,
    rawLine: null,
  };
}
