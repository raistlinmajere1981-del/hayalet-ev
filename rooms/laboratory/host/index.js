const ROOM_ID = "laboratory";
const FEATURE_ID = "media-analysis";
const TOOL_IDS = ["yt-dlp", "ffmpeg"];
const PROJECT_SCHEMA_VERSION = 1;

function toRecord(value) {
  if (value !== null && typeof value === "object" && Array.isArray(value) === false) {
    return value;
  }
  return {};
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function asNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function normalizeLocale(value) {
  return typeof value === "string" && value.toLowerCase().startsWith("tr") ? "tr" : "en";
}

function sanitizeContext(payload, api) {
  const source = toRecord(payload);
  const room = toRecord(source.room);
  const user = toRecord(source.user);
  const presentation = toRecord(source.presentation);
  const translations = toRecord(source.translations);
  const slots = toRecord(source.slots);

  return {
    room: {
      id: ROOM_ID,
      name:
        typeof room.name === "string" && room.name.trim() !== "" ? room.name.trim() : "Laboratory",
    },
    user: {
      nickname:
        typeof user.nickname === "string" && user.nickname.trim() !== ""
          ? user.nickname.trim()
          : "Operator",
    },
    presentation: {
      mode: presentation.mode === "scene-view" ? "scene-view" : "classic",
    },
    locale:
      typeof source.locale === "string" && source.locale.trim() !== ""
        ? normalizeLocale(source.locale)
        : normalizeLocale(api.getLocale()),
    translations,
    slots,
    roomId:
      typeof source.roomId === "string" && source.roomId.trim() !== ""
        ? source.roomId.trim()
        : ROOM_ID,
    featureId:
      typeof source.featureId === "string" && source.featureId.trim() !== ""
        ? source.featureId.trim()
        : FEATURE_ID,
  };
}

function loadContext(api) {
  return sanitizeContext(api.getState("context"), api);
}

function saveContext(api, payload) {
  const nextContext = sanitizeContext(payload, api);
  api.setState("context", nextContext);
  return nextContext;
}

function getElectronApi() {
  return typeof window !== "undefined" ? window.electronAPI || null : null;
}

function decodeBase64Text(base64Value) {
  if (typeof base64Value !== "string" || base64Value.trim() === "") {
    return null;
  }

  try {
    const binary = atob(base64Value);
    const bytes = Uint8Array.from(binary, function (char) {
      return char.charCodeAt(0);
    });
    return new TextDecoder("utf-8").decode(bytes);
  } catch (_error) {
    return null;
  }
}

async function readJsonFile(filePath) {
  const electronApi = getElectronApi();
  if (electronApi === null || typeof electronApi.readFile !== "function") {
    return null;
  }

  const encoded = await electronApi.readFile(filePath);
  const raw = decodeBase64Text(encoded);
  if (typeof raw !== "string" || raw.trim() === "") {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
}

async function writeJsonFile(filePath, value) {
  const electronApi = getElectronApi();
  if (electronApi === null || typeof electronApi.fmWriteFileAtomic !== "function") {
    throw new Error("Electron API is unavailable.");
  }

  const result = await electronApi.fmWriteFileAtomic({
    path: filePath,
    data: JSON.stringify(value, null, 2),
  });

  if (!result || result.success !== true) {
    throw new Error((result && (result.message || result.error)) || "Write failed.");
  }
}

async function listDirectory(dirPath) {
  const electronApi = getElectronApi();
  if (electronApi === null || typeof electronApi.readDirectoryFiles !== "function") {
    return [];
  }

  try {
    const result = await electronApi.readDirectoryFiles(dirPath);
    return Array.isArray(result) ? result : [];
  } catch (_error) {
    return [];
  }
}

async function callRoomTools(request) {
  const electronApi = getElectronApi();
  if (electronApi === null || typeof electronApi.roomToolsCall !== "function") {
    throw new Error("Room tools bridge is unavailable.");
  }

  const result = await electronApi.roomToolsCall(request);
  if (!result || result.success !== true) {
    throw new Error((result && result.error) || "Room tools call failed.");
  }
  return result;
}

function isUnsupportedEnsureDirError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.indexOf("Unsupported room-tools operation: ensure-dir") !== -1;
}

async function ensureDirectoryMarker(dirPath) {
  const electronApi = getElectronApi();
  if (electronApi === null || typeof electronApi.fmWriteFileAtomic !== "function") {
    throw new Error("Electron API is unavailable.");
  }

  const result = await electronApi.fmWriteFileAtomic({
    path: `${dirPath}/.keep`,
    data: "",
  });

  if (!result || result.success !== true) {
    throw new Error((result && (result.message || result.error)) || "Directory prepare failed.");
  }
}

async function ensureProjectDirectories(runtime, project, requestId) {
  const dirPaths = [
    getProjectDir(runtime, project),
    getProjectSourceDir(runtime, project),
    getProjectDerivedDir(runtime, project),
  ];

  try {
    for (let index = 0; index < dirPaths.length; index += 1) {
      await callRoomTools({
        operation: "ensure-dir",
        roomId: ROOM_ID,
        requestId: requestId || null,
        targetPath: dirPaths[index],
      });
    }
    return;
  } catch (error) {
    if (isUnsupportedEnsureDirError(error) !== true) {
      throw error;
    }
  }

  await Promise.all([
    ensureDirectoryMarker(getProjectSourceDir(runtime, project)),
    ensureDirectoryMarker(getProjectDerivedDir(runtime, project)),
  ]);
}

async function cancelRoomTool(roomId, jobId, requestId) {
  const electronApi = getElectronApi();
  if (electronApi === null || typeof electronApi.roomToolsCancel !== "function") {
    return;
  }
  await electronApi.roomToolsCancel({
    roomId: roomId,
    jobId: jobId,
    requestId: requestId || null,
  });
}

function createRuntimeState() {
  return {
    hydrated: false,
    hydrating: null,
    paths: null,
    sourcePresets: null,
    projectSchema: null,
    ytDlpForm: null,
    projects: [],
    activeProjectId: null,
    toolState: createDefaultToolState(),
    jobs: {},
    roomToolsSubscribed: false,
    roomToolsProgressHandler: null,
  };
}

function createDefaultToolState() {
  return {
    schemaVersion: 1,
    updatedAt: null,
    tools: {
      "yt-dlp": createDefaultToolEntry("yt-dlp"),
      ffmpeg: createDefaultToolEntry("ffmpeg"),
    },
  };
}

function createDefaultToolEntry(toolId) {
  return {
    toolId: toolId,
    installed: false,
    version: null,
    binaryPath: null,
    releaseTag: null,
    releaseName: null,
    installDir: null,
    companionPaths: {},
    latestVersion: null,
    latestReleaseTag: null,
    latestReleaseName: null,
    releaseUrl: null,
    updateAvailable: false,
    busy: false,
    lastCheckedAt: null,
    lastError: null,
  };
}

function asNumber(value) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : null;
}

