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

  async function loadRuntimeConfigs(api, runtime) {
    const baseDir = `${api.room.installedDir}/shared/data/tools`;
    const sourcePresets = await readJsonFile(`${baseDir}/source-presets.json`);
    const projectSchema = await readJsonFile(`${baseDir}/project-schema.json`);
    const ytDlpForm = await readJsonFile(`${baseDir}/yt-dlp.form.json`);
    const toolchainManifest = await readJsonFile(`${baseDir}/toolchain.manifest.json`);
    const editPresets = await readJsonFile(`${baseDir}/edit-presets.json`);
    const editCapabilities = await readJsonFile(`${baseDir}/edit-capabilities.json`);
    const profilePresets = await readJsonFile(`${baseDir}/profile-presets.json`);
    const profileCapabilities = await readJsonFile(`${baseDir}/profile-capabilities.json`);
    const profileModels = await readJsonFile(`${baseDir}/profile-models.json`);
    const subtitleSourcePresets = await readJsonFile(`${baseDir}/subtitle-source-presets.json`);
    const subtitleYoutubeForm = await readJsonFile(`${baseDir}/subtitle-youtube.form.json`);
    const subtitleEditPresets = await readJsonFile(`${baseDir}/subtitle-edit-presets.json`);
    const subtitleAnalysisCatalog = await readJsonFile(`${baseDir}/subtitle-analysis-catalog.json`);
    const subtitleAnalysisCapabilities = await readJsonFile(
      `${baseDir}/subtitle-analysis-capabilities.json`
    );
    const subtitleAnalysisProviders = await readJsonFile(`${baseDir}/subtitle-analysis-providers.json`);
    const audioAnalysisCatalog = await readJsonFile(`${baseDir}/audio-analysis-catalog.json`);
    const audioAnalysisCapabilities = await readJsonFile(`${baseDir}/audio-analysis-capabilities.json`);
    const audioAnalysisPresets = await readJsonFile(`${baseDir}/audio-analysis-presets.json`);
    const audioAnalysisProviders = await readJsonFile(`${baseDir}/audio-analysis-providers.json`);

    runtime.packageToolsDir = baseDir;
    runtime.toolchainManifest = toolchainManifest || {};
    runtime.sourcePresets = sourcePresets || {};
    runtime.projectSchema = projectSchema || {};
    runtime.ytDlpForm = ytDlpForm || {};
    runtime.editPresets = editPresets || {};
    runtime.editCapabilities = editCapabilities || {};
    runtime.profilePresets = profilePresets || {};
    runtime.profileCapabilities = profileCapabilities || {};
    runtime.profileModels = profileModels || {};
    runtime.subtitleSourcePresets = subtitleSourcePresets || {};
    runtime.subtitleYoutubeForm = subtitleYoutubeForm || {};
    runtime.subtitleEditPresets = subtitleEditPresets || {};
    runtime.subtitleAnalysisCatalog = subtitleAnalysisCatalog || {};
    runtime.subtitleAnalysisCapabilities = subtitleAnalysisCapabilities || {};
    runtime.subtitleAnalysisProviders = subtitleAnalysisProviders || {};
    runtime.audioAnalysisCatalog = audioAnalysisCatalog || {};
    runtime.audioAnalysisCapabilities = audioAnalysisCapabilities || {};
    runtime.audioAnalysisPresets = audioAnalysisPresets || {};
    runtime.audioAnalysisProviders = audioAnalysisProviders || {};
  }

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

  async function refreshToolStatus(runtime, options) {
    const checkUpdates = options && options.checkUpdates === true;
    const toolIds = getRuntimeToolIds(runtime);

    for (let index = 0; index < toolIds.length; index += 1) {
      const toolId = toolIds[index];
      const currentEntry = runtime.toolState.tools[toolId] || createDefaultToolEntry(toolId);
      try {
        const probeResult = await callRoomTools({
          operation: "tool-probe",
          roomId: roomId,
          toolId: toolId,
        });
        runtime.toolState.tools[toolId] = {
          ...currentEntry,
          ...toRecord(probeResult.tool),
          toolId: toolId,
          busy: false,
          lastError: null,
          lastCheckedAt: new Date().toISOString(),
        };

        if (
          checkUpdates &&
          toRecord(toRecord(runtime.toolState.tools[toolId]).details).platformSupported !== false
        ) {
          const updateResult = await callRoomTools({
            operation: "tool-check-for-updates",
            roomId: roomId,
            toolId: toolId,
            installedVersion: runtime.toolState.tools[toolId].version,
            installedReleaseTag: runtime.toolState.tools[toolId].releaseTag,
            installedReleaseName: runtime.toolState.tools[toolId].releaseName,
          });

          runtime.toolState.tools[toolId] = {
            ...runtime.toolState.tools[toolId],
            latestVersion: updateResult.update ? updateResult.update.latestVersion : null,
            latestReleaseTag: updateResult.update ? updateResult.update.latestReleaseTag : null,
            latestReleaseName: updateResult.update ? updateResult.update.latestReleaseName : null,
            releaseUrl: updateResult.update ? updateResult.update.releaseUrl : null,
            updateAvailable: updateResult.update ? updateResult.update.updateAvailable === true : false,
          };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        runtime.toolState.tools[toolId] = {
          ...currentEntry,
          toolId: toolId,
          installed: false,
          busy: false,
          lastError: message,
          lastCheckedAt: new Date().toISOString(),
          details: {
            ...toRecord(currentEntry.details),
            platformSupported: message.indexOf("does not support") === -1 ? true : false,
            supportError: message,
          },
        };
      }
    }

    await persistToolState(runtime);
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
