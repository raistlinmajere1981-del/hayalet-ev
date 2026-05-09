import { asLabRecord, asNonEmptyString } from "../../models/lab-types.js";
import type {
  CapabilityFamilyId,
  CapabilityReadiness,
  LabAnalysisPreparationGroup,
  LabAsset,
  LabExpectedOutput,
  LabIntentId,
  LabOperationCapabilityProjection,
  LabPreflightResult,
  LabStoreState,
  LabUserActionEvent,
} from "../../models/lab-types.js";
import {
  CAPABILITY_FAMILIES,
  LAB_ANALYSIS_MODULE_SETTINGS_FIELDS,
  LAB_OPERATION_CAPABILITIES,
  LAB_OPERATION_SETTINGS_FIELDS,
  WORKSPACE_INTENTS,
  getModuleIdsForCapabilityFamily,
  normalizeLabAnalysisModuleSettings,
  normalizeLabOperationSettings,
} from "../../models/lab-types.js";
import { getProjectSource } from "./lab-project-selectors.js";
import { getAssets, getSourceKind, getToolState } from "./lab-source-selectors.js";
import { getTrackedOperationActionId } from "../lab-operation-action-map.js";
import { getUserActions } from "./lab-activity-selectors.js";
import { inferLabAssetSourceKind, type LabAssetSourceKind } from "../../shared/lab-asset-kind.js";

type OperationSourceKind = LabAssetSourceKind;

type OperationTargetContext = {
  blockReason: string | null;
  metadata: Record<string, unknown>;
  sourceKind: OperationSourceKind | null;
  sourceReady: boolean;
};

export function getSourceReady(state: LabStoreState): boolean {
  return state.source !== null && state.sourceProbeStatus === "completed";
}

function getAssetOperationKind(asset: LabAsset): OperationSourceKind | null {
  return inferLabAssetSourceKind(asset);
}

function normalizeOperationSourceKind(value: string): OperationSourceKind {
  return value === "audio" || value === "image" ? value : "video";
}

function getWorkspaceOperationTarget(state: LabStoreState): OperationTargetContext {
  const assetId = asNonEmptyString(state.ui.activeWorkspaceAssetId);
  if (assetId === null) {
    const sourceKind = normalizeOperationSourceKind(getSourceKind(state));
    return {
      blockReason: getSourceReady(state) ? null : "Kaynak henüz hazır değil.",
      metadata: asLabRecord(asLabRecord(state.source)["metadata"]),
      sourceKind,
      sourceReady: getSourceReady(state),
    };
  }

  const asset =
    state.assets.find(function (candidate) {
      return candidate.id === assetId;
    }) || null;
  if (asset === null) {
    return {
      blockReason: "Seçili dosya bulunamadı.",
      metadata: {},
      sourceKind: null,
      sourceReady: false,
    };
  }

  const sourceKind = getAssetOperationKind(asset);
  if (sourceKind === null) {
    return {
      blockReason: "Seçili dosya bu işlem için desteklenmiyor.",
      metadata: asLabRecord(asset.metadata),
      sourceKind: null,
      sourceReady: false,
    };
  }

  if (asNonEmptyString(asset.localPath) === null) {
    return {
      blockReason: "Seçili dosya yerel işlem hedefi değil.",
      metadata: asLabRecord(asset.metadata),
      sourceKind,
      sourceReady: false,
    };
  }

  return {
    blockReason: null,
    metadata: asLabRecord(asset.metadata),
    sourceKind,
    sourceReady: true,
  };
}

export function getSelectedIntents(state: LabStoreState): LabIntentId[] {
  return state.ui.workspace.selectedIntents;
}

