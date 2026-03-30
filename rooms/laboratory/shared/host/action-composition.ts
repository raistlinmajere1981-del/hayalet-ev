import type { createSubtitleActionRuntime } from "../../main-functions/subtitle-analysis/host/action-handlers.js"

import { createMediaActionRuntime } from "../../main-functions/media-analysis/host/action-handlers.js"
import { createLaboratoryHostActionRuntime } from "./action-runtime.js"
import { createLaboratoryToolMutationRuntime } from "./tool-mutations.js"

type LaboratoryRecord = Record<string, unknown>
type UnknownFn = (...args: unknown[]) => unknown

type LaboratoryHostActionRuntime = ReturnType<typeof createLaboratoryHostActionRuntime>
type LaboratoryHostActionRuntimeDeps = Parameters<typeof createLaboratoryHostActionRuntime>[0]
type LaboratoryToolMutationRuntime = ReturnType<typeof createLaboratoryToolMutationRuntime>
type LaboratoryToolMutationRuntimeDeps = Parameters<typeof createLaboratoryToolMutationRuntime>[0]
type LaboratorySubtitleActionRuntime = ReturnType<typeof createSubtitleActionRuntime>
type LaboratoryMediaActionRuntime = ReturnType<typeof createMediaActionRuntime>

type LaboratoryMediaActionRuntimeDeps = {
  applyEditRecipePatch: UnknownFn
  applyProfilePresetPatch: UnknownFn
  asNonEmptyString: (value: unknown) => string | null
  audioFeatureId: string
  cancelEditJobsForProject: UnknownFn
  cancelFeatureProcess: UnknownFn
  cancelProfileJobsForProject: UnknownFn
  clampNumber: UnknownFn
  clampProfileTranscriptSampleSeconds: UnknownFn
  createDefaultEditState: UnknownFn
  createEmptyProfilePreflight: UnknownFn
  createProject: UnknownFn
  deleteProject: UnknownFn
  ensureProjectExists: UnknownFn
  exportFeatureReport: UnknownFn
  findEditPreset: UnknownFn
  findProfilePreset: UnknownFn
  getActiveProject: UnknownFn
  getDefaultMode: UnknownFn
  getDefaultSourceType: UnknownFn
  getProfileModelDescriptorMap: UnknownFn
  handleLocalPick: UnknownFn
  handleUrlDownload: UnknownFn
  handleYoutubeDownload: UnknownFn
  installProfileModel: UnknownFn
  markCloseoutAsStale: UnknownFn
  markProfileAsStale: UnknownFn
  normalizeProfileArtifactPreferences: UnknownFn
  patchActiveProject: UnknownFn
  patchActiveProjectDrafts: UnknownFn
  refreshActiveProjectMetadata: UnknownFn
  refreshToolStatus: UnknownFn
  removeProfileModel: UnknownFn
  resetEditForCurrentSource: UnknownFn
  resetProfileForCurrentSource: UnknownFn
  runEditPipeline: UnknownFn
  runFeatureProcess: UnknownFn
  runProfilePreflight: UnknownFn
  toRecord: (value: unknown) => LaboratoryRecord
}

type LaboratoryActionCompositionDeps = Omit<
  LaboratoryHostActionRuntimeDeps,
  "getSubtitleActionRuntime" | "mediaActionRuntime" | "toolMutationRuntime"
> &
  LaboratoryToolMutationRuntimeDeps &
  LaboratoryMediaActionRuntimeDeps & {
    getSubtitleActionRuntime: () => LaboratorySubtitleActionRuntime
  }

