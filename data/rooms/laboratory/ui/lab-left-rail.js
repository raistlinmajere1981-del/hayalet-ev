import { escapeHtml, LAB_STAGES } from "../models/lab-types.js";
import {
  canAdvanceToStage,
  getStageBlockReason,
  getCapabilityWorkflowSummary
} from "../runtime/lab-selectors.js";
const STAGE_LABELS = {
  source: "Kaynak",
  edit: "Düzenle",
  process: "İşlem",
  report: "Rapor"
};
const STAGE_HINTS = {
  source: "Kaynak seçimi ve yetenek belirleme",
  edit: "Çalışma alanı ve kapsam hazırlığı",
  process: "Analiz yürütme ve izleme",
  report: "Sonuçlar ve dışa aktarma"
};
export function renderLabLeftRail(state) {
  const workflowSummary = getCapabilityWorkflowSummary(state);
  return `
    <aside class="labx-left-rail">
      <div class="labx-brand">
        <span class="labx-brand__mark">A3</span>
        <div>
          <strong>Laboratuvar</strong>
          <p>Kaynak odaklı çalışma alanı</p>
        </div>
      </div>
      <button
        class="labx-manager-link"
        type="button"
        data-lab-action="toggle-tool-manager"
        data-active="${state.ui.toolManagerOpen ? "true" : "false"}"
      >
        <strong>Araç Yönetimi</strong>
        <small>yt-dlp, FFmpeg ve oda araçlarını kur, güncelle ve yenile</small>
      </button>
      <nav class="labx-stage-rail">
        ${LAB_STAGES.map(function(stageId, index) {
    const allowed = canAdvanceToStage(state, stageId);
    const blockReason = getStageBlockReason(state, stageId);
    const active = stageId === state.currentStage;
    const hint = STAGE_HINTS[stageId] || "";
    return `
            <button
              class="labx-stage-link"
              type="button"
              data-lab-stage="${stageId}"
              data-active="${active ? "true" : "false"}"
              title="${escapeHtml(blockReason || hint)}"
              ${allowed ? "" : 'data-blocked="true"'}
            >
              <span>${String(index + 1).padStart(2, "0")}</span>
              <div class="labx-stage-copy">
                <strong>${escapeHtml(STAGE_LABELS[stageId] || stageId)}</strong>
                ${blockReason ? `<em>${escapeHtml(blockReason)}</em>` : `<small>${active ? "Aktif aşama" : escapeHtml(hint)}</small>`}
              </div>
            </button>
          `;
  }).join("")}
      </nav>
      <section class="labx-rail-section">
        <p class="labx-rail-title">İş Akışı</p>
        <div class="labx-rail-note">
          <strong>${escapeHtml(String(workflowSummary.familyCount))} yetenek ailesi</strong>
          <p>${escapeHtml(String(workflowSummary.readyCount))} hazır${workflowSummary.blockedCount > 0 ? ` · ${escapeHtml(String(workflowSummary.blockedCount))} bloklu` : ""}</p>
        </div>
      </section>
    </aside>
  `;
}