export function getAvailableIntents(state: LabStoreState) {
  const operationTarget = getWorkspaceOperationTarget(state);
  const sourceKind = operationTarget.sourceKind;
  const sourceReady = operationTarget.sourceReady;
  const availableCapabilities = getAvailableCapabilities(state);

  return WORKSPACE_INTENTS.map(function (intent) {
    const sourceCompatible =
      sourceKind !== null && intent.sourceKinds.includes(sourceKind as "video" | "audio" | "image");
    const capabilityReadiness = intent.internalCapabilities.map(function (capId) {
      const cap = availableCapabilities.find(function (entry) {
        return entry.id === capId;
      });
      return cap ? cap.readiness : "blocked";
    });
    const allBlocked = capabilityReadiness.every(function (entry) {
      return entry === "blocked";
    });
    const someBlocked = capabilityReadiness.some(function (entry) {
      return entry === "blocked";
    });

    let readiness: "ready" | "optional" | "blocked" = "ready";
    let blockReason: string | null = null;

    if (sourceKind === null) {
      readiness = "blocked";
      blockReason = operationTarget.blockReason || "Not available for this file type.";
    } else if (!sourceReady) {
      readiness = "blocked";
      blockReason = "Source not ready.";
    } else if (!sourceCompatible) {
      readiness = "blocked";
      blockReason = "Not available for this source type.";
    } else if (allBlocked) {
      readiness = "blocked";
      blockReason = "Required tools not installed.";
    } else if (someBlocked) {
      readiness = "optional";
      blockReason = "Some tools missing — partial results.";
    }

    return {
      ...intent,
      readiness,
      blockReason,
      selected: state.ui.workspace.selectedIntents.includes(intent.id),
    };
  });
}

export function getIntentDerivedCapabilities(state: LabStoreState): CapabilityFamilyId[] {
  const selectedIntents = getSelectedIntents(state);
  const capabilitySet = new Set<CapabilityFamilyId>();
  WORKSPACE_INTENTS.forEach(function (intent) {
    if (selectedIntents.includes(intent.id)) {
      intent.internalCapabilities.forEach(function (capId) {
        capabilitySet.add(capId);
      });
    }
  });
  return Array.from(capabilitySet);
}

export function getEffectiveSelectedCapabilities(state: LabStoreState) {
  const intentDerivedCapabilities = getIntentDerivedCapabilities(state);
  if (intentDerivedCapabilities.length > 0) {
    return intentDerivedCapabilities;
  }
  return getSelectedCapabilities(state);
}

export function getCurrentPreflight(state: LabStoreState): LabPreflightResult {
  const source = getProjectSource(state);
  const operationTarget = getWorkspaceOperationTarget(state);
  if (Object.keys(source).length === 0) {
    return {
      status: "idle",
      missingDependencies: [],
      warnings: [],
      estimatedRuntime: null,
      enabledModules: [],
      stageReady: false,
      rawStatus: null,
      reason: "Önce kaynak seçilmelidir.",
    };
  }

  if (operationTarget.sourceKind === null || operationTarget.sourceReady !== true) {
    return {
      status: "idle",
      missingDependencies: [],
      warnings: [],
      estimatedRuntime: null,
      enabledModules: [],
      stageReady: false,
      rawStatus: null,
      reason: operationTarget.blockReason || "Kaynak probe tamamlanmadan ön kontrol doğrulanamaz.",
    };
  }

  const selectedCapabilities = getEffectiveSelectedCapabilities(state);
  if (selectedCapabilities.length === 0) {
    return {
      status: "blocked",
      missingDependencies: [],
      warnings: [],
      estimatedRuntime: null,
      enabledModules: [],
      stageReady: false,
      rawStatus: null,
      reason: "Önce en az bir yetenek ailesi seçilmelidir.",
    };
  }

  const selectedEntries = getAvailableCapabilities(state).filter(function (entry) {
    return selectedCapabilities.includes(entry.id);
  });
  const blockedEntries = selectedEntries.filter(function (entry) {
    return entry.readiness === "blocked";
  });
  const warningEntries = selectedEntries.filter(function (entry) {
    return entry.readiness === "optional";
  });

  const missingDependencies = blockedEntries.map(function (entry) {
    return entry.label;
  });
  const warnings = warningEntries.map(function (entry) {
    return entry.blockReason || `${entry.label} kısmi hazırlıkta.`;
  });
  const hostPreflight = state.preflight;
  const stageReady = blockedEntries.length === 0 && selectedEntries.length > 0;

  return {
    status: stageReady !== true ? "blocked" : warnings.length > 0 ? "warning" : "ready",
    missingDependencies,
    warnings:
      hostPreflight && hostPreflight.warnings.length > 0
        ? Array.from(new Set(hostPreflight.warnings.concat(warnings)))
        : warnings,
    estimatedRuntime:
      hostPreflight?.estimatedRuntime || Math.max(60, Math.round(selectedEntries.length * 75)),
    enabledModules: Array.isArray(selectedCapabilities) ? selectedCapabilities.slice() : [],
    stageReady,
    rawStatus: hostPreflight?.rawStatus || null,
    reason:
      stageReady !== true
        ? blockedEntries[0]?.blockReason || "Seçili yetenekler henüz hazır değil."
        : warnings.length > 0
          ? "Araç uyarıları var ama işlem başlatılabilir."
          : null,
  };
}

