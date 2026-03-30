import { createLaboratoryProjectConfigLoader } from "./project-config-loader.js";
import { createLaboratoryProjectStorageRuntime } from "./project-storage.js";
import { createLaboratoryProjectToolStatusRuntime } from "./project-tool-status.js";

type LaboratoryRecord = Record<string, unknown>;
type LaboratoryProjectConfigLoaderDeps = Parameters<typeof createLaboratoryProjectConfigLoader>[0];
type LaboratoryProjectConfigRuntime = Parameters<
  ReturnType<typeof createLaboratoryProjectConfigLoader>["loadRuntimeConfigs"]
>[1];
type LaboratoryProjectStorageRuntimeDeps = Parameters<
  typeof createLaboratoryProjectStorageRuntime
>[0];
type LaboratoryProjectToolStatusRuntimeDeps = Parameters<
  typeof createLaboratoryProjectToolStatusRuntime
>[0];
type LaboratoryProjectStorageRuntime = Parameters<
  ReturnType<typeof createLaboratoryProjectStorageRuntime>["saveProject"]
>[0];
type LaboratoryToolStatusRuntime = Parameters<
  ReturnType<typeof createLaboratoryProjectToolStatusRuntime>["refreshToolStatus"]
>[0];

type LaboratoryRoomApi = Parameters<
  ReturnType<typeof createLaboratoryProjectConfigLoader>["loadRuntimeConfigs"]
>[0] &
  LaboratoryRecord;

type LaboratoryRuntimePaths = LaboratoryRecord & {
  projectsDir?: unknown;
  toolStatePath?: unknown;
};

type LaboratoryToolEntry = LaboratoryRecord & {
  toolId?: unknown;
};

type LaboratoryToolState = {
  schemaVersion: number;
  tools: Record<string, LaboratoryToolEntry>;
  updatedAt: string | number | null;
};

type LaboratoryProfileModelState = {
  models: Record<string, LaboratoryRecord>;
  schemaVersion: number;
  updatedAt: string | number | null;
};

type LaboratoryProjectSourceDraftsRecord = LaboratoryRecord & {
  youtubeCustom?: unknown;
};

type LaboratoryProjectSourceRecord = LaboratoryRecord & {
  drafts?: unknown;
};

type LaboratoryProjectRecord = LaboratoryRecord & {
  id?: unknown;
  source?: unknown;
  updatedAt?: unknown;
};

type LaboratoryResolvePathsResult = LaboratoryRecord & {
  paths?: unknown;
};

type LaboratoryProjectLifecycleRuntime = LaboratoryProjectConfigRuntime & {
  activeProjectId: string | null;
  hydrated: boolean;
  hydrating: Promise<void> | null;
  paths: LaboratoryRuntimePaths | null;
  profileModelState: LaboratoryProfileModelState;
  projects: LaboratoryProjectRecord[];
  toolState: LaboratoryToolState;
};

type LaboratoryProjectLifecycleRuntimeDeps = LaboratoryProjectConfigLoaderDeps &
  LaboratoryProjectStorageRuntimeDeps &
  LaboratoryProjectToolStatusRuntimeDeps & {
    cancelJobsForProject: (
      runtime: LaboratoryProjectLifecycleRuntime,
      projectId: string | null,
      requestId: string | null
    ) => Promise<unknown>;
    clone: <T>(value: T) => T;
    createProjectRecord: (
      sourcePresets: unknown,
      editPresets: unknown,
      profilePresets: unknown,
      profileModels: unknown,
      profileCapabilities: unknown,
      subtitleRuntime: LaboratoryProjectLifecycleRuntime,
      featureId: string | null
    ) => LaboratoryProjectRecord;
    defaultFeatureId: string;
    ensureProjectDirectories: (
      runtime: LaboratoryProjectLifecycleRuntime,
      project: LaboratoryProjectRecord,
      requestId: string | null
    ) => Promise<unknown>;
    findProject: (
      runtime: LaboratoryProjectLifecycleRuntime,
      projectId: string | null
    ) => LaboratoryProjectRecord | null;
    getActiveProject: (
      runtime: LaboratoryProjectLifecycleRuntime
    ) => LaboratoryProjectRecord | null;
    getFeatureIdFromContext: (payload: unknown) => string;
    getProjectDir: (
      runtime: LaboratoryProjectLifecycleRuntime,
      project: LaboratoryProjectRecord
    ) => string;
    loadContext: (api: LaboratoryRoomApi) => LaboratoryRecord;
    refreshProfileModelState: (runtime: LaboratoryProjectLifecycleRuntime) => Promise<unknown>;
    roomId: string;
    syncProjectFeatureProjections: (
      runtime: LaboratoryProjectLifecycleRuntime,
      project: LaboratoryProjectRecord
    ) => void;
    updateProjectTimestamps: (project: LaboratoryProjectRecord) => void;
  };

