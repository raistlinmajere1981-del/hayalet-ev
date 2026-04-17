import { escapeHtml, formatDateTime } from "../../models/lab-types.js";
import {
  getGlobalActivityFeed,
  getCurrentRun,
  getVisibleArtifacts,
  getVisibleEventOffset,
  getVisibleEvents,
  getVisibleRawLogs,
  hasMoreVisibleArtifacts,
  hasMoreVisibleEvents
} from "../../runtime/lab-selectors.js";
import { renderArtifactItem } from "../components/artifact-item.js";
import { renderCompactCard } from "../components/compact-card.js";
import { renderEmptyState } from "../components/empty-state.js";
import { renderEventFeed } from "../components/event-feed.js";
import { renderFindingCard } from "../components/finding-card.js";
import { renderModuleRow } from "../components/module-row.js";
import { renderPrimaryCTA } from "../components/primary-cta.js";
import { renderStageHeader } from "../components/stage-header.js";
function getProcessFindingHint(run) {
  if (run.emptyReason) {
    return run.emptyReason;
  }
  return run.state === "running" ? "Bulgu üretildiğinde burada görünür." : "Raporlanabilir bulgu oluşmadı.";
}
function getProcessArtifactHint(run) {
  if (run.emptyReason) {
    return run.emptyReason;
  }
  return run.state === "running" ? "Artefakt üretildiğinde burada görünür." : "Raporlanabilir artefakt oluşmadı.";
}
export function renderProcessStage(deps) {
  const run = getCurrentRun(deps.state);
  const events = getVisibleEvents(deps.state);
  const rawLog = getVisibleRawLogs(deps.state);
  const artifacts = getVisibleArtifacts(deps.state);
  const hasMoreEvents = hasMoreVisibleEvents(deps.state);
  const hasMoreArtifacts = hasMoreVisibleArtifacts(deps.state);
  const activityFeedCount = getGlobalActivityFeed(deps.state).length;
  const main = `
    ${renderStageHeader({
    eyebrow: "Stage 04 · Process",
    stageIndex: 4,
    stageTotal: 5,
    statusLabel: run ? run.state : "idle",
    statusTone: run?.state === "failed" ? "error" : run?.state === "completed" ? "success" : "running",
    subtitle: "Tüm görünür runtime satırları host kayıtlarından gelir. Sahte progress ve sessiz hata yok.",
    title: "İşlem"
  })}
    ${run ? `
          <div class="labx-grid labx-grid--process">
            ${renderCompactCard({
    eyebrow: "Run Matrix",
    title: "Modül Akışı",
    body: run.moduleOrder.map(function(moduleId) {
      const module = run.modules[moduleId];
      return module ? renderModuleRow(module) : "";
    }).join(""),
    footer: renderPrimaryCTA({
      action: "primary-action",
      detail: deps.primaryDetail || null,
      disabled: deps.primaryDisabled,
      label: deps.primaryLabel
    })
  })}
            ${renderCompactCard({
    eyebrow: "Event Feed",
    title: "Activity Feed",
    body: renderEventFeed({
      canAdvance: hasMoreEvents,
      events,
      offset: getVisibleEventOffset(deps.state),
      totalCount: run.events.length
    }),
    footer: rawLog.length > 0 ? `
                    <details class="labx-raw-log">
                      <summary>Raw Log (${String(run.rawLog.length)})</summary>
                      <div class="labx-raw-log__list">
                        ${rawLog.map(function(entry) {
      return `<pre class="labx-raw-log__entry">${escapeHtml(
        entry.rawLine || entry.message
      )}</pre>`;
    }).join("")}
                      </div>
                    </details>
                  ` : `<p class="labx-panel-hint">Ham log yalnız araç çıktısı geldiğinde görünür.</p>`
  })}
          </div>
        ` : `
          ${renderEmptyState({
    title: "Aktif run yok",
    description: "Process stage yalnız store-backed run oluştuğunda detay gösterir.",
    hint: "Preflight ready durumuna geldiğinde analizi başlatabilirsin."
  })}
          ${renderPrimaryCTA({
    action: "primary-action",
    detail: deps.primaryDetail || null,
    disabled: deps.primaryDisabled,
    label: deps.primaryLabel
  })}
        `}
  `;
  const side = run ? [
    renderCompactCard({
      eyebrow: "Run Summary",
      title: "Çalışma Özeti",
      body: `
            <div class="labx-summary-list">
              <div><span>Run ID</span><strong>${escapeHtml(run.id)}</strong></div>
              <div><span>Started</span><strong>${escapeHtml(formatDateTime(new Date(run.startedAt).toISOString()))}</strong></div>
              <div><span>Modules</span><strong>${escapeHtml(String(run.moduleOrder.length))}</strong></div>
              <div><span>Findings</span><strong>${escapeHtml(String(run.findings.length))}</strong></div>
              <div><span>Artifacts</span><strong>${escapeHtml(String(run.artifacts.length))}</strong></div>
              <div><span>Room Activity</span><strong>${escapeHtml(String(activityFeedCount))}</strong></div>
            </div>
          `
    }),
    renderCompactCard({
      eyebrow: "Findings",
      title: "Öne Çıkan Bulgular",
      body: run.findings.length > 0 ? run.findings.slice(0, 4).map(renderFindingCard).join("") : `<p class="labx-panel-hint">${escapeHtml(getProcessFindingHint(run))}</p>`
    }),
    renderCompactCard({
      eyebrow: "Artifacts",
      title: "Artefaktlar",
      body: artifacts.length > 0 ? artifacts.map(renderArtifactItem).join("") : `<p class="labx-panel-hint">${escapeHtml(getProcessArtifactHint(run))}</p>`,
      footer: hasMoreArtifacts ? `<button class="labx-inline-action" type="button" data-lab-action="show-more-artifacts">Daha fazlasını göster</button>` : run.artifacts.length > 12 ? `<button class="labx-inline-action" type="button" data-lab-action="toggle-artifacts">Listeyi daralt</button>` : null
    })
  ].join("") : renderCompactCard({
    eyebrow: "Runtime",
    title: "Beklenen Çıkış",
    body: `<p class="labx-panel-hint">${escapeHtml(
      deps.primaryDetail || "Run hazır olduğunda gerçek runtime çıktısı burada görünür."
    )}</p>`
  });
  return { main, side };
}