export function getExpectedOutputs(intentId: string): LabExpectedOutput[] {
  switch (intentId) {
    case "visual-inspection":
      return [
        { intentId, label: "Frame çıktıları", assetTypes: ["frame", "image"] },
        { intentId, label: "Anomali verileri", assetTypes: ["artifact"] },
      ];
    case "audio-investigation":
      return [{ intentId, label: "Ses çıktısı", assetTypes: ["audio"] }];
    default:
      return [];
  }
}

export function getActualOutputs(state: LabStoreState, intentId: string): LabAsset[] {
  return getAssets(state).filter(function (asset) {
    return Array.isArray(asset.intentIds) && asset.intentIds.includes(intentId);
  });
}

export function isExpectedOutputMatched(
  expectedOutput: LabExpectedOutput,
  actualOutputs: LabAsset[]
): boolean {
  return expectedOutput.assetTypes.some(function (assetType) {
    return actualOutputs.some(function (asset) {
      return asset.type === assetType;
    });
  });
}

export function getSelectedCapabilities(state: LabStoreState): CapabilityFamilyId[] {
  return state.selectedCapabilities;
}

export function getAvailableCapabilities(state: LabStoreState) {
  const operationTarget = getWorkspaceOperationTarget(state);
  const sourceKind = operationTarget.sourceKind;
  const sourceReady = operationTarget.sourceReady;
  const toolState = getToolState(state);
  const toolRegistry = asLabRecord(toolState["tools"]);
  const effectiveSelectedCapabilities = getEffectiveSelectedCapabilities(state);

  return CAPABILITY_FAMILIES.map(function (family) {
    const sourceCompatible =
      sourceKind !== null && family.sourceKinds.includes(sourceKind as "video" | "audio" | "image");
    const toolsReady = family.requiredTools.every(function (toolId) {
      const tool = asLabRecord(toolRegistry[toolId]);
      return tool["installed"] === true || asNonEmptyString(tool["status"]) === "installed";
    });
    const toolsMissing = family.requiredTools.filter(function (toolId) {
      const tool = asLabRecord(toolRegistry[toolId]);
      return tool["installed"] !== true && asNonEmptyString(tool["status"]) !== "installed";
    });

    let readiness: "ready" | "optional" | "blocked" = "ready";
    let blockReason: string | null = null;

    if (sourceKind === null) {
      readiness = "blocked";
      blockReason = operationTarget.blockReason || "Bu dosya türü desteklenmiyor.";
    } else if (!sourceReady) {
      readiness = "blocked";
      blockReason = operationTarget.blockReason || "Kaynak henüz hazır değil.";
    } else if (!sourceCompatible) {
      readiness = "blocked";
      blockReason = `Bu kaynak türü (${sourceKind}) desteklenmiyor.`;
    } else if (!toolsReady) {
      if (toolsMissing.length === family.requiredTools.length) {
        readiness = "blocked";
        blockReason = `Eksik araç: ${toolsMissing.join(", ")}`;
      } else {
        readiness = "optional";
        blockReason = `Opsiyonel araç eksik: ${toolsMissing.join(", ")}`;
      }
    }

    return {
      ...family,
      readiness,
      blockReason,
      selected: effectiveSelectedCapabilities.includes(family.id),
    };
  });
}

function getMissingToolIds(state: LabStoreState, toolIds: string[]) {
  const toolState = getToolState(state);
  const toolRegistry = asLabRecord(toolState["tools"]);
  return toolIds.filter(function (toolId) {
    const tool = asLabRecord(toolRegistry[toolId]);
    return tool["installed"] !== true && asNonEmptyString(tool["status"]) !== "installed";
  });
}

