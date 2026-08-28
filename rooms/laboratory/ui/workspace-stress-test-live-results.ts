import { escapeHtml } from "../domain/lab-types.js";
import type { LabStoreState } from "../domain/lab-types.js";
import type { LabI18n } from "./lab-i18n.js";
import { renderLaboratoryStressReportHistory } from "./workspace-stress-report-history.js";

export function renderWorkspaceStressTestLiveResults(state: LabStoreState, copy: LabI18n) {
  const reportHistory = renderLaboratoryStressReportHistory(state.editConfig, copy);
  const hasResultContent = reportHistory.trim() !== "";

  return `
    <div class="labx-strip-expanded labx-strip-expanded--live" data-lab-process-expanded="true" data-lab-live-results="true">
      <div class="labx-strip-live-column labx-strip-live-column--results">
        <div class="labx-strip-live-heading">
          <strong>${escapeHtml(copy.locale === "tr" ? "Rapor Geçmişi" : "Report History")}</strong>
          <span>${escapeHtml(copy.locale === "tr" ? "En yeni rapor üstte · tam içerik Copy / MD Export ile" : "Newest first · full content through Copy / MD Export")}</span>
        </div>
        <div class="labx-strip-live-results__scroll">
          ${
            hasResultContent
              ? reportHistory
              : `<div class="labx-strip-live-empty">${escapeHtml(copy.locale === "tr" ? "Henüz manuel test raporu yok." : "No manual test report yet.")}</div>`
          }
        </div>
      </div>
    </div>
  `;
}
