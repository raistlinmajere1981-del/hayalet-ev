import { asNonEmptyString, escapeHtml } from "../models/lab-types.js";
import type { LabAsset, LabAssetType, LabStoreState } from "../models/lab-types.js";
import { getAssets, getCurrentSourceAsset, getProjectSource } from "../runtime/lab-selectors.js";
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
} from "./lab-asset-display.js";
import { LAB_FALLBACK_I18N } from "./lab-i18n.js";
import type { LabI18n } from "./lab-i18n.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AssetGroup = { type: LabAssetType; labelKey: string; labelFallback: string };

const ASSET_GROUPS: AssetGroup[] = [
  { type: "source", labelKey: "mediaAnalysis.assets.groups.source", labelFallback: "Kaynaklar" },
  { type: "clip", labelKey: "mediaAnalysis.assets.groups.clip", labelFallback: "Klipler" },
  { type: "frame", labelKey: "mediaAnalysis.assets.groups.frame", labelFallback: "Kareler" },
  { type: "audio", labelKey: "mediaAnalysis.assets.groups.audio", labelFallback: "Ses" },
  { type: "image", labelKey: "mediaAnalysis.assets.groups.image", labelFallback: "Görseller" },
  { type: "report", labelKey: "mediaAnalysis.assets.groups.report", labelFallback: "Raporlar" },
  { type: "artifact", labelKey: "mediaAnalysis.assets.groups.artifact", labelFallback: "Çıktılar" },
];

