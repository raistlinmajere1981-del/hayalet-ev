import { asLabRecord, asNonEmptyString, escapeHtml, formatBytes } from "../models/lab-types.js";
import type { LabAsset } from "../models/lab-types.js";
import { getLabAssetPreviewUrl } from "./lab-asset-display.js";
import { LAB_FALLBACK_I18N } from "./lab-i18n.js";
import type { LabI18n } from "./lab-i18n.js";

const ENTITY_ICONS: Record<string, string> = {
  source: "\u25B6",
  clip: "\u25B6",
  frame: "\uD83D\uDDBC",
  audio: "\u266B",
  image: "\uD83D\uDDBC",
  report: "\uD83D\uDCC4",
  artifact: "\u2699",
};

const BADGE_LABELS: Record<string, string> = {
  source: "SRC",
  clip: "CLP",
  frame: "FRM",
  audio: "AUD",
  image: "IMG",
  report: "RPT",
  artifact: "AST",
};

const CARD_IMAGE_EXTENSIONS = new Set(["avif", "gif", "jpeg", "jpg", "png", "svg", "webp"]);
const CARD_VIDEO_EXTENSIONS = new Set(["m4v", "mkv", "mov", "mp4", "webm"]);

function getPathExtension(path: string | null): string | null {
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

function getCardPreviewKind(
  asset: LabAsset,
  metadata: Record<string, unknown>,
  previewUrl: string | null
): "image" | "video" | null {
  if (asNonEmptyString(metadata["thumbnailUrl"]) !== null) {
    return "image";
  }
  const sourceKind = asNonEmptyString(metadata["kind"]);
  if (sourceKind === "image" || asset.type === "frame" || asset.type === "image") {
    return "image";
  }
  if (sourceKind === "video") {
    return "video";
  }
  const extension = getPathExtension(previewUrl);
  if (extension !== null && CARD_IMAGE_EXTENSIONS.has(extension)) {
    return "image";
  }
  if (extension !== null && CARD_VIDEO_EXTENSIONS.has(extension)) {
    return "video";
  }
  return asset.type === "source" || asset.type === "clip" ? "video" : null;
}

function formatCardDuration(metadata: Record<string, unknown>): string | null {
  const duration = Number(metadata["duration"]);
  if (!Number.isFinite(duration) || duration <= 0) {
    return null;
  }
  const totalSeconds = Math.round(duration);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes)}:${String(seconds).padStart(2, "0")}`;
}

function formatCardResolution(metadata: Record<string, unknown>): string | null {
  const width = Number(metadata["width"]);
  const height = Number(metadata["height"]);
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    return `${Math.round(width)}\u00D7${Math.round(height)}`;
  }
  return null;
}

function getEntityMetaLine(asset: LabAsset, copy: LabI18n): string {
  const metadata = asLabRecord(asset.metadata);
  const parts: string[] = [];

  if (asset.type === "source" || asset.type === "clip") {
    const dur = formatCardDuration(metadata);
    if (dur !== null) {
      parts.push(dur);
    }
  }

  if (asset.type === "frame" || asset.type === "image") {
    const res = formatCardResolution(metadata);
    if (res !== null) {
      parts.push(res);
    }
  }

  if (asset.type === "audio") {
    const dur = formatCardDuration(metadata);
    if (dur !== null) {
      parts.push(dur);
    }
  }

  if (asset.type === "report") {
    const findingCount = Number(metadata["findingCount"]);
    if (Number.isFinite(findingCount) && findingCount > 0) {
      parts.push(
        copy.t("mediaAnalysis.projectWorkspace.cardFindings", "{count} findings", {
          count: Math.round(findingCount),
        })
      );
    } else {
      parts.push(copy.t("mediaAnalysis.projectWorkspace.cardAnalysisResult", "Analysis result"));
    }
  }

  if (asset.type === "artifact") {
    const kind = asNonEmptyString(metadata["kind"]);
    if (kind !== null) {
      parts.push(kind);
    }
  }

  const size = Number(metadata["size"]);
  if (asset.type !== "report" && Number.isFinite(size) && size > 0) {
    parts.push(formatBytes(size));
  }

  return parts.join(" \u00B7 ");
}

function renderCardThumb(asset: LabAsset): string {
  const metadata = asLabRecord(asset.metadata);
  const previewUrl = getLabAssetPreviewUrl(asset);
  const isVisual =
    asset.type === "source" ||
    asset.type === "clip" ||
    asset.type === "frame" ||
    asset.type === "image";

  let thumbContent: string;
  if (isVisual && previewUrl !== null) {
    const previewKind = getCardPreviewKind(asset, metadata, previewUrl);
    thumbContent =
      previewKind === "video"
        ? `<video class="labx-pw-card__thumb-img labx-pw-card__thumb-video" src="${escapeHtml(previewUrl)}" muted playsinline preload="metadata" aria-hidden="true"></video>`
        : `<img class="labx-pw-card__thumb-img" src="${escapeHtml(previewUrl)}" alt="" loading="lazy" />`;
  } else {
    thumbContent = `<span>${ENTITY_ICONS[asset.type] || "\u2699"}</span>`;
  }

  const scrubBar =
    asset.type === "source" || asset.type === "clip"
      ? `<div class="labx-pw-card__scrub"><div class="labx-pw-card__scrub-fill"></div></div>`
      : "";

  return `
    <div class="labx-pw-card__thumb">
      ${thumbContent}
      <span class="labx-pw-card__badge" data-entity-type="${escapeHtml(asset.type)}">${escapeHtml(BADGE_LABELS[asset.type] || "ENT")}</span>
      ${scrubBar}
    </div>
  `;
}

function getTimelineRange(asset: LabAsset): { startMs: number; endMs: number } | null {
  const metadata = asLabRecord(asset.metadata);
  const selectionStartMs = Number(metadata["selectionStartMs"]);
  const selectionEndMs = Number(metadata["selectionEndMs"]);
  if (
    Number.isFinite(selectionStartMs) &&
    Number.isFinite(selectionEndMs) &&
    selectionEndMs > selectionStartMs
  ) {
    return {
      startMs: Math.max(0, Math.round(selectionStartMs)),
      endMs: Math.max(0, Math.round(selectionEndMs)),
    };
  }
  return null;
}

export function renderEntityCard(
  asset: LabAsset,
  selected: boolean,
  copy: LabI18n = LAB_FALLBACK_I18N
): string {
  const meta = getEntityMetaLine(asset, copy);
  const timelineRange = getTimelineRange(asset);
  const timelineAttrs =
    timelineRange !== null
      ? ` data-lab-timeline-start-ms="${String(timelineRange.startMs)}" data-lab-timeline-end-ms="${String(timelineRange.endMs)}"`
      : "";
  return `
    <div
      class="labx-pw-card"
      role="button"
      tabindex="0"
      data-lab-action="project-workspace-entity-click"
      data-lab-value="${escapeHtml(asset.id)}"
      data-lab-entity-type="${escapeHtml(asset.type)}"
      data-selected="${selected ? "true" : "false"}"
      aria-selected="${selected ? "true" : "false"}"
      aria-label="${escapeHtml(asset.name)}"
      ${timelineAttrs}
    >
      ${renderCardThumb(asset)}
      <div class="labx-pw-card__body">
        <div class="labx-pw-card__name">${escapeHtml(asset.name)}</div>
        ${meta ? `<div class="labx-pw-card__meta">${escapeHtml(meta)}</div>` : ""}
      </div>
    </div>
  `;
}