export function createLaboratoryActionCompositionRuntime(
  deps: LaboratoryActionCompositionDeps
) {
  let laboratoryHostActionRuntime: LaboratoryHostActionRuntime | null = null

  const laboratoryToolMutationRuntimeDeps = {
      callRoomTools: deps.callRoomTools,
      clearJob: deps.clearJob,
      createDefaultToolEntry: deps.createDefaultToolEntry,
      getRuntimeToolIds: deps.getRuntimeToolIds,
      persistToolState: deps.persistToolState,
      pushJobState: deps.pushJobState,
      refreshProfileModelState: deps.refreshProfileModelState,
      registerJob: deps.registerJob,
      roomId: deps.roomId,
      toRecord: deps.toRecord,
    }
  const laboratoryToolMutationRuntime: LaboratoryToolMutationRuntime =
    createLaboratoryToolMutationRuntime(
      laboratoryToolMutationRuntimeDeps as unknown as Parameters<typeof createLaboratoryToolMutationRuntime>[0]
    )

  const mediaActionRuntimeDeps = {
    applyEditRecipePatch: deps.applyEditRecipePatch,
    applyProfilePresetPatch: deps.applyProfilePresetPatch,
    asNonEmptyString: deps.asNonEmptyString,
    audioFeatureId: deps.audioFeatureId,
    cancelEditJobsForProject: deps.cancelEditJobsForProject,
    cancelFeatureProcess: deps.cancelFeatureProcess,
    cancelProfileJobsForProject: deps.cancelProfileJobsForProject,
    clampNumber: deps.clampNumber,
    clampProfileTranscriptSampleSeconds: deps.clampProfileTranscriptSampleSeconds,
    createEmptyProfilePreflight: deps.createEmptyProfilePreflight,
    createDefaultEditState: deps.createDefaultEditState,
    createProject: deps.createProject,
    deleteProject: deps.deleteProject,
    ensureProjectExists: deps.ensureProjectExists,
    exportFeatureReport: deps.exportFeatureReport,
    findEditPreset: deps.findEditPreset,
    findProfilePreset: deps.findProfilePreset,
    getProfileModelDescriptorMap: deps.getProfileModelDescriptorMap,
    getActiveProject: deps.getActiveProject,
    getDefaultMode: deps.getDefaultMode,
    getDefaultSourceType: deps.getDefaultSourceType,
    handleLocalPick: deps.handleLocalPick,
    handleToolMutation(...args: Parameters<LaboratoryHostActionRuntime["handleToolMutation"]>) {
      const hostAction = laboratoryHostActionRuntime
      if (!hostAction) {
        throw new Error("Laboratory host action runtime is not initialized")
      }
      return hostAction.handleToolMutation(...args)
    },
    handleUrlDownload: deps.handleUrlDownload,
    handleYoutubeDownload: deps.handleYoutubeDownload,
    installProfileModel: deps.installProfileModel,
    markCloseoutAsStale: deps.markCloseoutAsStale,
    markProfileAsStale: deps.markProfileAsStale,
    normalizeProfileArtifactPreferences: deps.normalizeProfileArtifactPreferences,
    patchActiveProject: deps.patchActiveProject,
    patchActiveProjectDrafts: deps.patchActiveProjectDrafts,
    refreshActiveProjectMetadata: deps.refreshActiveProjectMetadata,
    refreshToolStatus: deps.refreshToolStatus,
    removeProfileModel: deps.removeProfileModel,
    resetEditForCurrentSource: deps.resetEditForCurrentSource,
    resetProfileForCurrentSource: deps.resetProfileForCurrentSource,
    runFeatureProcess: deps.runFeatureProcess,
    runEditPipeline: deps.runEditPipeline,
    runProfilePreflight: deps.runProfilePreflight,
    toRecord: deps.toRecord,
  }
  const mediaActionRuntime: LaboratoryMediaActionRuntime = createMediaActionRuntime(
    mediaActionRuntimeDeps as unknown as Parameters<typeof createMediaActionRuntime>[0]
  )

  const toolMutationRuntime: LaboratoryHostActionRuntimeDeps["toolMutationRuntime"] = {
    handleToolMutation(api, runtime, requestId, action, toolId, featureStage) {
      return laboratoryToolMutationRuntime.handleToolMutation(
        api,
        runtime as Parameters<LaboratoryToolMutationRuntime["handleToolMutation"]>[1],
        requestId,
        action,
        toolId,
        featureStage
      )
    },
  }

  const laboratoryHostActionRuntimeDeps = {
    asNonEmptyString: deps.asNonEmptyString,
    createRequestId: deps.createRequestId,
    ensureHydrated: deps.ensureHydrated,
    getFeatureIdFromContext: deps.getFeatureIdFromContext,
    getSubtitleActionRuntime: deps.getSubtitleActionRuntime,
    loadContext: deps.loadContext,
    mediaActionRuntime,
    persistProfileModelState: deps.persistProfileModelState,
    persistToolState: deps.persistToolState,
    pushActionResult: deps.pushActionResult,
    pushMediaState: deps.pushMediaState,
    toRecord: deps.toRecord,
    toolMutationRuntime,
  }
  laboratoryHostActionRuntime = createLaboratoryHostActionRuntime(
    laboratoryHostActionRuntimeDeps as unknown as Parameters<typeof createLaboratoryHostActionRuntime>[0]
  )

  const hostActionRuntime = laboratoryHostActionRuntime

  return {
    handleMediaAction: hostActionRuntime.handleMediaAction,
    handleToolMutation: hostActionRuntime.handleToolMutation,
    laboratoryHostActionRuntime: hostActionRuntime,
    laboratoryToolMutationRuntime,
    mediaActionRuntime,
  }
}
