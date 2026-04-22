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
    writeJsonFile
  } = deps;
  function toRuntimePaths(value) {
    return toRecord(value);
  }
  function toToolEntry(value) {
    return toRecord(value);
  }
  function toProfileModelCatalog(value) {
    return toRecord(value);
  }
  function sortProjects(entries) {
    return entries.sort(function(left, right) {
      return String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""));
    });
  }
  async function loadProjects(runtime) {
    const projectsDir = asNonEmptyString(toRuntimePaths(runtime.paths).projectsDir);
    if (projectsDir === null) {
      runtime.projects = [];
      return;
    }
    const entries = await listDirectory(projectsDir);
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
    runtime.projects = sortProjects(projects);
  }
  async function saveProject(runtime, project) {
    await writeJsonFile(getProjectMetaPath(runtime, project), project);
    await writeJsonFile(getProjectEditManifestPath(runtime, project), buildEditManifest(project));
    await writeJsonFile(
      getProjectProfileManifestPath(runtime, project),
      buildProfileManifest(project)
    );
    await writeJsonFile(
      getProjectProcessManifestPath(runtime, project),
      buildProcessManifest(project)
    );
    await writeJsonFile(
      getProjectReportManifestPath(runtime, project),
      buildReportManifest(project)
    );
  }
  async function persistToolState(runtime) {
    const toolStatePath = asNonEmptyString(toRuntimePaths(runtime.paths).toolStatePath);
    if (toolStatePath === null) {
      return;
    }
    runtime.toolState.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    await writeJsonFile(toolStatePath, runtime.toolState);
  }
  async function persistProfileModelState(runtime) {
    runtime.profileModelState.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    await writeJsonFile(getProfileModelStatePath(runtime), runtime.profileModelState);
  }
  async function loadToolState(runtime) {
    const toolStatePath = asNonEmptyString(toRuntimePaths(runtime.paths).toolStatePath);
    const stored = toolStatePath ? await readJsonFile(toolStatePath) : null;
    const storedRecord = toRecord(stored);
    const tools = toRecord(storedRecord["tools"]);
    const nextState = createDefaultToolState(getRuntimeToolIds(runtime));
    getRuntimeToolIds(runtime).forEach(function(toolId) {
      const storedTool = toToolEntry(tools[toolId]);
      nextState.tools[toolId] = {
        ...createDefaultToolEntry(toolId),
        ...storedTool,
        toolId,
        companionPaths: toRecord(storedTool.companionPaths)
      };
    });
    nextState.updatedAt = asNonEmptyString(storedRecord["updatedAt"]);
    runtime.toolState = nextState;
  }
  async function loadProfileModelState(runtime) {
    const stored = await readJsonFile(getProfileModelStatePath(runtime));
    const storedRecord = toRecord(stored);
    const models = toRecord(storedRecord["models"]);
    const catalogModels = toRecord(toProfileModelCatalog(runtime.profileModels).models);
    const nextState = {
      schemaVersion: 1,
      updatedAt: asNonEmptyString(storedRecord["updatedAt"]),
      models: {}
    };
    Object.keys(catalogModels).forEach(function(modelId) {
      nextState.models[modelId] = {
        ...createDefaultProfileModelEntry(modelId),
        ...toRecord(models[modelId]),
        modelId
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
    saveProject
  };
}
