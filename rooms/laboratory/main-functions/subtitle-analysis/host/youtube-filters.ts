type SubtitleFilterRuntimeDeps = {
  asNonEmptyString: (value: unknown) => string | null;
  asNumber: (value: unknown) => number | null;
  toRecord: (value: unknown) => Record<string, unknown>;
};

export function createSubtitleYoutubeFilterRuntime(deps: SubtitleFilterRuntimeDeps) {
  const { asNonEmptyString, asNumber, toRecord } = deps;

  function formatYoutubeDateForTool(value: unknown): string | null {
    const normalized = asNonEmptyString(value);
    return normalized !== null ? normalized.replaceAll("-", "") : null;
  }

  function parseSubtitleLanguageList(value: unknown): string[] {
    const normalized = asNonEmptyString(value);
    if (normalized === null || normalized.toLowerCase() === "all") {
      return [];
    }
    return normalized
      .split(/[,\s]+/)
      .map(function (entry: string) {
        return entry.trim().toLowerCase();
      })
      .filter(Boolean);
  }

  function parseSubtitleWeekdayFilter(value: unknown): number[] {
    const normalized = asNonEmptyString(value);
    if (normalized === null) {
      return [];
    }

    const aliasMap: Record<string, number> = {
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
      .map(function (entry: string): number | null {
        const token = entry.trim().toLowerCase();
        return Object.prototype.hasOwnProperty.call(aliasMap, token)
          ? (aliasMap[token] ?? null)
          : null;
      })
      .filter(function (entry: number | null): entry is number {
        return typeof entry === "number";
      });
  }

  function matchesSubtitlePublishedRange(
    metadata: Record<string, unknown>,
    drafts: Record<string, unknown>
  ): boolean {
    const publishedAt =
      asNonEmptyString(metadata["upload_date"]) ||
      asNonEmptyString(metadata["release_date"]) ||
      asNonEmptyString(metadata["timestamp"]);
    if (publishedAt === null) {
      return true;
    }

    const normalizedPublished = publishedAt.replaceAll("-", "").slice(0, 8);
    const after = formatYoutubeDateForTool(drafts["publishedAfter"]);
    const before = formatYoutubeDateForTool(drafts["publishedBefore"]);
    if (after !== null && normalizedPublished < after) {
      return false;
    }
    if (before !== null && normalizedPublished > before) {
      return false;
    }
    return true;
  }

  function matchesSubtitleWeekday(
    metadata: Record<string, unknown>,
    drafts: Record<string, unknown>
  ): boolean {
    const filters = parseSubtitleWeekdayFilter(drafts["weekdays"]);
    if (filters.length === 0) {
      return true;
    }

    const uploadDate = asNonEmptyString(metadata["upload_date"]);
    if (uploadDate === null || uploadDate.length < 8) {
      return false;
    }

    const year = Number(uploadDate.slice(0, 4));
    const month = Number(uploadDate.slice(4, 6));
    const day = Number(uploadDate.slice(6, 8));
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    return filters.includes(weekday);
  }

  function matchesSubtitleDuration(
    metadata: Record<string, unknown>,
    drafts: Record<string, unknown>
  ): boolean {
    const durationSeconds = asNumber(metadata["duration"]);
    const minSeconds = asNumber(drafts["durationMinSeconds"]);
    const maxSeconds = asNumber(drafts["durationMaxSeconds"]);
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

  function matchesSubtitleShortsMode(
    metadata: Record<string, unknown>,
    drafts: Record<string, unknown>
  ): boolean {
    const shortsMode = asNonEmptyString(drafts["shortsMode"]) || "all";
    if (shortsMode === "all") {
      return true;
    }

    const webpageUrl = asNonEmptyString(metadata["webpage_url"]) || "";
    const durationSeconds = asNumber(metadata["duration"]);
    const isShort =
      webpageUrl.indexOf("/shorts/") >= 0 || (durationSeconds !== null && durationSeconds <= 180);
    return shortsMode === "only" ? isShort : !isShort;
  }

  function matchesSubtitleLanguageAvailability(
    metadata: Record<string, unknown>,
    drafts: Record<string, unknown>
  ): boolean {
    const requestedLanguages = parseSubtitleLanguageList(drafts["subtitlesLang"]);
    const subtitleMode = asNonEmptyString(drafts["subtitleMode"]) || "manual";
    const manualLanguages = Object.keys(toRecord(metadata["subtitles"]));
    const autoLanguages = Object.keys(toRecord(metadata["automatic_captions"]));
    const availableLanguages =
      subtitleMode === "auto"
        ? autoLanguages
        : subtitleMode === "both"
          ? Array.from(new Set(manualLanguages.concat(autoLanguages)))
          : manualLanguages;

    if (requestedLanguages.length === 0) {
      return availableLanguages.length > 0;
    }

    return requestedLanguages.some(function (language: string) {
      return availableLanguages.some(function (candidate: string) {
        return (
          candidate === language ||
          candidate.startsWith(`${language}-`) ||
          language.startsWith(`${candidate}-`)
        );
      });
    });
  }

  function parseSubtitleTitleFilters(value: unknown): string[] {
    const normalized = asNonEmptyString(value);
    if (normalized === null) {
      return [];
    }
    return normalized
      .split(/[\n,;]+/)
      .map(function (entry: string) {
        return entry.trim().toLowerCase();
      })
      .filter(Boolean);
  }

  function matchesSubtitleTitleFilters(
    metadata: Record<string, unknown>,
    drafts: Record<string, unknown>
  ): boolean {
    const title =
      `${asNonEmptyString(metadata["title"]) || ""} ${asNonEmptyString(metadata["description"]) || ""}`
        .trim()
        .toLowerCase();
    const includeTerms = parseSubtitleTitleFilters(drafts["titleInclude"]);
    const excludeTerms = parseSubtitleTitleFilters(drafts["titleExclude"]);

    if (
      includeTerms.length > 0 &&
      includeTerms.some(function (term: string) {
        return title.includes(term) !== true;
      })
    ) {
      return false;
    }

    return (
      excludeTerms.some(function (term: string) {
        return title.includes(term);
      }) !== true
    );
  }

  function matchesSubtitleLiveMode(
    metadata: Record<string, unknown>,
    drafts: Record<string, unknown>
  ): boolean {
    const liveMode = asNonEmptyString(drafts["liveMode"]) || "all";
    if (liveMode === "all") {
      return true;
    }

    const liveStatus = String(asNonEmptyString(metadata["live_status"]) || "").toLowerCase();
    const isLive =
      metadata["is_live"] === true ||
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

  function needsSubtitleYoutubeMetadataFiltering(drafts: Record<string, unknown>): boolean {
    return (
      parseSubtitleWeekdayFilter(drafts["weekdays"]).length > 0 ||
      asNumber(drafts["durationMinSeconds"]) !== null ||
      asNumber(drafts["durationMaxSeconds"]) !== null ||
      (asNonEmptyString(drafts["shortsMode"]) || "all") !== "all" ||
      (asNonEmptyString(drafts["liveMode"]) || "all") !== "all" ||
      parseSubtitleTitleFilters(drafts["titleInclude"]).length > 0 ||
      parseSubtitleTitleFilters(drafts["titleExclude"]).length > 0
    );
  }

  return {
    formatYoutubeDateForTool,
    matchesSubtitleDuration,
    matchesSubtitleLanguageAvailability,
    matchesSubtitleLiveMode,
    matchesSubtitlePublishedRange,
    matchesSubtitleShortsMode,
    matchesSubtitleTitleFilters,
    matchesSubtitleWeekday,
    needsSubtitleYoutubeMetadataFiltering,
    parseSubtitleLanguageList,
    parseSubtitleTitleFilters,
    parseSubtitleWeekdayFilter,
  };
}
