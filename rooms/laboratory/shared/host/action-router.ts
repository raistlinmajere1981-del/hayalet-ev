import type { createMediaActionRuntime } from "../../main-functions/media-analysis/host/action-handlers.js";
import type { createSubtitleActionRuntime } from "../../main-functions/subtitle-analysis/host/action-handlers.js";

type LaboratoryRecord = Record<string, unknown>;
type LaboratoryMediaActionRuntime = ReturnType<typeof createMediaActionRuntime>;
type LaboratorySubtitleActionRuntime = ReturnType<typeof createSubtitleActionRuntime>;

type LaboratoryRuntimeRecord = {
  activeProjectId?: string | null;
} & LaboratoryRecord;

type LaboratoryRoomApi = LaboratoryRecord & {
  log: (level: string, message: string) => void;
};

type LaboratoryActionEnvelope = LaboratoryRecord & {
  action?: unknown;
  payload?: unknown;
  requestId?: unknown;
};

type LaboratoryActionPayload = LaboratoryRecord & {
  featureId?: unknown;
  featureStage?: unknown;
  fields?: unknown;
};

type LaboratoryActionRouterDeps = {
  asNonEmptyString: (value: unknown) => string | null;
  createRequestId: () => string;
  ensureHydrated: (api: LaboratoryRoomApi, runtime: LaboratoryRuntimeRecord) => Promise<unknown>;
  getFeatureIdFromContext: (payload: unknown) => string | null;
  loadContext: (api: LaboratoryRoomApi) => LaboratoryRecord;
  mediaActionRuntime: LaboratoryMediaActionRuntime;
  persistProfileModelState: (runtime: LaboratoryRuntimeRecord) => Promise<unknown> | unknown;
  persistToolState: (runtime: LaboratoryRuntimeRecord) => Promise<unknown> | unknown;
  pushActionResult: (
    api: LaboratoryRoomApi,
    payload: {
      action: string;
      error?: string;
      requestId: string;
      success: boolean;
    }
  ) => void;
  pushMediaState: (
    api: LaboratoryRoomApi,
    runtime: LaboratoryRuntimeRecord,
    requestId: string,
    action: string
  ) => void;
  subtitleActionRuntime: LaboratorySubtitleActionRuntime;
  toRecord: (value: unknown) => LaboratoryRecord;
};

