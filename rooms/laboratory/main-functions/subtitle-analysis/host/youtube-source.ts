import { getProjectSubtitleSourceDir } from "../../../shared/host/project-paths.js";
import { createSubtitleYoutubeDiscoveryRuntime } from "./youtube-discovery.js";
import { createSubtitleYoutubeFilterRuntime } from "./youtube-filters.js";

type LaboratoryRecord = Record<string, unknown>;

type LaboratoryRuntimeRecord = LaboratoryRecord & {
  paths?: unknown;
  toolState?: unknown;
};

type LaboratoryProjectRecord = LaboratoryRecord & {
  id?: unknown;
  slug?: unknown;
  subtitleAnalysis?: unknown;
};

type LaboratoryWorkspaceDraftsRecord = LaboratoryRecord & {
  youtubeUrl?: unknown;
};

type LaboratoryWorkspaceRecord = LaboratoryRecord & {
  drafts?: unknown;
  lastActionAt?: unknown;
  lastError?: unknown;
  mode?: unknown;
};

type LaboratorySubtitleDiscoveryStateRecord = LaboratoryRecord & {
  items?: unknown;
  lastDownloadAt?: unknown;
};

type LaboratorySubtitleStateRecord = LaboratoryRecord & {
  discovery?: unknown;
  workspace?: unknown;
};

type LaboratorySubtitleDiscoveryItemRecord = LaboratoryRecord & {
  durationSeconds?: unknown;
  id?: unknown;
  isShort?: unknown;
  publishedAt?: unknown;
  subtitleLanguages?: unknown;
  url?: unknown;
  videoId?: unknown;
};

type LaboratorySubtitleEntryRecord = LaboratoryRecord & {
  id?: unknown;
};

type LaboratoryToolEntryRecord = LaboratoryRecord & {
  installed?: unknown;
};

type LaboratoryRuntimePathsRecord = LaboratoryRecord & {
  projectsDir?: unknown;
};

type SubtitleSourceFileEntry = {
  name: string;
  path: string;
  isDirectory: boolean;
};

type SubtitleYoutubeDiscoveryResult = {
  items: LaboratorySubtitleDiscoveryItemRecord[];
  totalCandidateCount: number;
};

type SubtitleYoutubeSourceRuntimeDeps = {
  asNonEmptyString: (value: unknown) => string | null;
  asNumber: (value: unknown) => number | null;
  callRoomTools: (payload: LaboratoryRecord) => Promise<LaboratoryRecord>;
  clearJob: (runtime: LaboratoryRuntimeRecord, jobId: string) => void;
  createEmptySubtitleDiscoveryState: () => LaboratoryRecord;
  createSubtitleEntryRecord: (
    filePath: string,
    options: LaboratoryRecord
  ) => LaboratorySubtitleEntryRecord;
  getActiveProject: (runtime: LaboratoryRuntimeRecord) => LaboratoryProjectRecord | null;
  listSubtitleFilesInDirectory: (
    runtime: LaboratoryRuntimeRecord,
    dirPath: string
  ) => Promise<SubtitleSourceFileEntry[]>;
  normalizeStringArray: (value: unknown) => string[];
  normalizeSubtitleAnalysisState: (
    rawValue: unknown,
    runtime: LaboratoryRuntimeRecord
  ) => LaboratorySubtitleStateRecord;
  normalizeSubtitleDiscoveryItem: (
    rawValue: unknown,
    index: number
  ) => LaboratorySubtitleDiscoveryItemRecord;
  patchActiveProject: (
    runtime: LaboratoryRuntimeRecord,
    updater: (project: LaboratoryProjectRecord) => LaboratoryProjectRecord
  ) => Promise<unknown>;
  pushJobState: (api: unknown, payload: LaboratoryRecord) => void;
  registerJob: (runtime: LaboratoryRuntimeRecord, options: LaboratoryRecord) => unknown;
  roomId: string;
  toRecord: (value: unknown) => LaboratoryRecord;
  upsertSubtitleEntries: (
    runtime: LaboratoryRuntimeRecord,
    project: LaboratoryProjectRecord,
    incomingEntries: LaboratorySubtitleEntryRecord[],
    options: LaboratoryRecord
  ) => void;
};

