import type {
  LabYoutubeImportCustomSettings,
  LabYoutubeImportPreview,
  LabYoutubeImportStrategy,
} from "../../models/lab-types.js";

export function normalizeYoutubeImportUrlInput(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const normalizedUrl = value.trim();
  return normalizedUrl === "" ? null : normalizedUrl;
}

export function extractYoutubeImportVideoId(urlText: string): string | null {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlText);
  } catch {
    return null;
  }

  const host = parsedUrl.hostname.toLowerCase().replace(/^www\./, "");
  let candidate: string | null = null;
  if (host === "youtu.be") {
    candidate = parsedUrl.pathname.split("/").filter(Boolean)[0] ?? null;
  } else if (
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "youtube-nocookie.com"
  ) {
    if (parsedUrl.pathname === "/watch") {
      candidate = parsedUrl.searchParams.get("v");
    } else {
      const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
      if (pathParts[0] === "embed" || pathParts[0] === "shorts" || pathParts[0] === "live") {
        candidate = pathParts[1] ?? null;
      }
    }
  }

  if (candidate === null || /^[A-Za-z0-9_-]{3,32}$/.test(candidate) !== true) {
    return null;
  }
  return candidate;
}

export function buildYoutubeImportPreview(urlText: string): LabYoutubeImportPreview | null {
  const videoId = extractYoutubeImportVideoId(urlText);
  if (videoId === null) {
    return null;
  }
  return {
    title: "Sample Video Title",
    duration: 154,
    thumbnail: `https://img.youtube.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`,
  };
}

export function normalizeYoutubeImportStrategyValue(
  value: string
): LabYoutubeImportStrategy | null {
  switch (value) {
    case "video_best":
    case "audio_only":
    case "low_size":
    case "custom":
      return value;
    default:
      return null;
  }
}

export function buildYoutubeImportCustomPatch(
  field: string,
  value: unknown
): Partial<LabYoutubeImportCustomSettings> | null {
  const customField = field.replace("youtube-import.custom.", "");
  switch (customField) {
    case "resolution":
    case "format":
    case "audioExtraction":
      return { [customField]: value } as Partial<LabYoutubeImportCustomSettings>;
    default:
      return null;
  }
}
