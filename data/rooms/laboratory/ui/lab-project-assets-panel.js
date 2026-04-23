import { asNonEmptyString, escapeHtml } from "../models/lab-types.js";
import { getAssets } from "../runtime/lab-selectors.js";
import { buildLabAssetMetadataTitle, getLabAssetPath, getLabAssetPathLeaf } from "./lab-asset-display.js";
const ASSET_GROUPS = [
  { type: "source", label: "Source" },
  { type: "clip", label: "Clips" },
  { type: "frame", label: "Frames" },
  { type: "audio", label: "Audio" },
  { type: "image", label: "Images" },
  { type: "report", label: "Reports" },
  { type: "artifact", label: "Artifacts" }
];
const ASSET_TYPE_ICONS = {
  source: "SRC",
  clip: "CLP",
  frame: "FRM",
  audio: "AUD",
  image: "IMG",
  report: "RPT",
  artifact: "AST"
};
function formatAssetTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}
function getAssetIcon(asset) {
  return ASSET_TYPE_ICONS[asset.type];
}
function canUseAsSource(asset) {
  return asNonEmptyString(asset.localPath) !== null && (asset.type === "source" || asset.type === "clip" || asset.type === "frame" || asset.type === "audio" || asset.type === "image");
}
function renderAssetMenu(asset) {
  const escapedId = escapeHtml(asset.id);
  const useAsSourceButton = canUseAsSource(asset) ? `
      <button type="button" data-lab-action="asset-use-as-source" data-lab-value="${escapedId}">
        Use as source
      </button>
    ` : "";
  const downloadButton = getLabAssetPath(asset) !== null ? `
        <button type="button" data-lab-action="asset-download" data-lab-value="${escapedId}">
          Download
        </button>
      ` : "";
  return `
    <details class="labx-project-assets__menu">
      <summary aria-label="Asset actions">...</summary>
      <div class="labx-project-assets__menu-list">
        <button type="button" data-lab-action="asset-preview" data-lab-value="${escapedId}">
          Preview
        </button>
        ${downloadButton}
        ${useAsSourceButton}
        <button type="button" data-lab-action="asset-remove" data-lab-value="${escapedId}">
          Delete
        </button>
      </div>
    </details>
  `;
}
function renderAssetItem(asset) {
  const createdAt = formatAssetTime(asset.createdAt);
  const escapedId = escapeHtml(asset.id);
  return `
    <div class="labx-project-assets__item" data-lab-asset-id="${escapedId}" title="${escapeHtml(
    buildLabAssetMetadataTitle(asset)
  )}">
      <button
        class="labx-project-assets__preview"
        type="button"
        data-lab-action="asset-preview"
        data-lab-value="${escapedId}"
      >
        <span class="labx-project-assets__icon" data-asset-type="${escapeHtml(asset.type)}">
          ${escapeHtml(getAssetIcon(asset))}
        </span>
        <span class="labx-project-assets__text">
          <strong>${escapeHtml(asset.name)}</strong>
          <span>${escapeHtml([createdAt, getLabAssetPathLeaf(asset)].filter(Boolean).join(" · "))}</span>
        </span>
      </button>
      ${renderAssetMenu(asset)}
    </div>
  `;
}
function renderAssetGroup(group, assets) {
  const groupAssets = assets.filter(function(asset) {
    return asset.type === group.type;
  });
  if (groupAssets.length === 0) {
    return "";
  }
  return `
    <section class="labx-project-assets__group">
      <div class="labx-project-assets__group-title">
        <strong>${escapeHtml(group.label)}</strong>
        <span>${String(groupAssets.length)}</span>
      </div>
      <div class="labx-project-assets__list">
        ${groupAssets.map(renderAssetItem).join("")}
      </div>
    </section>
  `;
}
export function renderLabProjectAssetsPanel(state) {
  const assets = getAssets(state).slice().sort(function(left, right) {
    return right.createdAt - left.createdAt;
  });
  const body = assets.length > 0 ? ASSET_GROUPS.map(function(group) {
    return renderAssetGroup(group, assets);
  }).join("") : `
        <div class="labx-project-assets__empty">
          <strong>No project assets yet</strong>
        </div>
      `;
  return `
    <section class="labx-project-assets" aria-label="Project assets">
      <div class="labx-project-assets__head">
        <strong>Project Assets</strong>
        <span>${String(assets.length)}</span>
      </div>
      ${body}
    </section>
  `;
}
