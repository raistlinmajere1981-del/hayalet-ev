import { asLabRecord, escapeHtml, formatDurationSeconds } from "../../models/lab-types.js";
import type {
  LabAiReport,
  LabStageSurface,
  LabStoreState,
  LabUserReport,
} from "../../models/lab-types.js";
import {
  getCurrentReports,
  getCurrentRun,
  getProcessAnalysisScope,
  getReportExports,
  getSelectedCapabilities,
  getSourceKind,
  getSourceMetadata,
  getVisibleArtifacts,
  hasMoreVisibleArtifacts,
} from "../../runtime/lab-selectors.js";
import { renderAnalysisScopeSummary } from "../components/analysis-scope-summary.js";
import { renderArtifactItem } from "../components/artifact-item.js";
import { renderCompactCard } from "../components/compact-card.js";
import { renderEmptyState } from "../components/empty-state.js";
import { renderFindingCard } from "../components/finding-card.js";
import { renderPrimaryCTA } from "../components/primary-cta.js";
import { renderStageHeader } from "../components/stage-header.js";

type ReportStageRenderDeps = {
  primaryDetail?: string | null;
  primaryDisabled?: boolean;
  primaryLabel: string;
  state: LabStoreState;
};

function getSourceKindLabel(kind: string) {
  switch (kind) {
    case "audio":
      return "Ses";
    case "image":
      return "Görsel";
    case "video":
      return "Video";
    default:
      return kind;
  }
}

