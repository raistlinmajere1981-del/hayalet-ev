import { asNonEmptyString, escapeHtml } from "../models/lab-types.js";
import type { LabAsset, LabAssetType, LabStoreState } from "../models/lab-types.js";
import { getAssets } from "../runtime/lab-selectors.js";
import { renderEntityCard } from "./asset-card.js";
import { LAB_FALLBACK_I18N } from "./lab-i18n.js";
import type { LabI18n } from "./lab-i18n.js";

function getAssetTypeLabel(type: string, copy: LabI18n): string {
  switch (type) {
    case "source":
      return copy.t("mediaAnalysis.projectWorkspace.typeSource", "Sources");
    case "clip":
      return copy.t("mediaAnalysis.projectWorkspace.typeClip", "Clips");
    case "frame":
      return copy.t("mediaAnalysis.projectWorkspace.typeFrame", "Frames");
    case "audio":
      return copy.t("mediaAnalysis.projectWorkspace.typeAudio", "Audio");
    case "image":
      return copy.t("mediaAnalysis.projectWorkspace.typeImage", "Images");
    case "report":
      return copy.t("mediaAnalysis.projectWorkspace.typeReport", "Reports");
    case "artifact":
      return copy.t("mediaAnalysis.projectWorkspace.typeArtifact", "Artifacts");
    default:
      return type;
  }
}

function getIntentGroupLabel(intentId: string, copy: LabI18n): string {
  switch (intentId) {
    case "visual-inspection":
      return copy.t("mediaAnalysis.projectWorkspace.intentVisualInspection", "Visual Inspection");
    case "audio-investigation":
      return copy.t(
        "mediaAnalysis.projectWorkspace.intentAudioInvestigation",
        "Audio Investigation"
      );
    case "detail-enhancement":
      return copy.t("mediaAnalysis.projectWorkspace.intentDetailEnhancement", "Detail Enhancement");
    case "anomaly-detection":
      return copy.t("mediaAnalysis.projectWorkspace.intentAnomalyDetection", "Anomaly Detection");
    default:
      return copy.t("mediaAnalysis.projectWorkspace.intentGeneral", "General");
  }
}

function getIntentGroupKey(asset: LabAsset): string {
  const intentIds = asset.intentIds;
  if (Array.isArray(intentIds) && intentIds.length > 0) {
    return intentIds[0] || "general";
  }
  return "general";
}

function sortAssets(assets: LabAsset[], sortKey: "createdAt" | "name" | "type"): LabAsset[] {
  const sorted = assets.slice();
  sorted.sort(function (a, b) {
    switch (sortKey) {
      case "name":
        return a.name.localeCompare(b.name);
      case "type":
        return a.type.localeCompare(b.type) || b.createdAt - a.createdAt;
      case "createdAt":
      default:
        return b.createdAt - a.createdAt;
    }
  });
  return sorted;
}

function filterAssets(
  assets: LabAsset[],
  filterType: LabAssetType | null,
  searchTerm: string
): LabAsset[] {
  let filtered = assets;
  if (filterType !== null) {
    filtered = filtered.filter(function (asset) {
      return asset.type === filterType;
    });
  }
  if (searchTerm.trim() !== "") {
    const lowerSearch = searchTerm.toLowerCase();
    filtered = filtered.filter(function (asset) {
      return (
        asset.name.toLowerCase().includes(lowerSearch) ||
        asset.type.toLowerCase().includes(lowerSearch)
      );
    });
  }
  return filtered;
}

type EntityGroup = {
  key: string;
  label: string;
  assets: LabAsset[];
};

function groupAssets(
  assets: LabAsset[],
  groupBy: "type" | "run" | "intent" | null,
  state: LabStoreState,
  copy: LabI18n
): EntityGroup[] {
  if (groupBy === null) {
    return [{ key: "all", label: "", assets }];
  }

  const groupMap = new Map<string, LabAsset[]>();
  const groupOrder: string[] = [];

  assets.forEach(function (asset) {
    let key: string;
    switch (groupBy) {
      case "type":
        key = asset.type;
        break;
      case "run":
        key = asNonEmptyString(asset.runId) || "manual";
        break;
      case "intent":
        key = getIntentGroupKey(asset);
        break;
      default:
        key = "all";
    }
    let groupAssetsForKey = groupMap.get(key);
    if (!groupAssetsForKey) {
      groupAssetsForKey = [];
      groupMap.set(key, groupAssetsForKey);
      groupOrder.push(key);
    }
    groupAssetsForKey.push(asset);
  });

  return groupOrder.map(function (key) {
    let label: string;
    switch (groupBy) {
      case "type":
        label = getAssetTypeLabel(key, copy);
        break;
      case "run":
        if (key === "manual") {
          label = copy.t("mediaAnalysis.projectWorkspace.groupManual", "Manually added");
        } else if (state.run && state.run.id === key) {
          label = copy.t("mediaAnalysis.projectWorkspace.groupCurrentRun", "From current analysis");
        } else {
          label = copy.t(
            "mediaAnalysis.projectWorkspace.groupPreviousRun",
            "From previous analysis"
          );
        }
        break;
      case "intent":
        label = getIntentGroupLabel(key, copy);
        break;
      default:
        label = "";
    }
    return { key, label, assets: groupMap.get(key) || [] };
  });
}

