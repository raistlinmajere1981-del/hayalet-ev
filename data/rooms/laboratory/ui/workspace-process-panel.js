import { escapeHtml } from "../models/lab-types.js";
import {
  getCurrentRun,
  getVisibleLiveFindings,
  getVisibleArtifacts,
  hasMoreVisibleArtifacts,
  hasMoreVisibleLiveFindings,
  getSelectedIntents,
  isProcessSectionCollapsed,
  getRunElapsedSeconds
} from "../runtime/lab-selectors.js";
import { renderStatusChip } from "./components/status-chip.js";
import { renderArtifactItem } from "./components/artifact-item.js";
function getStepStatusIcon(status) {
  switch (status) {
    case "completed":
      return "✓";
    case "running":
      return "▸";
    case "failed":
      return "✕";
    case "queued":
      return "○";
    default:
      return "·";
  }
}
function getStepTone(status) {
  switch (status) {
    case "completed":
      return "success";
    case "running":
      return "running";
    case "failed":
      return "error";
    default:
      return "neutral";
  }
}
function formatElapsed(seconds) {
  if (seconds < 60) {
    return `${String(seconds)} sn`;
  }
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m)} dk ${String(s).padStart(2, "0")} sn`;
}
function renderConfidenceGauge(confidence) {
  if (!confidence) {
    return "";
  }
  const level = confidence === "high" ? "high" : confidence === "medium" ? "medium" : "low";
  const label = level === "high" ? "Yüksek" : level === "medium" ? "Orta" : "Düşük";
  return `<span class="labx-confidence-gauge" data-level="${level}">${escapeHtml(label)}</span>`;
}
function renderSectionHeader(sectionId, label, badge, collapsed) {
  const chevron = collapsed ? "▸" : "▾";
  const badgeHtml = badge > 0 ? `<span class="labx-process-section__badge">${String(badge)}</span>` : "";
  return `
    <button
      class="labx-process-section__header"
      type="button"
      data-lab-action="workspace-process-section-toggle"
      data-lab-value="${escapeHtml(sectionId)}"
    >
      <span class="labx-process-section__chevron">${chevron}</span>
      <strong>${escapeHtml(label)}</strong>
      ${badgeHtml}
    </button>
  `;
}
function renderPipelineSection(run, activeStepId, collapsed) {
  if (run.moduleOrder.length === 0) {
    return `<div class="labx-process-empty">Pipeline resolving...</div>`;
  }
  const completedCount = run.moduleOrder.filter(function(id) {
    const mod = run.modules[id];
    return mod && mod.status === "completed";
  }).length;
  const totalCount = run.moduleOrder.length;
  const progressPct = totalCount > 0 ? Math.round(completedCount / totalCount * 100) : 0;
  const bodyHtml = `
    <div class="labx-process-section__body">
      <div class="labx-process-progress">
        <div class="labx-process-progress__bar">
          <div class="labx-process-progress__fill" style="width: ${String(progressPct)}%"></div>
        </div>
        <span class="labx-process-progress__label">${String(completedCount)}/${String(totalCount)} adım · ${String(progressPct)}%</span>
      </div>
      <div class="labx-process-steps">
        ${run.moduleOrder.map(function(moduleId) {
    const mod = run.modules[moduleId];
    if (!mod) {
      return "";
    }
    const isActive = moduleId === activeStepId;
    const isCurrent = mod.status === "running";
    return `
            <button
              class="labx-process-step ${isActive ? "labx-process-step--selected" : ""} ${isCurrent ? "labx-process-step--current" : ""}"
              type="button"
              data-lab-action="workspace-step-preview"
              data-lab-value="${escapeHtml(moduleId)}"
            >
              <span class="labx-process-step__icon" data-status="${escapeHtml(mod.status)}">${getStepStatusIcon(mod.status)}</span>
              <div class="labx-process-step__body">
                <strong>${escapeHtml(mod.title || mod.id)}</strong>
                <small>${escapeHtml(mod.message || mod.status)}</small>
              </div>
            </button>
          `;
  }).join("")}
      </div>
    </div>
  `;
  return `
    <div class="labx-process-section" data-collapsed="${collapsed ? "true" : "false"}">
      ${renderSectionHeader("pipeline", "Pipeline", run.moduleOrder.length, collapsed)}
      ${collapsed ? "" : bodyHtml}
    </div>
  `;
}
function renderFindingsSection(liveFindings, hasMore, collapsed) {
  const bodyHtml = `
    <div class="labx-process-section__body">
      ${liveFindings.length > 0 ? liveFindings.slice(0, 4).map(function(f) {
    return `<div class="labx-finding-line"><strong>${escapeHtml(f.title)}</strong><small>${escapeHtml(f.detail || "")}</small></div>`;
  }).join("") : `<div class="labx-process-empty">Bulgu yok</div>`}
      ${hasMore ? `<button class="labx-inline-action labx-inline-action--small" type="button" data-lab-action="toggle-live-findings">Daha fazla</button>` : ""}
    </div>
  `;
  return `
    <div class="labx-process-section" data-collapsed="${collapsed ? "true" : "false"}">
      ${renderSectionHeader("findings", "Bulgular", liveFindings.length, collapsed)}
      ${collapsed ? "" : bodyHtml}
    </div>
  `;
}
function renderArtifactsSection(artifacts, hasMore, collapsed) {
  const bodyHtml = `
    <div class="labx-process-section__body">
      ${artifacts.length > 0 ? artifacts.slice(0, 4).map(renderArtifactItem).join("") : `<div class="labx-process-empty">Artefakt yok</div>`}
      ${hasMore ? `<button class="labx-inline-action labx-inline-action--small" type="button" data-lab-action="show-more-artifacts">Daha fazla</button>` : ""}
    </div>
  `;
  return `
    <div class="labx-process-section" data-collapsed="${collapsed ? "true" : "false"}">
      ${renderSectionHeader("artifacts", "Artefaktlar", artifacts.length, collapsed)}
      ${collapsed ? "" : bodyHtml}
    </div>
  `;
}
export function renderWorkspaceProcessPanel(state) {
  const run = getCurrentRun(state);
  if (!run) {
    return "";
  }
  const liveFindings = getVisibleLiveFindings(state);
  const artifacts = getVisibleArtifacts(state);
  const selectedIntents = getSelectedIntents(state);
  const hasMoreFindings = hasMoreVisibleLiveFindings(state);
  const hasMoreArts = hasMoreVisibleArtifacts(state);
  const activeStepId = state.ui.workspace.activeStepPreviewId;
  const elapsedSeconds = getRunElapsedSeconds(state);
  const pipelineCollapsed = isProcessSectionCollapsed(state, "pipeline");
  const findingsCollapsed = isProcessSectionCollapsed(state, "findings");
  const artifactsCollapsed = isProcessSectionCollapsed(state, "artifacts");
  const statusTone = getStepTone(run.state);
  const statusLabel = run.state === "running" ? "Analiz ediliyor" : run.state === "completed" || run.state === "ready" ? "Tamamlandı" : run.state === "failed" ? "Hata" : run.state === "cancelled" ? "İptal" : "Sırada";
  return `
    <section class="labx-process-panel" id="lab-process-panel">
      <div class="labx-process-header">
        <div class="labx-process-header__title">
          ${renderStatusChip(statusLabel, statusTone)}
          <strong>Analiz #${escapeHtml(run.id.slice(-6))}</strong>
        </div>
        <div class="labx-process-header__meta">
          <span>${escapeHtml(String(selectedIntents.length))} intent</span>
          <span>${escapeHtml(String(run.moduleOrder.length))} adım</span>
          <span>${formatElapsed(elapsedSeconds)}</span>
          ${renderConfidenceGauge(run.confidence)}
        </div>
        ${run.error ? `<div class="labx-process-error">${escapeHtml(run.error)}</div>` : ""}
      </div>

      ${renderPipelineSection(run, activeStepId, pipelineCollapsed)}
      ${renderFindingsSection(liveFindings, hasMoreFindings, findingsCollapsed)}
      ${renderArtifactsSection(artifacts, hasMoreArts, artifactsCollapsed)}
    </section>
  `;
}