function normalizeSourceMetadata(rawValue) {
  const source = toRecord(rawValue);
  const normalized = {
    durationSeconds: asNumber(source.durationSeconds),
    width: asNumber(source.width),
    height: asNumber(source.height),
    codec: asNonEmptyString(source.codec),
    videoCodec: asNonEmptyString(source.videoCodec),
    audioCodec: asNonEmptyString(source.audioCodec),
    formatName: asNonEmptyString(source.formatName),
    bitRate: asNumber(source.bitRate),
    sizeBytes: asNumber(source.sizeBytes),
    streamCount: asNumber(source.streamCount),
    mimeType: asNonEmptyString(source.mimeType),
    extractedBy: asNonEmptyString(source.extractedBy),
    extractedAt: asNonEmptyString(source.extractedAt),
  };

  const hasValue = Object.keys(normalized).some(function (key) {
    return normalized[key] !== null;
  });

  return hasValue ? normalized : null;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function buildProjectName(dateValue) {
  const date = new Date(dateValue);
  return `Lab Session ${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate()
  )} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function buildProjectSlug(dateValue) {
  const date = new Date(dateValue);
  return [
    "lab-session",
    `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`,
    `${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}`,
  ].join("-");
}

function getSourceConfig(sourcePresets, kind) {
  const presets = toRecord(sourcePresets);
  const sourceTypes = toRecord(presets.sourceTypes);
  return toRecord(sourceTypes[kind]);
}

function getDefaultSourceType(sourcePresets) {
  const presets = toRecord(sourcePresets);
  const sourceType = asNonEmptyString(presets.defaultSourceType);
  return sourceType || "video";
}

function getDefaultMode(sourcePresets, kind) {
  const config = getSourceConfig(sourcePresets, kind);
  return asNonEmptyString(config.defaultMode) || "local";
}

function getDefaultYoutubePreset(sourcePresets) {
  const presets = toRecord(sourcePresets);
  const youtubePresets = toRecord(presets.youtubePresets);
  return youtubePresets.medium ? "medium" : youtubePresets.custom ? "custom" : "low";
}

function getPresetDefaultCustomValues(sourcePresets, presetId) {
  const presets = toRecord(sourcePresets);
  const youtubePresets = toRecord(presets.youtubePresets);
  const preset = toRecord(youtubePresets[presetId]);
  return clone(toRecord(preset.defaultCustomValues));
}

function createEmptySourceDrafts(sourcePresets) {
  const defaultPreset = getDefaultYoutubePreset(sourcePresets);
  return {
    urlInput: "",
    youtubeUrl: "",
    fileNameHint: "",
    youtubePreset: defaultPreset,
    youtubeCustom: getPresetDefaultCustomValues(sourcePresets, defaultPreset),
  };
}

function createProjectRecord(sourcePresets) {
  const now = new Date().toISOString();
  const kind = getDefaultSourceType(sourcePresets);
  const mode = getDefaultMode(sourcePresets, kind);
  const slug = buildProjectSlug(now);

  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: slug,
    slug: slug,
    name: buildProjectName(now),
    createdAt: now,
    updatedAt: now,
    source: {
      kind: kind,
      mode: mode,
      status: "idle",
      storedPath: null,
      storedFileName: null,
      sourceUrl: null,
      mimeType: null,
      routeLabel: null,
      lastError: null,
      metadata: null,
      metadataError: null,
      drafts: createEmptySourceDrafts(sourcePresets),
    },
  };
}

function normalizeProject(rawValue, sourcePresets) {
  const source = toRecord(toRecord(rawValue).source);
  const kind = asNonEmptyString(source.kind) || getDefaultSourceType(sourcePresets);
  const mode = asNonEmptyString(source.mode) || getDefaultMode(sourcePresets, kind);
  const drafts = toRecord(source.drafts);
  const defaultPreset = getDefaultYoutubePreset(sourcePresets);
  const youtubePreset = asNonEmptyString(drafts.youtubePreset) || defaultPreset;

  return {
    schemaVersion:
      typeof toRecord(rawValue).schemaVersion === "number"
        ? toRecord(rawValue).schemaVersion
        : PROJECT_SCHEMA_VERSION,
    id: asNonEmptyString(toRecord(rawValue).id) || asNonEmptyString(toRecord(rawValue).slug) || buildProjectSlug(new Date().toISOString()),
    slug: asNonEmptyString(toRecord(rawValue).slug) || asNonEmptyString(toRecord(rawValue).id) || buildProjectSlug(new Date().toISOString()),
    name: asNonEmptyString(toRecord(rawValue).name) || buildProjectName(new Date().toISOString()),
    createdAt: asNonEmptyString(toRecord(rawValue).createdAt) || new Date().toISOString(),
    updatedAt: asNonEmptyString(toRecord(rawValue).updatedAt) || new Date().toISOString(),
    source: {
      kind: kind,
      mode: mode,
      status: asNonEmptyString(source.status) || "idle",
      storedPath: asNonEmptyString(source.storedPath),
      storedFileName: asNonEmptyString(source.storedFileName),
      sourceUrl: asNonEmptyString(source.sourceUrl),
      mimeType: asNonEmptyString(source.mimeType),
      routeLabel: asNonEmptyString(source.routeLabel),
      lastError: asNonEmptyString(source.lastError),
      metadata: normalizeSourceMetadata(source.metadata),
      metadataError: asNonEmptyString(source.metadataError),
      drafts: {
        urlInput: asNonEmptyString(drafts.urlInput) || "",
        youtubeUrl: asNonEmptyString(drafts.youtubeUrl) || "",
        fileNameHint: asNonEmptyString(drafts.fileNameHint) || "",
        youtubePreset: youtubePreset,
        youtubeCustom: {
          ...getPresetDefaultCustomValues(sourcePresets, youtubePreset),
          ...toRecord(drafts.youtubeCustom),
        },
      },
    },
  };
}

function updateProjectTimestamps(project) {
  project.updatedAt = new Date().toISOString();
  return project;
}

function findProject(runtime, projectId) {
  return runtime.projects.find(function (project) {
    return project.id === projectId;
  });
}

function getActiveProject(runtime) {
  return findProject(runtime, runtime.activeProjectId) || null;
}

function getProjectDir(runtime, project) {
  return `${runtime.paths.projectsDir}/${project.slug}`;
}

function getProjectMetaPath(runtime, project) {
  return `${getProjectDir(runtime, project)}/project.json`;
}

function getProjectSourceDir(runtime, project) {
  return `${getProjectDir(runtime, project)}/source`;
}

function getProjectDerivedDir(runtime, project) {
  return `${getProjectDir(runtime, project)}/derived`;
}

function toFileUrl(filePath) {
  if (typeof filePath !== "string" || filePath.trim() === "") {
    return null;
  }

  const normalized = filePath.replace(/\\/g, "/");
  if (normalized.startsWith("/")) {
    return encodeURI(`file://${normalized}`);
  }
  return encodeURI(`file:///${normalized}`);
}