export function createLaboratoryProjectLifecycleRuntime(
  deps: LaboratoryProjectLifecycleRuntimeDeps
) {
  const {
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
    refreshProfileModelState,
    roomId,
    syncProjectFeatureProjections,
    toRecord,
    updateProjectTimestamps,
  } = deps;

  const { loadRuntimeConfigs } = createLaboratoryProjectConfigLoader({
    readJsonFile: deps.readJsonFile,
  });

  const {
    loadProfileModelState,
    loadProjects,
    loadToolState,
    persistProfileModelState,
    persistToolState,
    saveProject,
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
    writeJsonFile: deps.writeJsonFile,
  });

  const { refreshToolStatus } = createLaboratoryProjectToolStatusRuntime({
    callRoomTools,
    createDefaultToolEntry: deps.createDefaultToolEntry,
    getRuntimeToolIds: deps.getRuntimeToolIds,
    persistToolState: async function (runtime) {
      await persistToolState(runtime as unknown as LaboratoryProjectStorageRuntime);
    },
    roomId,
    toRecord: deps.toRecord,
  });

  function toProjectRecord(value: unknown): LaboratoryProjectRecord {
    return toRecord(value);
  }

  function toProjectSourceRecord(value: unknown): LaboratoryProjectSourceRecord {
    return toRecord(value);
  }

  function toSourceDraftsRecord(value: unknown): LaboratoryProjectSourceDraftsRecord {
    return toRecord(value);
  }

  function toPathsRecord(value: unknown): LaboratoryRuntimePaths {
    return toRecord(value);
  }

  function requireProjectStorageRuntime(
    runtime: LaboratoryProjectLifecycleRuntime
  ): LaboratoryProjectStorageRuntime {
    if (runtime.paths === null) {
      throw new Error("Project runtime paths are not initialized.");
    }
    return runtime as unknown as LaboratoryProjectStorageRuntime;
  }

  function asToolStatusRuntime(
    runtime: LaboratoryProjectLifecycleRuntime
  ): LaboratoryToolStatusRuntime {
    return runtime as unknown as LaboratoryToolStatusRuntime;
  }

  function sortProjects(projects: LaboratoryProjectRecord[]): LaboratoryProjectRecord[] {
    return projects.sort(function (left, right) {
      return String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""));
    });
  }

  async function ensureProjectExists(
    runtime: LaboratoryProjectLifecycleRuntime,
    featureId: string | null
  ) {
    if (runtime.projects.length > 0) {
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
      featureId || defaultFeatureId
    );
    syncProjectFeatureProjections(runtime, project);
    await ensureProjectDirectories(runtime, project, null);
    await saveProject(requireProjectStorageRuntime(runtime), project);
    runtime.projects = [project];
    runtime.activeProjectId = String(project.id || "");
  }

  async function ensureHydrated(
    api: LaboratoryRoomApi,
    runtime: LaboratoryProjectLifecycleRuntime
  ) {
    if (runtime.hydrated === true) {
      return;
    }

    if (runtime.hydrating) {
      await runtime.hydrating;
      return;
    }

    runtime.hydrating = (async function () {
      const pathResult = (await callRoomTools({
        operation: "resolve-paths",
        roomId,
      })) as LaboratoryResolvePathsResult;

      runtime.paths = toPathsRecord(pathResult.paths);
      await loadRuntimeConfigs(api, runtime);
      await loadToolState(requireProjectStorageRuntime(runtime));
      await loadProfileModelState(requireProjectStorageRuntime(runtime));
      await loadProjects(requireProjectStorageRuntime(runtime));
      await ensureProjectExists(runtime, getFeatureIdFromContext(loadContext(api)));
      await refreshToolStatus(asToolStatusRuntime(runtime), { checkUpdates: false });
      await refreshProfileModelState(runtime);
      runtime.hydrated = true;
    })();

    try {
      await runtime.hydrating;
    } finally {
      runtime.hydrating = null;
    }
  }

  function updateProjectInMemory(
    runtime: LaboratoryProjectLifecycleRuntime,
    nextProject: LaboratoryProjectRecord
  ) {
    runtime.projects = sortProjects(
      runtime.projects.map(function (project) {
        return String(project.id || "") === String(nextProject.id || "") ? nextProject : project;
      })
    );
  }

  async function patchActiveProject(
    runtime: LaboratoryProjectLifecycleRuntime,
    updater: (project: LaboratoryProjectRecord) => LaboratoryProjectRecord
  ) {
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

  async function patchActiveProjectDrafts(
    runtime: LaboratoryProjectLifecycleRuntime,
    fields: unknown
  ) {
    const patch = toRecord(fields);
    if (Object.keys(patch).length === 0) {
      return getActiveProject(runtime);
    }

    return patchActiveProject(runtime, function (nextProject) {
      const nextProjectRecord = toProjectRecord(nextProject);
      const source = toProjectSourceRecord(nextProjectRecord.source);
      const drafts = toSourceDraftsRecord(source.drafts);
      source.drafts = {
        ...drafts,
        ...patch,
        ["youtubeCustom"]: {
          ...toRecord(drafts["youtubeCustom"]),
          ...toRecord(patch["youtubeCustom"]),
        },
      };
      nextProjectRecord.source = source;
      return nextProjectRecord;
    });
  }

  async function createProject(
    runtime: LaboratoryProjectLifecycleRuntime,
    featureId: string | null
  ) {
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
    runtime.projects.unshift(project);
    runtime.activeProjectId = String(project.id || "");
    return project;
  }

  async function deleteProject(
    runtime: LaboratoryProjectLifecycleRuntime,
    projectId: string | null,
    requestId: string | null,
    featureId: string | null
  ) {
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
      recursive: true,
    });
    runtime.projects = runtime.projects.filter(function (entry) {
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
    updateProjectInMemory,
  };
}