export function createLaboratoryActionRouter(deps: LaboratoryActionRouterDeps) {
  const {
    asNonEmptyString,
    createRequestId,
    ensureHydrated,
    getFeatureIdFromContext,
    loadContext,
    mediaActionRuntime,
    persistProfileModelState,
    persistToolState,
    pushActionResult,
    pushMediaState,
    subtitleActionRuntime,
    toRecord,
  } = deps;

  function toActionEnvelope(value: unknown): LaboratoryActionEnvelope {
    return toRecord(value);
  }

  function toActionPayload(value: unknown): LaboratoryActionPayload {
    return toRecord(value);
  }

  async function dispatch(
    api: LaboratoryRoomApi,
    runtime: LaboratoryRuntimeRecord,
    payload: LaboratoryActionEnvelope
  ) {
    const actionEnvelope = toActionEnvelope(payload);
    const requestId = asNonEmptyString(actionEnvelope.requestId) || createRequestId();
    const action = asNonEmptyString(actionEnvelope.action);
    const actionPayload = toActionPayload(actionEnvelope.payload);
    const featureStage = asNonEmptyString(actionPayload.featureStage);
    const featureId =
      asNonEmptyString(actionPayload.featureId) || getFeatureIdFromContext(loadContext(api));

    if (action === null) {
      pushActionResult(api, {
        requestId,
        success: false,
        action: "",
        error: "Action is missing.",
      });
      return;
    }

    try {
      await ensureHydrated(api, runtime);

      switch (action) {
        case "refresh":
          await mediaActionRuntime.refresh(runtime, requestId, false);
          break;
        case "tools-refresh":
          await mediaActionRuntime.refresh(runtime, requestId, true);
          break;
        case "project-create":
          await mediaActionRuntime.createProject(runtime, featureId);
          break;
        case "project-select":
          await mediaActionRuntime.selectProject(runtime, requestId, featureId, actionPayload);
          break;
        case "project-delete":
          await mediaActionRuntime.deleteProject(runtime, requestId, featureId, actionPayload);
          break;
        case "subtitle-source-set-mode":
          await subtitleActionRuntime.setSourceMode(runtime, actionPayload);
          break;
        case "subtitle-source-update-drafts":
          await subtitleActionRuntime.updateDrafts(runtime, toRecord(actionPayload.fields));
          break;
        case "subtitle-source-pick-local":
          await subtitleActionRuntime.pickLocal(api, runtime, requestId, actionPayload);
          break;
        case "subtitle-source-pick-folder":
          await subtitleActionRuntime.pickFolder(api, runtime, requestId, actionPayload);
          break;
        case "subtitle-source-download-url":
          await subtitleActionRuntime.downloadUrl(api, runtime, requestId, actionPayload);
          break;
        case "subtitle-source-discover-youtube":
          await subtitleActionRuntime.discoverYoutube(api, runtime, requestId, actionPayload);
          break;
        case "subtitle-source-download-youtube":
          await subtitleActionRuntime.downloadYoutube(api, runtime, requestId, actionPayload);
          break;
        case "subtitle-source-toggle-discovery":
          await subtitleActionRuntime.toggleDiscovery(runtime, actionPayload);
          break;
        case "subtitle-source-select-all-discovery":
          await subtitleActionRuntime.selectAllDiscovery(runtime);
          break;
        case "subtitle-source-clear-discovery-selection":
          await subtitleActionRuntime.clearDiscoverySelection(runtime);
          break;
        case "subtitle-source-select-entry":
          await subtitleActionRuntime.selectEntry(runtime, actionPayload);
          break;
        case "subtitle-source-toggle-selection":
          await subtitleActionRuntime.toggleSelection(runtime, actionPayload);
          break;
        case "source-set-kind":
          await mediaActionRuntime.setSourceKind(runtime, actionPayload);
          break;
        case "source-set-mode":
          await mediaActionRuntime.setSourceMode(runtime, actionPayload);
          break;
        case "source-update-draft":
          await mediaActionRuntime.updateDrafts(runtime, toRecord(actionPayload["fields"]));
          break;
        case "source-pick-local":
          await mediaActionRuntime.pickLocal(api, runtime, requestId, actionPayload);
          break;
        case "source-download-url":
          await mediaActionRuntime.downloadUrl(api, runtime, requestId, actionPayload);
          break;
        case "source-download-youtube":
          await mediaActionRuntime.downloadYoutube(api, runtime, requestId, actionPayload);
          break;
        case "edit-set-mode":
          await mediaActionRuntime.setEditMode(runtime, actionPayload);
          break;
        case "subtitle-edit-apply-preset":
          await subtitleActionRuntime.applyEditPreset(runtime, actionPayload);
          break;
        case "subtitle-edit-update-recipe":
          await subtitleActionRuntime.updateEditRecipe(runtime, actionPayload);
          break;
        case "subtitle-edit-preview":
          await subtitleActionRuntime.previewEdit(runtime, requestId, actionPayload);
          break;
        case "subtitle-edit-apply":
          await subtitleActionRuntime.applyEdit(runtime, requestId, actionPayload);
          break;
        case "edit-apply-preset":
          await mediaActionRuntime.applyEditPreset(runtime, actionPayload);
          break;
        case "edit-update-recipe":
          await mediaActionRuntime.updateEditRecipe(runtime, actionPayload);
          break;
        case "edit-set-output":
          await mediaActionRuntime.setEditOutput(runtime, actionPayload);
          break;
        case "edit-set-handoff":
          await mediaActionRuntime.setEditHandoff(runtime, actionPayload);
          break;
        case "edit-preview":
          await mediaActionRuntime.previewEdit(api, runtime, requestId, actionPayload);
          break;
        case "edit-apply":
          await mediaActionRuntime.applyEdit(api, runtime, requestId, actionPayload);
          break;
        case "edit-cancel-preview":
          await mediaActionRuntime.cancelPreview(api, runtime, requestId);
          break;
        case "edit-cancel-apply":
          await mediaActionRuntime.cancelApply(api, runtime, requestId);
          break;
        case "profile-set-mode":
          await mediaActionRuntime.setProfileMode(runtime, actionPayload);
          break;
        case "profile-apply-preset":
          await mediaActionRuntime.applyProfilePreset(runtime, actionPayload);
          break;
        case "profile-update":
          await mediaActionRuntime.updateProfile(runtime, actionPayload);
          break;
        case "profile-set-target":
          await mediaActionRuntime.setProfileTarget(runtime, actionPayload);
          break;
        case "profile-set-model":
          await mediaActionRuntime.setProfileModel(runtime, actionPayload);
          break;
        case "profile-run-preflight":
          await mediaActionRuntime.runProfile(api, runtime, requestId);
          break;
        case "profile-cancel-preflight":
          await mediaActionRuntime.cancelProfile(api, runtime, requestId);
          break;
        case "profile-model-install":
          await mediaActionRuntime.installProfile(api, runtime, requestId, actionPayload);
          break;
        case "profile-model-remove":
          await mediaActionRuntime.removeProfile(runtime, requestId, actionPayload);
          break;
        case "process-run":
        case "audio-process-run":
          await mediaActionRuntime.runProcess(
            api,
            runtime,
            requestId,
            featureId,
            toRecord(loadContext(api))["workbench"]
          );
          break;
        case "process-cancel":
        case "audio-process-cancel":
          await mediaActionRuntime.cancelProcess(
            api,
            runtime,
            requestId,
            featureId,
            toRecord(loadContext(api))["workbench"]
          );
          break;
        case "job-cancel":
          await mediaActionRuntime.cancelJob(api, runtime, requestId, actionPayload);
          break;
        case "report-export":
        case "audio-report-export":
          await mediaActionRuntime.exportReport(api, runtime, requestId, featureId);
          break;
        case "tool-install":
        case "tool-update":
          await mediaActionRuntime.mutateTool(
            api,
            runtime,
            requestId,
            action,
            actionPayload,
            featureStage || "source"
          );
          break;
        default:
          throw new Error(`Unsupported media action: ${action}`);
      }

      await persistToolState(runtime);
      await persistProfileModelState(runtime);
      pushMediaState(api, runtime, requestId, action);
      pushActionResult(api, {
        requestId,
        success: true,
        action,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      api.log("warn", `Laboratory media action failed: ${action} -> ${message}`);
      pushMediaState(api, runtime, requestId, action);
      pushActionResult(api, {
        requestId,
        success: false,
        action,
        error: message,
      });
    }
  }

  return {
    dispatch,
  };
}