export function renderReportStage(deps: ReportStageRenderDeps): LabStageSurface {
  const reports = getCurrentReports(deps.state);
  const userReport: LabUserReport | null = reports.user;
  const aiReport: LabAiReport | null = reports.ai;
  const run = getCurrentRun(deps.state);
  const scope = getProcessAnalysisScope(deps.state);
  const exportsList = getReportExports(deps.state);
  const artifacts = getVisibleArtifacts(deps.state);
  const hasMoreArtifacts = hasMoreVisibleArtifacts(deps.state);
  const reportView = deps.state.ui.reportView;
  const hasReport = userReport !== null || aiReport !== null;
  const sourceMetadata = getSourceMetadata(deps.state);
  const sourceKind = getSourceKind(deps.state);
  const selectedCapabilities = getSelectedCapabilities(deps.state);
  const editConfig = asLabRecord(deps.state.editConfig);
  const editRecipe = asLabRecord(editConfig["recipe"]);
  const commonRecipe = asLabRecord(editRecipe["common"]);

  const reportBody =
    hasReport !== true
      ? renderEmptyState({
          title: "Rapor henüz hazır değil",
          description: "Bu yüzey, tamamlanmış run bağlamını ve üretilen çıktıları gösterir.",
          hint: reports.emptyReason || "Process tamamlandıktan sonra report görünür.",
        })
      : `
        <div class="labx-chip-row">
          ${["user", "ai"]
            .map(function (entry) {
              return `
                <button
                  class="labx-chip-button"
                  type="button"
                  data-lab-action="report-view"
                  data-lab-value="${entry}"
                  data-selected="${entry === reportView ? "true" : "false"}"
                >
                  ${escapeHtml(entry === "user" ? "User Report" : "AI Report")}
                </button>
              `;
            })
            .join("")}
        </div>
        ${
          reportView === "user" && userReport
            ? `
              <section class="labx-report-block">
                <p class="labx-report-block__summary">${escapeHtml(userReport.summary)}</p>
                <div class="labx-summary-list">
                  <div><span>Confidence</span><strong>${escapeHtml(userReport.confidence)}</strong></div>
                  <div><span>Top Findings</span><strong>${escapeHtml(String(userReport.topFindings.length))}</strong></div>
                  <div><span>Warnings</span><strong>${escapeHtml(String(run?.warnings.length || 0))}</strong></div>
                </div>
                <div class="labx-list-stack">
                  ${userReport.topFindings
                    .map(function (entry) {
                      return `
                        <article class="labx-report-finding">
                          <strong>${escapeHtml(entry.title)}</strong>
                          <p>${escapeHtml(entry.detail)}</p>
                          <span>${escapeHtml(entry.evidence.join(" · "))}</span>
                        </article>
                      `;
                    })
                    .join("")}
                </div>
              </section>
            `
            : reportView === "ai" && aiReport
              ? `
                <section class="labx-report-block">
                  <div class="labx-summary-list">
                    <div><span>Status</span><strong>${escapeHtml(String(aiReport.manifest["status"] || "--"))}</strong></div>
                    <div><span>Findings</span><strong>${escapeHtml(String(aiReport.findings.length))}</strong></div>
                    <div><span>Warnings</span><strong>${escapeHtml(String(aiReport.warnings.length))}</strong></div>
                    <div><span>Artifacts</span><strong>${escapeHtml(String(aiReport.artifacts.length))}</strong></div>
                  </div>
                  <div class="labx-list-stack">
                    ${aiReport.findings.slice(0, 8).map(renderFindingCard).join("")}
                  </div>
                </section>
              `
              : renderEmptyState({
                  title: "Seçili rapor görünümü boş",
                  description: "Bu görünüm için içerik yok.",
                  hint: reports.emptyReason || "Run bağlamı oluştuğunda burada görünür.",
                })
        }
      `;

  const main = `
    ${renderStageHeader({
      eyebrow: "Aşama 04 · Rapor",
      stageIndex: 4,
      stageTotal: 4,
      statusLabel: hasReport ? "ready" : "idle",
      statusTone: hasReport ? "success" : "neutral",
      subtitle:
        "Rapor; kaynak bağlamı, workflow yolu, dondurulmuş scope ve üretilen artefaktlarla birlikte sunulur.",
      title: "Report",
    })}
    ${renderCompactCard({
      eyebrow: "Report",
      title: run ? `Run ${run.id}` : "Analiz Raporu",
      body: reportBody,
      footer: renderPrimaryCTA({
        action: "primary-action",
        detail: deps.primaryDetail || null,
        disabled: deps.primaryDisabled,
        label: deps.primaryLabel,
      }),
    })}
  `;

  const side = [
    renderCompactCard({
      eyebrow: "Source Snapshot",
      title: "Kaynak Özeti",
      body: `
        <div class="labx-summary-list">
          <div><span>Tür</span><strong>${escapeHtml(getSourceKindLabel(sourceKind))}</strong></div>
          <div><span>Süre</span><strong>${escapeHtml(formatDurationSeconds(sourceMetadata["durationSeconds"]))}</strong></div>
          <div><span>Çözünürlük</span><strong>${escapeHtml(typeof sourceMetadata["width"] === "number" && typeof sourceMetadata["height"] === "number" ? `${String(sourceMetadata["width"])} × ${String(sourceMetadata["height"])}` : "--")}</strong></div>
        </div>
      `,
    }),
    renderCompactCard({
      eyebrow: "Workflow Path",
      title: "Seçili Yol",
      body: `
        <div class="labx-list-stack">
          ${
            selectedCapabilities.length > 0
              ? selectedCapabilities
                  .map(function (entry) {
                    return `<p class="labx-panel-hint">${escapeHtml(entry)}</p>`;
                  })
                  .join("")
              : `<p class="labx-panel-hint">Yetenek seçimi bulunamadı.</p>`
          }
        </div>
      `,
    }),
    renderCompactCard({
      eyebrow: "Frozen Scope",
      title: "Dondurulmuş Kapsam",
      body: renderAnalysisScopeSummary(run?.analysisScope || scope, userReport?.confidence || null),
    }),
    renderCompactCard({
      eyebrow: "Applied Adjustments",
      title: "Uygulanan Ayarlar",
      body: `
        <div class="labx-summary-list">
          <div><span>Output Alias</span><strong>${escapeHtml(String(commonRecipe["outputNameHint"] || deps.state.ui.editDrafts.outputNameHint || "--"))}</strong></div>
          <div><span>Notes</span><strong>${escapeHtml(String(commonRecipe["notes"] || deps.state.ui.editDrafts.notes || "--"))}</strong></div>
          <div><span>Preview Mode</span><strong>${escapeHtml(String(editConfig["handoffMode"] || "source"))}</strong></div>
        </div>
      `,
    }),
    renderCompactCard({
      eyebrow: "Artifacts",
      title: "Üretilen Çıktılar",
      body:
        artifacts.length > 0
          ? artifacts.map(renderArtifactItem).join("")
          : `<p class="labx-panel-hint">Henüz görünür artefakt yok.</p>`,
      footer: hasMoreArtifacts
        ? `<button class="labx-inline-action" type="button" data-lab-action="show-more-artifacts">Daha fazlasını göster</button>`
        : null,
    }),
    renderCompactCard({
      eyebrow: "Actions",
      title: "Sonraki Adımlar",
      body: `
        <div class="labx-inline-actions">
          <button class="labx-inline-action" type="button" data-lab-stage="source">Kaynağa Dön</button>
          <button class="labx-inline-action" type="button" data-lab-stage="edit">Düzenlemeye Dön</button>
          <button class="labx-inline-action" type="button" data-lab-action="new-run-from-report">Yeni Run Oluştur</button>
          <button class="labx-inline-action" type="button" data-lab-action="save-project">Projeyi Kaydet</button>
        </div>
        ${
          exportsList.length > 0
            ? `<div class="labx-list-stack">${exportsList
                .slice(0, 4)
                .map(function (entry) {
                  const record = asLabRecord(entry);
                  return `<p class="labx-panel-hint">${escapeHtml(String(record["fileName"] || record["path"] || "export"))}</p>`;
                })
                .join("")}</div>`
            : `<p class="labx-panel-hint">Export geçmişi yok. Primary action dışa aktarma yapar.</p>`
        }
      `,
    }),
  ].join("");

  return { main, side };
}
