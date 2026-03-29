export function createLaboratoryProjectStorageRuntime(deps) {
  const {
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
  } = deps;

  async function loadProjects(runtime) {
    const entries = await listDirectory(runtime.paths.projectsDir);
    const projects = [];

    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      if (!entry || entry.isDirectory !== true) {
        continue;
      }

      const project = await readJsonFile(`${entry.path}/project.json`);
      if (project) {
        const normalizedProject = normalizeProject(
          project,
          runtime.sourcePresets,
          runtime.editPresets,
          runtime.profilePresets,
          runtime.profileModels,
          runtime.profileCapabilities,
          runtime
        );
        syncProjectFeatureProjections(runtime, normalizedProject);
        projects.push(normalizedProject);
      }
    }

    projects.sort(function (left, right) {
      return String(right.updatedAt).localeCompare(String(left.updatedAt));
    });

    runtime.projects = projects;
  }

  async function saveProject(runtime, project) {
    await writeJsonFile(getProjectMetaPath(runtime, project), project);
    await writeJsonFile(getProjectEditManifestPath(runtime, project), buildEditManifest(project));
    await writeJsonFile(getProjectProfileManifestPath(runtime, project), buildProfileManifest(project));
    await writeJsonFile(getProjectProcessManifestPath(runtime, project), buildProcessManifest(project));
    await writeJsonFile(getProjectReportManifestPath(runtime, project), buildReportManifest(project));
  }

  async function persistToolState(runtime) {
    if (!runtime.paths || !runtime.paths.toolStatePath) {
      return;
    }

    runtime.toolState.updatedAt = new Date().toISOString();
    await writeJsonFile(runtime.paths.toolStatePath, runtime.toolState);
  }

  async function persistProfileModelState(runtime) {
    if (!runtime.paths) {
      return;
    }

    runtime.profileModelState.updatedAt = new Date().toISOString();
    await writeJsonFile(getProfileModelStatePath(runtime), runtime.profileModelState);
  }

  async function loadToolState(runtime) {
    const stored = await readJsonFile(runtime.paths.toolStatePath);
    const nextState = createDefaultToolState(getRuntimeToolIds(runtime));
    const tools = toRecord(toRecord(stored).tools);

    getRuntimeToolIds(runtime).forEach(function (toolId) {
      nextState.tools[toolId] = {
        ...createDefaultToolEntry(toolId),
        ...toRecord(tools[toolId]),
        toolId: toolId,
        companionPaths: toRecord(toRecord(tools[toolId]).companionPaths),
      };
    });

    nextState.updatedAt = asNonEmptyString(toRecord(stored).updatedAt);
    runtime.toolState = nextState;
  }

  async function loadProfileModelState(runtime) {
    const stored = await readJsonFile(getProfileModelStatePath(runtime));
    const models = toRecord(toRecord(stored).models);
    const nextState = {
      schemaVersion: 1,
      updatedAt: asNonEmptyString(toRecord(stored).updatedAt),
      models: {},
    };

    Object.keys(toRecord(toRecord(runtime.profileModels).models)).forEach(function (modelId) {
      nextState.models[modelId] = {
        ...createDefaultProfileModelEntry(modelId),
        ...toRecord(models[modelId]),
        modelId: modelId,
      };
    });

    runtime.profileModelState = nextState;
  }

  return {
    loadProfileModelState,
    loadProjects,
    loadToolState,
    persistProfileModelState,
    persistToolState,
    saveProject,
  };
}
