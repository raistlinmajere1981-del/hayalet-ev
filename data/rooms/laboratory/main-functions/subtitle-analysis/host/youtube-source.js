import { getProjectSubtitleSourceDir } from "../../../shared/host/project-paths.js";
import { createSubtitleYoutubeDiscoveryRuntime } from "./youtube-discovery.js";
import { createSubtitleYoutubeFilterRuntime } from "./youtube-filters.js";
export function createSubtitleYoutubeSourceRuntime(deps) {
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
    upsertSubtitleEntries
  } = deps;
  const subtitleYoutubeFilterRuntime = createSubtitleYoutubeFilterRuntime({
    asNonEmptyString,
    asNumber,
    toRecord
  });
  const { needsSubtitleYoutubeMetadataFiltering } = subtitleYoutubeFilterRuntime;
  const subtitleYoutubeDiscoveryRuntime = createSubtitleYoutubeDiscoveryRuntime({
    asNonEmptyString,
    asNumber,
    callRoomTools,
    normalizeSubtitleDiscoveryItem,
    roomId,
    subtitleYoutubeFilterRuntime,
    toRecord
  });
  const { buildSubtitleYoutubeDownloadArgs, collectSubtitleYoutubeDiscovery } = subtitleYoutubeDiscoveryRuntime;
  async function handleYoutubeDiscovery(api, runtime, requestId) {
    const project = getActiveProject(runtime);
    const ytDlpState = toRecord(toRecord(runtime.toolState).tools)["yt-dlp"];
    if (project === null) {
      throw new Error("Active project is missing.");
    }
    if (toRecord(ytDlpState).installed !== true) {
      throw new Error("yt-dlp is not installed.");
    }
    const subtitleState = normalizeSubtitleAnalysisState(project.subtitleAnalysis, runtime);
    const drafts = toRecord(toRecord(subtitleState.workspace).drafts);
    const urlValue = asNonEmptyString(drafts.youtubeUrl);
    const scopeId = subtitleState.workspace.mode === "youtube-playlist" ? "playlist" : subtitleState.workspace.mode === "youtube-channel" ? "channel" : "single";
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
      featureStage: "source"
    });
    pushJobState(api, {
      requestId,
      jobId,
      action: "subtitle-source-discover-youtube",
      projectId: project.id,
      toolId: "yt-dlp",
      featureStage: "source",
      stage: "queued"
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
      await patchActiveProject(runtime, function(nextProject) {
        const nextSubtitleState = normalizeSubtitleAnalysisState(nextProject.subtitleAnalysis, runtime);
        nextSubtitleState.workspace.mode = subtitleState.workspace.mode;
        nextSubtitleState.workspace.lastError = null;
        nextSubtitleState.workspace.lastActionAt = (/* @__PURE__ */ new Date()).toISOString();
        nextSubtitleState.discovery = {
          status: "ready",
          scope: scopeId,
          items: discoveryResult.items,
          selectedCandidateIds: discoveryResult.items.map(function(entry) {
            return entry.id;
          }),
          totalCandidateCount: discoveryResult.totalCandidateCount,
          lastError: null,
          lastRunAt: (/* @__PURE__ */ new Date()).toISOString(),
          lastDownloadAt: asNonEmptyString(toRecord(nextSubtitleState.discovery).lastDownloadAt)
        };
        nextProject.subtitleAnalysis = nextSubtitleState;
        return nextProject;
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
        message: `${discoveryResult.items.length} subtitle candidate(s) are ready for selection.`
      });
      return {
        count: discoveryResult.items.length,
        totalCandidateCount: discoveryResult.totalCandidateCount
      };
    } catch (error) {
      await patchActiveProject(runtime, function(nextProject) {
        const nextSubtitleState = normalizeSubtitleAnalysisState(nextProject.subtitleAnalysis, runtime);
        nextSubtitleState.discovery = {
          ...createEmptySubtitleDiscoveryState(),
          status: "error",
          scope: scopeId,
          lastError: error instanceof Error ? error.message : String(error),
          lastRunAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        nextSubtitleState.workspace.lastError = error instanceof Error ? error.message : String(error);
        nextSubtitleState.workspace.lastActionAt = (/* @__PURE__ */ new Date()).toISOString();
        nextProject.subtitleAnalysis = nextSubtitleState;
        return nextProject;
      });
      pushJobState(api, {
        requestId,
        jobId,
        action: "subtitle-source-discover-youtube",
        projectId: project.id,
        toolId: "yt-dlp",
        featureStage: "source",
        stage: "failed",
        message: error instanceof Error ? error.message : String(error)
      });
      throw error;
    } finally {
      clearJob(runtime, jobId);
    }
  }
  async function handleYoutubeDownload(api, runtime, requestId) {
    const project = getActiveProject(runtime);
    const ytDlpState = toRecord(toRecord(runtime.toolState).tools)["yt-dlp"];
    if (project === null) {
      throw new Error("Active project is missing.");
    }
    if (toRecord(ytDlpState).installed !== true) {
      throw new Error("yt-dlp is not installed.");
    }
    const subtitleState = normalizeSubtitleAnalysisState(project.subtitleAnalysis, runtime);
    const drafts = toRecord(toRecord(subtitleState.workspace).drafts);
    const urlValue = asNonEmptyString(drafts.youtubeUrl);
    const scopeId = subtitleState.workspace.mode === "youtube-playlist" ? "playlist" : subtitleState.workspace.mode === "youtube-channel" ? "channel" : "single";
    if (urlValue === null) {
      throw new Error("YouTube URL is empty.");
    }
    const discoveryItems = Array.isArray(toRecord(subtitleState.discovery).items) ? toRecord(subtitleState.discovery).items.map(function(entry, index) {
      return normalizeSubtitleDiscoveryItem(entry, index);
    }) : [];
    const selectedCandidateIds = normalizeStringArray(toRecord(subtitleState.discovery).selectedCandidateIds);
    const selectedCandidates = discoveryItems.filter(function(entry) {
      return selectedCandidateIds.includes(entry.id) && entry.url !== null;
    });
    if (selectedCandidates.length === 0) {
      throw new Error("Run discovery and select at least one video before downloading subtitles.");
    }
    const jobId = `room-subtitle-youtube-download-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sourceDir = getProjectSubtitleSourceDir(runtime, project);
    const beforePaths = new Set(
      (await listSubtitleFilesInDirectory(runtime, sourceDir)).map(function(entry) {
        return entry.path;
      })
    );
    registerJob(runtime, {
      jobId,
      requestId,
      action: "subtitle-source-download-youtube",
      projectId: project.id,
      toolId: "yt-dlp",
      featureStage: "source"
    });
    pushJobState(api, {
      requestId,
      jobId,
      action: "subtitle-source-download-youtube",
      projectId: project.id,
      toolId: "yt-dlp",
      featureStage: "source",
      stage: "queued"
    });
    try {
      for (let index = 0; index < selectedCandidates.length; index += 1) {
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
            selectedCandidates[index].url,
            "single"
          ),
          timeoutMs: 20 * 60 * 1e3
        });
      }
      const sourceType = scopeId === "channel" ? "youtube-channel" : scopeId === "playlist" ? "youtube-playlist" : "youtube-single";
      const afterEntries = await listSubtitleFilesInDirectory(runtime, sourceDir);
      const importedEntries = afterEntries.filter(function(entry) {
        return beforePaths.has(entry.path) !== true;
      }).map(function(entry) {
        const matchedDiscovery = selectedCandidates.find(function(candidate) {
          const candidateId = asNonEmptyString(candidate.videoId);
          return candidateId !== null && entry.name.includes(candidateId);
        }) || selectedCandidates[0] || null;
        return createSubtitleEntryRecord(entry.path, {
          fileName: entry.name,
          sourceType,
          sourceUrl: matchedDiscovery ? matchedDiscovery.url : urlValue,
          publishedAt: matchedDiscovery ? matchedDiscovery.publishedAt : null,
          durationSeconds: matchedDiscovery ? matchedDiscovery.durationSeconds : null,
          isShort: matchedDiscovery ? matchedDiscovery.isShort : null,
          metadata: {
            subtitleLanguages: matchedDiscovery ? matchedDiscovery.subtitleLanguages : []
          }
        });
      });
      if (importedEntries.length === 0) {
        throw new Error("yt-dlp finished without creating subtitle files.");
      }
      await patchActiveProject(runtime, function(nextProject) {
        upsertSubtitleEntries(runtime, nextProject, importedEntries, {
          mode: subtitleState.workspace.mode,
          activeEntryId: importedEntries[0] ? importedEntries[0].id : null,
          selectedEntryIds: importedEntries.map(function(entry) {
            return entry.id;
          }),
          replaceExisting: false
        });
        const nextSubtitleState = normalizeSubtitleAnalysisState(nextProject.subtitleAnalysis, runtime);
        nextSubtitleState.discovery = {
          ...nextSubtitleState.discovery,
          status: "ready",
          scope: scopeId,
          lastError: null,
          lastDownloadAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        nextProject.subtitleAnalysis = nextSubtitleState;
        return nextProject;
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
        message: `${importedEntries.length} subtitle file(s) imported from ${selectedCandidates.length} selected video(s).`
      });
      return {
        count: importedEntries.length,
        selectedVideoCount: selectedCandidates.length
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
        message: error instanceof Error ? error.message : String(error)
      });
      throw error;
    } finally {
      clearJob(runtime, jobId);
    }
  }
  return {
    handleYoutubeDiscovery,
    handleYoutubeDownload,
    needsMetadataFiltering: needsSubtitleYoutubeMetadataFiltering
  };
}
