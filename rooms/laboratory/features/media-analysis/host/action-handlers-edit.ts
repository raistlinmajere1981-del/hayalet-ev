import { createLaboratoryControlInjectionRuntime } from "./control-injection.js";
import { createLaboratoryTemporalStressTestRuntime } from "./temporal-stress-test.js";

type MediaEditActionApi = Record<string, unknown>;
type MediaEditProjectIdentity = {
  id?: unknown;
} & Record<string, unknown>;
type MediaEditProjectRecord = {
  edit: {
    mode?: string;
    lastError?: string | null;
    lastActionAt?: string | null;
    recipe: {
      common: {
        outputNameHint?: string;
        notes?: string;
      };
    };
    outputs?: unknown[];
    activeOutputId?: string | null;
    handoffMode?: string;
    preview?: Record<string, unknown>;
  };
  source: {
    kind?: unknown;
    storedPath?: unknown;
  };
} & Record<string, unknown>;
type MediaEditRuntimeRecord = {
  editPresets?: unknown;
} & Record<string, unknown>;

type EditDeps = {
  applyEditRecipePatch: (
    runtime: MediaEditRuntimeRecord,
    project: MediaEditProjectRecord,
    patch: Record<string, unknown>,
    options: Record<string, unknown>
  ) => void;
  asNonEmptyString: (value: unknown) => string | null;
  audioFeatureId: string;
  callRoomTools: (payload: Record<string, unknown>) => Promise<unknown>;
  cancelEditJobsForProject: (
    api: MediaEditActionApi,
    runtime: MediaEditRuntimeRecord,
    projectId: string,
    requestId: string,
    action: string
  ) => Promise<void>;
  createDefaultEditState: (presets: unknown, sourceKind: unknown) => MediaEditProjectRecord["edit"];
  findEditPreset: (
    runtime: MediaEditRuntimeRecord,
    project: MediaEditProjectRecord,
    presetId: string | null
  ) => Record<string, unknown> | null;
  getActiveProject: (runtime: MediaEditRuntimeRecord) => MediaEditProjectIdentity | null;
  getProjectEditOutputDir: (runtime: MediaEditRuntimeRecord, project: MediaEditProjectRecord) => string;
  markCloseoutAsStale: (
    project: MediaEditProjectRecord,
    reason: string,
    featureIds?: string[]
  ) => void;
  markProfileAsStale: (
    project: MediaEditProjectRecord,
    reason: string,
    options?: Record<string, unknown>
  ) => void;
  patchActiveProject: (
    runtime: MediaEditRuntimeRecord,
    patcher: (project: MediaEditProjectRecord) => MediaEditProjectRecord
  ) => Promise<MediaEditProjectRecord>;
  roomId: string;
  runEditPipeline: (
    api: MediaEditActionApi,
    runtime: MediaEditRuntimeRecord,
    requestId: string,
    mode: string
  ) => Promise<unknown>;
  toRecord: (value: unknown) => Record<string, unknown>;
};

