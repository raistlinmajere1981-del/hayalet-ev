import { createLaboratoryProjectConfigLoader } from "./project-config-loader.js";
import { createLaboratoryProjectStorageRuntime } from "./project-storage.js";
import { createLaboratoryProjectToolStatusRuntime } from "./project-tool-status.js";
export function createLaboratoryProjectLifecycleRuntime(deps) {
  const {
    asNonEmptyString,
    callRoomTools,
    cancelJobsForProject,
    clone,
    createProjectRecord,
    defaultFeatureId,
    ensureProjectDirectories,
    findProject,
    getActiveProject,
    getFeatureIdFromContext,
    getProjectDir,
    loadContext,
    pushBootstrapState,
    refreshProfileModelState,
    roomId,
    syncProjectFeatureProjections,
    toRecord,
    updateProjectTimestamps
  } = deps;
  const { loadRuntimeConfigs } = createLaboratoryProjectConfigLoader({
    readJsonFile: deps.readJsonFile
  });
  const {
    loadProfileModelState,
    loadProjects,
    loadToolState,
    persistProfileModelState,
    persistToolState,
    saveProject
  } = createLaboratoryProjectStorageRuntime({
    asNonEmptyString: deps.asNonEmptyString,
    buildEditManifest: deps.buildEditManifest,
    buildProcessManifest: deps.buildProcessManifest,
    buildProfileManifest: deps.buildProfileManifest,
    buildReportManifest: deps.buildReportManifest,
    createDefaultProfileModelEntry: deps.createDefaultProfileModelEntry,
    createDefaultToolEntry: deps.createDefaultToolEntry,
    createDefaultToolState: deps.createDefaultToolState,
    getProfileModelStatePath: deps.getProfileModelStatePath,
    getProjectEditManifestPath: deps.getProjectEditManifestPath,
    getProjectMetaPath: deps.getProjectMetaPath,
    getProjectProcessManifestPath: deps.getProjectProcessManifestPath,
    getProjectProfileManifestPath: deps.getProjectProfileManifestPath,
    getProjectReportManifestPath: deps.getProjectReportManifestPath,
    getRuntimeToolIds: deps.getRuntimeToolIds,
    listDirectory: deps.listDirectory,
    normalizeProject: deps.normalizeProject,
    readJsonFile: deps.readJsonFile,
    syncProjectFeatureProjections,
    toRecord: deps.toRecord,
    writeJsonFile: deps.writeJsonFile
  });
  const { refreshToolStatus } = createLaboratoryProjectToolStatusRuntime({
    callRoomTools,
    createDefaultToolEntry: deps.createDefaultToolEntry,
    getRuntimeToolIds: deps.getRuntimeToolIds,
    persistToolState: async function(runtime) {
      await persistToolState(runtime);
    },
    roomId,
    toRecord: deps.toRecord
  });
  function toProjectRecord(value) {
    return toRecord(value);
  }
  function toProjectSourceRecord(value) {
    return toRecord(value);
  }
  function toSourceDraftsRecord(value) {
    return toRecord(value);
  }
  function toPathsRecord(value) {
    return toRecord(value);
  }
  function requireProjectStorageRuntime(runtime) {
    if (runtime.paths === null) {
      throw new Error("Project runtime paths are not initialized.");
    }
    return runtime;
  }
  function asToolStatusRuntime(runtime) {
    return runtime;
  }
  const bootstrapStepIds = [
    "resolve-paths",
    "load-config",
    "load-tool-state",
    "load-profile-model-state",
    "load-projects",
    "ensure-project",
    "refresh-tools",
    "refresh-profile-models"
  ];
  function createBootstrapState(status, currentStepId, message, error = null) {
    const activeIndex = currentStepId === null ? -1 : bootstrapStepIds.indexOf(currentStepId);
    return {
      active: status === "running",
      currentStep: activeIndex >= 0 ? activeIndex + 1 : status === "ready" ? bootstrapStepIds.length : 0,
      currentStepId,
      error,
      message,
      status,
      steps: bootstrapStepIds.map(function(stepId, index) {
        if (status === "ready") {
          return {
            id: stepId,
            status: "done"
          };
        }
        if (status === "error" && stepId === currentStepId) {
          return {
            id: stepId,
            status: "error"
          };
        }
        if (activeIndex >= 0 && index < activeIndex) {
          return {
            id: stepId,
            status: "done"
          };
        }
        if (stepId === currentStepId) {
          return {
            id: stepId,
            status: status === "running" ? "active" : "pending"
          };
        }
        return {
          id: stepId,
          status: "pending"
        };
      }),
      totalSteps: bootstrapStepIds.length
    };
  }
  function pushBootstrapProgress(api, runtime, status, currentStepId, message, error = null) {
    runtime.bootstrap = createBootstrapState(status, currentStepId, message, error);
    pushBootstrapState(api, runtime, null, null);
  }
  function sortProjects(projects) {
    return projects.sort(function(left, right) {
      return String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""));
    });
  }
  function isProjectSourceEmpty(project) {
    const source = toProjectSourceRecord(project.source);
    if (asNonEmptyString(source.status) === "ready") {
      return false;
    }
    return asNonEmptyString(source.storedPath) === null && asNonEmptyString(source.storedFileName) === null && asNonEmptyString(source.sourceUrl) === null && asNonEmptyString(source.routeLabel) === null && asNonEmptyString(source.mimeType) === null && Object.keys(toRecord(source.metadata)).length === 0;
  }
  async function ensureProjectExists(runtime, featureId, options) {
    const resolvedFeatureId = featureId || defaultFeatureId;
    if (runtime.projects.length > 0) {
      if (options?.preferFreshProject === true) {
        const latestProject = runtime.projects[0];
        if (latestProject && isProjectSourceEmpty(latestProject)) {
          runtime.activeProjectId = String(latestProject.id || "");
          return;
        }
        const project2 = await createProject(runtime, resolvedFeatureId);
        runtime.projects = sortProjects(runtime.projects);
        runtime.activeProjectId = String(project2.id || "");
        return;
      }
      if (!findProject(runtime, runtime.activeProjectId)) {
        const firstProject = runtime.projects[0];
        runtime.activeProjectId = firstProject ? String(firstProject.id || "") : null;
      }
      return;
    }
    const project = createProjectRecord(
      runtime.sourcePresets,
      runtime.editPresets,
      runtime.profilePresets,
      runtime.profileModels,
      runtime.profileCapabilities,
      runtime,
      resolvedFeatureId
    );
    syncProjectFeatureProjections(runtime, project);
    await ensureProjectDirectories(runtime, project, null);
    await saveProject(requireProjectStorageRuntime(runtime), project);
    runtime.projects = [project];
    runtime.activeProjectId = String(project.id || "");
  }
  async function ensureHydrated(api, runtime) {
    if (runtime.hydrated === true) {
      return;
    }
    if (runtime.hydrating) {
      await runtime.hydrating;
      return;
    }
    runtime.hydrating = (async function() {
      try {
        pushBootstrapProgress(api, runtime, "running", "resolve-paths", "resolve-paths");
        const pathResult = await callRoomTools({
          operation: "resolve-paths",
          roomId
        });
        runtime.paths = toPathsRecord(pathResult.paths);
        pushBootstrapProgress(api, runtime, "running", "load-config", "load-config");
        await loadRuntimeConfigs(api, runtime);
        pushBootstrapProgress(api, runtime, "running", "load-tool-state", "load-tool-state");
        await loadToolState(requireProjectStorageRuntime(runtime));
        pushBootstrapProgress(
          api,
          runtime,
          "running",
          "load-profile-model-state",
          "load-profile-model-state"
        );
        await loadProfileModelState(requireProjectStorageRuntime(runtime));
        pushBootstrapProgress(api, runtime, "running", "load-projects", "load-projects");
        await loadProjects(requireProjectStorageRuntime(runtime));
        pushBootstrapProgress(api, runtime, "running", "ensure-project", "ensure-project");
        await ensureProjectExists(runtime, getFeatureIdFromContext(loadContext(api)), {
          preferFreshProject: true
        });
        pushBootstrapProgress(api, runtime, "running", "refresh-tools", "refresh-tools");
        await refreshToolStatus(asToolStatusRuntime(runtime));
        pushBootstrapProgress(
          api,
          runtime,
          "running",
          "refresh-profile-models",
          "refresh-profile-models"
        );
        await refreshProfileModelState(runtime);
        runtime.hydrated = true;
        pushBootstrapProgress(api, runtime, "ready", null, "ready");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        pushBootstrapProgress(
          api,
          runtime,
          "error",
          runtime.bootstrap.currentStepId,
          "error",
          message
        );
        throw error;
      }
    })();
    try {
      await runtime.hydrating;
    } finally {
      runtime.hydrating = null;
    }
  }
  function updateProjectInMemory(runtime, nextProject) {
    runtime.projects = sortProjects(
      runtime.projects.map(function(project) {
        return String(project.id || "") === String(nextProject.id || "") ? nextProject : project;
      })
    );
  }
  async function patchActiveProject(runtime, updater) {
    const activeProject = getActiveProject(runtime);
    if (activeProject === null) {
      throw new Error("Active project is missing.");
    }
    const projectStorageRuntime = requireProjectStorageRuntime(runtime);
    const nextProject = deps.normalizeProject(
      updater(clone(activeProject)),
      runtime.sourcePresets,
      runtime.editPresets,
      runtime.profilePresets,
      runtime.profileModels,
      runtime.profileCapabilities,
      projectStorageRuntime
    );
    syncProjectFeatureProjections(runtime, nextProject);
    updateProjectTimestamps(nextProject);
    await saveProject(projectStorageRuntime, nextProject);
    updateProjectInMemory(runtime, nextProject);
    runtime.activeProjectId = String(nextProject.id || "");
    return nextProject;
  }
  async function patchActiveProjectDrafts(runtime, fields) {
    const patch = toRecord(fields);
    if (Object.keys(patch).length === 0) {
      return getActiveProject(runtime);
    }
    return patchActiveProject(runtime, function(nextProject) {
      const nextProjectRecord = toProjectRecord(nextProject);
      const source = toProjectSourceRecord(nextProjectRecord.source);
      const drafts = toSourceDraftsRecord(source.drafts);
      source.drafts = {
        ...drafts,
        ...patch,
        ["youtubeCustom"]: {
          ...toRecord(drafts["youtubeCustom"]),
          ...toRecord(patch["youtubeCustom"])
        }
      };
      nextProjectRecord.source = source;
      return nextProjectRecord;
    });
  }
  async function createProject(runtime, featureId) {
    const project = createProjectRecord(
      runtime.sourcePresets,
      runtime.editPresets,
      runtime.profilePresets,
      runtime.profileModels,
      runtime.profileCapabilities,
      runtime,
      featureId
    );
    syncProjectFeatureProjections(runtime, project);
    await ensureProjectDirectories(runtime, project, null);
    await saveProject(requireProjectStorageRuntime(runtime), project);
    runtime.projects = sortProjects([project, ...runtime.projects]);
    runtime.activeProjectId = String(project.id || "");
    return project;
  }
  async function deleteProject(runtime, projectId, requestId, featureId) {
    const project = findProject(runtime, projectId);
    if (project === null) {
      return null;
    }
    await cancelJobsForProject(runtime, projectId, requestId);
    await callRoomTools({
      operation: "delete-path",
      roomId,
      requestId,
      targetPath: getProjectDir(runtime, project),
      recursive: true
    });
    runtime.projects = runtime.projects.filter(function(entry) {
      return String(entry.id || "") !== String(projectId || "");
    });
    if (runtime.activeProjectId === projectId) {
      runtime.activeProjectId = runtime.projects[0] ? String(runtime.projects[0].id || "") : null;
    }
    await ensureProjectExists(runtime, featureId);
    return project;
  }
  return {
    createProject,
    deleteProject,
    ensureHydrated,
    ensureProjectExists,
    loadProfileModelState,
    loadProjects,
    loadRuntimeConfigs,
    loadToolState,
    patchActiveProject,
    patchActiveProjectDrafts,
    persistProfileModelState,
    persistToolState,
    refreshToolStatus,
    saveProject,
    updateProjectInMemory
  };
}
