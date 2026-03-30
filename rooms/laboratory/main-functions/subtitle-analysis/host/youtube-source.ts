import { getProjectSubtitleSourceDir } from "../../../shared/host/project-paths.js";
import { createSubtitleYoutubeDiscoveryRuntime } from "./youtube-discovery.js";
import { createSubtitleYoutubeFilterRuntime } from "./youtube-filters.js";

type SubtitleYoutubeSourceRuntimeDeps = {
  asNonEmptyString: (value: unknown) => string | null;
  asNumber: (value: unknown) => number | null;
  callRoomTools: (payload: Record<string, unknown>) => Promise<Record<string, unknown>>;
  clearJob: (runtime: Record<string, unknown>, jobId: string) => void;
  createEmptySubtitleDiscoveryState: () => Record<string, unknown>;
  createSubtitleEntryRecord: (
    filePath: string,
    options: Record<string, unknown>
  ) => Record<string, unknown>;
  getActiveProject: (runtime: Record<string, unknown>) => Record<string, unknown> | null;
  listSubtitleFilesInDirectory: (
    runtime: Record<string, unknown>,
    dirPath: string
  ) => Promise<Array<{ name: string; path: string; isDirectory: boolean }>>;
  normalizeStringArray: (value: unknown) => string[];
  normalizeSubtitleAnalysisState: (
    rawValue: unknown,
    runtime: Record<string, unknown>
  ) => Record<string, unknown>;
  normalizeSubtitleDiscoveryItem: (rawValue: unknown, index: number) => Record<string, unknown>;
  patchActiveProject: (
    runtime: Record<string, unknown>,
    updater: (project: Record<string, unknown>) => Record<string, unknown>
  ) => Promise<unknown>;
  pushJobState: (api: unknown, payload: Record<string, unknown>) => void;
  registerJob: (runtime: Record<string, unknown>, options: Record<string, unknown>) => unknown;
  roomId: string;
  toRecord: (value: unknown) => Record<string, unknown>;
  upsertSubtitleEntries: (
    runtime: Record<string, unknown>,
    project: Record<string, unknown>,
    incomingEntries: Record<string, unknown>[],
    options: Record<string, unknown>
  ) => void;
};

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
    runtime: Record<string, unknown>,
    requestId: string
  ) {
    const project = getActiveProject(runtime);
    const ytDlpState = toRecord(toRecord(runtime["toolState"])["tools"])["yt-dlp"];
    if (project === null) {
      throw new Error("Active project is missing.");
    }
    if (toRecord(ytDlpState)["installed"] !== true) {
      throw new Error("yt-dlp is not installed.");
    }

    const subtitleState = normalizeSubtitleAnalysisState(project["subtitleAnalysis"], runtime);
    const drafts = toRecord(toRecord(subtitleState["workspace"])["drafts"]);
    const urlValue = asNonEmptyString(drafts["youtubeUrl"]);
    const scopeId =
      (subtitleState["workspace"] as Record<string, unknown>)["mode"] === "youtube-playlist"
        ? "playlist"
        : (subtitleState["workspace"] as Record<string, unknown>)["mode"] === "youtube-channel"
          ? "channel"
          : "single";
    if (urlValue === null) {
      throw new Error("YouTube URL is empty.");
    }

    const jobId = `room-subtitle-youtube-discovery-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    registerJob(runtime, {
      jobId: jobId,
      requestId: requestId,
      action: "subtitle-source-discover-youtube",
      projectId: project["id"],
      toolId: "yt-dlp",
      featureStage: "source",
    });
    pushJobState(api, {
      requestId: requestId,
      jobId: jobId,
      action: "subtitle-source-discover-youtube",
      projectId: project["id"],
      toolId: "yt-dlp",
      featureStage: "source",
      stage: "queued",
    });

    try {
      const discoveryResult = await collectSubtitleYoutubeDiscovery(
        runtime,
        requestId,
        jobId,
        urlValue,
        scopeId,
        drafts
      );
      if (discoveryResult.items.length === 0) {
        throw new Error("No videos matched the requested subtitle filters.");
      }

      await patchActiveProject(runtime, function (nextProject: any) {
        const nextSubtitleState = normalizeSubtitleAnalysisState(
          nextProject["subtitleAnalysis"],
          runtime
        );
        (nextSubtitleState["workspace"] as Record<string, unknown>)["mode"] = (
          subtitleState["workspace"] as Record<string, unknown>
        )["mode"];
        (nextSubtitleState["workspace"] as Record<string, unknown>)["lastError"] = null;
        (nextSubtitleState["workspace"] as Record<string, unknown>)["lastActionAt"] =
          new Date().toISOString();
        nextSubtitleState["discovery"] = {
          status: "ready",
          scope: scopeId,
          items: discoveryResult.items,
          selectedCandidateIds: discoveryResult.items.map(function (entry: any) {
            return entry["id"];
          }),
          totalCandidateCount: discoveryResult.totalCandidateCount,
          lastError: null,
          lastRunAt: new Date().toISOString(),
          lastDownloadAt: asNonEmptyString(toRecord(nextSubtitleState["discovery"])["lastDownloadAt"]),
        };
        nextProject["subtitleAnalysis"] = nextSubtitleState;
        return nextProject;
      });

      pushJobState(api, {
        requestId: requestId,
        jobId: jobId,
        action: "subtitle-source-discover-youtube",
        projectId: project["id"],
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
      await patchActiveProject(runtime, function (nextProject: any) {
        const nextSubtitleState = normalizeSubtitleAnalysisState(
          nextProject["subtitleAnalysis"],
          runtime
        );
        nextSubtitleState["discovery"] = {
          ...createEmptySubtitleDiscoveryState(),
          status: "error",
          scope: scopeId,
          lastError: error instanceof Error ? error.message : String(error),
          lastRunAt: new Date().toISOString(),
        };
        (nextSubtitleState["workspace"] as Record<string, unknown>)["lastError"] =
          error instanceof Error ? error.message : String(error);
        (nextSubtitleState["workspace"] as Record<string, unknown>)["lastActionAt"] =
          new Date().toISOString();
        nextProject["subtitleAnalysis"] = nextSubtitleState;
        return nextProject;
      });

      pushJobState(api, {
        requestId: requestId,
        jobId: jobId,
        action: "subtitle-source-discover-youtube",
        projectId: project["id"],
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
    runtime: Record<string, unknown>,
    requestId: string
  ) {
    const project = getActiveProject(runtime);
    const ytDlpState = toRecord(toRecord(runtime["toolState"])["tools"])["yt-dlp"];
    if (project === null) {
      throw new Error("Active project is missing.");
    }
    if (toRecord(ytDlpState)["installed"] !== true) {
      throw new Error("yt-dlp is not installed.");
    }

    const subtitleState = normalizeSubtitleAnalysisState(project["subtitleAnalysis"], runtime);
    const drafts = toRecord(toRecord(subtitleState["workspace"])["drafts"]);
    const urlValue = asNonEmptyString(drafts["youtubeUrl"]);
    const scopeId =
      (subtitleState["workspace"] as Record<string, unknown>)["mode"] === "youtube-playlist"
        ? "playlist"
        : (subtitleState["workspace"] as Record<string, unknown>)["mode"] === "youtube-channel"
          ? "channel"
          : "single";
    if (urlValue === null) {
      throw new Error("YouTube URL is empty.");
    }

    const discoveryItems = Array.isArray(toRecord(subtitleState["discovery"])["items"])
      ? (toRecord(subtitleState["discovery"])["items"] as unknown[]).map(function (
          entry: unknown,
          index: number
        ) {
          return normalizeSubtitleDiscoveryItem(entry, index);
        })
      : [];
    const selectedCandidateIds = normalizeStringArray(
      toRecord(subtitleState["discovery"])["selectedCandidateIds"]
    );
    const selectedCandidates = discoveryItems.filter(function (entry: Record<string, unknown>) {
      const id = asNonEmptyString(entry["id"]) || "";
      return selectedCandidateIds.includes(id) && entry["url"] !== null;
    });
    if (selectedCandidates.length === 0) {
      throw new Error("Run discovery and select at least one video before downloading subtitles.");
    }

    const jobId = `room-subtitle-youtube-download-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sourceDir = getProjectSubtitleSourceDir(
      runtime as { paths: { projectsDir: string } },
      project as { slug: string }
    );
    const beforePaths = new Set(
      (await listSubtitleFilesInDirectory(runtime, sourceDir)).map(function (entry: any) {
        return entry.path;
      })
    );

    registerJob(runtime, {
      jobId: jobId,
      requestId: requestId,
      action: "subtitle-source-download-youtube",
      projectId: project["id"],
      toolId: "yt-dlp",
      featureStage: "source",
    });
    pushJobState(api, {
      requestId: requestId,
      jobId: jobId,
      action: "subtitle-source-download-youtube",
      projectId: project["id"],
      toolId: "yt-dlp",
      featureStage: "source",
      stage: "queued",
    });

    try {
      for (let index = 0; index < selectedCandidates.length; index += 1) {
        // eslint-disable-next-line no-await-in-loop -- NOTE: keep yt-dlp downloads ordered per request.
        await callRoomTools({
          operation: "tool-run",
          roomId: roomId,
          requestId: requestId,
          jobId: `${jobId}-${index}`,
          toolId: "yt-dlp",
          cwd: sourceDir,
          args: buildSubtitleYoutubeDownloadArgs(
            runtime,
            drafts,
            sourceDir,
            asNonEmptyString(toRecord(selectedCandidates[index])["url"]) || "",
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
        .filter(function (entry: any) {
          return beforePaths.has(entry.path) !== true;
        })
        .map(function (entry: any) {
          const matchedDiscovery =
            selectedCandidates.find(function (candidate: Record<string, unknown>) {
              const candidateId = asNonEmptyString(candidate["videoId"]);
              return candidateId !== null && entry.name.includes(candidateId);
            }) ||
            selectedCandidates[0] ||
            null;
          return createSubtitleEntryRecord(entry.path, {
            fileName: entry.name,
            sourceType: sourceType,
            sourceUrl: matchedDiscovery ? matchedDiscovery["url"] : urlValue,
            publishedAt: matchedDiscovery ? matchedDiscovery["publishedAt"] : null,
            durationSeconds: matchedDiscovery ? matchedDiscovery["durationSeconds"] : null,
            isShort: matchedDiscovery ? matchedDiscovery["isShort"] : null,
            metadata: {
              subtitleLanguages: matchedDiscovery ? matchedDiscovery["subtitleLanguages"] : [],
            },
          });
        });

      if (importedEntries.length === 0) {
        throw new Error("yt-dlp finished without creating subtitle files.");
      }

      await patchActiveProject(runtime, function (nextProject: any) {
        upsertSubtitleEntries(runtime, nextProject, importedEntries, {
          mode: (subtitleState["workspace"] as Record<string, unknown>)["mode"],
          activeEntryId: importedEntries[0] ? importedEntries[0]["id"] : null,
          selectedEntryIds: importedEntries.map(function (entry: any) {
            return entry["id"];
          }),
          replaceExisting: false,
        });
        const nextSubtitleState = normalizeSubtitleAnalysisState(
          nextProject["subtitleAnalysis"],
          runtime
        );
        nextSubtitleState["discovery"] = {
          ...(nextSubtitleState["discovery"] as Record<string, unknown>),
          status: "ready",
          scope: scopeId,
          lastError: null,
          lastDownloadAt: new Date().toISOString(),
        };
        nextProject["subtitleAnalysis"] = nextSubtitleState;
        return nextProject;
      });

      pushJobState(api, {
        requestId: requestId,
        jobId: jobId,
        action: "subtitle-source-download-youtube",
        projectId: project["id"],
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
        requestId: requestId,
        jobId: jobId,
        action: "subtitle-source-download-youtube",
        projectId: project["id"],
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
    handleYoutubeDiscovery: handleYoutubeDiscovery,
    handleYoutubeDownload: handleYoutubeDownload,
    needsMetadataFiltering: needsSubtitleYoutubeMetadataFiltering,
  };
}
