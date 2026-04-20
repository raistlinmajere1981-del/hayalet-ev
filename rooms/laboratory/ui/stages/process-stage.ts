import { escapeHtml, formatDateTime } from "../../models/lab-types.js";
import type { LabStageSurface, LabStoreState } from "../../models/lab-types.js";
import {
  getActivePreviewArtifact,
  getCurrentRun,
  getProcessAnalysisScope,
  getSelectedCapabilities,
  getVisibleArtifacts,
  getVisibleEventOffset,
  getVisibleEvents,
  getVisibleLiveFindings,
  getVisibleRawLogs,
  hasMoreVisibleArtifacts,
  hasMoreVisibleEvents,
  hasMoreVisibleLiveFindings,
} from "../../runtime/lab-selectors.js";
import { renderAnalysisScopeSummary } from "../components/analysis-scope-summary.js";
import { renderArtifactItem } from "../components/artifact-item.js";
import { renderCompactCard } from "../components/compact-card.js";
import { renderEmptyState } from "../components/empty-state.js";
import { renderEventFeed } from "../components/event-feed.js";
import { renderLiveFindingsStream } from "../components/live-findings-stream.js";
import { renderPreviewSurface } from "../components/preview-surface.js";
import { renderPrimaryCTA } from "../components/primary-cta.js";
import { renderStageHeader } from "../components/stage-header.js";
import { renderStatusChip } from "../components/status-chip.js";

type ProcessStageRenderDeps = {
  primaryDetail?: string | null;
  primaryDisabled?: boolean;
  primaryLabel: string;
  state: LabStoreState;
};

