import { getProjectSubtitleSourceDir } from "../../../shared/host/project-paths.js";

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
    upsertSubtitleEntries,
  } = deps;

  function formatYoutubeDateForTool(value) {
    const normalized = asNonEmptyString(value);
    return normalized !== null ? normalized.replaceAll("-", "") : null;
  }

  function parseSubtitleLanguageList(value) {
    const normalized = asNonEmptyString(value);
    if (normalized === null || normalized.toLowerCase() === "all") {
      return [];
    }
    return normalized
      .split(/[,\s]+/)
      .map(function (entry) {
        return entry.trim().toLowerCase();
      })
      .filter(Boolean);
  }

  function parseSubtitleWeekdayFilter(value) {
    const normalized = asNonEmptyString(value);
    if (normalized === null) {
      return [];
    }

    const aliasMap = {
      sun: 0,
      sunday: 0,
      pazar: 0,
      mon: 1,
      monday: 1,
      pazartesi: 1,
      tue: 2,
      tuesday: 2,
      sali: 2,
      salı: 2,
      wed: 3,
      wednesday: 3,
      carsamba: 3,
      çarşamba: 3,
      thu: 4,
      thursday: 4,
      persembe: 4,
      perşembe: 4,
      fri: 5,
      friday: 5,
      cuma: 5,
      sat: 6,
      saturday: 6,
      cumartesi: 6,
    };

    return normalized
      .split(/[,\s]+/)
      .map(function (entry) {
        const token = entry.trim().toLowerCase();
        return Object.prototype.hasOwnProperty.call(aliasMap, token) ? aliasMap[token] : null;
      })
      .filter(function (entry) {
        return typeof entry === "number";
      });
  }

  function matchesSubtitlePublishedRange(metadata, drafts) {
    const publishedAt =
      asNonEmptyString(metadata.upload_date) ||
      asNonEmptyString(metadata.release_date) ||
      asNonEmptyString(metadata.timestamp);
    if (publishedAt === null) {
      return true;
    }

    const normalizedPublished = publishedAt.replaceAll("-", "").slice(0, 8);
    const after = formatYoutubeDateForTool(drafts.publishedAfter);
    const before = formatYoutubeDateForTool(drafts.publishedBefore);
    if (after !== null && normalizedPublished < after) {
      return false;
    }
    if (before !== null && normalizedPublished > before) {
      return false;
    }
    return true;
  }

  function matchesSubtitleWeekday(metadata, drafts) {
    const filters = parseSubtitleWeekdayFilter(drafts.weekdays);
    if (filters.length === 0) {
      return true;
    }

    const uploadDate = asNonEmptyString(metadata.upload_date);
    if (uploadDate === null || uploadDate.length < 8) {
      return false;
    }

    const year = Number(uploadDate.slice(0, 4));
    const month = Number(uploadDate.slice(4, 6));
    const day = Number(uploadDate.slice(6, 8));
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    return filters.includes(weekday);
  }

  function matchesSubtitleDuration(metadata, drafts) {
    const durationSeconds = asNumber(metadata.duration);
    const minSeconds = asNumber(drafts.durationMinSeconds);
    const maxSeconds = asNumber(drafts.durationMaxSeconds);
    if (minSeconds === null && maxSeconds === null) {
      return true;
    }
    if (durationSeconds === null) {
      return false;
    }
    if (minSeconds !== null && durationSeconds < minSeconds) {
      return false;
    }
    if (maxSeconds !== null && durationSeconds > maxSeconds) {
      return false;
    }
    return true;
  }

  function matchesSubtitleShortsMode(metadata, drafts) {
    const shortsMode = asNonEmptyString(drafts.shortsMode) || "all";
    if (shortsMode === "all") {
      return true;
    }

    const webpageUrl = asNonEmptyString(metadata.webpage_url) || "";
    const durationSeconds = asNumber(metadata.duration);
    const isShort =
      webpageUrl.indexOf("/shorts/") >= 0 || (durationSeconds !== null && durationSeconds <= 180);
    return shortsMode === "only" ? isShort : !isShort;
  }

  function matchesSubtitleLanguageAvailability(metadata, drafts) {
    const requestedLanguages = parseSubtitleLanguageList(drafts.subtitlesLang);
    const subtitleMode = asNonEmptyString(drafts.subtitleMode) || "manual";
    const manualLanguages = Object.keys(toRecord(metadata.subtitles));
    const autoLanguages = Object.keys(toRecord(metadata.automatic_captions));
    const availableLanguages =
      subtitleMode === "auto"
        ? autoLanguages
        : subtitleMode === "both"
          ? Array.from(new Set(manualLanguages.concat(autoLanguages)))
          : manualLanguages;

    if (requestedLanguages.length === 0) {
      return availableLanguages.length > 0;
    }

    return requestedLanguages.some(function (language) {
      return availableLanguages.some(function (candidate) {
        return (
          candidate === language ||
          candidate.startsWith(`${language}-`) ||
          language.startsWith(`${candidate}-`)
        );
      });
    });
  }

  function parseSubtitleTitleFilters(value) {
    const normalized = asNonEmptyString(value);
    if (normalized === null) {
      return [];
    }
    return normalized
      .split(/[\n,;]+/)
      .map(function (entry) {
        return entry.trim().toLowerCase();
      })
      .filter(Boolean);
  }

  function matchesSubtitleTitleFilters(metadata, drafts) {
    const title = `${asNonEmptyString(metadata.title) || ""} ${asNonEmptyString(metadata.description) || ""}`
      .trim()
      .toLowerCase();
    const includeTerms = parseSubtitleTitleFilters(drafts.titleInclude);
    const excludeTerms = parseSubtitleTitleFilters(drafts.titleExclude);

    if (
      includeTerms.length > 0 &&
      includeTerms.some(function (term) {
        return title.includes(term) !== true;
      })
    ) {
      return false;
    }

    return (
      excludeTerms.some(function (term) {
        return title.includes(term);
      }) !== true
    );
  }

  function matchesSubtitleLiveMode(metadata, drafts) {
    const liveMode = asNonEmptyString(drafts.liveMode) || "all";
    if (liveMode === "all") {
      return true;
    }

    const liveStatus = String(asNonEmptyString(metadata.live_status) || "").toLowerCase();
    const isLive =
      metadata.is_live === true ||
      liveStatus === "is_live" ||
      liveStatus === "is-upcoming" ||
      liveStatus === "is_upcoming";
    if (liveMode === "only-live") {
      return isLive;
    }
    if (liveMode === "exclude-live") {
      return isLive !== true;
    }
    return true;
  }

  function needsSubtitleYoutubeMetadataFiltering(drafts) {
    return (
      parseSubtitleWeekdayFilter(drafts.weekdays).length > 0 ||
      asNumber(drafts.durationMinSeconds) !== null ||
      asNumber(drafts.durationMaxSeconds) !== null ||
      (asNonEmptyString(drafts.shortsMode) || "all") !== "all" ||
      (asNonEmptyString(drafts.liveMode) || "all") !== "all" ||
      parseSubtitleTitleFilters(drafts.titleInclude).length > 0 ||
      parseSubtitleTitleFilters(drafts.titleExclude).length > 0
    );
  }

  function buildSubtitleYoutubeCandidateUrl(entry, fallbackUrl) {
    const record = toRecord(entry);
    return (
      asNonEmptyString(record.webpage_url) ||
      asNonEmptyString(record.original_url) ||
      (asNonEmptyString(record.url) && String(record.url).startsWith("http")
        ? asNonEmptyString(record.url)
        : null) ||
      (asNonEmptyString(record.id) ? `https://www.youtube.com/watch?v=${record.id}` : null) ||
      fallbackUrl
    );
  }

  function parseToolRunJson(stdoutValue) {
    const trimmed = String(stdoutValue || "").trim();
    if (trimmed === "") {
      return null;
    }

    const lines = trimmed
      .split(/\r?\n/)
      .map(function (line) {
        return line.trim();
      })
      .filter(function (line) {
        return line.startsWith("{") || line.startsWith("[");
      });

    for (let index = lines.length - 1; index >= 0; index -= 1) {
      try {
        return JSON.parse(lines[index]);
      } catch (_error) {
        // Keep scanning.
      }
    }

    try {
      return JSON.parse(trimmed);
    } catch (_error) {
      return null;
    }
  }

  async function runSubtitleYoutubeMetadata(runtime, requestId, jobId, urlValue, flatPlaylist) {
    const runResult = await callRoomTools({
      operation: "tool-run",
      roomId: roomId,
      requestId: requestId,
      jobId: `${jobId}-${flatPlaylist ? "flat" : "single"}`,
      toolId: "yt-dlp",
      cwd: runtime.paths.storageDir,
      args:
        flatPlaylist === true
          ? ["--dump-single-json", "--flat-playlist", "--skip-download", urlValue]
          : ["--dump-single-json", "--skip-download", urlValue],
      timeoutMs: 10 * 60 * 1000,
    });

    const payload = parseToolRunJson(toRecord(runResult.run).stdout);
    if (!payload || typeof payload !== "object") {
      throw new Error("yt-dlp metadata output could not be parsed.");
    }
    return payload;
  }

  function buildSubtitleYoutubeDownloadArgs(runtime, drafts, sourceDir, urlValue, scopeId) {
    const args = [
      "--newline",
      "--progress",
      "--ignore-errors",
      "--skip-download",
      "--sub-format",
      "vtt/srt/ass/best",
      "-o",
      `${sourceDir}/%(title).120B-%(id)s.%(ext)s`,
    ];
    const subtitleMode = asNonEmptyString(drafts.subtitleMode) || "manual";
    const subtitlesLang = asNonEmptyString(drafts.subtitlesLang) || "all";
    const publishedAfter = formatYoutubeDateForTool(drafts.publishedAfter);
    const publishedBefore = formatYoutubeDateForTool(drafts.publishedBefore);
    const playlistItems = asNonEmptyString(drafts.playlistItems);
    const limitCount = asNumber(drafts.limitCount);

    if (subtitleMode === "manual" || subtitleMode === "both") {
      args.push("--write-subs");
    }
    if (subtitleMode === "auto" || subtitleMode === "both") {
      args.push("--write-auto-subs");
    }
    args.push("--sub-langs", subtitlesLang);

    if (toRecord(toRecord(runtime.toolState).tools).ffmpeg?.installed === true) {
      args.push("--convert-subs", "srt");
    }
    if (publishedAfter !== null) {
      args.push("--dateafter", publishedAfter);
    }
    if (publishedBefore !== null) {
      args.push("--datebefore", publishedBefore);
    }
    if (scopeId === "single") {
      args.push("--no-playlist");
    } else if (playlistItems !== null) {
      args.push("--playlist-items", playlistItems);
    }
    if (scopeId !== "single" && limitCount !== null && limitCount > 0) {
      args.push("--playlist-end", String(limitCount));
    }

    args.push(urlValue);
    return args;
  }

  function getSubtitleAvailableLanguages(metadata) {
    const manualLanguages = Object.keys(toRecord(metadata.subtitles));
    const autoLanguages = Object.keys(toRecord(metadata.automatic_captions));
    return Array.from(new Set(manualLanguages.concat(autoLanguages))).sort();
  }

  function getSubtitleLiveStatus(metadata) {
    return (
      asNonEmptyString(metadata.live_status) ||
      (metadata.is_live === true ? "live" : metadata.was_live === true ? "post_live" : "offline")
    );
  }

  function buildSubtitleDiscoveryItem(metadata, candidateUrl, scopeId) {
    const title = asNonEmptyString(metadata.title);
    const videoId = asNonEmptyString(metadata.id);
    return normalizeSubtitleDiscoveryItem(
      {
        id: videoId || `subtitle-discovery-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        url: candidateUrl,
        videoId: videoId,
        title: title || candidateUrl || `Subtitle candidate ${scopeId}`,
        channelTitle: asNonEmptyString(metadata.channel) || asNonEmptyString(metadata.uploader),
        publishedAt:
          asNonEmptyString(metadata.upload_date) ||
          asNonEmptyString(metadata.release_date) ||
          asNonEmptyString(metadata.timestamp),
        durationSeconds: asNumber(metadata.duration),
        isShort:
          typeof metadata.is_short === "boolean"
            ? metadata.is_short
            : (asNonEmptyString(metadata.webpage_url) || "").includes("/shorts/") ||
                (asNumber(metadata.duration) !== null && asNumber(metadata.duration) <= 180),
        liveStatus: getSubtitleLiveStatus(metadata),
        subtitleLanguages: getSubtitleAvailableLanguages(metadata),
        metadata: {
          scopeId: scopeId,
        },
      },
      0
    );
  }

  async function collectSubtitleYoutubeDiscovery(runtime, requestId, jobId, urlValue, scopeId, drafts) {
    const catalog =
      scopeId === "single"
        ? { entries: [await runSubtitleYoutubeMetadata(runtime, requestId, jobId, urlValue, false)] }
        : await runSubtitleYoutubeMetadata(runtime, requestId, jobId, urlValue, true);
    const candidateEntries = Array.isArray(toRecord(catalog).entries) ? toRecord(catalog).entries : [];
    const limitCount = asNumber(drafts.limitCount);
    const slicedCandidates =
      limitCount !== null && limitCount > 0 ? candidateEntries.slice(0, limitCount) : candidateEntries;
    const matchedItems = [];

    for (let index = 0; index < slicedCandidates.length; index += 1) {
      const candidateUrl = buildSubtitleYoutubeCandidateUrl(slicedCandidates[index], urlValue);
      if (candidateUrl === null) {
        continue;
      }

      const metadata =
        scopeId === "single"
          ? slicedCandidates[index]
          : await runSubtitleYoutubeMetadata(runtime, requestId, jobId, candidateUrl, false);
      if (
        matchesSubtitlePublishedRange(metadata, drafts) !== true ||
        matchesSubtitleWeekday(metadata, drafts) !== true ||
        matchesSubtitleDuration(metadata, drafts) !== true ||
        matchesSubtitleShortsMode(metadata, drafts) !== true ||
        matchesSubtitleLanguageAvailability(metadata, drafts) !== true ||
        matchesSubtitleLiveMode(metadata, drafts) !== true ||
        matchesSubtitleTitleFilters(metadata, drafts) !== true
      ) {
        continue;
      }

      matchedItems.push(buildSubtitleDiscoveryItem(metadata, candidateUrl, scopeId));
    }

    return {
      totalCandidateCount: slicedCandidates.length,
      items: matchedItems,
    };
  }

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
    const scopeId =
      subtitleState.workspace.mode === "youtube-playlist"
        ? "playlist"
        : subtitleState.workspace.mode === "youtube-channel"
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
      projectId: project.id,
      toolId: "yt-dlp",
      featureStage: "source",
    });
    pushJobState(api, {
      requestId: requestId,
      jobId: jobId,
      action: "subtitle-source-discover-youtube",
      projectId: project.id,
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

      await patchActiveProject(runtime, function (nextProject) {
        const nextSubtitleState = normalizeSubtitleAnalysisState(nextProject.subtitleAnalysis, runtime);
        nextSubtitleState.workspace.mode = subtitleState.workspace.mode;
        nextSubtitleState.workspace.lastError = null;
        nextSubtitleState.workspace.lastActionAt = new Date().toISOString();
        nextSubtitleState.discovery = {
          status: "ready",
          scope: scopeId,
          items: discoveryResult.items,
          selectedCandidateIds: discoveryResult.items.map(function (entry) {
            return entry.id;
          }),
          totalCandidateCount: discoveryResult.totalCandidateCount,
          lastError: null,
          lastRunAt: new Date().toISOString(),
          lastDownloadAt: asNonEmptyString(toRecord(nextSubtitleState.discovery).lastDownloadAt),
        };
        nextProject.subtitleAnalysis = nextSubtitleState;
        return nextProject;
      });

      pushJobState(api, {
        requestId: requestId,
        jobId: jobId,
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
        const nextSubtitleState = normalizeSubtitleAnalysisState(nextProject.subtitleAnalysis, runtime);
        nextSubtitleState.discovery = {
          ...createEmptySubtitleDiscoveryState(),
          status: "error",
          scope: scopeId,
          lastError: error instanceof Error ? error.message : String(error),
          lastRunAt: new Date().toISOString(),
        };
        nextSubtitleState.workspace.lastError = error instanceof Error ? error.message : String(error);
        nextSubtitleState.workspace.lastActionAt = new Date().toISOString();
        nextProject.subtitleAnalysis = nextSubtitleState;
        return nextProject;
      });

      pushJobState(api, {
        requestId: requestId,
        jobId: jobId,
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
    const scopeId =
      subtitleState.workspace.mode === "youtube-playlist"
        ? "playlist"
        : subtitleState.workspace.mode === "youtube-channel"
          ? "channel"
          : "single";
    if (urlValue === null) {
      throw new Error("YouTube URL is empty.");
    }

    const discoveryItems = Array.isArray(toRecord(subtitleState.discovery).items)
      ? toRecord(subtitleState.discovery).items.map(function (entry, index) {
          return normalizeSubtitleDiscoveryItem(entry, index);
        })
      : [];
    const selectedCandidateIds = normalizeStringArray(toRecord(subtitleState.discovery).selectedCandidateIds);
    const selectedCandidates = discoveryItems.filter(function (entry) {
      return selectedCandidateIds.includes(entry.id) && entry.url !== null;
    });
    if (selectedCandidates.length === 0) {
      throw new Error("Run discovery and select at least one video before downloading subtitles.");
    }

    const jobId = `room-subtitle-youtube-download-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sourceDir = getProjectSubtitleSourceDir(runtime, project);
    const beforePaths = new Set(
      (await listSubtitleFilesInDirectory(runtime, sourceDir)).map(function (entry) {
        return entry.path;
      })
    );

    registerJob(runtime, {
      jobId: jobId,
      requestId: requestId,
      action: "subtitle-source-download-youtube",
      projectId: project.id,
      toolId: "yt-dlp",
      featureStage: "source",
    });
    pushJobState(api, {
      requestId: requestId,
      jobId: jobId,
      action: "subtitle-source-download-youtube",
      projectId: project.id,
      toolId: "yt-dlp",
      featureStage: "source",
      stage: "queued",
    });

    try {
      for (let index = 0; index < selectedCandidates.length; index += 1) {
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
            selectedCandidates[index].url,
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
            }) ||
            selectedCandidates[0] ||
            null;
          return createSubtitleEntryRecord(entry.path, {
            fileName: entry.name,
            sourceType: sourceType,
            sourceUrl: matchedDiscovery ? matchedDiscovery.url : urlValue,
            publishedAt: matchedDiscovery ? matchedDiscovery.publishedAt : null,
            durationSeconds: matchedDiscovery ? matchedDiscovery.durationSeconds : null,
            isShort: matchedDiscovery ? matchedDiscovery.isShort : null,
            metadata: {
              subtitleLanguages: matchedDiscovery ? matchedDiscovery.subtitleLanguages : [],
            },
          });
        });

      if (importedEntries.length === 0) {
        throw new Error("yt-dlp finished without creating subtitle files.");
      }

      await patchActiveProject(runtime, function (nextProject) {
        upsertSubtitleEntries(runtime, nextProject, importedEntries, {
          mode: subtitleState.workspace.mode,
          activeEntryId: importedEntries[0] ? importedEntries[0].id : null,
          selectedEntryIds: importedEntries.map(function (entry) {
            return entry.id;
          }),
          replaceExisting: false,
        });
        const nextSubtitleState = normalizeSubtitleAnalysisState(nextProject.subtitleAnalysis, runtime);
        nextSubtitleState.discovery = {
          ...nextSubtitleState.discovery,
          status: "ready",
          scope: scopeId,
          lastError: null,
          lastDownloadAt: new Date().toISOString(),
        };
        nextProject.subtitleAnalysis = nextSubtitleState;
        return nextProject;
      });

      pushJobState(api, {
        requestId: requestId,
        jobId: jobId,
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
        requestId: requestId,
        jobId: jobId,
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
    handleYoutubeDiscovery: handleYoutubeDiscovery,
    handleYoutubeDownload: handleYoutubeDownload,
    needsMetadataFiltering: needsSubtitleYoutubeMetadataFiltering,
  };
}