function getReadableModuleLabel(moduleId: string) {
  return moduleId
    .split("-")
    .filter(function (part) {
      return part.trim() !== "";
    })
    .map(function (part) {
      return `${part.charAt(0).toUpperCase()}${part.slice(1)}`;
    })
    .join(" ");
}

function getReportSectionForCapability(capabilityId: CapabilityFamilyId) {
  switch (capabilityId) {
    case "visual-structure":
      return "Visual structure";
    case "visual-forensics":
      return "Visual forensics";
    case "audio-signal":
      return "Audio signal";
    case "audio-recovery":
      return "Audio recovery";
    case "transcription":
    case "speaker-analysis":
      return "Speech evidence";
    case "prosody-emotion":
      return "Prosody and emotion";
    case "sound-classification":
      return "Sound events";
    case "source-separation":
      return "Separated sources";
    case "music-analysis":
      return "Music descriptors";
    default:
      return "Analysis evidence";
  }
}

function getLatestOperationUserAction(
  state: LabStoreState,
  capability: (typeof LAB_OPERATION_CAPABILITIES)[number]
): LabUserActionEvent | null {
  const trackedAction = getTrackedOperationActionId(capability.actionId);
  if (trackedAction === null) {
    return null;
  }
  return (
    getUserActions(state).find(function (entry) {
      return entry.sourceAction === trackedAction;
    }) || null
  );
}

function getOperationAudioBlockReason(sourceKind: string, metadata: Record<string, unknown>) {
  if (sourceKind === "audio") {
    return null;
  }
  if (sourceKind !== "video") {
    return "Bu işlem için ses akışı gerekir.";
  }
  const audioCodec = asNonEmptyString(metadata["audioCodec"]);
  const codec = asNonEmptyString(metadata["codec"]);
  if (audioCodec !== null || (codec !== null && codec.includes("+"))) {
    return null;
  }
  return Object.keys(metadata).length > 0 ? "Bu kaynakta ses akışı algılanmadı." : null;
}

export function getOperationSettings(
  state: LabStoreState,
  capabilityId: (typeof LAB_OPERATION_CAPABILITIES)[number]["id"]
) {
  const settings = asLabRecord(asLabRecord(state.workbench)["operationSettings"]);
  return normalizeLabOperationSettings(capabilityId, settings[capabilityId]);
}

export function getAvailableOperationCapabilities(
  state: LabStoreState
): LabOperationCapabilityProjection[] {
  const operationTarget = getWorkspaceOperationTarget(state);
  const sourceKind = operationTarget.sourceKind;
  if (sourceKind === null) {
    return [];
  }
  const sourceReady = operationTarget.sourceReady;
  const selection = state.ui.workspace.activeSelection;
  const hasSelection = selection !== null && selection.endMs > selection.startMs;
  const hasRoi = selection?.roi !== undefined;

  return LAB_OPERATION_CAPABILITIES.map(function (capability) {
    const sourceCompatible = capability.sourceKinds.includes(
      sourceKind as "video" | "audio" | "image"
    );
    const missingTools = getMissingToolIds(state, capability.toolIds);
    const activeAction = getLatestOperationUserAction(state, capability);
    const audioBlockReason =
      capability.groupId === "audio" || capability.groupId === "stems"
        ? getOperationAudioBlockReason(sourceKind, operationTarget.metadata)
        : null;

    let readiness: CapabilityReadiness = "ready";
    let blockReason: string | null = null;

    if (!sourceReady) {
      readiness = "blocked";
      blockReason = operationTarget.blockReason || "Kaynak henüz hazır değil.";
    } else if (!sourceCompatible) {
      readiness = "blocked";
      blockReason = `Bu kaynak türü (${sourceKind}) desteklenmiyor.`;
    } else if (audioBlockReason !== null) {
      readiness = "blocked";
      blockReason = audioBlockReason;
    } else if (capability.requiresSelection === true && !hasSelection) {
      readiness = "blocked";
      blockReason = "Önce zaman aralığı seçilmelidir.";
    } else if (capability.requiresRoi === true && !hasRoi) {
      readiness = "blocked";
      blockReason = "Önce görüntü üzerinde ROI seçilmelidir.";
    } else if (missingTools.length > 0) {
      readiness = "blocked";
      blockReason = `Eksik araç: ${missingTools.join(", ")}`;
    } else if (capability.planned === true || capability.actionId === null) {
      readiness = "blocked";
      blockReason = "Bu işlem için runner henüz bağlanmadı.";
    }

    return {
      ...capability,
      readiness,
      blockReason,
      settings: getOperationSettings(state, capability.id),
      settingsFields: LAB_OPERATION_SETTINGS_FIELDS[capability.id] || [],
      actionStatus: activeAction?.status ?? "idle",
      activeActionLabel: activeAction?.label ?? null,
      activeActionMessage: activeAction?.message ?? null,
      activeJobId: activeAction?.jobId ?? null,
      activeRequestId: activeAction?.requestId ?? null,
      progress: activeAction?.progress ?? null,
      ...(activeAction?.resultAssetIds === undefined
        ? {}
        : { resultAssetIds: activeAction.resultAssetIds }),
    };
  }).filter(function (capability) {
    return capability.sourceKinds.includes(sourceKind as "video" | "audio" | "image");
  });
}