function isNonNullString(value: string | null): value is string {
  return typeof value === "string" && value.length > 0;
}

export function createSubtitleYoutubeSourceRuntime(deps: SubtitleYoutubeSourceRuntimeDeps) {
  const {
    asNonEmptyString,
    asNumber,
    callRoomTools,
    clearJob,
    createEmptySubtitleDiscoveryState,
    createSubtitleEntryRecord,
    getActiveProject,
    listSubtitleFilesInDirectory,
    normalizeStringArray,
    normalizeSubtitleAnalysisState,
    normalizeSubtitleDiscoveryItem,
    patchActiveProject,
    pushJobState,
    registerJob,
    roomId,
    toRecord,
    upsertSubtitleEntries,
  } = deps;

  function toProjectRecord(value: unknown): LaboratoryProjectRecord {
    return toRecord(value);
  }

  function toWorkspaceRecord(value: unknown): LaboratoryWorkspaceRecord {
    return toRecord(value);
  }

  function toDraftsRecord(value: unknown): LaboratoryWorkspaceDraftsRecord {
    return toRecord(value);
  }

  function toSubtitleStateRecord(
    value: unknown,
    runtime: LaboratoryRuntimeRecord
  ): LaboratorySubtitleStateRecord {
    return normalizeSubtitleAnalysisState(value, runtime);
  }

  function toDiscoveryStateRecord(value: unknown): LaboratorySubtitleDiscoveryStateRecord {
    return toRecord(value);
  }

  function toDiscoveryItemRecord(value: unknown): LaboratorySubtitleDiscoveryItemRecord {
    return toRecord(value);
  }

  function toToolEntryRecord(value: unknown): LaboratoryToolEntryRecord {
    return toRecord(value);
  }

  function toRuntimePathsRecord(value: unknown): LaboratoryRuntimePathsRecord {
    return toRecord(value);
  }

  function getToolEntry(runtime: LaboratoryRuntimeRecord, toolId: string): LaboratoryToolEntryRecord {
    return toToolEntryRecord(toRecord(toRecord(runtime.toolState)["tools"])[toolId]);
  }

  function getWorkspaceScopeId(workspace: LaboratoryWorkspaceRecord): string {
    const mode = asNonEmptyString(workspace.mode);
    if (mode === "youtube-playlist") {
      return "playlist";
    }
    if (mode === "youtube-channel") {
      return "channel";
    }
    return "single";
  }

  function getProjectSubtitleSourcePath(
    runtime: LaboratoryRuntimeRecord,
    project: LaboratoryProjectRecord
  ): string {
    const projectsDir = asNonEmptyString(toRuntimePathsRecord(runtime.paths).projectsDir);
    const slug = asNonEmptyString(project.slug);
    if (projectsDir === null || slug === null) {
      throw new Error("Project source directory could not be resolved for subtitle downloads.");
    }
    return getProjectSubtitleSourceDir({ paths: { projectsDir } }, { slug });
  }

  function getDiscoveryItems(
    subtitleState: LaboratorySubtitleStateRecord
  ): LaboratorySubtitleDiscoveryItemRecord[] {
    const discovery = toDiscoveryStateRecord(subtitleState.discovery);
    return Array.isArray(discovery.items)
      ? discovery.items.map(function (entry, index) {
          return normalizeSubtitleDiscoveryItem(entry, index);
        })
      : [];
  }

  function toDiscoveryResult(value: {
    items: Record<string, unknown>[];
    totalCandidateCount: number;
  }): SubtitleYoutubeDiscoveryResult {
    return {
      items: value.items.map(toDiscoveryItemRecord),
      totalCandidateCount: value.totalCandidateCount,
    };
  }

  const subtitleYoutubeFilterRuntime = createSubtitleYoutubeFilterRuntime({
    asNonEmptyString,
    asNumber,
    toRecord,
  });
  const { needsSubtitleYoutubeMetadataFiltering } = subtitleYoutubeFilterRuntime;
  const subtitleYoutubeDiscoveryRuntime = createSubtitleYoutubeDiscoveryRuntime({
    asNonEmptyString,
    asNumber,
    callRoomTools,
    normalizeSubtitleDiscoveryItem,
    roomId,
    subtitleYoutubeFilterRuntime,
    toRecord,
  });
  const { buildSubtitleYoutubeDownloadArgs, collectSubtitleYoutubeDiscovery } =
    subtitleYoutubeDiscoveryRuntime;

  async function handleYoutubeDiscovery(
    api: unknown,
    runtime: LaboratoryRuntimeRecord,
    requestId: string
  ) {
    const project = getActiveProject(runtime);
    const ytDlpState = getToolEntry(runtime, "yt-dlp");
    if (project === null) {
      throw new Error("Active project is missing.");
    }
    if (ytDlpState.installed !== true) {
      throw new Error("yt-dlp is not installed.");
    }

    const subtitleState = toSubtitleStateRecord(project.subtitleAnalysis, runtime);
    const workspace = toWorkspaceRecord(subtitleState.workspace);
    const drafts = toDraftsRecord(workspace.drafts);
    const urlValue = asNonEmptyString(drafts.youtubeUrl);
    const scopeId = getWorkspaceScopeId(workspace);
    if (urlValue === null) {
      throw new Error("YouTube URL is empty.");
    }

    const jobId = `room-subtitle-youtube-discovery-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    registerJob(runtime, {
      jobId,
      requestId,
      action: "subtitle-source-discover-youtube",
      projectId: project.id,
      toolId: "yt-dlp",
      featureStage: "source",
    });
    pushJobState(api, {
      requestId,
      jobId,
      action: "subtitle-source-discover-youtube",
      projectId: project.id,
      toolId: "yt-dlp",
      featureStage: "source",
      stage: "queued",
    });

    try {
      const discoveryResult = toDiscoveryResult(
        await collectSubtitleYoutubeDiscovery(runtime, requestId, jobId, urlValue, scopeId, drafts)
      );
      if (discoveryResult.items.length === 0) {
        throw new Error("No videos matched the requested subtitle filters.");
      }

      await patchActiveProject(runtime, function (nextProject) {
        const nextProjectRecord = toProjectRecord(nextProject);
        const nextSubtitleState = toSubtitleStateRecord(
          nextProjectRecord.subtitleAnalysis,
          runtime
        );
        const nextWorkspace = toWorkspaceRecord(nextSubtitleState.workspace);
        const nextDiscovery = toDiscoveryStateRecord(nextSubtitleState.discovery);

        nextWorkspace.mode = asNonEmptyString(workspace.mode) ?? nextWorkspace.mode;
        nextWorkspace.lastError = null;
        nextWorkspace.lastActionAt = new Date().toISOString();
        nextSubtitleState.workspace = nextWorkspace;
        nextSubtitleState.discovery = {
          status: "ready",
          scope: scopeId,
          items: discoveryResult.items,
          selectedCandidateIds: discoveryResult.items
            .map(function (entry) {
              return asNonEmptyString(entry.id);
            })
            .filter(isNonNullString),
          totalCandidateCount: discoveryResult.totalCandidateCount,
          lastError: null,
          lastRunAt: new Date().toISOString(),
          lastDownloadAt: asNonEmptyString(nextDiscovery.lastDownloadAt),
        };
        nextProjectRecord.subtitleAnalysis = nextSubtitleState;
        return nextProjectRecord;
      });

      pushJobState(api, {
        requestId,
        jobId,
        action: "subtitle-source-discover-youtube",
        projectId: project.id,
        toolId: "yt-dlp",
        featureStage: "source",
        stage: "completed",
        percent: 100,
        message: `${discoveryResult.items.length} subtitle candidate(s) are ready for selection.`,
      });
      return {
        count: discoveryResult.items.length,
        totalCandidateCount: discoveryResult.totalCandidateCount,
      };
    } catch (error) {
      await patchActiveProject(runtime, function (nextProject) {
        const nextProjectRecord = toProjectRecord(nextProject);
        const nextSubtitleState = toSubtitleStateRecord(
          nextProjectRecord.subtitleAnalysis,
          runtime
        );
        const nextWorkspace = toWorkspaceRecord(nextSubtitleState.workspace);

        nextSubtitleState.discovery = {
          ...createEmptySubtitleDiscoveryState(),
          status: "error",
          scope: scopeId,
          lastError: error instanceof Error ? error.message : String(error),
          lastRunAt: new Date().toISOString(),
        };
        nextWorkspace.lastError = error instanceof Error ? error.message : String(error);
        nextWorkspace.lastActionAt = new Date().toISOString();
        nextSubtitleState.workspace = nextWorkspace;
        nextProjectRecord.subtitleAnalysis = nextSubtitleState;
        return nextProjectRecord;
      });

      pushJobState(api, {
        requestId,
        jobId,
        action: "subtitle-source-discover-youtube",
        projectId: project.id,
        toolId: "yt-dlp",
        featureStage: "source",
        stage: "failed",
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      clearJob(runtime, jobId);
    }
  }

  async function handleYoutubeDownload(
    api: unknown,
    runtime: LaboratoryRuntimeRecord,
    requestId: string
  ) {
    const project = getActiveProject(runtime);
    const ytDlpState = getToolEntry(runtime, "yt-dlp");
    if (project === null) {
      throw new Error("Active project is missing.");
    }
    if (ytDlpState.installed !== true) {
      throw new Error("yt-dlp is not installed.");
    }

    const subtitleState = toSubtitleStateRecord(project.subtitleAnalysis, runtime);
    const workspace = toWorkspaceRecord(subtitleState.workspace);
    const drafts = toDraftsRecord(workspace.drafts);
    const urlValue = asNonEmptyString(drafts.youtubeUrl);
    const scopeId = getWorkspaceScopeId(workspace);
    if (urlValue === null) {
      throw new Error("YouTube URL is empty.");
    }

    const discoveryItems = getDiscoveryItems(subtitleState);
    const selectedCandidateIds = normalizeStringArray(
      toDiscoveryStateRecord(subtitleState.discovery)["selectedCandidateIds"]
    );
    const selectedCandidates = discoveryItems.filter(function (entry) {
      const id = asNonEmptyString(entry.id) ?? "";
      return selectedCandidateIds.includes(id) && asNonEmptyString(entry.url) !== null;
    });

    if (selectedCandidates.length === 0) {
      throw new Error("Run discovery and select at least one video before downloading subtitles.");
    }

    const jobId = `room-subtitle-youtube-download-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sourceDir = getProjectSubtitleSourcePath(runtime, project);
    const beforePaths = new Set(
      (await listSubtitleFilesInDirectory(runtime, sourceDir)).map(function (entry) {
        return entry.path;
      })
    );

    registerJob(runtime, {
      jobId,
      requestId,
      action: "subtitle-source-download-youtube",
      projectId: project.id,
      toolId: "yt-dlp",
      featureStage: "source",
    });
    pushJobState(api, {
      requestId,
      jobId,
      action: "subtitle-source-download-youtube",
      projectId: project.id,
      toolId: "yt-dlp",
      featureStage: "source",
      stage: "queued",
    });

    try {
      for (let index = 0; index < selectedCandidates.length; index += 1) {
        const selectedCandidate = selectedCandidates[index];
        if (!selectedCandidate) {
          continue;
        }
        const selectedUrl = asNonEmptyString(selectedCandidate.url) ?? "";
        // eslint-disable-next-line no-await-in-loop -- NOTE: keep yt-dlp downloads ordered per request.
        await callRoomTools({
          operation: "tool-run",
          roomId,
          requestId,
          jobId: `${jobId}-${index}`,
          toolId: "yt-dlp",
          cwd: sourceDir,
          args: buildSubtitleYoutubeDownloadArgs(
            runtime,
            drafts,
            sourceDir,
            selectedUrl,
            "single"
          ),
          timeoutMs: 20 * 60 * 1000,
        });
      }

      const sourceType =
        scopeId === "channel"
          ? "youtube-channel"
          : scopeId === "playlist"
            ? "youtube-playlist"
            : "youtube-single";
      const afterEntries = await listSubtitleFilesInDirectory(runtime, sourceDir);
      const importedEntries = afterEntries
        .filter(function (entry) {
          return beforePaths.has(entry.path) !== true;
        })
        .map(function (entry) {
          const matchedDiscovery =
            selectedCandidates.find(function (candidate) {
              const candidateId = asNonEmptyString(candidate.videoId);
              return candidateId !== null && entry.name.includes(candidateId);
            }) ??
            selectedCandidates[0] ??
            null;
          return createSubtitleEntryRecord(entry.path, {
            fileName: entry.name,
            sourceType,
            sourceUrl: matchedDiscovery === null ? urlValue : matchedDiscovery.url,
            publishedAt: matchedDiscovery === null ? null : matchedDiscovery.publishedAt,
            durationSeconds: matchedDiscovery === null ? null : matchedDiscovery.durationSeconds,
            isShort: matchedDiscovery === null ? null : matchedDiscovery.isShort,
            metadata: {
              subtitleLanguages:
                matchedDiscovery === null
                  ? []
                  : normalizeStringArray(matchedDiscovery.subtitleLanguages),
            },
          });
        });

      if (importedEntries.length === 0) {
        throw new Error("yt-dlp finished without creating subtitle files.");
      }

      await patchActiveProject(runtime, function (nextProject) {
        const nextProjectRecord = toProjectRecord(nextProject);
        upsertSubtitleEntries(runtime, nextProjectRecord, importedEntries, {
          mode: asNonEmptyString(workspace.mode),
          activeEntryId: asNonEmptyString(importedEntries[0]?.id) ?? null,
          selectedEntryIds: importedEntries
            .map(function (entry) {
              return asNonEmptyString(entry.id);
            })
            .filter(isNonNullString),
          replaceExisting: false,
        });
        const nextSubtitleState = toSubtitleStateRecord(
          nextProjectRecord.subtitleAnalysis,
          runtime
        );
        const nextDiscovery = toDiscoveryStateRecord(nextSubtitleState.discovery);
        nextSubtitleState.discovery = {
          ...nextDiscovery,
          status: "ready",
          scope: scopeId,
          lastError: null,
          lastDownloadAt: new Date().toISOString(),
        };
        nextProjectRecord.subtitleAnalysis = nextSubtitleState;
        return nextProjectRecord;
      });

      pushJobState(api, {
        requestId,
        jobId,
        action: "subtitle-source-download-youtube",
        projectId: project.id,
        toolId: "yt-dlp",
        featureStage: "source",
        stage: "completed",
        percent: 100,
        message: `${importedEntries.length} subtitle file(s) imported from ${selectedCandidates.length} selected video(s).`,
      });
      return {
        count: importedEntries.length,
        selectedVideoCount: selectedCandidates.length,
      };
    } catch (error) {
      pushJobState(api, {
        requestId,
        jobId,
        action: "subtitle-source-download-youtube",
        projectId: project.id,
        toolId: "yt-dlp",
        featureStage: "source",
        stage: "failed",
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      clearJob(runtime, jobId);
    }
  }

  return {
    handleYoutubeDiscovery,
    handleYoutubeDownload,
    needsMetadataFiltering: needsSubtitleYoutubeMetadataFiltering,
  };
}
