import { createLaboratoryProjectConfigLoader } from "./project-config-loader.js";
import { createLaboratoryProjectStorageRuntime } from "./project-storage.js";
import { createLaboratoryProjectToolStatusRuntime } from "./project-tool-status.js";

export function createLaboratoryProjectLifecycleRuntime(deps) {
  const {
    asNonEmptyString,
    buildEditManifest,
    buildProcessManifest,
    buildProfileManifest,
    buildReportManifest,
    callRoomTools,
    cancelJobsForProject,
    clone,
    createDefaultProfileModelEntry,
    createDefaultToolEntry,
    createDefaultToolState,
    createProjectRecord,
    defaultFeatureId,
    ensureProjectDirectories,
    findProject,
    getActiveProject,
    getFeatureIdFromContext,
    getProfileModelStatePath,
    getProjectDir,
    getProjectEditManifestPath,
    getProjectMetaPath,
    getProjectProcessManifestPath,
    getProjectProfileManifestPath,
    getProjectReportManifestPath,
    getRuntimeToolIds,
    listDirectory,
    loadContext,
    normalizeProject,
    readJsonFile,
    refreshProfileModelState,
    roomId,
    syncProjectFeatureProjections,
    toRecord,
    updateProjectTimestamps,
    writeJsonFile,
  } = deps;

  const { loadRuntimeConfigs } = createLaboratoryProjectConfigLoader({
    readJsonFile,
  });

  const {
    loadProfileModelState,
    loadProjects,
    loadToolState,
    persistProfileModelState,
    persistToolState,
    saveProject,
  } = createLaboratoryProjectStorageRuntime({
    asNonEmptyString,
    buildEditManifest,
    buildProcessManifest,
    buildProfileManifest,
    buildReportManifest,
    createDefaultProfileModelEntry,
    createDefaultToolEntry,
    createDefaultToolState,
    getProfileModelStatePath,
    getProjectEditManifestPath,
    getProjectMetaPath,
    getProjectProcessManifestPath,
    getProjectProfileManifestPath,
    getProjectReportManifestPath,
    getRuntimeToolIds,
    listDirectory,
    normalizeProject,
    readJsonFile,
    syncProjectFeatureProjections,
    toRecord,
    writeJsonFile,
  });

  const { refreshToolStatus } = createLaboratoryProjectToolStatusRuntime({
    callRoomTools,
    createDefaultToolEntry,
    getRuntimeToolIds,
    persistToolState,
    roomId,
    toRecord,
  });

  async function ensureProjectExists(runtime, featureId) {
    if (runtime.projects.length > 0) {
      if (!findProject(runtime, runtime.activeProjectId)) {
        runtime.activeProjectId = runtime.projects[0].id;
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
      featureId || defaultFeatureId
    );
    syncProjectFeatureProjections(runtime, project);
    await ensureProjectDirectories(runtime, project, null);
    await saveProject(runtime, project);
    runtime.projects = [project];
    runtime.activeProjectId = project.id;
  }

  async function ensureHydrated(api, runtime) {
    if (runtime.hydrated === true) {
      return;
    }

    if (runtime.hydrating) {
      await runtime.hydrating;
      return;
    }

    runtime.hydrating = (async function () {
      const pathResult = await callRoomTools({
        operation: "resolve-paths",
        roomId: roomId,
      });

      runtime.paths = pathResult.paths;
      await loadRuntimeConfigs(api, runtime);
      await loadToolState(runtime);
      await loadProfileModelState(runtime);
      await loadProjects(runtime);
      await ensureProjectExists(runtime, getFeatureIdFromContext(loadContext(api)));
      await refreshToolStatus(runtime, { checkUpdates: false });
      await refreshProfileModelState(runtime);
      runtime.hydrated = true;
    })();

    try {
      await runtime.hydrating;
    } finally {
      runtime.hydrating = null;
    }
  }

  function updateProjectInMemory(runtime, nextProject) {
    runtime.projects = runtime.projects.map(function (project) {
      return project.id === nextProject.id ? nextProject : project;
    });
    runtime.projects.sort(function (left, right) {
      return String(right.updatedAt).localeCompare(String(left.updatedAt));
    });
  }

  async function patchActiveProject(runtime, updater) {
    const activeProject = getActiveProject(runtime);
    if (activeProject === null) {
      throw new Error("Active project is missing.");
    }

    const nextProject = normalizeProject(
      updater(clone(activeProject)),
      runtime.sourcePresets,
      runtime.editPresets,
      runtime.profilePresets,
      runtime.profileModels,
      runtime.profileCapabilities,
      runtime
    );
    syncProjectFeatureProjections(runtime, nextProject);
    updateProjectTimestamps(nextProject);
    await saveProject(runtime, nextProject);
    updateProjectInMemory(runtime, nextProject);
    runtime.activeProjectId = nextProject.id;
    return nextProject;
  }

  async function patchActiveProjectDrafts(runtime, fields) {
    const patch = toRecord(fields);
    if (Object.keys(patch).length === 0) {
      return getActiveProject(runtime);
    }

    return await patchActiveProject(runtime, function (nextProject) {
      nextProject.source.drafts = {
        ...toRecord(nextProject.source.drafts),
        ...patch,
        youtubeCustom: {
          ...toRecord(toRecord(nextProject.source.drafts).youtubeCustom),
          ...toRecord(patch.youtubeCustom),
        },
      };
      return nextProject;
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
    await saveProject(runtime, project);
    runtime.projects.unshift(project);
    runtime.activeProjectId = project.id;
    return project;
  }

  async function deleteProject(runtime, projectId, requestId, featureId) {
    const project = findProject(runtime, projectId);
    if (project === null || project === undefined) {
      return null;
    }

    await cancelJobsForProject(runtime, projectId, requestId);
    await callRoomTools({
      operation: "delete-path",
      roomId: roomId,
      requestId: requestId,
      targetPath: getProjectDir(runtime, project),
      recursive: true,
    });
    runtime.projects = runtime.projects.filter(function (entry) {
      return entry.id !== projectId;
    });
    if (runtime.activeProjectId === projectId) {
      runtime.activeProjectId = runtime.projects[0] ? runtime.projects[0].id : null;
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
    updateProjectInMemory,
  };
}