export function getAnalysisPreparationGroups(state: LabStoreState): LabAnalysisPreparationGroup[] {
  const availableCapabilities = getAvailableCapabilities(state);
  const selectedIntents = getSelectedIntents(state);
  const moduleToggles = asLabRecord(asLabRecord(state.workbench)["moduleToggles"]);
  const analysisSettings = asLabRecord(asLabRecord(state.workbench)["analysisSettings"]);
  const moduleSettings = asLabRecord(analysisSettings["modules"]);

  return WORKSPACE_INTENTS.map(function (intent) {
    const intentSelected = selectedIntents.includes(intent.id);
    const modules = intent.internalCapabilities.flatMap(function (capabilityId) {
      const capability = availableCapabilities.find(function (entry) {
        return entry.id === capabilityId;
      });
      const readiness = capability?.readiness ?? "blocked";
      const blockReason = capability?.blockReason ?? null;
      const requiredTools = capability?.requiredTools ?? [];
      return getModuleIdsForCapabilityFamily(capabilityId).map(function (moduleId) {
        return {
          capabilityId,
          moduleId,
          label: getReadableModuleLabel(moduleId),
          flowKind: "analysis-report" as const,
          requiredTools: requiredTools.slice(),
          readiness,
          blockReason,
          enabled: intentSelected && moduleToggles[moduleId] === true,
          settings: normalizeLabAnalysisModuleSettings(moduleId, moduleSettings[moduleId]),
          settingsFields: LAB_ANALYSIS_MODULE_SETTINGS_FIELDS[moduleId] || [],
          reportSection: getReportSectionForCapability(capabilityId),
        };
      });
    });
    const selectedModules = modules.filter(function (module) {
      return module.enabled;
    });
    const selectionState =
      !intentSelected || selectedModules.length === 0
        ? "none"
        : selectedModules.length === modules.length
          ? "full"
          : "partial";
    const selected = selectionState !== "none";
    const blockedModules = selectedModules.filter(function (module) {
      return module.readiness === "blocked";
    });
    const optionalModules = selectedModules.filter(function (module) {
      return module.readiness === "optional";
    });
    const readiness: CapabilityReadiness =
      selectedModules.length === 0 || blockedModules.length === selectedModules.length
        ? "blocked"
        : blockedModules.length > 0 || optionalModules.length > 0
          ? "optional"
          : "ready";

    return {
      intentId: intent.id,
      label: intent.label,
      description: intent.description,
      selected,
      selectionState,
      readiness,
      blockReason:
        readiness === "blocked"
          ? blockedModules[0]?.blockReason || "Seçili rapor modülleri hazır değil."
          : readiness === "optional"
            ? "Bazı modüller kısmi veya kapalı durumda."
            : null,
      expectedOutputs: getExpectedOutputs(intent.id),
      modules,
    };
  });
}

export function getCapabilityWorkflowSummary(state: LabStoreState) {
  const selected = getEffectiveSelectedCapabilities(state);
  const available = getAvailableCapabilities(state);
  const selectedFamilies = available.filter(function (entry) {
    return selected.includes(entry.id);
  });
  const readyCount = selectedFamilies.filter(function (entry) {
    return entry.readiness === "ready";
  }).length;

  return {
    familyCount: selectedFamilies.length,
    readyCount,
    blockedCount: selectedFamilies.length - readyCount,
    selectedIds: selected,
  };
}
