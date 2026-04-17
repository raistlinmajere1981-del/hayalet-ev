import { createLabFeatureMeta, escapeHtml, LAB_STAGES } from "../models/lab-types.js";
import type { LabFeatureId, LabStoreState } from "../models/lab-types.js";
import {
  canAdvanceToStage,
  getCurrentFeatureMeta,
  getStageBlockReason,
  getWorkbench,
} from "../runtime/lab-selectors.js";

const STAGE_LABELS: Record<string, string> = {
  source: "Kaynak",
  edit: "Düzene",
  profile: "Profil",
  process: "İşlem",
  report: "Rapor",
};

export function renderLabLeftRail(state: LabStoreState) {
  const feature = getCurrentFeatureMeta(state);
  const workbench = getWorkbench(state);
  const selectedModuleIds = Array.isArray(workbench["selectedModuleIds"])
    ? (workbench["selectedModuleIds"] as unknown[]).filter(
        (entry): entry is LabFeatureId =>
          typeof entry === "string" &&
          ["media-analysis", "audio-analysis", "subtitle-analysis"].includes(entry)
      )
    : [feature.id];
  const activeModuleId =
    typeof workbench["activeModuleId"] === "string"
      ? (workbench["activeModuleId"] as LabFeatureId)
      : feature.id;

  return `
    <aside class="labx-left-rail">
      <div class="labx-brand">
        <span class="labx-brand__mark">A3</span>
        <div>
          <strong>Laboratuvar</strong>
          <p>Yoğun operatör tezgahı</p>
        </div>
      </div>
      <button
        class="labx-manager-link"
        type="button"
        data-lab-action="toggle-module-manager"
        data-active="${state.ui.moduleManagerOpen ? "true" : "false"}"
      >
        <strong>Modül Yönetimi</strong>
        <small>Araçları ve çalışma kapsamını her aşamadan düzenle</small>
      </button>
      <nav class="labx-stage-rail">
        ${LAB_STAGES.map(function (stageId, index) {
          const allowed = canAdvanceToStage(state, stageId);
          const blockReason = getStageBlockReason(state, stageId);
          const active = stageId === state.currentStage;
          return `
            <button
              class="labx-stage-link"
              type="button"
              data-lab-stage="${stageId}"
              data-active="${active ? "true" : "false"}"
              title="${escapeHtml(blockReason || STAGE_LABELS[stageId])}"
              ${allowed ? "" : 'data-blocked="true"'}
            >
              <span>${String(index + 1).padStart(2, "0")}</span>
              <div class="labx-stage-copy">
                <strong>${escapeHtml(STAGE_LABELS[stageId])}</strong>
                ${
                  blockReason
                    ? `<em>${escapeHtml(blockReason)}</em>`
                    : `<small>${active ? "Aktif aşama" : "Hazır geçiş"}</small>`
                }
              </div>
            </button>
          `;
        }).join("")}
      </nav>
      <section class="labx-rail-section">
        <p class="labx-rail-title">Seçili Modüller</p>
        <div class="labx-rail-stack">
          ${selectedModuleIds
            .map(function (moduleId) {
              const moduleMeta = createLabFeatureMeta(moduleId);
              return `
              <button
                class="labx-module-link"
                type="button"
                data-lab-action="feature-activate"
                data-lab-value="${escapeHtml(moduleId)}"
                data-active="${moduleId === activeModuleId ? "true" : "false"}"
              >
                <strong>${escapeHtml(moduleMeta.label)}</strong>
                <small>${escapeHtml(moduleId)}</small>
              </button>
            `;
            })
            .join("")}
        </div>
      </section>
      <section class="labx-rail-section">
        <p class="labx-rail-title">Odak</p>
        <div class="labx-rail-note">
          <strong>${escapeHtml(feature.label)}</strong>
          <p>${escapeHtml(feature.description)}</p>
        </div>
      </section>
    </aside>
  `;
}
