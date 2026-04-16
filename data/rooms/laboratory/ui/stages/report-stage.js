import { escapeHtml } from "../../models/lab-types.js";
import {
  getCurrentReports,
  getReportExports,
  getVisibleArtifacts,
  hasMoreVisibleArtifacts
} from "../../runtime/lab-selectors.js";
import { renderArtifactItem } from "../components/artifact-item.js";
import { renderCompactCard } from "../components/compact-card.js";
import { renderEmptyState } from "../components/empty-state.js";
import { renderFindingCard } from "../components/finding-card.js";
import { renderPrimaryCTA } from "../components/primary-cta.js";
import { renderStageHeader } from "../components/stage-header.js";
export function renderReportStage(deps) {
  const reports = getCurrentReports(deps.state);
  const userReport = reports.user;
  const aiReport = reports.ai;
  const exportsList = getReportExports(deps.state);
  const artifacts = getVisibleArtifacts(deps.state);
  const hasMoreArtifacts = hasMoreVisibleArtifacts(deps.state);
  const reportView = deps.state.ui.reportView;
  const hasReport = userReport !== null || aiReport !== null;
  const mainBody = hasReport !== true ? renderEmptyState({
    title: "Rapor yok",
    description: "Report stage yalnız yapılandırılmış run verisinden çıktı üretir.",
    hint: "User report ile AI work report aynı nesne değildir."
  }) : `
        <div class="labx-chip-row">
          ${["user", "ai"].map(function(entry) {
    return `
                <button
                  class="labx-chip-button"
                  type="button"
                  data-lab-action="report-view"
                  data-lab-value="${entry}"
                  data-selected="${entry === reportView ? "true" : "false"}"
                >
                  ${escapeHtml(entry === "user" ? "User Report" : "AI Work Report")}
                </button>
              `;
  }).join("")}
        </div>
        ${reportView === "user" && userReport ? `
              <section class="labx-report-block">
                <p class="labx-report-block__summary">${escapeHtml(userReport.summary)}</p>
                <div class="labx-summary-list">
                  <div><span>Confidence</span><strong>${escapeHtml(userReport.confidence)}</strong></div>
                  <div><span>Top Findings</span><strong>${escapeHtml(String(userReport.topFindings.length))}</strong></div>
                </div>
                <div class="labx-list-stack">
                  ${userReport.topFindings.map(function(entry) {
    return `
                        <article class="labx-report-finding">
                          <strong>${escapeHtml(entry.title)}</strong>
                          <p>${escapeHtml(entry.detail)}</p>
                          <span>${escapeHtml(entry.evidence.join(" · "))}</span>
                        </article>
                      `;
  }).join("")}
                </div>
              </section>
            ` : reportView === "ai" && aiReport ? `
                <section class="labx-report-block">
                  <div class="labx-summary-list">
                    <div><span>Status</span><strong>${escapeHtml(String(aiReport.manifest["status"] || "--"))}</strong></div>
                    <div><span>Modules</span><strong>${escapeHtml(String(aiReport.manifest["moduleCount"] || 0))}</strong></div>
                    <div><span>Findings</span><strong>${escapeHtml(String(aiReport.findings.length))}</strong></div>
                  </div>
                  <div class="labx-list-stack">
                    ${aiReport.findings.slice(0, 6).map(renderFindingCard).join("")}
                  </div>
                </section>
              ` : renderEmptyState({
    title: "Rapor görünümü boş",
    description: "Seçili görünüm için yapılandırılmış içerik oluşmadı.",
    hint: "Store önce user ve ai raporları ayrı üretir."
  })}
      `;
  const main = `
    ${renderStageHeader({
    eyebrow: "Stage 05 · Report",
    stageIndex: 5,
    stageTotal: 5,
    statusLabel: hasReport ? "ready" : "idle",
    statusTone: hasReport ? "success" : "neutral",
    subtitle: "Dual output: kullanıcı özeti ve AI çalışma raporu aynı structured run verisinden türetilir.",
    title: "Rapor"
  })}
    ${renderCompactCard({
    eyebrow: "Dual Output",
    title: "Analiz Raporu",
    body: mainBody,
    footer: renderPrimaryCTA({
      action: "primary-action",
      detail: deps.primaryDetail || null,
      disabled: deps.primaryDisabled,
      label: deps.primaryLabel
    })
  })}
  `;
  const side = [
    renderCompactCard({
      eyebrow: "Exports",
      title: "Dışa Aktarılanlar",
      body: exportsList.length > 0 ? exportsList.slice(0, 6).map(function(entry) {
        const fileName = typeof entry["fileName"] === "string" ? entry["fileName"] : "--";
        const path = typeof entry["path"] === "string" ? entry["path"] : "--";
        return `
                  <article class="labx-artifact-item">
                    <div>
                      <strong>${escapeHtml(fileName)}</strong>
                      <p class="labx-panel-hint">${escapeHtml(path)}</p>
                    </div>
                  </article>
                `;
      }).join("") : `<p class="labx-panel-hint">Henüz export alınmadı.</p>`
    }),
    renderCompactCard({
      eyebrow: "Artifacts",
      title: "Run Artefaktları",
      body: artifacts.length > 0 ? artifacts.map(renderArtifactItem).join("") : `<p class="labx-panel-hint">Rapor için artefakt hazır değil.</p>`,
      footer: hasMoreArtifacts ? `<button class="labx-inline-action" type="button" data-lab-action="show-more-artifacts">Daha fazlasını göster</button>` : null
    })
  ].join("");
  return { main, side };
}
