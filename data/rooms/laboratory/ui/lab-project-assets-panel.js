import { asNonEmptyString, escapeHtml } from "../models/lab-types.js";
import {
  getAssets,
  getCurrentSourceAsset,
  getParentSourceForAsset,
  getProjectSource
} from "../runtime/lab-selectors.js";
import {
  buildLabAssetMetadataTitle,
  getLabAssetPath,
  getLabAssetPathLeaf,
  getLabAssetSyncLabel
} from "./lab-asset-display.js";
import { LAB_FALLBACK_I18N } from "./lab-i18n.js";
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
function getAssetGroupLabel(group, copy) {
  return copy.t(`mediaAnalysis.assets.groups.${group.type}`, group.label);
}
function getAssetIcon(asset) {
  return ASSET_TYPE_ICONS[asset.type];
}
function canUseAsSource(asset) {
  return asNonEmptyString(asset.localPath) !== null && (asset.type === "source" || asset.type === "clip" || asset.type === "frame" || asset.type === "audio" || asset.type === "image");
}
function renderAssetMenu(asset, copy) {
  const escapedId = escapeHtml(asset.id);
  const useAsSourceButton = canUseAsSource(asset) ? `
      <button type="button" data-lab-action="asset-use-as-source" data-lab-value="${escapedId}">
        ${escapeHtml(copy.t("mediaAnalysis.assets.actions.useAsSource", "Use as source"))}
      </button>
    ` : "";
  const downloadButton = getLabAssetPath(asset) !== null ? `
        <button type="button" data-lab-action="asset-download" data-lab-value="${escapedId}">
          ${escapeHtml(copy.t("mediaAnalysis.assets.actions.download", "Download"))}
        </button>
      ` : "";
  return `
    <details class="labx-project-assets__menu">
      <summary aria-label="${escapeHtml(copy.t("mediaAnalysis.assets.actions.ariaLabel", "Asset actions"))}">...</summary>
      <div class="labx-project-assets__menu-list">
        <button type="button" data-lab-action="asset-preview" data-lab-value="${escapedId}">
          ${escapeHtml(copy.t("mediaAnalysis.assets.actions.preview", "Preview"))}
        </button>
        ${downloadButton}
        ${useAsSourceButton}
        <button type="button" data-lab-action="asset-remove" data-lab-value="${escapedId}">
          ${escapeHtml(copy.t("mediaAnalysis.assets.actions.delete", "Delete"))}
        </button>
      </div>
    </details>
  `;
}
function renderAudioAssetDetails(state, asset, copy) {
  if (asset.type !== "audio") {
    return "";
  }
  const parentSource = getParentSourceForAsset(state, asset.id);
  const currentSourceAsset = getCurrentSourceAsset(state);
  const syncLabel = getLabAssetSyncLabel(asset, copy);
  const relationMarkup = parentSource === null ? "" : currentSourceAsset !== null && currentSourceAsset.id === parentSource.id ? `<button class="labx-project-assets__relation-link" type="button" data-lab-action="focus-source-preview" data-lab-value="${escapeHtml(parentSource.id)}">${escapeHtml(copy.t("mediaAnalysis.assets.relation.source", "Source"))}: ${escapeHtml(parentSource.name)}</button>` : `<span class="labx-project-assets__relation-text">${escapeHtml(copy.t("mediaAnalysis.assets.relation.source", "Source"))}: ${escapeHtml(parentSource.name)}</span>`;
  if (relationMarkup === "" && syncLabel === null) {
    return "";
  }
  return `
    <span class="labx-project-assets__meta-extra">
      ${relationMarkup}
      ${syncLabel ? `<span class="labx-project-assets__relation-text">${escapeHtml(syncLabel)}</span>` : ""}
    </span>
  `;
}
function renderAssetItem(state, asset, copy) {
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
          <span class="labx-project-assets__meta-primary">${escapeHtml(
    [createdAt, getLabAssetPathLeaf(asset)].filter(Boolean).join(" · ")
  )}</span>
          ${renderAudioAssetDetails(state, asset, copy)}
        </span>
      </button>
      ${renderAssetMenu(asset, copy)}
    </div>
  `;
}
function renderAssetGroup(state, group, assets, copy) {
  const groupAssets = assets.filter(function(asset) {
    return asset.type === group.type;
  });
  if (groupAssets.length === 0) {
    return "";
  }
  return `
    <section class="labx-project-assets__group">
      <div class="labx-project-assets__group-title">
        <strong>${escapeHtml(getAssetGroupLabel(group, copy))}</strong>
        <span>${String(groupAssets.length)}</span>
      </div>
      <div class="labx-project-assets__list">
        ${groupAssets.map(function(asset) {
    return renderAssetItem(state, asset, copy);
  }).join("")}
      </div>
    </section>
  `;
}
export function renderLabProjectAssetsPanel(state, options = {}) {
  const copy = options.copy ?? LAB_FALLBACK_I18N;
  const source = getProjectSource(state);
  const storedFileName = asNonEmptyString(source["storedFileName"]) || asNonEmptyString(source["routeLabel"]) || null;
  const hasSource = storedFileName !== null;
  const projectSummaries = state.projectIndex.projects.map(function(project) {
    return project;
  });
  const activeProjectSummary = projectSummaries.find(function(project) {
    return String(project["id"] || "") === String(state.projectIndex.activeProjectId || "");
  });
  const newProjectSelected = activeProjectSummary?.["hasSource"] === false || state.projectIndex.activeProjectId === null;
  const listedProjects = projectSummaries.filter(function(project) {
    return project["hasSource"] !== false;
  });
  const disableDelete = newProjectSelected || state.projectIndex.activeProjectId === null;
  const assets = getAssets(state).slice().sort(function(left, right) {
    return right.createdAt - left.createdAt;
  });
  const projectControls = options.includeProjectControls ? `
      <div class="labx-project-assets__project-controls">
        <select class="labx-select labx-select--compact" data-lab-field="project.id">
          <option value="new" ${newProjectSelected ? "selected" : ""}>${escapeHtml(copy.t("mediaAnalysis.assets.projects.newOption", "-- New Project --"))}</option>
          ${listedProjects.map(function(project) {
    return `<option value="${escapeHtml(String(project["id"]))}" ${!newProjectSelected && project["id"] === state.projectIndex.activeProjectId ? "selected" : ""}>
                ${escapeHtml(String(project["name"] || project["id"]))}
              </option>`;
  }).join("")}
        </select>
        <div class="labx-rail-actions labx-project-assets__project-actions">
          <button
            class="labx-inline-action labx-inline-action--rail"
            type="button"
            data-lab-action="save-project"
            ${hasSource ? "" : "disabled"}
          >
            ${escapeHtml(copy.t("mediaAnalysis.assets.projects.saveAction", "Save"))}
          </button>
          <button
            class="labx-inline-action labx-inline-action--rail labx-inline-action--danger"
            type="button"
            data-lab-action="project-delete"
            ${disableDelete ? "disabled" : ""}
          >
            ${escapeHtml(copy.t("mediaAnalysis.assets.projects.deleteAction", "Delete"))}
          </button>
        </div>
      </div>
    ` : "";
  const body = assets.length > 0 ? ASSET_GROUPS.map(function(group) {
    return renderAssetGroup(state, group, assets, copy);
  }).join("") : `
        <div class="labx-project-assets__empty">
          <strong>${escapeHtml(copy.t("mediaAnalysis.assets.empty", "No project assets yet"))}</strong>
        </div>
      `;
  return `
    <section class="labx-project-assets${options.variant === "rail" ? " labx-project-assets--rail" : ""}" aria-label="${escapeHtml(copy.t("mediaAnalysis.assets.ariaLabel", "Project assets"))}">
      <div class="labx-project-assets__head">
        <strong>${escapeHtml(copy.t("mediaAnalysis.assets.title", "Project Assets"))}</strong>
        <span>${String(assets.length)}</span>
      </div>
      ${projectControls}
      ${body}
    </section>
  `;
}
