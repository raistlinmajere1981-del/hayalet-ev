const LAB_YOUTUBE_MIN_RANGE_SECONDS = 0.2;
const LAB_YOUTUBE_RANGE_EPSILON_SECONDS = 1e-9;

export type LabYoutubeDownloadRange = {
  startSeconds: number;
  endSeconds: number;
};

export type LabYoutubeRangeValidationCode =
  | "missing-boundary"
  | "non-finite-boundary"
  | "negative-start"
  | "end-not-after-start"
  | "range-too-short"
  | "end-after-duration";

type LabYoutubeRangeCandidate = {
  startSeconds: unknown;
  endSeconds: unknown;
};

function toRangeCandidate(value: unknown): LabYoutubeRangeCandidate {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { startSeconds: null, endSeconds: null };
  }
  const record = value as Record<string, unknown>;
  return {
    startSeconds: record["startSeconds"],
    endSeconds: record["endSeconds"],
  };
}

export function getLabYoutubeRangeValidationCode(
  value: unknown,
  sourceDurationSeconds?: unknown
): LabYoutubeRangeValidationCode | null {
  const range = toRangeCandidate(value);
  if (range.startSeconds === null || range.startSeconds === undefined) {
    return "missing-boundary";
  }
  if (range.endSeconds === null || range.endSeconds === undefined) {
    return "missing-boundary";
  }
  if (
    typeof range.startSeconds !== "number" ||
    Number.isFinite(range.startSeconds) !== true ||
    typeof range.endSeconds !== "number" ||
    Number.isFinite(range.endSeconds) !== true
  ) {
    return "non-finite-boundary";
  }
  if (range.startSeconds < 0) {
    return "negative-start";
  }
  if (range.endSeconds <= range.startSeconds) {
    return "end-not-after-start";
  }
  if (
    range.endSeconds - range.startSeconds <
    LAB_YOUTUBE_MIN_RANGE_SECONDS - LAB_YOUTUBE_RANGE_EPSILON_SECONDS
  ) {
    return "range-too-short";
  }
  if (
    typeof sourceDurationSeconds === "number" &&
    Number.isFinite(sourceDurationSeconds) &&
    sourceDurationSeconds >= 0 &&
    range.endSeconds > sourceDurationSeconds
  ) {
    return "end-after-duration";
  }
  return null;
}

function rangeValidationMessage(code: LabYoutubeRangeValidationCode): string {
  switch (code) {
    case "missing-boundary":
      return "YouTube range requires both startSeconds and endSeconds.";
    case "non-finite-boundary":
      return "YouTube range boundaries must be finite numbers.";
    case "negative-start":
      return "YouTube range startSeconds must be zero or greater.";
    case "end-not-after-start":
      return "YouTube range endSeconds must be greater than startSeconds.";
    case "range-too-short":
      return `YouTube range must be at least ${String(LAB_YOUTUBE_MIN_RANGE_SECONDS)} seconds long.`;
    case "end-after-duration":
      return "YouTube range endSeconds exceeds the source duration.";
  }
}

export function normalizeLabYoutubeDownloadRange(
  value: unknown,
  sourceDurationSeconds?: unknown
): LabYoutubeDownloadRange {
  const validationCode = getLabYoutubeRangeValidationCode(value, sourceDurationSeconds);
  if (validationCode !== null) {
    throw new Error(rangeValidationMessage(validationCode));
  }
  const range = toRangeCandidate(value);
  return {
    startSeconds: range.startSeconds as number,
    endSeconds: range.endSeconds as number,
  };
}

function formatLabYoutubeRangeSeconds(value: number): string {
  return value.toFixed(3).replace(/\.?0+$/, "");
}

export function buildLabYoutubeDownloadSection(range: LabYoutubeDownloadRange): string {
  return `*${formatLabYoutubeRangeSeconds(range.startSeconds)}-${formatLabYoutubeRangeSeconds(range.endSeconds)}`;
}

export function getLabYoutubeRequestedDurationSeconds(range: LabYoutubeDownloadRange): number {
  return Number((range.endSeconds - range.startSeconds).toFixed(3));
}

export function formatLabYoutubeRangeClock(value: unknown): string {
  if (typeof value !== "number" || Number.isFinite(value) !== true || value < 0) {
    return "--:--.---";
  }
  const totalMilliseconds = Math.round(value * 1000);
  const hours = Math.floor(totalMilliseconds / 3_600_000);
  const minutes = Math.floor((totalMilliseconds % 3_600_000) / 60_000);
  const wholeSeconds = Math.floor((totalMilliseconds % 60_000) / 1000);
  const milliseconds = totalMilliseconds % 1000;
  const minuteText = String(minutes).padStart(2, "0");
  return `${hours > 0 ? `${String(hours)}:` : ""}${minuteText}:${String(wholeSeconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
}