const ASSET_TYPE_BADGES: Record<LabAssetType, string> = {
  source: "SRC",
  clip: "CLP",
  frame: "FRM",
  audio: "AUD",
  image: "IMG",
  report: "RPT",
  artifact: "AST",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function canUseAsSource(asset: LabAsset): boolean {
  return (
    asNonEmptyString(asset.localPath) !== null &&
    (asset.type === "source" ||
      asset.type === "clip" ||
      asset.type === "frame" ||
      asset.type === "audio" ||
      asset.type === "image")
  );
}

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

// ---------------------------------------------------------------------------
// Asset item
// ---------------------------------------------------------------------------

function getAssetPrimaryAction(asset: LabAsset): { action: string; value: string } {
  if (asset.type === "report") {
    return { action: "open-report-overlay", value: asset.id };
  }
  if (canUseAsSource(asset)) {
    return { action: "asset-use-as-source", value: asset.id };
  }
  if (getLabAssetPath(asset) !== null) {
    return { action: "asset-download", value: asset.id };
  }
  return { action: "asset-preview", value: asset.id };
}

function renderAssetItem(asset: LabAsset, currentSourceId: string | null, copy: LabI18n): string {
  const id = escapeHtml(asset.id);
  const isActive =
    canUseAsSource(asset) && asset.id === currentSourceId ? ' data-active="true"' : "";
  const leaf = getLabAssetPathLeaf(asset);
  const date = formatAssetDate(asset.createdAt);
  const meta = [date, leaf].filter(Boolean).join(" · ");
  const primary = getAssetPrimaryAction(asset);

  const useAsSourceItem = canUseAsSource(asset)
    ? `<button class="labx-sp-menu__item" type="button"
         data-lab-action="asset-use-as-source" data-lab-value="${id}">
         ${escapeHtml(copy.t("mediaAnalysis.assets.actions.useAsSource", "Kaynak olarak kullan"))}
       </button>`
    : "";
  const viewReportItem =
    asset.type === "report"
      ? `<button class="labx-sp-menu__item" type="button"
         data-lab-action="open-report-overlay" data-lab-value="${id}">
         ${escapeHtml(copy.t("mediaAnalysis.assets.actions.viewReport", "Raporu görüntüle"))}
       </button>`
      : "";
  const downloadItem =
    getLabAssetPath(asset) !== null
      ? `<button class="labx-sp-menu__item" type="button"
         data-lab-action="asset-download" data-lab-value="${id}">
         ${escapeHtml(copy.t("mediaAnalysis.assets.actions.download", "İndir"))}
       </button>`
      : "";

  return `
    <div class="labx-sp-asset" data-asset-id="${id}" data-asset-type="${escapeHtml(asset.type)}"${isActive}
         title="${escapeHtml(buildLabAssetMetadataTitle(asset))}">
      <button class="labx-sp-asset__btn" type="button"
              data-lab-action="${escapeHtml(primary.action)}" data-lab-value="${escapeHtml(primary.value)}"
              aria-label="${escapeHtml(asset.name)}">
        <span class="labx-sp-asset__badge" data-type="${escapeHtml(asset.type)}">${ASSET_TYPE_BADGES[asset.type]}</span>
        <span class="labx-sp-asset__info">
          <strong class="labx-sp-asset__name">${escapeHtml(asset.name)}</strong>
          ${meta ? `<span class="labx-sp-asset__meta">${escapeHtml(meta)}</span>` : ""}
        </span>
      </button>
      <details class="labx-sp-asset__menu">
        <summary class="labx-sp-asset__menu-trigger" aria-label="${escapeHtml(copy.t("mediaAnalysis.assets.actions.ariaLabel", "Seçenekler"))}">···</summary>
        <div class="labx-sp-asset__menu-list">
          ${useAsSourceItem}
          ${viewReportItem}
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
  assets: LabAsset[],
  currentSourceId: string | null,
  isOpen: boolean,
  copy: LabI18n
): string {
  const groupAssets = assets.filter(function (a) {
    return a.type === group.type;
  });
  if (groupAssets.length === 0) return "";
  const label = copy.t(group.labelKey, group.labelFallback);
  return `
    <details class="labx-sp-group" ${isOpen ? "open" : ""} data-group-type="${escapeHtml(group.type)}">
      <summary class="labx-sp-group__title">
        <span>${escapeHtml(label)}</span>
        <span class="labx-sp-group__count">${String(groupAssets.length)}</span>
      </summary>
      <div class="labx-sp-group__items">
        ${groupAssets
          .map(function (a) {
            return renderAssetItem(a, currentSourceId, copy);
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
      copy.t("mediaAnalysis.projectWorkspace.untitledProject", "Adsız");
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
              data-lab-field="project.id" title="${escapeHtml(copy.t("mediaAnalysis.projectWorkspace.managementTitle", "Proje"))}">
        ${noProjectOpt}
        ${options.join("")}
      </select>
      <button class="labx-sp-header__new-btn" type="button"
              data-lab-action="project-create"
              title="${escapeHtml(copy.t("mediaAnalysis.projectWorkspace.newProject", "Yeni Proje"))}"
              aria-label="${escapeHtml(copy.t("mediaAnalysis.projectWorkspace.newProject", "Yeni Proje"))}">+</button>
      <button class="labx-sp-header__del-btn" type="button"
              data-lab-action="project-delete"${deleteDisabled}
              title="${escapeHtml(copy.t("mediaAnalysis.projectWorkspace.deleteProject", "Projeyi Sil"))}"
              aria-label="${escapeHtml(copy.t("mediaAnalysis.projectWorkspace.deleteProject", "Projeyi Sil"))}">🗑</button>
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
  const currentSourceId = currentAsset?.id ?? asNonEmptyString(source["assetId"]);
  const assets = getAssets(state)
    .slice()
    .sort(function (a, b) {
      return b.createdAt - a.createdAt;
    });

  const localAction = buildProjectImportLocalHostAction(state);
  const localDisabled = localAction.disabledReason !== null ? " disabled" : "";

  const firstGroupWithAssets = ASSET_GROUPS.find(function (g) {
    return assets.some(function (a) {
      return a.type === g.type;
    });
  });

  const assetGroupsMarkup = ASSET_GROUPS.map(function (group) {
    const isOpen = firstGroupWithAssets?.type === group.type;
    return renderAssetGroup(group, assets, currentSourceId, isOpen, copy);
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
