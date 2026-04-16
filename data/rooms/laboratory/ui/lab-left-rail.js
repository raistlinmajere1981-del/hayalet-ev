import { escapeHtml, LAB_STAGES } from "../models/lab-types.js";
import {
  canAdvanceToStage,
  getCurrentFeatureMeta,
  getStageBlockReason,
  getWorkbench
} from "../runtime/lab-selectors.js";
const STAGE_LABELS = {
  source: "Kaynak",
  edit: "Düzene",
  profile: "Profil",
  process: "İşlem",
  report: "Rapor"
};
export function renderLabLeftRail(state) {
  const feature = getCurrentFeatureMeta(state);
  const workbench = getWorkbench(state);
  const selectedModuleIds = Array.isArray(workbench["selectedModuleIds"]) ? workbench["selectedModuleIds"].filter((entry) => typeof entry === "string") : [feature.id];
  const activeModuleId = typeof workbench["activeModuleId"] === "string" ? workbench["activeModuleId"] : feature.id;
  return `
    <aside class="labx-left-rail">
      <div class="labx-brand">
        <span class="labx-brand__mark">A3</span>
        <div>
          <strong>Laboratory</strong>
          <p>Dense operator workbench</p>
        </div>
      </div>
      <nav class="labx-stage-rail">
        ${LAB_STAGES.map(function(stageId, index) {
    const allowed = canAdvanceToStage(state, stageId);
    const blockReason = getStageBlockReason(state, stageId);
    return `
            <button
              class="labx-stage-link"
              type="button"
              data-lab-stage="${stageId}"
              data-active="${stageId === state.currentStage ? "true" : "false"}"
              title="${escapeHtml(blockReason || STAGE_LABELS[stageId])}"
              ${allowed ? "" : 'data-blocked="true"'}
            >
              <span>${String(index + 1).padStart(2, "0")}</span>
              <div class="labx-stage-copy">
                <strong>${escapeHtml(STAGE_LABELS[stageId])}</strong>
                ${blockReason ? `<em>${escapeHtml(blockReason)}</em>` : `<small>Hazır geçiş</small>`}
              </div>
            </button>
          `;
  }).join("")}
      </nav>
      <section class="labx-rail-section">
        <p class="labx-rail-title">Modules</p>
        <div class="labx-rail-stack">
          ${selectedModuleIds.map(function(moduleId) {
    return `
              <button
                class="labx-module-link"
                type="button"
                data-lab-action="feature-activate"
                data-lab-value="${escapeHtml(moduleId)}"
                data-active="${moduleId === activeModuleId ? "true" : "false"}"
              >
                ${escapeHtml(moduleId)}
              </button>
            `;
  }).join("")}
        </div>
      </section>
      <section class="labx-rail-section">
        <p class="labx-rail-title">Focus</p>
        <div class="labx-rail-note">
          <strong>${escapeHtml(feature.label)}</strong>
          <p>${escapeHtml(feature.description)}</p>
        </div>
      </section>
    </aside>
  `;
}
