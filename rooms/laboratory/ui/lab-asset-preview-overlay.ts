import { asLabRecord, asNonEmptyString, escapeHtml, formatBytes } from "../models/lab-types.js";
import type { LabAsset, LabStoreState } from "../models/lab-types.js";
import {
  buildLabAssetMetadataTitle,
  getLabAssetPath,
  getLabAssetPathLeaf,
} from "./lab-asset-display.js";

type AssetPreviewKind = "video" | "audio" | "image" | "document" | "unsupported";

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

function getActiveAssetPreview(state: LabStoreState): LabAsset | null {
  const activeAssetId = asNonEmptyString(state.ui.activeAssetPreviewId);
  if (activeAssetId === null) {
    return null;
  }
  return (
    state.assets.find(function (asset) {
      return asset.id === activeAssetId;
    }) || null
  );
}

function encodeFilePathSegment(segment: string, index: number): string {
  if (index === 0 && /^[A-Za-z]:$/.test(segment)) {
    return segment;
  }
  return encodeURIComponent(segment);
}

function toAssetPreviewUrl(path: string): string {
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

function getAssetExtension(path: string | null): string | null {
  if (path === null) {
    return null;
  }
  const cleanPath = path.split(/[?#]/)[0] || "";
  const match = /\.([A-Za-z0-9]+)$/.exec(cleanPath);
  const extension = match?.[1];
  return extension ? extension.toLowerCase() : null;
}

function inferPreviewKind(asset: LabAsset, path: string | null): AssetPreviewKind {
  if (asset.type === "source" || asset.type === "clip") {
    return "video";
  }
  if (asset.type === "audio") {
    return "audio";
  }
  if (asset.type === "frame" || asset.type === "image") {
    return "image";
  }

  const extension = getAssetExtension(path);
  if (extension === null) {
    return "unsupported";
  }
  if (IMAGE_EXTENSIONS.has(extension)) {
    return "image";
  }
  if (VIDEO_EXTENSIONS.has(extension)) {
    return "video";
  }
  if (AUDIO_EXTENSIONS.has(extension)) {
    return "audio";
  }
  if (DOCUMENT_EXTENSIONS.has(extension)) {
    return "document";
  }
  return "unsupported";
}

function renderPreviewMedia(asset: LabAsset, previewUrl: string, kind: AssetPreviewKind): string {
  const label = escapeHtml(asset.name);
  if (kind === "image") {
    return `<img class="labx-asset-preview__media labx-asset-preview__media--image" src="${escapeHtml(previewUrl)}" alt="${label}" />`;
  }
  if (kind === "audio") {
    return `
      <div class="labx-asset-preview__audio-shell">
        <div class="labx-asset-preview__audio-bars" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
        </div>
        <audio class="labx-asset-preview__audio-control" src="${escapeHtml(previewUrl)}" controls preload="metadata"></audio>
      </div>
    `;
  }
  if (kind === "video") {
    return `<video class="labx-asset-preview__media labx-asset-preview__media--video" src="${escapeHtml(previewUrl)}" controls preload="metadata" playsinline></video>`;
  }
  if (kind === "document") {
    return `<iframe class="labx-asset-preview__document" src="${escapeHtml(previewUrl)}" title="${label}"></iframe>`;
  }
  return `
    <div class="labx-asset-preview__unsupported">
      <strong>Preview unavailable</strong>
      <span>${escapeHtml(getLabAssetPathLeaf(asset) || asset.name)}</span>
    </div>
  `;
}

function renderAssetMeta(asset: LabAsset): string {
  const metadata = asLabRecord(asset.metadata);
  const durationSeconds =
    typeof metadata["durationSeconds"] === "number"
      ? `${String(Math.round(metadata["durationSeconds"]))} s`
      : null;
  const sizeBytes =
    typeof metadata["sizeBytes"] === "number" ? formatBytes(metadata["sizeBytes"]) : null;
  return [asset.type.toUpperCase(), durationSeconds, sizeBytes, getLabAssetPathLeaf(asset)]
    .filter((entry): entry is string => typeof entry === "string" && entry.trim() !== "")
    .join(" · ");
}

export function renderLabAssetPreviewOverlay(state: LabStoreState): string {
  const asset = getActiveAssetPreview(state);
  const isOpen = asset !== null;
  const path = asset === null ? null : getLabAssetPath(asset);
  const previewUrl = path === null ? null : toAssetPreviewUrl(path);
  const previewKind = asset === null ? "unsupported" : inferPreviewKind(asset, path);

  return `
    <div class="labx-overlay-root labx-asset-preview-root" data-open="${isOpen ? "true" : "false"}" id="lab-asset-preview-overlay-root">
      ${
        isOpen && asset !== null
          ? `
            <button
              type="button"
              class="labx-overlay-backdrop"
              aria-label="Close asset preview"
              data-lab-action="close-asset-preview"
            ></button>
            <section class="labx-asset-preview" role="dialog" aria-modal="true" aria-label="Asset preview">
              <header class="labx-asset-preview__header">
                <div class="labx-asset-preview__title-group">
                  <span class="labx-card__eyebrow">ASSET PREVIEW</span>
                  <h2 class="labx-asset-preview__title">${escapeHtml(asset.name)}</h2>
                  <p class="labx-asset-preview__meta" title="${escapeHtml(buildLabAssetMetadataTitle(asset))}">
                    ${escapeHtml(renderAssetMeta(asset))}
                  </p>
                </div>
                <button class="labx-inline-action" type="button" data-lab-action="close-asset-preview">Kapat</button>
              </header>
              <div class="labx-asset-preview__body" data-preview-kind="${escapeHtml(previewKind)}">
                ${
                  previewUrl === null
                    ? `<div class="labx-asset-preview__unsupported"><strong>Preview unavailable</strong></div>`
                    : renderPreviewMedia(asset, previewUrl, previewKind)
                }
              </div>
            </section>
          `
          : ""
      }
    </div>
  `;
}
