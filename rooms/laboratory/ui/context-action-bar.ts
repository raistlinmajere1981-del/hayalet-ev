import { escapeHtml } from "../models/lab-types.js";
import type { LabAsset, LabStoreState } from "../models/lab-types.js";
import { LAB_FALLBACK_I18N } from "./lab-i18n.js";
import type { LabI18n } from "./lab-i18n.js";

export function renderContextActionBar(
  state: LabStoreState,
  copy: LabI18n = LAB_FALLBACK_I18N
): string {
  const selectedIds = state.ui.projectWorkspaceSelectedEntityIds;
  if (selectedIds.length === 0) {
    return `<div class="labx-pw-bar labx-pw-bar--hidden" aria-hidden="true"></div>`;
  }

  const selectedEntities = selectedIds
    .map(function (id) {
      return state.assets.find(function (asset) {
        return asset.id === id;
      });
    })
    .filter(function (asset): asset is LabAsset {
      return asset !== undefined;
    });
  const firstEntity = selectedEntities[0];
  const entityName = firstEntity ? firstEntity.name : "Unknown";

  const canUseAsSource =
    selectedEntities.find(function (entity) {
      return (
        (entity.localPath || "") !== "" &&
        (entity.type === "source" ||
          entity.type === "clip" ||
          entity.type === "frame" ||
          entity.type === "audio" ||
          entity.type === "image")
      );
    }) || null;
  const firstReport =
    selectedEntities.find(function (entity) {
      return entity.type === "report";
    }) || null;
  const selectedValue = selectedIds.join(",");

  const actions: string[] = [];

  if (canUseAsSource) {
    actions.push(
      `<button class="labx-pw-bar__btn labx-pw-bar__btn--accent" type="button" data-lab-action="project-workspace-use-source" data-lab-value="${escapeHtml(canUseAsSource.id)}">${escapeHtml(copy.t("mediaAnalysis.projectWorkspace.useAsSource", "Use as Source"))}</button>`
    );
  }

  if (firstReport !== null) {
    actions.push(
      `<button class="labx-pw-bar__btn" type="button" data-lab-action="project-workspace-open-report" data-lab-value="${escapeHtml(firstReport.id)}">${escapeHtml(copy.t("mediaAnalysis.projectWorkspace.openReport", "Open Report"))}</button>`
    );
  }

  actions.push(
    `<button class="labx-pw-bar__btn labx-pw-bar__btn--danger" type="button" data-lab-action="project-workspace-delete" data-lab-value="${escapeHtml(selectedValue)}">${escapeHtml(copy.t("mediaAnalysis.projectWorkspace.delete", "Delete"))}</button>`
  );
  actions.push(
    `<button class="labx-pw-bar__btn" type="button" data-lab-action="project-workspace-send-to-ai" data-lab-value="${escapeHtml(selectedValue)}" disabled>${escapeHtml(copy.t("mediaAnalysis.projectWorkspace.sendToAi", "Send to AI"))}</button>`
  );
  const label =
    selectedIds.length === 1
      ? copy.t("mediaAnalysis.projectWorkspace.oneSelected", "1 selected: {name}", {
          name: entityName,
        })
      : copy.t("mediaAnalysis.projectWorkspace.manySelected", "{count} selected", {
          count: selectedIds.length,
        });

  return `
    <div class="labx-pw-bar">
      <div class="labx-pw-bar__label"><strong>${escapeHtml(label)}</strong></div>
      <div class="labx-pw-bar__actions">
        ${actions.join("")}
      </div>
    </div>
  `;
}