function getSourceRouteLabel(project) {
  if (project.source.routeLabel) {
    return project.source.routeLabel;
  }
  if (project.source.mode === "youtube") {
    return "YouTube";
  }
  if (project.source.mode === "url") {
    return "Direct URL";
  }
  return "Local copy";
}

function serializeProjectSummary(project) {
  return {
    id: project.id,
    slug: project.slug,
    name: project.name,
    updatedAt: project.updatedAt,
    sourceKind: project.source.kind,
    sourceMode: project.source.mode,
    status: project.source.status,
    hasSource: typeof project.source.storedPath === "string" && project.source.storedPath.trim() !== "",
  };
}

function serializeProject(project) {
  if (project === null) {
    return null;
  }

  return {
    id: project.id,
    slug: project.slug,
    name: project.name,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    source: {
      ...clone(project.source),
      previewUrl: toFileUrl(project.source.storedPath),
      routeLabel: getSourceRouteLabel(project),
    },
  };
}

function serializeJobs(runtime) {
  return Object.keys(runtime.jobs)
    .map(function (jobId) {
      const job = runtime.jobs[jobId];
      if (!job) {
        return null;
      }

      return {
        jobId: jobId,
        requestId: job.requestId,
        action: job.action,
        projectId: job.projectId || null,
        toolId: job.toolId || null,
        stage: job.stage || "queued",
        percent: typeof job.percent === "number" ? job.percent : null,
        message: job.message || null,
      };
    })
    .filter(Boolean);
}

function buildSourceSnapshot(runtime) {
  return {
    roomId: ROOM_ID,
    featureId: FEATURE_ID,
    ready: runtime.hydrated,
    sourcePresets: clone(runtime.sourcePresets || {}),
    ytDlpForm: clone(runtime.ytDlpForm || {}),
    projects: runtime.projects.map(serializeProjectSummary),
    activeProjectId: runtime.activeProjectId,
    activeProject: serializeProject(getActiveProject(runtime)),
    toolState: clone(runtime.toolState),
    jobs: serializeJobs(runtime),
  };
}

function notifyRoom(api, type, payload) {
  api.notifyRoom(type, payload || {});
}

function pushSourceState(api, runtime, requestId, action) {
  notifyRoom(api, "source-state", {
    requestId: requestId || null,
    action: action || null,
    snapshot: buildSourceSnapshot(runtime),
  });
}

function pushActionResult(api, payload) {
  notifyRoom(api, "source-action-result", payload);
}

function pushJobState(api, payload) {
  notifyRoom(api, "source-job", payload);
}

async function loadRuntimeConfigs(api, runtime) {
  const baseDir = `${api.room.installedDir}/tools`;
  const sourcePresets = await readJsonFile(`${baseDir}/source-presets.json`);
  const projectSchema = await readJsonFile(`${baseDir}/project-schema.json`);
  const ytDlpForm = await readJsonFile(`${baseDir}/yt-dlp.form.json`);

  runtime.sourcePresets = sourcePresets || {};
  runtime.projectSchema = projectSchema || {};
  runtime.ytDlpForm = ytDlpForm || {};
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
      projects.push(normalizeProject(project, runtime.sourcePresets));
    }
  }

  projects.sort(function (left, right) {
    return String(right.updatedAt).localeCompare(String(left.updatedAt));
  });

  runtime.projects = projects;
}

async function saveProject(runtime, project) {
  await writeJsonFile(getProjectMetaPath(runtime, project), project);
}

async function persistToolState(runtime) {
  if (!runtime.paths || !runtime.paths.toolStatePath) {
    return;
  }
  runtime.toolState.updatedAt = new Date().toISOString();
  await writeJsonFile(runtime.paths.toolStatePath, runtime.toolState);
}