function renderToolbar(state: LabStoreState, copy: LabI18n): string {
  const sort = state.ui.projectWorkspaceSort;
  const filter = state.ui.projectWorkspaceFilter;
  const group = state.ui.projectWorkspaceGroup;
  const search = state.ui.projectWorkspaceSearch;

  const sortOptions = [
    { value: "createdAt", label: copy.t("mediaAnalysis.projectWorkspace.sortDate", "Date") },
    { value: "name", label: copy.t("mediaAnalysis.projectWorkspace.sortName", "Name") },
    { value: "type", label: copy.t("mediaAnalysis.projectWorkspace.sortType", "Type") },
  ];
  const filterOptions: Array<{ value: string; label: string }> = [
    { value: "", label: copy.t("mediaAnalysis.projectWorkspace.filterAll", "All types") },
    { value: "source", label: getAssetTypeLabel("source", copy) },
    { value: "clip", label: getAssetTypeLabel("clip", copy) },
    { value: "frame", label: getAssetTypeLabel("frame", copy) },
    { value: "audio", label: getAssetTypeLabel("audio", copy) },
    { value: "image", label: getAssetTypeLabel("image", copy) },
    { value: "report", label: getAssetTypeLabel("report", copy) },
    { value: "artifact", label: getAssetTypeLabel("artifact", copy) },
  ];
  const groupOptions = [
    { value: "type", label: copy.t("mediaAnalysis.projectWorkspace.groupType", "By type") },
    { value: "run", label: copy.t("mediaAnalysis.projectWorkspace.groupRun", "By analysis") },
    { value: "intent", label: copy.t("mediaAnalysis.projectWorkspace.groupIntent", "By intent") },
    { value: "", label: copy.t("mediaAnalysis.projectWorkspace.groupNone", "No grouping") },
  ];

  const sortSelect = `<select class="labx-pw-grid__toolbar-select" data-lab-field="project-workspace-sort">${sortOptions
    .map(function (opt) {
      return `<option value="${escapeHtml(opt.value)}" ${sort === opt.value ? "selected" : ""}>${escapeHtml(opt.label)}</option>`;
    })
    .join("")}</select>`;

  const filterSelect = `<select class="labx-pw-grid__toolbar-select" data-lab-field="project-workspace-filter">${filterOptions
    .map(function (opt) {
      return `<option value="${escapeHtml(opt.value)}" ${(filter || "") === opt.value ? "selected" : ""}>${escapeHtml(opt.label)}</option>`;
    })
    .join("")}</select>`;

  const groupSelect = `<select class="labx-pw-grid__toolbar-select" data-lab-field="project-workspace-group">${groupOptions
    .map(function (opt) {
      return `<option value="${escapeHtml(opt.value)}" ${(group || "") === opt.value ? "selected" : ""}>${escapeHtml(opt.label)}</option>`;
    })
    .join("")}</select>`;

  const searchInput = `<input class="labx-pw-grid__toolbar-search" type="text" placeholder="${escapeHtml(copy.t("mediaAnalysis.projectWorkspace.search", "Search entities\u2026"))}" data-lab-field="project-workspace-search" value="${escapeHtml(search)}" />`;

  return `
    <div class="labx-pw-grid__toolbar">
      ${sortSelect}
      ${filterSelect}
      ${groupSelect}
      ${searchInput}
    </div>
  `;
}

export function renderAssetGrid(state: LabStoreState, copy: LabI18n = LAB_FALLBACK_I18N): string {
  const selectedIds = new Set(state.ui.projectWorkspaceSelectedEntityIds);
  const allAssets = getAssets(state);
  const sorted = sortAssets(allAssets, state.ui.projectWorkspaceSort);
  const filtered = filterAssets(
    sorted,
    state.ui.projectWorkspaceFilter,
    state.ui.projectWorkspaceSearch
  );
  const groups = groupAssets(filtered, state.ui.projectWorkspaceGroup, state, copy);

  const toolbar = renderToolbar(state, copy);

  if (filtered.length === 0) {
    return `
      <section class="labx-pw-grid">
        ${toolbar}
        <div class="labx-pw-grid__empty">
          ${escapeHtml(
            allAssets.length === 0
              ? copy.t(
                  "mediaAnalysis.projectWorkspace.emptyProject",
                  "Load a source to begin building your project"
                )
              : copy.t(
                  "mediaAnalysis.projectWorkspace.noMatch",
                  "No entities match current filters"
                )
          )}
        </div>
      </section>
    `;
  }

  const groupSections = groups
    .map(function (group) {
      const header =
        group.label !== ""
          ? `<div class="labx-pw-grid__group-header">${escapeHtml(group.label)} <span style="opacity:0.5">${String(group.assets.length)}</span></div>`
          : "";
      const cards = group.assets
        .map(function (asset) {
          return renderEntityCard(asset, selectedIds.has(asset.id), copy);
        })
        .join("");
      return `${header}<div class="labx-pw-grid__cards">${cards}</div>`;
    })
    .join("");

  return `
    <section class="labx-pw-grid">
      ${toolbar}
      ${groupSections}
    </section>
  `;
}
