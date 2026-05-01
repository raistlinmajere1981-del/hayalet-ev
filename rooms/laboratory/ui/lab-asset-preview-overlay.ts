import { asLabRecord, asNonEmptyString, escapeHtml, formatBytes } from "../models/lab-types.js";
import type { LabAsset, LabStoreState } from "../models/lab-types.js";
import {
  buildLabAssetMetadataTitle,
  getLabAssetPath,
  getLabAssetPathLeaf,
  getLabAssetPreviewKind,
  getLabAssetPreviewUrl,
  toLabAssetDisplayUrl,
} from "./lab-asset-display.js";
import type { LabAssetPreviewKind } from "./lab-asset-display.js";
import { LAB_FALLBACK_I18N } from "./lab-i18n.js";
import type { LabI18n } from "./lab-i18n.js";

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

function renderPreviewMedia(
  asset: LabAsset,
  previewUrl: string,
  kind: LabAssetPreviewKind,
  copy: LabI18n
): string {
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
      <strong>${escapeHtml(copy.t("mediaAnalysis.assetPreview.unavailable", "Preview unavailable"))}</strong>
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

export function renderLabAssetPreviewOverlay(
  state: LabStoreState,
  copy: LabI18n = LAB_FALLBACK_I18N
): string {
  const asset = getActiveAssetPreview(state);
  const isOpen = asset !== null;
  const path = asset === null ? null : getLabAssetPath(asset);
  const previewUrl =
    asset === null
      ? null
      : path === null
        ? getLabAssetPreviewUrl(asset)
        : toLabAssetDisplayUrl(path);
  const previewKind =
    asset === null
      ? "unsupported"
      : getLabAssetPreviewKind(asset, previewUrl, { usesThumbnail: path === null });

  return `
    <div class="labx-overlay-root labx-asset-preview-root" data-open="${isOpen ? "true" : "false"}" id="lab-asset-preview-overlay-root">
      ${
        asset !== null
          ? `
            <button
              type="button"
              class="labx-overlay-backdrop"
              aria-label="${escapeHtml(copy.t("mediaAnalysis.assetPreview.closeAria", "Close asset preview"))}"
              data-lab-action="close-asset-preview"
            ></button>
            <section class="labx-asset-preview" role="dialog" aria-modal="true" aria-label="${escapeHtml(copy.t("mediaAnalysis.assetPreview.ariaLabel", "Asset preview"))}">
              <header class="labx-asset-preview__header">
                <div class="labx-asset-preview__title-group">
                  <span class="labx-card__eyebrow">${escapeHtml(copy.t("mediaAnalysis.assetPreview.eyebrow", "ASSET PREVIEW"))}</span>
                  <h2 class="labx-asset-preview__title">${escapeHtml(asset.name)}</h2>
                  <p class="labx-asset-preview__meta" title="${escapeHtml(buildLabAssetMetadataTitle(asset))}">
                    ${escapeHtml(renderAssetMeta(asset))}
                  </p>
                </div>
                <button class="labx-inline-action" type="button" data-lab-action="close-asset-preview">${escapeHtml(copy.t("mediaAnalysis.assetPreview.closeAction", "Kapat"))}</button>
              </header>
              <div class="labx-asset-preview__body" data-preview-kind="${escapeHtml(previewKind)}">
                ${
                  previewUrl === null
                    ? `<div class="labx-asset-preview__unsupported"><strong>${escapeHtml(copy.t("mediaAnalysis.assetPreview.unavailable", "Preview unavailable"))}</strong></div>`
                    : renderPreviewMedia(asset, previewUrl, previewKind, copy)
                }
              </div>
            </section>
          `
          : ""
      }
    </div>
  `;
}
