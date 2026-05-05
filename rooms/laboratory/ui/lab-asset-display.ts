import { asLabRecord, asNonEmptyString, asNumber } from "../models/lab-types.js";
import type { LabAsset } from "../models/lab-types.js";
import type { LabI18n } from "./lab-i18n.js";

export type LabAssetPreviewKind = "video" | "audio" | "image" | "document" | "unsupported";

const IMAGE_EXTENSIONS = new Set(["avif", "gif", "jpeg", "jpg", "png", "svg", "webp"]);
const VIDEO_EXTENSIONS = new Set(["m4v", "mkv", "mov", "mp4", "webm"]);
const AUDIO_EXTENSIONS = new Set(["aac", "flac", "m4a", "mp3", "ogg", "opus", "wav", "webm"]);
const DOCUMENT_EXTENSIONS = new Set([
  "csv",
  "html",
  "htm",
  "json",
  "log",
  "md",
  "pdf",
  "txt",
  "xml",
]);

export function getLabAssetPath(asset: LabAsset): string | null {
  return asNonEmptyString(asset.localPath) || asNonEmptyString(asset.url);
}

function encodeFilePathSegment(segment: string, index: number): string {
  if (index === 0 && /^[A-Za-z]:$/.test(segment)) {
    return segment;
  }
  return encodeURIComponent(segment);
}

export function toLabAssetDisplayUrl(path: string): string {
  if (/^(blob|data|file|https?):/i.test(path)) {
    return path;
  }
  const normalizedPath = path.replace(/\\/g, "/");
  if (normalizedPath.startsWith("/")) {
    return `file://${normalizedPath.split("/").map(encodeFilePathSegment).join("/")}`;
  }
  if (/^[A-Za-z]:\//.test(normalizedPath)) {
    return `file:///${normalizedPath.split("/").map(encodeFilePathSegment).join("/")}`;
  }
  return path;
}

export function getLabAssetPreviewUrl(asset: LabAsset): string | null {
  const metadata = asLabRecord(asset.metadata);
  const path = asNonEmptyString(metadata["thumbnailUrl"]) || getLabAssetPath(asset);
  return path === null ? null : toLabAssetDisplayUrl(path);
}

function getLabAssetPathExtension(path: string | null): string | null {
  if (path === null) {
    return null;
  }
  const cleanPath = path.split(/[?#]/)[0] || "";
  const leaf = cleanPath.split(/[\\/]/).pop() || cleanPath;
  const dotIndex = leaf.lastIndexOf(".");
  if (dotIndex < 0 || dotIndex === leaf.length - 1) {
    return null;
  }
  return leaf.slice(dotIndex + 1).toLowerCase();
}

export function getLabAssetPreviewKind(
  asset: LabAsset,
  path: string | null,
  options: { usesThumbnail?: boolean } = {}
): LabAssetPreviewKind {
  const metadata = asLabRecord(asset.metadata);
  if (options.usesThumbnail === true && asNonEmptyString(metadata["thumbnailUrl"]) !== null) {
    return "image";
  }

  const sourceKind = asNonEmptyString(metadata["kind"]);
  if (sourceKind === "image") {
    return "image";
  }
  if (sourceKind === "audio") {
    return "audio";
  }
  if (sourceKind === "video") {
    return "video";
  }
  if (asset.type === "frame" || asset.type === "image") {
    return "image";
  }
  if (asset.type === "audio") {
    return "audio";
  }

  const extension = getLabAssetPathExtension(path);
  if (extension !== null && IMAGE_EXTENSIONS.has(extension)) {
    return "image";
  }
  if (extension !== null && VIDEO_EXTENSIONS.has(extension)) {
    return "video";
  }
  if (extension !== null && AUDIO_EXTENSIONS.has(extension)) {
    return "audio";
  }
  if (extension !== null && DOCUMENT_EXTENSIONS.has(extension)) {
    return "document";
  }

  return asset.type === "source" || asset.type === "clip" ? "video" : "unsupported";
}

export function getLabAssetPathLeaf(asset: LabAsset): string | null {
  const path = getLabAssetPath(asset);
  if (path === null) {
    return null;
  }
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

export function buildLabAssetMetadataTitle(asset: LabAsset): string {
  const lines = [
    `${asset.type}: ${asset.name}`,
    asset.sourceId ? `sourceId: ${asset.sourceId}` : "",
    asset.derivedFromAssetId ? `derivedFromAssetId: ${asset.derivedFromAssetId}` : "",
    asset.derivedFromSourceId ? `derivedFromSourceId: ${asset.derivedFromSourceId}` : "",
    asset.runId ? `runId: ${asset.runId}` : "",
    asset.localPath ? `path: ${asset.localPath}` : "",
    asset.url ? `url: ${asset.url}` : "",
  ].filter(Boolean);
  return lines.join("\n");
}

export function getLabAssetSyncLabel(asset: LabAsset, copy?: LabI18n): string | null {
  if (asset.type !== "audio") {
    return null;
  }
  const metadata = asLabRecord(asset.metadata);
  const durationMs = asNumber(metadata["durationMs"]);
  const startOffsetMs = asNumber(metadata["startOffsetMs"]);
  if (durationMs === null && startOffsetMs === null) {
    return null;
  }
  if (startOffsetMs === null || startOffsetMs === 0) {
    return (
      copy?.t("mediaAnalysis.assets.sync.sameAxis", "Senkron: ✓ Aynı zaman ekseni") ??
      "Senkron: ✓ Aynı zaman ekseni"
    );
  }
  return (
    copy?.t("mediaAnalysis.assets.sync.offset", "Senkron: Ofset {offset} ms", {
      offset: Math.round(startOffsetMs),
    }) ?? `Senkron: Ofset ${String(Math.round(startOffsetMs))} ms`
  );
}