function renderPipelineSteps(run: NonNullable<ReturnType<typeof getCurrentRun>>) {
  if (run.moduleOrder.length === 0) {
    return `<p class="labx-panel-hint">Henüz çözülmüş pipeline adımı yok.</p>`;
  }

  return `
    <div class="labx-list-stack">
      ${run.moduleOrder
        .map(function (moduleId) {
          const module = run.modules[moduleId];
          if (!module) {
            return "";
          }
          return `
            <article class="labx-choice-row" data-status="${escapeHtml(module.status)}">
              <div>
                <strong>${escapeHtml(module.title || module.id)}</strong>
                <p class="labx-panel-hint">${escapeHtml(module.message || module.summary || module.status)}</p>
              </div>
              <div class="labx-chip-row">
                ${renderStatusChip(module.status, module.status === "completed" ? "success" : module.status === "running" ? "running" : module.status === "failed" ? "error" : "neutral")}
                ${typeof module.progress === "number" ? `<span>${escapeHtml(`${String(module.progress)}%`)}</span>` : ""}
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

export function renderProcessStage(deps: ProcessStageRenderDeps): LabStageSurface {
  const run = getCurrentRun(deps.state);
  const scope = getProcessAnalysisScope(deps.state);
  const events = getVisibleEvents(deps.state);
  const rawLog = getVisibleRawLogs(deps.state);
  const liveFindings = getVisibleLiveFindings(deps.state);
  const artifacts = getVisibleArtifacts(deps.state);
  const activePreviewArtifact = getActivePreviewArtifact(deps.state);
  const selectedCapabilities = getSelectedCapabilities(deps.state);
  const hasMoreEvents = hasMoreVisibleEvents(deps.state);
  const hasMoreArtifacts = hasMoreVisibleArtifacts(deps.state);
  const hasMoreLiveFindings = hasMoreVisibleLiveFindings(deps.state);

  const main = `
    ${renderStageHeader({
      eyebrow: "Aşama 03 · İşlem",
      stageIndex: 3,
      stageTotal: 4,
      statusLabel: run ? run.state : "idle",
      statusTone:
        run?.state === "failed" ? "error" : run?.state === "completed" ? "success" : "running",
      subtitle:
        "Bu aşama sadece yürütme görünümüdür. Kapsam artık read-only'dir; olaylar gruplanmış ve okunabilir biçimde akar.",
      title: "Process",
    })}
    ${
      run
        ? `
          <div class="labx-grid labx-grid--process-v2">
            ${renderCompactCard({
              eyebrow: "Run Summary",
              title: `Run ${run.id}`,
              body: `
                <div class="labx-summary-list">
                  <div><span>Başlangıç</span><strong>${escapeHtml(formatDateTime(new Date(run.startedAt).toISOString()))}</strong></div>
                  <div><span>Yetenek Ailesi</span><strong>${escapeHtml(String(selectedCapabilities.length))}</strong></div>
                  <div><span>Çözülmüş Modül</span><strong>${escapeHtml(String(run.moduleOrder.length))}</strong></div>
                  <div><span>İlerleme</span><strong>${escapeHtml(run.progress !== null ? `${String(run.progress)}%` : "--")}</strong></div>
                </div>
              `,
              footer: renderPrimaryCTA({
                action: "primary-action",
                detail: deps.primaryDetail || null,
                disabled: deps.primaryDisabled,
                label: deps.primaryLabel,
              }),
            })}
            ${renderCompactCard({
              eyebrow: "Pipeline",
              title: "Adım İlerlemesi",
              body: renderPipelineSteps(run),
            })}
            ${renderCompactCard({
              eyebrow: "Activity Feed",
              title: "Toplanmış Olay Akışı",
              body: renderEventFeed({
                canAdvance: hasMoreEvents,
                events,
                offset: getVisibleEventOffset(deps.state),
                totalCount: run.events.length,
              }),
              footer: `
                <div class="labx-inline-actions">
                  <button class="labx-inline-action" type="button" data-lab-action="toggle-raw-log">
                    ${deps.state.ui.rawLogCollapsed ? "Ham logu aç" : "Ham logu daralt"}
                  </button>
                </div>
                ${
                  deps.state.ui.rawLogCollapsed
                    ? ""
                    : `
                      <div class="labx-raw-log__list">
                        ${rawLog
                          .map(function (entry) {
                            return `<pre class="labx-raw-log__entry">${escapeHtml(entry.rawLine || entry.message)}</pre>`;
                          })
                          .join("")}
                      </div>
                    `
                }
              `,
            })}
          </div>
        `
        : `
          ${renderEmptyState({
            title: "Henüz run yok",
            description: "Process aşaması mevcut scope ile başlatılmış gerçek bir run bekler.",
            hint: "Birincil aksiyon analizi başlatır.",
          })}
          ${renderPrimaryCTA({
            action: "primary-action",
            detail: deps.primaryDetail || null,
            disabled: deps.primaryDisabled,
            label: deps.primaryLabel,
          })}
        `
    }
  `;

  const side = run
    ? [
        renderCompactCard({
          eyebrow: "Frozen Scope",
          title: "Dondurulmuş Kapsam",
          body: `
            ${renderAnalysisScopeSummary(run.analysisScope || scope, run.confidence)}
            <p class="labx-panel-hint">Run başladıktan sonra bu kapsam değişmez. Yeni scope yeni run üretir.</p>
          `,
        }),
        renderCompactCard({
          eyebrow: "Warnings",
          title: "Uyarılar",
          body:
            run.warnings.length > 0
              ? `<div class="labx-list-stack">${run.warnings
                  .map(function (warning) {
                    return `<p class="labx-panel-hint">${escapeHtml(warning)}</p>`;
                  })
                  .join("")}</div>`
              : `<p class="labx-panel-hint">Şu anda aktif uyarı yok.</p>`,
        }),
        renderCompactCard({
          eyebrow: "Live Findings",
          title: "Canlı Bulgular",
          body:
            liveFindings.length > 0
              ? renderLiveFindingsStream({
                  canExpand: hasMoreLiveFindings,
                  expanded: deps.state.ui.liveFindingsExpanded,
                  findings: liveFindings,
                  totalCount: run.liveFindings.length,
                })
              : `<p class="labx-panel-hint">Throttled bulgular geldikçe burada görünür.</p>`,
        }),
        renderCompactCard({
          eyebrow: "Preview Artifacts",
          title: "Gerçek Önizlemeler",
          body: renderPreviewSurface({
            activeArtifact: activePreviewArtifact,
            comparisonVariants: [],
            previewArtifacts: run.previewArtifacts,
          }),
        }),
        renderCompactCard({
          eyebrow: "Artifacts",
          title: "Üretilen Çıktılar",
          body:
            artifacts.length > 0
              ? artifacts.map(renderArtifactItem).join("")
              : `<p class="labx-panel-hint">Gerçek artefakt oluştuğunda burada listelenir.</p>`,
          footer: hasMoreArtifacts
            ? `<button class="labx-inline-action" type="button" data-lab-action="show-more-artifacts">Daha fazlasını göster</button>`
            : null,
        }),
      ].join("")
    : renderCompactCard({
        eyebrow: "Scope",
        title: "Hazır Kapsam",
        body: renderAnalysisScopeSummary(scope, null),
      });

  return { main, side };
}
