export function createSubtitleYoutubeDiscoveryRuntime(deps) {
  const {
    asNonEmptyString,
    asNumber,
    callRoomTools,
    normalizeSubtitleDiscoveryItem,
    roomId,
    subtitleYoutubeFilterRuntime,
    toRecord
  } = deps;
  const {
    formatYoutubeDateForTool,
    matchesSubtitleDuration,
    matchesSubtitleLanguageAvailability,
    matchesSubtitleLiveMode,
    matchesSubtitlePublishedRange,
    matchesSubtitleShortsMode,
    matchesSubtitleTitleFilters,
    matchesSubtitleWeekday
  } = subtitleYoutubeFilterRuntime;
  function buildSubtitleYoutubeCandidateUrl(entry, fallbackUrl) {
    const record = toRecord(entry);
    return asNonEmptyString(record["webpage_url"]) || asNonEmptyString(record["original_url"]) || (asNonEmptyString(record["url"]) && String(record["url"]).startsWith("http") ? asNonEmptyString(record["url"]) : null) || (asNonEmptyString(record["id"]) ? `https://www.youtube.com/watch?v=${record["id"]}` : null) || fallbackUrl;
  }
  function parseToolRunJson(stdoutValue) {
    const trimmed = String(stdoutValue || "").trim();
    if (trimmed === "") {
      return null;
    }
    const lines = trimmed.split(/\r?\n/).map(function(line) {
      return line.trim();
    }).filter(function(line) {
      return line.startsWith("{") || line.startsWith("[");
    });
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const candidate = lines[index];
      if (!candidate) {
        continue;
      }
      try {
        return JSON.parse(candidate);
      } catch (_error) {
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
      roomId,
      requestId,
      jobId: `${jobId}-${flatPlaylist ? "flat" : "single"}`,
      toolId: "yt-dlp",
      cwd: toRecord(runtime["paths"])["storageDir"],
      args: flatPlaylist === true ? ["--dump-single-json", "--flat-playlist", "--skip-download", urlValue] : ["--dump-single-json", "--skip-download", urlValue],
      timeoutMs: 10 * 60 * 1e3
    });
    const payload = parseToolRunJson(toRecord(runResult["run"])["stdout"]);
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
      `${sourceDir}/%(title).120B-%(id)s.%(ext)s`
    ];
    const subtitleMode = asNonEmptyString(drafts["subtitleMode"]) || "manual";
    const subtitlesLang = asNonEmptyString(drafts["subtitlesLang"]) || "all";
    const publishedAfter = formatYoutubeDateForTool(drafts["publishedAfter"]);
    const publishedBefore = formatYoutubeDateForTool(drafts["publishedBefore"]);
    const playlistItems = asNonEmptyString(drafts["playlistItems"]);
    const limitCount = asNumber(drafts["limitCount"]);
    if (subtitleMode === "manual" || subtitleMode === "both") {
      args.push("--write-subs");
    }
    if (subtitleMode === "auto" || subtitleMode === "both") {
      args.push("--write-auto-subs");
    }
    args.push("--sub-langs", subtitlesLang);
    if (toRecord(toRecord(toRecord(runtime["toolState"])["tools"])["ffmpeg"])["installed"] === true) {
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
    const manualLanguages = Object.keys(toRecord(metadata["subtitles"]));
    const autoLanguages = Object.keys(toRecord(metadata["automatic_captions"]));
    return Array.from(new Set(manualLanguages.concat(autoLanguages))).sort();
  }
  function getSubtitleLiveStatus(metadata) {
    return asNonEmptyString(metadata["live_status"]) || (metadata["is_live"] === true ? "live" : metadata["was_live"] === true ? "post_live" : "offline");
  }
  function buildSubtitleDiscoveryItem(metadata, candidateUrl, scopeId) {
    const title = asNonEmptyString(metadata["title"]);
    const videoId = asNonEmptyString(metadata["id"]);
    const durationSeconds = asNumber(metadata["duration"]);
    return normalizeSubtitleDiscoveryItem(
      {
        id: videoId || `subtitle-discovery-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        url: candidateUrl,
        videoId,
        title: title || candidateUrl || `Subtitle candidate ${scopeId}`,
        channelTitle: asNonEmptyString(metadata["channel"]) || asNonEmptyString(metadata["uploader"]),
        publishedAt: asNonEmptyString(metadata["upload_date"]) || asNonEmptyString(metadata["release_date"]) || asNonEmptyString(metadata["timestamp"]),
        durationSeconds,
        isShort: typeof metadata["is_short"] === "boolean" ? metadata["is_short"] : (asNonEmptyString(metadata["webpage_url"]) || "").includes("/shorts/") || durationSeconds !== null && durationSeconds <= 180,
        liveStatus: getSubtitleLiveStatus(metadata),
        subtitleLanguages: getSubtitleAvailableLanguages(metadata),
        metadata: {
          scopeId
        }
      },
      0
    );
  }
  async function collectSubtitleYoutubeDiscovery(runtime, requestId, jobId, urlValue, scopeId, drafts) {
    const catalogUnknown = scopeId === "single" ? {
      entries: [await runSubtitleYoutubeMetadata(runtime, requestId, jobId, urlValue, false)]
    } : await runSubtitleYoutubeMetadata(runtime, requestId, jobId, urlValue, true);
    const catalog = toRecord(catalogUnknown);
    const candidateEntries = Array.isArray(catalog["entries"]) ? catalog["entries"] : [];
    const limitCount = asNumber(drafts["limitCount"]);
    const slicedCandidates = limitCount !== null && limitCount > 0 ? candidateEntries.slice(0, limitCount) : candidateEntries;
    const matchedItems = [];
    for (let index = 0; index < slicedCandidates.length; index += 1) {
      const candidateUrl = buildSubtitleYoutubeCandidateUrl(slicedCandidates[index], urlValue);
      if (candidateUrl === null) {
        continue;
      }
      const metadata = scopeId === "single" ? slicedCandidates[index] : (
        // eslint-disable-next-line no-await-in-loop -- NOTE: yt-dlp metadata calls stay serialized per request.
        await runSubtitleYoutubeMetadata(runtime, requestId, jobId, candidateUrl, false)
      );
      const normalizedMetadata = toRecord(metadata);
      if (matchesSubtitlePublishedRange(normalizedMetadata, drafts) !== true || matchesSubtitleWeekday(normalizedMetadata, drafts) !== true || matchesSubtitleDuration(normalizedMetadata, drafts) !== true || matchesSubtitleShortsMode(normalizedMetadata, drafts) !== true || matchesSubtitleLanguageAvailability(normalizedMetadata, drafts) !== true || matchesSubtitleLiveMode(normalizedMetadata, drafts) !== true || matchesSubtitleTitleFilters(normalizedMetadata, drafts) !== true) {
        continue;
      }
      matchedItems.push(buildSubtitleDiscoveryItem(normalizedMetadata, candidateUrl, scopeId));
    }
    return {
      totalCandidateCount: slicedCandidates.length,
      items: matchedItems
    };
  }
  return {
    buildSubtitleDiscoveryItem,
    buildSubtitleYoutubeCandidateUrl,
    buildSubtitleYoutubeDownloadArgs,
    collectSubtitleYoutubeDiscovery,
    getSubtitleAvailableLanguages,
    getSubtitleLiveStatus,
    parseToolRunJson,
    runSubtitleYoutubeMetadata
  };
}