export function createMediaEditActionRuntime(deps: EditDeps) {
  const {
    applyEditRecipePatch,
    asNonEmptyString,
    audioFeatureId,
    callRoomTools,
    cancelEditJobsForProject,
    createDefaultEditState,
    findEditPreset,
    getActiveProject,
    getProjectEditOutputDir,
    markCloseoutAsStale,
    markProfileAsStale,
    patchActiveProject,
    roomId,
    runEditPipeline,
    toRecord,
  } = deps;

  const temporalStressTestRuntime = createLaboratoryTemporalStressTestRuntime({
    callRoomTools,
    async ensureProjectDirectories() {
      // Prepared Laboratory projects already own the edit/output directory tree.
    },
    getActiveProject(runtime) {
      return getActiveProject(runtime);
    },
    getPreparedSourcePath(project) {
      return asNonEmptyString(toRecord(project.source)["storedPath"]);
    },
    getProjectEditOutputDir(runtime, project) {
      return getProjectEditOutputDir(runtime, project as MediaEditProjectRecord);
    },
    patchActiveProject(runtime, patcher) {
      return patchActiveProject(runtime, function (project) {
        return patcher(project) as MediaEditProjectRecord;
      });
    },
    roomId,
    toRecord,
  });

  const controlInjectionRuntime = createLaboratoryControlInjectionRuntime({
    callRoomTools,
    getActiveProject(runtime) {
      return getActiveProject(runtime);
    },
    getPreparedSourcePath(project) {
      return asNonEmptyString(toRecord(project.source)["storedPath"]);
    },
    getProjectEditOutputDir(runtime, project) {
      return getProjectEditOutputDir(runtime, project as MediaEditProjectRecord);
    },
    patchActiveProject(runtime, patcher) {
      return patchActiveProject(runtime, function (project) {
        return patcher(project) as MediaEditProjectRecord;
      });
    },
    roomId,
    temporalRuntime: temporalStressTestRuntime,
    toRecord,
  });

  async function setEditMode(
    runtime: MediaEditRuntimeRecord,
    actionPayload: Record<string, unknown>
  ) {
    return patchActiveProject(runtime, function (nextProject: MediaEditProjectRecord) {
      nextProject.edit.mode =
        asNonEmptyString(actionPayload["mode"]) === "advanced" ? "advanced" : "beginner";
      nextProject.edit.lastError = null;
      nextProject.edit.lastActionAt = new Date().toISOString();
      return nextProject;
    });
  }

  async function applyEditPreset(
    runtime: MediaEditRuntimeRecord,
    actionPayload: Record<string, unknown>
  ) {
    return patchActiveProject(runtime, function (nextProject: MediaEditProjectRecord) {
      const presetId = asNonEmptyString(actionPayload["presetId"]);
      const preset = findEditPreset(runtime, nextProject, presetId);
      if (!presetId || !preset) {
        throw new Error("Requested edit preset is unavailable for the current source.");
      }

      const currentMode = asNonEmptyString(toRecord(nextProject.edit)["mode"]) || "beginner";
      const preservedCommon = {
        outputNameHint:
          asNonEmptyString(
            toRecord(toRecord(nextProject.edit.recipe)["common"])["outputNameHint"]
          ) || "",
        notes:
          asNonEmptyString(toRecord(toRecord(nextProject.edit.recipe)["common"])["notes"]) || "",
      };

      nextProject.edit = createDefaultEditState(runtime.editPresets, nextProject.source.kind);
      nextProject.edit.mode = currentMode;
      nextProject.edit.recipe.common.outputNameHint = preservedCommon.outputNameHint;
      nextProject.edit.recipe.common.notes = preservedCommon.notes;
      applyEditRecipePatch(runtime, nextProject, toRecord(toRecord(preset)["patch"]), {
        presetId: presetId,
      });
      return nextProject;
    });
  }

  async function updateEditRecipe(
    runtime: MediaEditRuntimeRecord,
    actionPayload: Record<string, unknown>
  ) {
    return patchActiveProject(runtime, function (nextProject: MediaEditProjectRecord) {
      applyEditRecipePatch(
        runtime,
        nextProject,
        toRecord(actionPayload["patch"] || actionPayload["fields"]),
        {}
      );
      return nextProject;
    });
  }

  async function setEditOutput(
    runtime: MediaEditRuntimeRecord,
    actionPayload: Record<string, unknown>
  ) {
    return patchActiveProject(runtime, function (nextProject: MediaEditProjectRecord) {
      const outputId = asNonEmptyString(actionPayload["outputId"]);
      const outputs = Array.isArray(nextProject.edit.outputs) ? nextProject.edit.outputs : [];
      const hasOutput = outputs.some(function (entry: unknown) {
        return asNonEmptyString(toRecord(entry)["id"]) === outputId;
      });

      nextProject.edit.activeOutputId = hasOutput ? outputId : null;
      if (hasOutput !== true) {
        nextProject.edit.handoffMode = "source";
      }
      nextProject.edit.lastError = null;
      nextProject.edit.lastActionAt = new Date().toISOString();
      markProfileAsStale(
        nextProject,
        "Derived output selection changed; rerun the profile preflight.",
        { clearTargetOutput: hasOutput !== true }
      );
      markCloseoutAsStale(nextProject, "Derived output selection changed.", [audioFeatureId]);
      return nextProject;
    });
  }

  async function setEditHandoff(
    runtime: MediaEditRuntimeRecord,
    actionPayload: Record<string, unknown>
  ) {
    return patchActiveProject(runtime, function (nextProject: MediaEditProjectRecord) {
      const requestedMode =
        asNonEmptyString(actionPayload["mode"]) === "derived" ? "derived" : "source";
      if (
        requestedMode === "derived" &&
        asNonEmptyString(nextProject.edit.activeOutputId) === null
      ) {
        throw new Error("Generate and select a derived output before enabling derived handoff.");
      }

      nextProject.edit.handoffMode = requestedMode;
      nextProject.edit.lastError = null;
      nextProject.edit.lastActionAt = new Date().toISOString();
      markCloseoutAsStale(nextProject, "Downstream handoff changed.");
      return nextProject;
    });
  }

  async function previewEdit(
    api: MediaEditActionApi,
    runtime: MediaEditRuntimeRecord,
    requestId: string,
    actionPayload: Record<string, unknown>
  ) {
    if (Object.keys(toRecord(actionPayload["patch"])).length > 0) {
      await patchActiveProject(runtime, function (nextProject: MediaEditProjectRecord) {
        applyEditRecipePatch(runtime, nextProject, toRecord(actionPayload["patch"]), {});
        return nextProject;
      });
    }
    return runEditPipeline(api, runtime, requestId, "preview");
  }

  async function runTemporalStressTest(
    runtime: MediaEditRuntimeRecord,
    requestId: string,
    actionPayload: Record<string, unknown>
  ) {
    return temporalStressTestRuntime.runTemporalStressTest(
      runtime,
      requestId,
      actionPayload["request"]
    );
  }

  async function runControlInjection(
    runtime: MediaEditRuntimeRecord,
    requestId: string,
    actionPayload: Record<string, unknown>
  ) {
    return controlInjectionRuntime.runControlInjection(
      runtime,
      requestId,
      actionPayload["request"]
    );
  }

  async function applyEdit(
    api: MediaEditActionApi,
    runtime: MediaEditRuntimeRecord,
    requestId: string,
    actionPayload: Record<string, unknown>
  ) {
    if (Object.keys(toRecord(actionPayload["patch"])).length > 0) {
      await patchActiveProject(runtime, function (nextProject: MediaEditProjectRecord) {
        applyEditRecipePatch(runtime, nextProject, toRecord(actionPayload["patch"]), {});
        return nextProject;
      });
    }
    return runEditPipeline(api, runtime, requestId, "apply");
  }

  async function cancelPreview(
    api: MediaEditActionApi,
    runtime: MediaEditRuntimeRecord,
    requestId: string
  ) {
    const activeProject = getActiveProject(runtime);
    if (activeProject === null) {
      throw new Error("Active project is missing.");
    }
    const activeProjectId = asNonEmptyString(activeProject["id"]);
    if (activeProjectId === null) {
      throw new Error("Active project id is missing.");
    }
    await cancelEditJobsForProject(api, runtime, activeProjectId, requestId, "edit-preview");
    return patchActiveProject(runtime, function (nextProject: MediaEditProjectRecord) {
      nextProject.edit.lastError = null;
      nextProject.edit.lastActionAt = new Date().toISOString();
      nextProject.edit.preview = {
        ...toRecord(nextProject.edit.preview),
        status:
          asNonEmptyString(toRecord(nextProject.edit.preview)["path"]) !== null ? "stale" : "idle",
        jobId: null,
        requestId: null,
      };
      return nextProject;
    });
  }

  async function cancelApply(
    api: MediaEditActionApi,
    runtime: MediaEditRuntimeRecord,
    requestId: string
  ) {
    const activeProject = getActiveProject(runtime);
    if (activeProject === null) {
      throw new Error("Active project is missing.");
    }
    const activeProjectId = asNonEmptyString(activeProject["id"]);
    if (activeProjectId === null) {
      throw new Error("Active project id is missing.");
    }
    await cancelEditJobsForProject(api, runtime, activeProjectId, requestId, "edit-apply");
    return patchActiveProject(runtime, function (nextProject: MediaEditProjectRecord) {
      nextProject.edit.lastError = null;
      nextProject.edit.lastActionAt = new Date().toISOString();
      return nextProject;
    });
  }

  return {
    applyEdit,
    applyEditPreset,
    cancelApply,
    cancelPreview,
    previewEdit,
    runControlInjection,
    runTemporalStressTest,
    setEditHandoff,
    setEditMode,
    setEditOutput,
    updateEditRecipe,
  };
}
