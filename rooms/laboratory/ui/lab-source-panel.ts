import { asLabRecord, asNonEmptyString, escapeHtml } from "../models/lab-types.js";
import type { LabAsset, LabAssetType, LabStoreState } from "../models/lab-types.js";
import { getLabPathExtension, inferLabAssetSourceKind } from "../shared/lab-asset-kind.js";
import {
  getAssets,
  getCurrentSourceAsset,
  getParentSourceForAsset,
  getProjectSource,
} from "../runtime/lab-selectors.js";
import {
  buildProjectImportHostAction,
  buildProjectImportLocalHostAction,
  buildProjectImportUrlCheckAction,
  getProjectImportUrlInput,
  hasProjectImportDraftValue,
} from "../runtime/lab-project-import.js";
import {
  renderDirectUrlCheckResult,
  renderProjectImportProgress,
  renderYoutubeCheckResult,
} from "./project-source-import.js";
import {
  buildLabAssetMetadataTitle,
  getLabAssetPath,
  getLabAssetPathLeaf,
  getLabAssetPreviewKind,
  getLabAssetPreviewUrl,
  getLabAssetSyncLabel,
} from "./lab-asset-display.js";
import { LAB_FALLBACK_I18N } from "./lab-i18n.js";
import type { LabI18n } from "./lab-i18n.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AssetGroup = {
  id: string;
  labelKey: string;
  labelFallback: string;
  types: LabAssetType[];
};