async function loadToolState(runtime) {
  const stored = await readJsonFile(runtime.paths.toolStatePath);
  const nextState = createDefaultToolState();
  const tools = toRecord(toRecord(stored).tools);

  TOOL_IDS.forEach(function (toolId) {
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

async function ensureProjectExists(runtime) {
  if (runtime.projects.length > 0) {
    if (!findProject(runtime, runtime.activeProjectId)) {
      runtime.activeProjectId = runtime.projects[0].id;
    }
    return;
  }

  const project = createProjectRecord(runtime.sourcePresets);
  await ensureProjectDirectories(runtime, project, null);
  await saveProject(runtime, project);
  runtime.projects = [project];
  runtime.activeProjectId = project.id;
}

async function refreshToolStatus(runtime, options) {
  const checkUpdates = options && options.checkUpdates === true;

  for (let index = 0; index < TOOL_IDS.length; index += 1) {
    const toolId = TOOL_IDS[index];
    const probeResult = await callRoomTools({
      operation: "tool-probe",
      roomId: ROOM_ID,
      toolId: toolId,
    });
    const currentEntry = runtime.toolState.tools[toolId] || createDefaultToolEntry(toolId);
    runtime.toolState.tools[toolId] = {
      ...currentEntry,
      ...toRecord(probeResult.tool),
      toolId: toolId,
      busy: false,
      lastError: null,
      lastCheckedAt: new Date().toISOString(),
    };

    if (checkUpdates) {
      const updateResult = await callRoomTools({
        operation: "tool-check-for-updates",
        roomId: ROOM_ID,
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
      roomId: ROOM_ID,
    });

    runtime.paths = pathResult.paths;
    await loadRuntimeConfigs(api, runtime);
    await loadToolState(runtime);
    await loadProjects(runtime);
    await ensureProjectExists(runtime);
    await refreshToolStatus(runtime, { checkUpdates: false });
    runtime.hydrated = true;
  })();

  try {
    await runtime.hydrating;
  } finally {
    runtime.hydrating = null;
  }
}

function createRequestId() {
  return `lab-source-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

  const nextProject = normalizeProject(updater(clone(activeProject)), runtime.sourcePresets);
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

async function refreshActiveProjectMetadata(runtime, requestId) {
  const project = getActiveProject(runtime);
  if (
    project === null ||
    asNonEmptyString(project.source.storedPath) === null ||
    asNonEmptyString(project.source.storedFileName) === null
  ) {
    return null;
  }

  const ffmpegState = toRecord(runtime.toolState.tools.ffmpeg);
  if (ffmpegState.installed !== true) {
    return null;
  }

  const currentMetadata = normalizeSourceMetadata(project.source.metadata);
  if (currentMetadata && currentMetadata.extractedBy === "ffprobe") {
    return currentMetadata;
  }

  const validation = validateSourceCandidate(
    runtime,
    project.source.kind,
    project.source.storedFileName,
    project.source.mimeType
  );
  if (validation.valid !== true) {
    return null;
  }

  const metadataResult = await collectStoredSourceMetadata(runtime, project, {
    requestId: requestId,
    storedPath: project.source.storedPath,
    mimeType: validation.mimeType,
  });

  await patchActiveProject(runtime, function (nextProject) {
    if (nextProject.id !== project.id) {
      return nextProject;
    }
    nextProject.source.mimeType = validation.mimeType;
    nextProject.source.metadata = metadataResult.metadata;
    nextProject.source.metadataError = metadataResult.metadataError;
    return nextProject;
  });

  return metadataResult.metadata;
}

async function createProject(runtime) {
  const project = createProjectRecord(runtime.sourcePresets);
  await ensureProjectDirectories(runtime, project, null);
  await saveProject(runtime, project);
  runtime.projects.unshift(project);
  runtime.activeProjectId = project.id;
  return project;
}

async function deleteProject(runtime, projectId, requestId) {
  const project = findProject(runtime, projectId);
  if (project === null || project === undefined) {
    return null;
  }

  await cancelJobsForProject(runtime, projectId, requestId);
  await callRoomTools({
    operation: "delete-path",
    roomId: ROOM_ID,
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
  await ensureProjectExists(runtime);
  return project;
}

function registerJob(runtime, options) {
  runtime.jobs[options.jobId] = {
    requestId: options.requestId || null,
    action: options.action,
    projectId: options.projectId || null,
    toolId: options.toolId || null,
    stage: "queued",
    percent: null,
    message: null,
  };
  return runtime.jobs[options.jobId];
}

function clearJob(runtime, jobId) {
  delete runtime.jobs[jobId];
}

async function cancelJobsForProject(runtime, projectId, requestId) {
  const jobIds = Object.keys(runtime.jobs);
  for (let index = 0; index < jobIds.length; index += 1) {
    const jobId = jobIds[index];
    const job = runtime.jobs[jobId];
    if (job && job.projectId === projectId) {
      await cancelRoomTool(ROOM_ID, jobId, requestId);
      clearJob(runtime, jobId);
    }
  }
}

function normalizeMimeType(fileName, kind) {
  const lowerName = String(fileName || "").toLowerCase();
  if (kind === "audio") {
    if (lowerName.endsWith(".m4a")) return "audio/mp4";
    if (lowerName.endsWith(".wav")) return "audio/wav";
    if (lowerName.endsWith(".flac")) return "audio/flac";
    if (lowerName.endsWith(".ogg")) return "audio/ogg";
    if (lowerName.endsWith(".aac")) return "audio/aac";
    return "audio/mpeg";
  }
  if (kind === "image") {
    if (lowerName.endsWith(".png")) return "image/png";
    if (lowerName.endsWith(".webp")) return "image/webp";
    if (lowerName.endsWith(".gif")) return "image/gif";
    if (lowerName.endsWith(".bmp")) return "image/bmp";
    return "image/jpeg";
  }
  if (lowerName.endsWith(".webm")) return "video/webm";
  if (lowerName.endsWith(".mov")) return "video/quicktime";
  if (lowerName.endsWith(".mkv")) return "video/x-matroska";
  if (lowerName.endsWith(".avi")) return "video/x-msvideo";
  if (lowerName.endsWith(".m4v")) return "video/x-m4v";
  return "video/mp4";
}

function stripMimeParameters(value) {
  const rawValue = asNonEmptyString(value);
  if (rawValue === null) {
    return null;
  }

  const normalized = rawValue.split(";")[0].trim().toLowerCase();
  return normalized || null;
}

function getFileExtension(fileName) {
  const rawValue = asNonEmptyString(fileName);
  if (rawValue === null) {
    return null;
  }

  const match = rawValue.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : null;
}

function getSupportedMimeTypes(sourcePresets, kind) {
  const sourceConfig = getSourceConfig(sourcePresets, kind);
  return toRecord(sourceConfig).supportedMimeTypes instanceof Array
    ? toRecord(sourceConfig).supportedMimeTypes
        .map(stripMimeParameters)
        .filter(Boolean)
    : [];
}

function getSupportedExtensions(sourcePresets, kind) {
  const sourceConfig = getSourceConfig(sourcePresets, kind);
  const filters = Array.isArray(sourceConfig.fileDialogFilters) ? sourceConfig.fileDialogFilters : [];
  const values = [];

  filters.forEach(function (filter) {
    if (!filter || Array.isArray(filter.extensions) === false) {
      return;
    }

    filter.extensions.forEach(function (extension) {
      const normalized = asNonEmptyString(extension);
      if (normalized) {
        values.push(normalized.toLowerCase().replace(/^\./, ""));
      }
    });
  });

  return Array.from(new Set(values));
}

function validateSourceCandidate(runtime, kind, storedFileName, mimeType) {
  const normalizedMimeType = stripMimeParameters(mimeType);
  const normalizedExtension = getFileExtension(storedFileName);
  const supportedMimeTypes = getSupportedMimeTypes(runtime.sourcePresets, kind);
  const supportedExtensions = getSupportedExtensions(runtime.sourcePresets, kind);
  const extensionMatches =
    normalizedExtension !== null && supportedExtensions.includes(normalizedExtension);
  const mimeMatches =
    normalizedMimeType !== null &&
    (supportedMimeTypes.includes(normalizedMimeType) || normalizedMimeType.startsWith(`${kind}/`));

  if (
    normalizedMimeType === "text/html" ||
    normalizedMimeType === "application/xhtml+xml" ||
    normalizedMimeType === "text/plain"
  ) {
    return {
      valid: false,
      error: `Saved file is ${normalizedMimeType}, not a supported ${kind} source.`,
    };
  }

  if (mimeMatches || extensionMatches) {
    return {
      valid: true,
      mimeType:
        mimeMatches && normalizedMimeType !== null
          ? normalizedMimeType
          : normalizeMimeType(storedFileName, kind),
    };
  }

  if (normalizedMimeType === "application/octet-stream" && extensionMatches) {
    return {
      valid: true,
      mimeType: normalizeMimeType(storedFileName, kind),
    };
  }

  return {
    valid: false,
    error: `Saved file is not a supported ${kind} source.`,
  };
}

function findCompanionExecutableName(toolEntry, baseName) {
  const companionPaths = toRecord(toRecord(toolEntry).companionPaths);
  const keys = Object.keys(companionPaths);
  const match = keys.find(function (key) {
    return key.toLowerCase() === baseName.toLowerCase() || key.toLowerCase().startsWith(`${baseName.toLowerCase()}.`);
  });
  return match || null;
}

function parseFfprobeMetadata(stdout, kind, mimeType) {
  const payload = toRecord(JSON.parse(stdout));
  const format = toRecord(payload.format);
  const streams = Array.isArray(payload.streams) ? payload.streams.map(toRecord) : [];
  const videoStream =
    streams.find(function (stream) {
      return asNonEmptyString(stream.codec_type) === "video";
    }) ||
    streams.find(function (stream) {
      return asNumber(stream.width) !== null || asNumber(stream.height) !== null;
    }) ||
    {};
  const audioStream =
    streams.find(function (stream) {
      return asNonEmptyString(stream.codec_type) === "audio";
    }) || {};
  const durationSeconds =
    asNumber(format.duration) || asNumber(videoStream.duration) || asNumber(audioStream.duration);
  const videoCodec = asNonEmptyString(videoStream.codec_name);
  const audioCodec = asNonEmptyString(audioStream.codec_name);
  let codec = videoCodec || audioCodec;

  if (kind === "audio") {
    codec = audioCodec;
  } else if (kind === "video" && videoCodec && audioCodec) {
    codec = `${videoCodec} + ${audioCodec}`;
  }

  return normalizeSourceMetadata({
    durationSeconds: durationSeconds,
    width: asNumber(videoStream.width),
    height: asNumber(videoStream.height),
    codec: codec,
    videoCodec: videoCodec,
    audioCodec: audioCodec,
    formatName: asNonEmptyString(format.format_long_name) || asNonEmptyString(format.format_name),
    bitRate: asNumber(format.bit_rate) || asNumber(audioStream.bit_rate) || asNumber(videoStream.bit_rate),
    sizeBytes: asNumber(format.size),
    streamCount: streams.length,
    mimeType: stripMimeParameters(mimeType),
    extractedBy: "ffprobe",
    extractedAt: new Date().toISOString(),
  });
}

async function deleteOwnedSourceFile(filePath, requestId) {
  const targetPath = asNonEmptyString(filePath);
  if (targetPath === null) {
    return;
  }

  try {
    await callRoomTools({
      operation: "delete-path",
      roomId: ROOM_ID,
      requestId: requestId || null,
      targetPath: targetPath,
      recursive: false,
    });
  } catch (_error) {
    // noop
  }
}

async function collectStoredSourceMetadata(runtime, project, options) {
  const ffmpegState = toRecord(runtime.toolState.tools.ffmpeg);
  const normalizedMimeType = stripMimeParameters(options.mimeType);

  if (ffmpegState.installed !== true) {
    return {
      metadata: normalizeSourceMetadata({
        mimeType: normalizedMimeType,
        formatName: normalizedMimeType,
        extractedBy: "host-fallback",
        extractedAt: new Date().toISOString(),
      }),
      metadataError: null,
    };
  }

  const executableName = findCompanionExecutableName(ffmpegState, "ffprobe");
  if (executableName === null) {
    return {
      metadata: normalizeSourceMetadata({
        mimeType: normalizedMimeType,
        formatName: normalizedMimeType,
        extractedBy: "host-fallback",
        extractedAt: new Date().toISOString(),
      }),
      metadataError: null,
    };
  }

  try {
    await ensureProjectDirectories(runtime, project, requestId);
    const runResult = await callRoomTools({
      operation: "tool-run",
      roomId: ROOM_ID,
      requestId: options.requestId || null,
      jobId: options.jobId || null,
      toolId: "ffmpeg",
      executableName: executableName,
      cwd: getProjectSourceDir(runtime, project),
      args: [
        "-v",
        "quiet",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        options.storedPath,
      ],
      timeoutMs: 15_000,
    });
    const runPayload = toRecord(runResult.run);
    const exitCode = typeof runPayload.exitCode === "number" ? runPayload.exitCode : 0;
    const stdout = asNonEmptyString(runPayload.stdout);

    if (runPayload.cancelled === true || exitCode !== 0 || stdout === null) {
      throw new Error(
        asNonEmptyString(runPayload.stderr) || "ffprobe did not return structured metadata."
      );
    }

    return {
      metadata: parseFfprobeMetadata(stdout, project.source.kind, options.mimeType),
      metadataError: null,
    };
  } catch (error) {
    return {
      metadata: normalizeSourceMetadata({
        mimeType: normalizedMimeType,
        formatName: normalizedMimeType,
        extractedBy: "host-fallback",
        extractedAt: new Date().toISOString(),
      }),
      metadataError: error instanceof Error ? error.message : String(error),
    };
  }
}

async function resolvePreparedSource(runtime, project, options) {
  const storedPath = asNonEmptyString(options.storedPath);
  const storedFileName = asNonEmptyString(options.storedFileName);
  const sourceKind = project.source.kind;

  if (storedPath === null || storedFileName === null) {
    throw new Error("Saved source file is missing.");
  }

  const validation = validateSourceCandidate(runtime, sourceKind, storedFileName, options.mimeType);
  if (validation.valid !== true) {
    await deleteOwnedSourceFile(storedPath, options.requestId);
    throw new Error(validation.error);
  }

  const metadataResult = await collectStoredSourceMetadata(runtime, project, {
    requestId: options.requestId,
    jobId: options.jobId,
    storedPath: storedPath,
    mimeType: validation.mimeType,
  });

  return {
    storedPath: storedPath,
    storedFileName: storedFileName,
    mimeType: validation.mimeType,
    metadata: metadataResult.metadata,
    metadataError: metadataResult.metadataError,
  };
}

function deriveFilename(urlValue, kind, hint) {
  const hintValue = asNonEmptyString(hint);
  if (hintValue) {
    return hintValue;
  }

  try {
    const parsed = new URL(urlValue);
    const pathname = decodeURIComponent(parsed.pathname || "");
    const rawName = pathname.split("/").filter(Boolean).pop();
    if (rawName && rawName.indexOf(".") > 0) {
      return rawName;
    }
  } catch (_error) {
    // noop
  }

  if (kind === "audio") return "downloaded-audio.mp3";
  if (kind === "image") return "downloaded-image.jpg";
  return "downloaded-video.mp4";
}

async function handleLocalPick(api, runtime, requestId) {
  const project = getActiveProject(runtime);
  const sourceConfig = getSourceConfig(runtime.sourcePresets, project.source.kind);
  const electronApi = getElectronApi();
  if (electronApi === null || typeof electronApi.showOpenDialog !== "function") {
    throw new Error("File picker is unavailable.");
  }

  const dialogResult = await electronApi.showOpenDialog({
    properties: ["openFile"],
    filters: Array.isArray(sourceConfig.fileDialogFilters) ? sourceConfig.fileDialogFilters : [],
  });

  if (!dialogResult || dialogResult.canceled === true || !Array.isArray(dialogResult.filePaths)) {
    return { cancelled: true };
  }

  const selectedPath = dialogResult.filePaths[0];
  if (typeof selectedPath !== "string" || selectedPath.trim() === "") {
    return { cancelled: true };
  }

  const sourceDir = getProjectSourceDir(runtime, project);
  const copyResult = await electronApi.copyFileTo(selectedPath, sourceDir);
  if (!copyResult || copyResult.success !== true) {
    throw new Error((copyResult && (copyResult.message || copyResult.error)) || "Copy failed.");
  }

  const storedPath = asNonEmptyString(copyResult.path);
  const storedFileName = asNonEmptyString(copyResult.name) || (storedPath ? storedPath.split(/[\\/]/).pop() : null);
  const preparedSource = await resolvePreparedSource(runtime, project, {
    requestId: requestId,
    storedPath: storedPath,
    storedFileName: storedFileName,
    mimeType: normalizeMimeType(storedFileName, project.source.kind),
  });

  await patchActiveProject(runtime, function (nextProject) {
    nextProject.source.mode = "local";
    nextProject.source.status = "ready";
    nextProject.source.storedPath = preparedSource.storedPath;
    nextProject.source.storedFileName = preparedSource.storedFileName;
    nextProject.source.mimeType = preparedSource.mimeType;
    nextProject.source.sourceUrl = selectedPath;
    nextProject.source.routeLabel = "Local copy";
    nextProject.source.lastError = null;
    nextProject.source.metadata = preparedSource.metadata;
    nextProject.source.metadataError = preparedSource.metadataError;
    return nextProject;
  });

  return {
    storedPath: preparedSource.storedPath,
    storedFileName: preparedSource.storedFileName,
  };
}

async function handleUrlDownload(api, runtime, requestId) {
  const project = getActiveProject(runtime);
  if (project === null) {
    throw new Error("Active project is missing.");
  }

  const urlValue = asNonEmptyString(project.source.drafts.urlInput);
  if (urlValue === null) {
    throw new Error("Direct URL is empty.");
  }

  await cancelJobsForProject(runtime, project.id, requestId);

  const fileName = deriveFilename(urlValue, project.source.kind, project.source.drafts.fileNameHint);
  const jobId = `room-url-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  registerJob(runtime, {
    jobId: jobId,
    requestId: requestId,
    action: "source-download-url",
    projectId: project.id,
  });

  pushJobState(api, {
    requestId: requestId,
    jobId: jobId,
    action: "source-download-url",
    projectId: project.id,
    stage: "queued",
  });

  try {
    const downloadResult = await callRoomTools({
      operation: "download-file",
      roomId: ROOM_ID,
      requestId: requestId,
      jobId: jobId,
      url: urlValue,
      destinationPath: `${getProjectSourceDir(runtime, project)}/${fileName}`,
      overwrite: false,
    });

    const downloaded = toRecord(downloadResult.download);
    const storedPath = asNonEmptyString(downloaded.path);
    const storedFileName =
      asNonEmptyString(downloaded.fileName) ||
      (storedPath ? storedPath.split(/[\\/]/).pop() : null);
    const preparedSource = await resolvePreparedSource(runtime, project, {
      requestId: requestId,
      jobId: jobId,
      storedPath: storedPath,
      storedFileName: storedFileName,
      mimeType:
        asNonEmptyString(downloaded.contentType) ||
        normalizeMimeType(storedFileName, project.source.kind),
    });

    await patchActiveProject(runtime, function (nextProject) {
      if (nextProject.id !== project.id) {
        return nextProject;
      }
      nextProject.source.mode = "url";
      nextProject.source.status = "ready";
      nextProject.source.storedPath = preparedSource.storedPath;
      nextProject.source.storedFileName = preparedSource.storedFileName;
      nextProject.source.sourceUrl = urlValue;
      nextProject.source.mimeType = preparedSource.mimeType;
      nextProject.source.routeLabel = "Direct URL";
      nextProject.source.lastError = null;
      nextProject.source.metadata = preparedSource.metadata;
      nextProject.source.metadataError = preparedSource.metadataError;
      return nextProject;
    });

    pushJobState(api, {
      requestId: requestId,
      jobId: jobId,
      action: "source-download-url",
      projectId: project.id,
      stage: "completed",
      percent: 100,
    });

    return {
      storedPath: preparedSource.storedPath,
      storedFileName: preparedSource.storedFileName,
    };
  } catch (error) {
    await patchActiveProject(runtime, function (nextProject) {
      if (nextProject.id !== project.id) {
        return nextProject;
      }
      nextProject.source.status = "error";
      nextProject.source.lastError = error instanceof Error ? error.message : String(error);
      return nextProject;
    });

    pushJobState(api, {
      requestId: requestId,
      jobId: jobId,
      action: "source-download-url",
      projectId: project.id,
      stage: "failed",
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    clearJob(runtime, jobId);
  }
}

function getResolvedYoutubeSettings(project, sourcePresets) {
  const presetId = asNonEmptyString(project.source.drafts.youtubePreset) || "medium";
  const presetDefaults = getPresetDefaultCustomValues(sourcePresets, presetId);
  if (presetId === "custom") {
    return {
      presetId: presetId,
      values: {
        ...presetDefaults,
        ...toRecord(project.source.drafts.youtubeCustom),
      },
    };
  }
  return {
    presetId: presetId,
    values: presetDefaults,
  };
}

function findYtDlpFinalPath(stdoutValue) {
  const lines = String(stdoutValue || "")
    .split(/\r?\n/)
    .map(function (line) {
      return line.trim();
    })
    .filter(Boolean);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (/^[A-Za-z]:\\/.test(line) || line.startsWith("/")) {
      return line;
    }
  }

  return null;
}

function buildYtDlpArgs(project, toolState, sourceDir) {
  const settings = getResolvedYoutubeSettings(project, toolState.sourcePresets || {});
  const values = settings.values;
  const args = [
    "--newline",
    "--progress",
    "--print",
    "after_move:filepath",
    "-o",
    `${sourceDir}/%(title).120B-%(id)s.%(ext)s`,
  ];

  let formatValue = asNonEmptyString(values.format) || "best";
  if (
    formatValue.indexOf("+") >= 0 &&
    (!toolState.ffmpeg || toolState.ffmpeg.installed !== true)
  ) {
    formatValue = "best";
  }

  args.push("-f", formatValue);

  const mergeOutputFormat = asNonEmptyString(values.mergeOutputFormat);
  if (mergeOutputFormat && mergeOutputFormat !== "auto") {
    args.push("--merge-output-format", mergeOutputFormat);
  }

  const recodeVideo = asNonEmptyString(values.recodeVideo);
  if (recodeVideo && recodeVideo !== "none") {
    args.push("--recode-video", recodeVideo);
  }

  const audioFormat = asNonEmptyString(values.audioFormat);
  if (audioFormat && audioFormat !== "none") {
    args.push("-x", "--audio-format", audioFormat);
  }

  if (values.writeSubtitles === true) {
    args.push("--write-subs");
  }
  if (values.writeAutoSubtitles === true) {
    args.push("--write-auto-subs");
  }

  const subtitlesLang = asNonEmptyString(values.subtitlesLang);
  if (subtitlesLang) {
    args.push("--sub-langs", subtitlesLang);
  } else if (values.writeSubtitles === true || values.writeAutoSubtitles === true) {
    args.push("--sub-langs", "all");
  }

  const playlistItems = asNonEmptyString(values.playlistItems);
  if (playlistItems) {
    args.push("--playlist-items", playlistItems);
  } else {
    args.push("--no-playlist");
  }

  const limitRate = asNonEmptyString(values.limitRate);
  if (limitRate) {
    args.push("--limit-rate", limitRate);
  }

  const retries = Number(values.retries);
  if (Number.isFinite(retries) && retries > 0) {
    args.push("--retries", String(retries));
  }

  if (
    toolState.ffmpeg &&
    toolState.ffmpeg.installed === true &&
    typeof toolState.ffmpeg.binaryPath === "string" &&
    toolState.ffmpeg.binaryPath.trim() !== ""
  ) {
    const binaryPath = toolState.ffmpeg.binaryPath.replace(/\\/g, "/");
    const separatorIndex = binaryPath.lastIndexOf("/");
    const ffmpegDir = separatorIndex >= 0 ? binaryPath.slice(0, separatorIndex) : binaryPath;
    args.push("--ffmpeg-location", ffmpegDir);
  }

  args.push(project.source.drafts.youtubeUrl);
  return args;
}

async function handleYoutubeDownload(api, runtime, requestId) {
  const project = getActiveProject(runtime);
  if (project === null) {
    throw new Error("Active project is missing.");
  }

  const ytDlpState = toRecord(runtime.toolState.tools["yt-dlp"]);
  if (ytDlpState.installed !== true) {
    throw new Error("yt-dlp is not installed.");
  }

  const youtubeUrl = asNonEmptyString(project.source.drafts.youtubeUrl);
  if (youtubeUrl === null) {
    throw new Error("YouTube URL is empty.");
  }

  await cancelJobsForProject(runtime, project.id, requestId);

  const jobId = `room-youtube-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  registerJob(runtime, {
    jobId: jobId,
    requestId: requestId,
    action: "source-download-youtube",
    projectId: project.id,
    toolId: "yt-dlp",
  });

  pushJobState(api, {
    requestId: requestId,
    jobId: jobId,
    action: "source-download-youtube",
    projectId: project.id,
    toolId: "yt-dlp",
    stage: "queued",
  });

  try {
    const runResult = await callRoomTools({
      operation: "tool-run",
      roomId: ROOM_ID,
      requestId: requestId,
      jobId: jobId,
      toolId: "yt-dlp",
      cwd: getProjectSourceDir(runtime, project),
      args: buildYtDlpArgs(
        project,
        {
          sourcePresets: runtime.sourcePresets,
          ffmpeg: runtime.toolState.tools.ffmpeg,
        },
        getProjectSourceDir(runtime, project)
      ),
      timeoutMs: 45 * 60 * 1000,
    });

    const runPayload = toRecord(runResult.run);
    const storedPath = findYtDlpFinalPath(runPayload.stdout);
    const storedFileName = storedPath ? storedPath.split(/[\\/]/).pop() : null;

    if (!storedPath) {
      throw new Error("yt-dlp finished without a final output path.");
    }

    const preparedSource = await resolvePreparedSource(runtime, project, {
      requestId: requestId,
      jobId: jobId,
      storedPath: storedPath,
      storedFileName: storedFileName,
      mimeType: normalizeMimeType(storedFileName, project.source.kind),
    });

    await patchActiveProject(runtime, function (nextProject) {
      if (nextProject.id !== project.id) {
        return nextProject;
      }
      nextProject.source.mode = "youtube";
      nextProject.source.status = "ready";
      nextProject.source.storedPath = preparedSource.storedPath;
      nextProject.source.storedFileName = preparedSource.storedFileName;
      nextProject.source.sourceUrl = youtubeUrl;
      nextProject.source.mimeType = preparedSource.mimeType;
      nextProject.source.routeLabel = "YouTube";
      nextProject.source.lastError = null;
      nextProject.source.metadata = preparedSource.metadata;
      nextProject.source.metadataError = preparedSource.metadataError;
      return nextProject;
    });

    pushJobState(api, {
      requestId: requestId,
      jobId: jobId,
      action: "source-download-youtube",
      projectId: project.id,
      toolId: "yt-dlp",
      stage: "completed",
      percent: 100,
    });

    return {
      storedPath: preparedSource.storedPath,
      storedFileName: preparedSource.storedFileName,
    };
  } catch (error) {
    await patchActiveProject(runtime, function (nextProject) {
      if (nextProject.id !== project.id) {
        return nextProject;
      }
      nextProject.source.status = "error";
      nextProject.source.lastError = error instanceof Error ? error.message : String(error);
      return nextProject;
    });

    pushJobState(api, {
      requestId: requestId,
      jobId: jobId,
      action: "source-download-youtube",
      projectId: project.id,
      toolId: "yt-dlp",
      stage: "failed",
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    clearJob(runtime, jobId);
  }
}

function updateToolBusy(runtime, toolId, busy, lastError) {
  runtime.toolState.tools[toolId] = {
    ...createDefaultToolEntry(toolId),
    ...toRecord(runtime.toolState.tools[toolId]),
    toolId: toolId,
    busy: busy === true,
    lastError: lastError || null,
  };
}

async function handleToolMutation(api, runtime, requestId, action, toolId) {
  if (TOOL_IDS.includes(toolId) === false) {
    throw new Error(`Unsupported tool: ${toolId}`);
  }

  const operation = action === "tool-update" ? "tool-update" : "tool-install";
  const jobId = `room-tool-${toolId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  updateToolBusy(runtime, toolId, true, null);
  registerJob(runtime, {
    jobId: jobId,
    requestId: requestId,
    action: action,
    toolId: toolId,
  });

  pushJobState(api, {
    requestId: requestId,
    jobId: jobId,
    action: action,
    toolId: toolId,
    stage: "queued",
  });

  try {
    const result = await callRoomTools({
      operation: operation,
      roomId: ROOM_ID,
      requestId: requestId,
      jobId: jobId,
      toolId: toolId,
    });

    runtime.toolState.tools[toolId] = {
      ...createDefaultToolEntry(toolId),
      ...toRecord(runtime.toolState.tools[toolId]),
      ...toRecord(result.tool),
      toolId: toolId,
      busy: false,
      lastError: null,
      updateAvailable: false,
      latestVersion: result.tool ? result.tool.version : null,
      latestReleaseTag: result.tool ? result.tool.releaseTag : null,
      latestReleaseName: result.tool ? result.tool.releaseName : null,
      lastCheckedAt: new Date().toISOString(),
    };

    await persistToolState(runtime);
    pushJobState(api, {
      requestId: requestId,
      jobId: jobId,
      action: action,
      toolId: toolId,
      stage: "completed",
      percent: 100,
    });
    return result.tool;
  } catch (error) {
    updateToolBusy(runtime, toolId, false, error instanceof Error ? error.message : String(error));
    await persistToolState(runtime);
    pushJobState(api, {
      requestId: requestId,
      jobId: jobId,
      action: action,
      toolId: toolId,
      stage: "failed",
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    clearJob(runtime, jobId);
  }
}

function updateJobFromProgress(runtime, eventPayload) {
  const jobId = asNonEmptyString(eventPayload.jobId);
  if (!jobId || !runtime.jobs[jobId]) {
    return null;
  }

  const job = runtime.jobs[jobId];
  job.stage = asNonEmptyString(eventPayload.stage) || job.stage;
  if (typeof eventPayload.percent === "number") {
    job.percent = eventPayload.percent;
  } else if (
    typeof eventPayload.bytesReceived === "number" &&
    typeof eventPayload.bytesTotal === "number" &&
    eventPayload.bytesTotal > 0
  ) {
    job.percent = Math.round((eventPayload.bytesReceived / eventPayload.bytesTotal) * 100);
  }
  job.message = asNonEmptyString(eventPayload.message) || job.message;

  if (
    asNonEmptyString(eventPayload.operation) === "tool-run" &&
    (eventPayload.stage === "stdout" || eventPayload.stage === "stderr")
  ) {
    const chunk = asNonEmptyString(eventPayload.chunk);
    if (chunk) {
      const match = chunk.match(/(\d{1,3}(?:\.\d+)?)%/);
      if (match) {
        job.percent = Number(match[1]);
      }
    }
  }

  return {
    requestId: job.requestId,
    jobId: jobId,
    action: job.action,
    projectId: job.projectId,
    toolId: job.toolId,
    stage: job.stage,
    percent: job.percent,
    message: job.message,
  };
}

function ensureRoomToolsSubscription(api, runtime) {
  const electronApi = getElectronApi();
  if (
    runtime.roomToolsSubscribed === true ||
    electronApi === null ||
    typeof electronApi.onRoomToolsProgress !== "function"
  ) {
    return;
  }

  runtime.roomToolsProgressHandler = function (eventPayload) {
    if (!eventPayload || eventPayload.roomId !== ROOM_ID) {
      return;
    }

    const nextJobPayload = updateJobFromProgress(runtime, toRecord(eventPayload));
    if (!nextJobPayload) {
      return;
    }

    pushJobState(api, nextJobPayload);
    pushSourceState(api, runtime, nextJobPayload.requestId, nextJobPayload.action);
  };

  electronApi.onRoomToolsProgress(runtime.roomToolsProgressHandler);
  runtime.roomToolsSubscribed = true;
}

function tearDownRoomToolsSubscription(runtime) {
  const electronApi = getElectronApi();
  if (
    runtime.roomToolsSubscribed !== true ||
    electronApi === null ||
    typeof electronApi.offRoomToolsProgress !== "function" ||
    typeof runtime.roomToolsProgressHandler !== "function"
  ) {
    return;
  }

  electronApi.offRoomToolsProgress(runtime.roomToolsProgressHandler);
  runtime.roomToolsProgressHandler = null;
  runtime.roomToolsSubscribed = false;
}

async function handleSourceAction(api, runtime, payload) {
  const requestId = asNonEmptyString(payload.requestId) || createRequestId();
  const action = asNonEmptyString(payload.action);
  const actionPayload = toRecord(payload.payload);

  if (action === null) {
    pushActionResult(api, {
      requestId: requestId,
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
        await refreshToolStatus(runtime, { checkUpdates: false });
        await refreshActiveProjectMetadata(runtime, requestId);
        break;
      case "tools-refresh":
        await refreshToolStatus(runtime, { checkUpdates: true });
        await refreshActiveProjectMetadata(runtime, requestId);
        break;
      case "project-create":
        await createProject(runtime);
        break;
      case "project-select":
        runtime.activeProjectId = asNonEmptyString(actionPayload.projectId);
        await ensureProjectExists(runtime);
        await refreshActiveProjectMetadata(runtime, requestId);
        break;
      case "project-delete":
        await deleteProject(runtime, asNonEmptyString(actionPayload.projectId), requestId);
        break;
      case "source-set-kind":
        await patchActiveProject(runtime, function (nextProject) {
          nextProject.source.kind =
            asNonEmptyString(actionPayload.kind) || getDefaultSourceType(runtime.sourcePresets);
          nextProject.source.mode = getDefaultMode(runtime.sourcePresets, nextProject.source.kind);
          nextProject.source.status = "idle";
          nextProject.source.storedPath = null;
          nextProject.source.storedFileName = null;
          nextProject.source.sourceUrl = null;
          nextProject.source.mimeType = null;
          nextProject.source.routeLabel = null;
          nextProject.source.lastError = null;
          nextProject.source.metadata = null;
          nextProject.source.metadataError = null;
          return nextProject;
        });
        break;
      case "source-set-mode":
        await patchActiveProject(runtime, function (nextProject) {
          nextProject.source.mode =
            asNonEmptyString(actionPayload.mode) || getDefaultMode(runtime.sourcePresets, nextProject.source.kind);
          nextProject.source.lastError = null;
          return nextProject;
        });
        break;
      case "source-update-draft":
        await patchActiveProjectDrafts(runtime, actionPayload.fields);
        break;
      case "source-pick-local":
        await patchActiveProjectDrafts(runtime, actionPayload.fields);
        await handleLocalPick(api, runtime, requestId);
        break;
      case "source-download-url":
        await patchActiveProjectDrafts(runtime, actionPayload.fields);
        await handleUrlDownload(api, runtime, requestId);
        break;
      case "source-download-youtube":
        await patchActiveProjectDrafts(runtime, actionPayload.fields);
        await handleYoutubeDownload(api, runtime, requestId);
        break;
      case "tool-install":
        await handleToolMutation(api, runtime, requestId, action, asNonEmptyString(actionPayload.toolId));
        await refreshActiveProjectMetadata(runtime, requestId);
        break;
      case "tool-update":
        await handleToolMutation(api, runtime, requestId, action, asNonEmptyString(actionPayload.toolId));
        await refreshActiveProjectMetadata(runtime, requestId);
        break;
      default:
        throw new Error(`Unsupported source action: ${action}`);
    }

    await persistToolState(runtime);
    pushSourceState(api, runtime, requestId, action);
    pushActionResult(api, {
      requestId: requestId,
      success: true,
      action: action,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    api.log("warn", `Laboratory source action failed: ${action} -> ${message}`);
    pushSourceState(api, runtime, requestId, action);
    pushActionResult(api, {
      requestId: requestId,
      success: false,
      action: action,
      error: message,
    });
  }
}

module.exports = {
  activate: function activate(api) {
    const runtime = createRuntimeState();
    api.log("info", "Laboratory media analysis host activated.");
    saveContext(api, {});
    ensureRoomToolsSubscription(api, runtime);

    return {
      onRoomReady: function onRoomReady() {
        void ensureHydrated(api, runtime)
          .then(function () {
            pushSourceState(api, runtime, null);
          })
          .catch(function (error) {
            api.log(
              "warn",
              `Laboratory source host bootstrap failed: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
          });
      },
      onRoomEvent: function onRoomEvent(payload) {
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
          return;
        }

        if (payload.type === "host-context") {
          saveContext(api, payload);
          return;
        }

        if (payload.type === "source-action") {
          void handleSourceAction(api, runtime, toRecord(payload.payload));
        }
      },
      dispose: function dispose() {
        tearDownRoomToolsSubscription(runtime);
        api.log("info", "Laboratory media analysis host disposed.");
      },
    };
  },
};