const ASSET_GROUPS: AssetGroup[] = [
  {
    id: "source",
    labelKey: "mediaAnalysis.assets.groups.source",
    labelFallback: "Kaynaklar",
    types: ["source"],
  },
  {
    id: "clip",
    labelKey: "mediaAnalysis.assets.groups.clip",
    labelFallback: "Klipler",
    types: ["clip"],
  },
  {
    id: "frame",
    labelKey: "mediaAnalysis.assets.groups.frame",
    labelFallback: "Kareler",
    types: ["frame", "image"],
  },
  {
    id: "audio",
    labelKey: "mediaAnalysis.assets.groups.audio",
    labelFallback: "Sesler",
    types: ["audio"],
  },
  {
    id: "report",
    labelKey: "mediaAnalysis.assets.groups.report",
    labelFallback: "Raporlar",
    types: ["report"],
  },
  {
    id: "artifact",
    labelKey: "mediaAnalysis.assets.groups.artifact",
    labelFallback: "Artefaktlar",
    types: ["artifact"],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAssetDate(value: number): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getAssetExtension(asset: LabAsset): string | null {
  return (
    getLabPathExtension(getLabAssetPath(asset)) ||
    getLabPathExtension(getLabAssetPathLeaf(asset)) ||
    getLabPathExtension(asset.name)
  );
}

function getAssetMediaKind(asset: LabAsset): "image" | "video" | "audio" | null {
  return inferLabAssetSourceKind(asset);
}

function renderAssetVisual(asset: LabAsset): string {
  const mediaKind = getAssetMediaKind(asset);
  const previewUrl = getLabAssetPreviewUrl(asset);

  if ((mediaKind === "image" || mediaKind === "video") && previewUrl !== null) {
    const metadata = asLabRecord(asset.metadata);
    const thumbnailUrl = asNonEmptyString(metadata["thumbnailUrl"]);
    const mediaMarkup =
      mediaKind === "image" || thumbnailUrl !== null
        ? `<img class="labx-sp-asset__thumb-media" src="${escapeHtml(previewUrl)}" alt="" loading="lazy" />`
        : `<video class="labx-sp-asset__thumb-media" src="${escapeHtml(previewUrl)}" muted preload="metadata" playsinline aria-hidden="true"></video>`;
    return `<span class="labx-sp-asset__thumb" data-kind="${escapeHtml(mediaKind)}" aria-hidden="true">${mediaMarkup}</span>`;
  }

  if (mediaKind === "audio") {
    return `<span class="labx-sp-asset__badge labx-sp-asset__badge--audio" data-type="${escapeHtml(asset.type)}" data-kind="audio" aria-hidden="true">&sung;</span>`;
  }

  const extension = getAssetExtension(asset);
  const label = (extension ?? "file").slice(0, 4).toUpperCase();
  return `<span class="labx-sp-asset__badge" data-type="${escapeHtml(asset.type)}" data-kind="extension" data-extension="${escapeHtml(extension ?? "file")}">${escapeHtml(label)}</span>`;
}

// ---------------------------------------------------------------------------
// Asset item
// ---------------------------------------------------------------------------

function getReportAssetView(asset: LabAsset): "user" | "ai" {
  const metadata = asLabRecord(asset.metadata);
  return asNonEmptyString(metadata["reportView"]) === "ai" ? "ai" : "user";
}

function getAssetContentActionKind(asset: LabAsset) {
  return getLabAssetPreviewKind(
    asset,
    getLabAssetPath(asset) || getLabAssetPathLeaf(asset) || asset.name
  );
}

function getAssetPrimaryAction(asset: LabAsset): { action: string; value: string } {
  if (asset.type === "report") {
    return { action: "open-report-overlay", value: getReportAssetView(asset) };
  }
  if (getAssetMediaKind(asset) !== null) {
    return { action: "source-activate-asset", value: asset.id };
  }
  if (getAssetContentActionKind(asset) === "document") {
    return { action: "open-document-overlay", value: asset.id };
  }
  return { action: "workspace-content-open", value: asset.id };
}

function canDownloadAsset(asset: LabAsset): boolean {
  if (getLabAssetPath(asset) !== null) {
    return true;
  }
  return false;
}

function renderAssetRelationMeta(
  state: LabStoreState,
  asset: LabAsset,
  currentSourceId: string | null,
  copy: LabI18n
): string {
  const activeSourceLabel =
    currentSourceId === asset.id
      ? `<span class="labx-sp-asset__relation-text">${escapeHtml(copy.t("mediaAnalysis.assets.relation.activeSource", "Aktif kaynak"))}</span>`
      : "";
  const comparisonReferenceLabel =
    state.ui.workspace.comparisonReferenceAssetId === asset.id
      ? `<span class="labx-sp-asset__relation-text">${escapeHtml(copy.t("mediaAnalysis.assets.relation.compareReference", "Karşılaştırma referansı"))}</span>`
      : "";

  if (asset.type !== "audio") {
    const relation = `${activeSourceLabel}${comparisonReferenceLabel}`;
    return relation === "" ? "" : `<span class="labx-sp-asset__relation">${relation}</span>`;
  }

  const parentSource = getParentSourceForAsset(state, asset.id);
  const currentSourceAsset = getCurrentSourceAsset(state);
  const syncLabel = getLabAssetSyncLabel(asset, copy);
  const relationMarkup =
    parentSource === null
      ? ""
      : currentSourceAsset !== null && currentSourceAsset.id === parentSource.id
        ? `<button class="labx-sp-asset__relation-link" type="button" data-lab-action="focus-source-preview" data-lab-value="${escapeHtml(parentSource.id)}">${escapeHtml(copy.t("mediaAnalysis.assets.relation.source", "Kaynak"))}: ${escapeHtml(parentSource.name)}</button>`
        : `<span class="labx-sp-asset__relation-text">${escapeHtml(copy.t("mediaAnalysis.assets.relation.source", "Kaynak"))}: ${escapeHtml(parentSource.name)}</span>`;

  if (
    relationMarkup === "" &&
    syncLabel === null &&
    activeSourceLabel === "" &&
    comparisonReferenceLabel === ""
  ) {
    return "";
  }

  return `
    <span class="labx-sp-asset__relation">
      ${activeSourceLabel}
      ${relationMarkup}
      ${syncLabel ? `<span class="labx-sp-asset__relation-text">${escapeHtml(syncLabel)}</span>` : ""}
      ${comparisonReferenceLabel}
    </span>
  `;
}

function renderAssetItem(
  state: LabStoreState,
  asset: LabAsset,
  currentSourceId: string | null,
  copy: LabI18n
): string {
  const id = escapeHtml(asset.id);
  const isActive = asset.id === currentSourceId ? ' data-active="true"' : "";
  const isComparisonReference =
    state.ui.workspace.comparisonReferenceAssetId === asset.id
      ? ' data-compare-reference="true"'
      : "";
  const leaf = getLabAssetPathLeaf(asset);
  const date = formatAssetDate(asset.createdAt);
  const meta = [date, leaf].filter(Boolean).join(" · ");
  const primary = getAssetPrimaryAction(asset);
  const reportView = asset.type === "report" ? getReportAssetView(asset) : null;

  const viewReportItem =
    asset.type === "report"
      ? `<button class="labx-sp-menu__item" type="button"
         data-lab-action="open-report-overlay" data-lab-value="${escapeHtml(reportView ?? "user")}">
         ${escapeHtml(copy.t("mediaAnalysis.assets.actions.viewReport", "Raporu görüntüle"))}
       </button>`
      : "";
  const useAsSourceItem =
    getAssetMediaKind(asset) !== null
      ? `<button class="labx-sp-menu__item" type="button"
         data-lab-action="source-activate-asset" data-lab-value="${id}">
         ${escapeHtml(copy.t("mediaAnalysis.assets.actions.useAsSource", "Kaynak olarak kullan"))}
	       </button>`
      : "";
  const useAsComparisonReferenceItem =
    getAssetMediaKind(asset) === "image"
      ? `<button class="labx-sp-menu__item" type="button"
         data-lab-action="workspace-comparison-reference-set" data-lab-value="${id}">
         ${escapeHtml(copy.t("mediaAnalysis.assets.actions.useAsCompareReference", "Karşılaştırma referansı yap"))}
       </button>`
      : "";
  const downloadItem = canDownloadAsset(asset)
    ? `<button class="labx-sp-menu__item" type="button"
         data-lab-action="asset-download" data-lab-value="${id}">
         ${escapeHtml(copy.t("mediaAnalysis.assets.actions.download", "İndir"))}
       </button>`
    : "";

  return `
    <div class="labx-sp-asset" data-asset-id="${id}" data-asset-type="${escapeHtml(asset.type)}"${isActive}${isComparisonReference}
         title="${escapeHtml(buildLabAssetMetadataTitle(asset))}">
      <button class="labx-sp-asset__btn" type="button"
              data-lab-action="${escapeHtml(primary.action)}" data-lab-value="${escapeHtml(primary.value)}"
              aria-label="${escapeHtml(asset.name)}">
        ${renderAssetVisual(asset)}
        <span class="labx-sp-asset__info">
          <strong class="labx-sp-asset__name">${escapeHtml(asset.name)}</strong>
          ${meta ? `<span class="labx-sp-asset__meta">${escapeHtml(meta)}</span>` : ""}
        </span>
      </button>
      ${renderAssetRelationMeta(state, asset, currentSourceId, copy)}
      <details class="labx-sp-asset__menu">
        <summary class="labx-sp-asset__menu-trigger" aria-label="${escapeHtml(copy.t("mediaAnalysis.assets.actions.ariaLabel", "Seçenekler"))}">···</summary>
        <div class="labx-sp-asset__menu-list">
          ${viewReportItem}
          ${useAsSourceItem}
          ${useAsComparisonReferenceItem}
          ${downloadItem}
          <button class="labx-sp-menu__item labx-sp-menu__item--danger" type="button"
                  data-lab-action="asset-remove" data-lab-value="${id}">
            ${escapeHtml(copy.t("mediaAnalysis.assets.actions.delete", "Sil"))}
          </button>
        </div>
      </details>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Asset group accordion
// ---------------------------------------------------------------------------

function renderAssetGroup(
  group: AssetGroup,
  state: LabStoreState,
  assets: LabAsset[],
  currentSourceId: string | null,
  isOpen: boolean,
  copy: LabI18n
): string {
  const groupAssets = assets.filter(function (a) {
    return group.types.includes(a.type);
  });
  if (groupAssets.length === 0) return "";
  const label = copy.t(group.labelKey, group.labelFallback);
  return `
    <details class="labx-sp-group" ${isOpen ? "open" : ""} data-group-type="${escapeHtml(group.id)}">
      <summary class="labx-sp-group__title">
        <span>${escapeHtml(label)}</span>
        <span class="labx-sp-group__count">${String(groupAssets.length)}</span>
      </summary>
      <div class="labx-sp-group__items">
        ${groupAssets
          .map(function (a) {
            return renderAssetItem(state, a, currentSourceId, copy);
          })
          .join("")}
      </div>
    </details>
  `;
}

// ---------------------------------------------------------------------------
// URL import overlay (inline)
// ---------------------------------------------------------------------------

function renderUrlOverlay(state: LabStoreState, copy: LabI18n): string {
  const checkAction = buildProjectImportUrlCheckAction(state);
  const addAction = buildProjectImportHostAction(state);
  const check = state.ui.projectImport.urlCheck;
  const ready = check.status === "ready";
  const checking = check.status === "checking";
  const primaryAction = ready ? "project-import-url-add" : "project-import-check-url";
  const primaryDisabledReason = ready
    ? addAction.disabledReason
    : checking
      ? copy.t("mediaAnalysis.projectImport.url.checking", "Kontrol ediliyor")
      : checkAction.disabledReason;
  const primaryDisabledAttr = primaryDisabledReason !== null ? " disabled" : "";
  const primaryLabel = ready
    ? copy.t("mediaAnalysis.projectImport.url.add", "Projeye Ekle")
    : checking
      ? copy.t("mediaAnalysis.projectImport.url.checking", "Kontrol ediliyor")
      : copy.t("mediaAnalysis.projectImport.url.check", "Kontrol Et");
  const clearDisabled = hasProjectImportDraftValue(state) !== true;

  return `
    <div class="labx-sp-url-overlay">
      <div class="labx-sp-url__inner">
        <label class="labx-sp-url__label">
          <span>${escapeHtml(copy.t("mediaAnalysis.source.fields.urlInput", "URL"))}</span>
          <input class="labx-sp-url__input" type="url"
                 data-lab-field="project-import.urlInput"
                 value="${escapeHtml(getProjectImportUrlInput(state))}"
                 placeholder="https://..." />
        </label>
        <div class="labx-sp-url__actions">
          <button class="labx-sp-url__btn labx-sp-url__btn--primary" type="button"
                  data-lab-action="${escapeHtml(primaryAction)}"${primaryDisabledAttr}>
            ${escapeHtml(primaryLabel)}
          </button>
          <button class="labx-sp-url__btn" type="button"
                  data-lab-action="project-import-clear"${clearDisabled ? " disabled" : ""}>
            ${escapeHtml(copy.t("mediaAnalysis.projectImport.clear", "Temizle"))}
          </button>
        </div>
        ${renderYoutubeCheckResult(state, copy)}
        ${renderDirectUrlCheckResult(state, copy)}
        ${renderProjectImportProgress(state, copy)}
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Project selector
// ---------------------------------------------------------------------------

function renderProjectSelector(state: LabStoreState, copy: LabI18n): string {
  const activeId = state.projectIndex.activeProjectId;
  const projects = state.projectIndex.projects.filter(function (p) {
    return p["hasSource"] !== false || String(p["id"] ?? "") === activeId;
  });

  const options = projects.map(function (p) {
    const id = String(p["id"] ?? "");
    const name =
      asNonEmptyString(p["name"]) ||
      asNonEmptyString(p["id"]) ||
      copy.t("mediaAnalysis.sourcePanel.project.untitledProject", "Adsız");
    const selected = id === activeId ? " selected" : "";
    return `<option value="${escapeHtml(id)}"${selected}>${escapeHtml(name)}</option>`;
  });

  const noProjectOpt =
    activeId === null || projects.length === 0
      ? `<option value="">${escapeHtml(copy.t("mediaAnalysis.assets.projects.newOption", "-- Yeni Proje --"))}</option>`
      : "";

  const deleteDisabled = activeId === null ? " disabled" : "";

  return `
    <div class="labx-sp-header__project-row">
      <select class="labx-sp-header__project-select labx-select labx-select--compact"
              data-lab-field="project.id" title="${escapeHtml(copy.t("mediaAnalysis.sourcePanel.project.managementTitle", "Proje"))}">
        ${noProjectOpt}
        ${options.join("")}
      </select>
      <button class="labx-sp-header__new-btn" type="button"
              data-lab-action="project-create"
              title="${escapeHtml(copy.t("mediaAnalysis.sourcePanel.project.newProject", "Yeni Proje"))}"
              aria-label="${escapeHtml(copy.t("mediaAnalysis.sourcePanel.project.newProject", "Yeni Proje"))}">+</button>
      <button class="labx-sp-header__del-btn" type="button"
              data-lab-action="project-delete"${deleteDisabled}
              title="${escapeHtml(copy.t("mediaAnalysis.sourcePanel.project.deleteProject", "Projeyi Sil"))}"
              aria-label="${escapeHtml(copy.t("mediaAnalysis.sourcePanel.project.deleteProject", "Projeyi Sil"))}">🗑</button>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Public render
// ---------------------------------------------------------------------------

export function renderLabSourcePanel(
  state: LabStoreState,
  copy: LabI18n = LAB_FALLBACK_I18N
): string {
  const collapsed = state.ui.sourcePanelCollapsed === true;
  if (collapsed) {
    return `<aside class="labx-source-panel" data-lab-region="source-panel" data-collapsed="true" hidden aria-hidden="true"></aside>`;
  }

  const source = getProjectSource(state);
  const currentAsset = getCurrentSourceAsset(state);
  const sourceMetadata = asLabRecord(source["metadata"]);
  const currentSourceId =
    state.ui.activeWorkspaceAssetId ??
    currentAsset?.id ??
    asNonEmptyString(sourceMetadata["originAssetId"]) ??
    asNonEmptyString(sourceMetadata["derivedFromAssetId"]) ??
    asNonEmptyString(source["assetId"]);
  const assets = getAssets(state);

  const localAction = buildProjectImportLocalHostAction(state);
  const localDisabled = localAction.disabledReason !== null ? " disabled" : "";

  const firstGroupWithAssets = ASSET_GROUPS.find(function (g) {
    return assets.some(function (a) {
      return g.types.includes(a.type);
    });
  });
  const activeAsset =
    currentSourceId === null
      ? null
      : assets.find(function (asset) {
          return asset.id === currentSourceId;
        }) || null;
  const activeGroupWithAsset =
    activeAsset === null
      ? null
      : ASSET_GROUPS.find(function (group) {
          return group.types.includes(activeAsset.type);
        }) || null;
  const openGroupId = activeGroupWithAsset?.id ?? firstGroupWithAssets?.id ?? null;

  const assetGroupsMarkup = ASSET_GROUPS.map(function (group) {
    const isOpen = openGroupId === group.id;
    return renderAssetGroup(group, state, assets, currentSourceId, isOpen, copy);
  }).join("");

  const emptyMarkup =
    assets.length === 0
      ? `<div class="labx-sp-empty">${escapeHtml(copy.t("mediaAnalysis.assets.empty", "Henüz kaynak yok"))}</div>`
      : "";

  return `
    <aside class="labx-source-panel" data-lab-region="source-panel" data-collapsed="false">
      <div class="labx-sp-header">
        <div class="labx-sp-header__title-row">
          <strong class="labx-sp-header__title">${escapeHtml(copy.t("mediaAnalysis.sourcePanel.title", "Kaynaklar"))}</strong>
        </div>
        ${renderProjectSelector(state, copy)}
      </div>

      <div class="labx-sp-add-bar">
        <button class="labx-sp-add-bar__btn" type="button"
                data-lab-action="project-import-local-add"${localDisabled}
                title="${escapeHtml(copy.t("mediaAnalysis.projectImport.localUnifiedTitle", "Yerel Dosya Ekle"))}">
          📁 ${escapeHtml(copy.t("mediaAnalysis.projectImport.localUnifiedButton", "Yerel Dosya Ekle"))}
        </button>
      </div>

      <div class="labx-sp-url-section">
        ${renderUrlOverlay(state, copy)}
      </div>

      <div class="labx-sp-assets">
        ${emptyMarkup}
        ${assetGroupsMarkup}
      </div>
    </aside>
  `;
}
