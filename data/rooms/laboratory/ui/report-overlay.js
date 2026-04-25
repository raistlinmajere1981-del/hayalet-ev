import { escapeHtml, formatDateTime, getIntentLabel } from "../models/lab-types.js";
import { buildIntentReportGroups } from "../services/report-builder.js";
import {
  getCurrentReports,
  getReportFreshness,
  getReportOverlayOpen,
  getCurrentRun,
  getIntentDirtyMap,
  getRunSnapshotSummary,
  getWorkspaceDiff,
  isRunActive
} from "../runtime/lab-selectors.js";
import { renderStatusChip } from "./components/status-chip.js";
import { LAB_FALLBACK_I18N } from "./lab-i18n.js";
import { translateLabRuntimeText } from "./lab-runtime-i18n.js";
function formatTimelineMs(ms) {
  if (ms === null) {
    return "—";
  }
  const totalSeconds = Math.max(0, Math.round(ms / 1e3));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds % 3600 / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${String(hours)}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
function formatDiffLabel(key, copy = LAB_FALLBACK_I18N) {
  switch (key) {
    case "timeline":
      return copy.t("mediaAnalysis.reportOverlay.diff.timeline", "Timeline");
    case "hypothesis":
      return copy.t("mediaAnalysis.reportOverlay.diff.hypothesis", "Hypothesis");
    case "intents":
      return copy.t("mediaAnalysis.reportOverlay.diff.intents", "Intents");
    default:
      return key;
  }
}
function getReportIntentLabel(intentId, copy) {
  return copy.t(`mediaAnalysis.workspace.intents.${intentId}.label`, getIntentLabel(intentId));
}
function renderSnapshotSummary(state, copy = LAB_FALLBACK_I18N) {
  const snapshotSummary = getRunSnapshotSummary(state);
  if (!snapshotSummary) {
    return "";
  }
  const workspaceDiff = getWorkspaceDiff(state);
  const timelineSummary = snapshotSummary.timelineStartMs !== null || snapshotSummary.timelineEndMs !== null ? `${formatTimelineMs(snapshotSummary.timelineStartMs)} - ${formatTimelineMs(snapshotSummary.timelineEndMs)}` : copy.t("mediaAnalysis.reportOverlay.snapshot.fullSource", "Full source");
  const intentSummary = snapshotSummary.intentIds.length > 0 ? snapshotSummary.intentIds.map((intentId) => getReportIntentLabel(intentId, copy)).join(", ") : copy.t("mediaAnalysis.reportOverlay.snapshot.noIntent", "No intent snapshot");
  const diffBadges = workspaceDiff && workspaceDiff.changedKeys.length > 0 ? `<div class="labx-workspace-diff-badges">${workspaceDiff.changedKeys.map(function(key) {
    return `<span class="labx-workspace-diff-badge">${escapeHtml(formatDiffLabel(key, copy))}</span>`;
  }).join("")}</div>` : "";
  return `
    <div class="labx-report-section">
      <div class="labx-process-snapshot__head">
        <h3 class="labx-report-section__title">${escapeHtml(copy.t("mediaAnalysis.reportOverlay.snapshot.title", "Snapshot Summary"))}</h3>
        ${diffBadges}
      </div>
      <div class="labx-process-snapshot__grid">
        <div class="labx-process-snapshot__item">
          <span>${escapeHtml(copy.t("mediaAnalysis.reportOverlay.snapshot.focus", "Focus"))}</span>
          <strong>${escapeHtml(snapshotSummary.focus || copy.t("mediaAnalysis.reportOverlay.snapshot.unspecified", "Unspecified"))}</strong>
        </div>
        <div class="labx-process-snapshot__item">
          <span>${escapeHtml(copy.t("mediaAnalysis.reportOverlay.snapshot.timeline", "Timeline"))}</span>
          <strong>${escapeHtml(timelineSummary)}</strong>
        </div>
        <div class="labx-process-snapshot__item">
          <span>${escapeHtml(copy.t("mediaAnalysis.reportOverlay.snapshot.intents", "Intents"))}</span>
          <strong>${escapeHtml(intentSummary)}</strong>
        </div>
      </div>
      ${snapshotSummary.hypothesis ? `<p class="labx-process-snapshot__hypothesis">${escapeHtml(snapshotSummary.hypothesis)}</p>` : ""}
      ${workspaceDiff && workspaceDiff.workspaceDirty ? `<p class="labx-workspace-diff-hint">${escapeHtml(copy.t("mediaAnalysis.reportOverlay.snapshot.liveWorkspaceChanged", "Live workspace changed in {keys}. Report still reflects the frozen snapshot.", { keys: workspaceDiff.changedKeys.map((key) => formatDiffLabel(key, copy)).join(", ") }))}</p>` : `<p class="labx-workspace-diff-hint">${escapeHtml(copy.t("mediaAnalysis.reportOverlay.snapshot.frozen", "Report reflects the frozen run snapshot."))}</p>`}
    </div>
  `;
}
function renderIntentGroups(state, copy = LAB_FALLBACK_I18N) {
  const run = getCurrentRun(state);
  const intentGroups = buildIntentReportGroups(run);
  if (intentGroups.length === 0) {
    return "";
  }
  const dirtyMap = getIntentDirtyMap(state);
  return `
    <div class="labx-report-section">
      <h3 class="labx-report-section__title">${escapeHtml(copy.t("mediaAnalysis.reportOverlay.intentGroups.title", "Intent Groups"))}</h3>
      ${intentGroups.map(function(group) {
    const dirtyState = dirtyMap[group.intentId];
    const dirtyHint = dirtyState.dirty ? `<p class="labx-report-section__hint">${escapeHtml(copy.t("mediaAnalysis.reportOverlay.intentGroups.liveDrift", "Live workspace drift"))}: ${escapeHtml(dirtyState.changedKeys.join(", "))}</p>` : "";
    const findingsHtml = group.findings.length > 0 ? group.findings.slice(0, 3).map(function(finding) {
      return `<div class="labx-report-finding"><div class="labx-report-finding__title"><strong>${escapeHtml(finding.title)}</strong></div><div class="labx-report-finding__detail">${escapeHtml(finding.detail)}</div></div>`;
    }).join("") : `<div class="labx-process-empty">${escapeHtml(copy.t("mediaAnalysis.reportOverlay.intentGroups.noFindings", "No findings mapped to this intent."))}</div>`;
    const artifactHtml = group.artifacts.length > 0 ? `<div class="labx-report-manifest">${group.artifacts.slice(0, 4).map(function(artifact) {
      return `<div class="labx-report-manifest__entry"><span>${escapeHtml(artifact.kind)}</span><strong>${escapeHtml(artifact.fileName || artifact.id)}</strong></div>`;
    }).join("")}</div>` : "";
    return `
            <div class="labx-report-section">
              <h4 class="labx-report-section__title">${escapeHtml(group.label)}</h4>
              <p class="labx-report-section__hint">${escapeHtml(
      copy.t(
        "mediaAnalysis.reportOverlay.intentGroups.counts",
        "{modules} modules · {findings} findings · {artifacts} artifacts",
        {
          artifacts: group.artifacts.length,
          findings: group.findings.length,
          modules: group.modules.length
        }
      )
    )}</p>
              ${dirtyHint}
              ${findingsHtml}
              ${artifactHtml}
            </div>
          `;
  }).join("")}
    </div>
  `;
}
function renderConfidenceBadge(confidence, copy = LAB_FALLBACK_I18N) {
  const level = confidence === "high" ? "high" : confidence === "medium" ? "medium" : "low";
  const label = copy.t(
    `mediaAnalysis.reportOverlay.confidence.${level}`,
    level === "high" ? "Yüksek" : level === "medium" ? "Orta" : "Düşük"
  );
  return `<span class="labx-confidence-gauge" data-level="${level}">${escapeHtml(label)}</span>`;
}
function renderUserReportFindings(findings, copy = LAB_FALLBACK_I18N) {
  if (findings.length === 0) {
    return `<div class="labx-process-empty">${escapeHtml(copy.t("mediaAnalysis.reportOverlay.empty.noFindings", "Bulgu yok"))}</div>`;
  }
  return findings.map(function(f) {
    const evidenceHtml = f.evidence.length > 0 ? `<div class="labx-report-finding__evidence">${f.evidence.map(function(e) {
      return `<span class="labx-report-evidence-tag">${escapeHtml(e)}</span>`;
    }).join("")}</div>` : "";
    return `
        <div class="labx-report-finding">
          <div class="labx-report-finding__title">
            <strong>${escapeHtml(f.title)}</strong>
            ${renderConfidenceBadge(f.confidence, copy)}
          </div>
          <div class="labx-report-finding__detail">${escapeHtml(f.detail)}</div>
          ${evidenceHtml}
        </div>
      `;
  }).join("");
}
function renderSuspiciousFrames(report, copy = LAB_FALLBACK_I18N) {
  if (!Array.isArray(report.suspiciousFrames) || report.suspiciousFrames.length === 0) {
    return "";
  }
  return `
    <div class="labx-report-section">
      <h3 class="labx-report-section__title">${escapeHtml(copy.t("mediaAnalysis.reportOverlay.user.suspiciousFrames", "Şüpheli Kareler"))}</h3>
      <p class="labx-report-section__hint">${escapeHtml(copy.t("mediaAnalysis.reportOverlay.user.suspiciousFramesHint", "Otomatik tespit edilen dikkat çekici kareler"))}</p>
      ${report.suspiciousFrames.map(function(frame) {
    return `
            <div class="labx-report-suspicious-frame">
              <img src="${escapeHtml(frame.previewUrl)}" alt="${escapeHtml(frame.label)}" loading="lazy" />
              <span class="labx-report-suspicious-frame__label">${escapeHtml(frame.label)}</span>
            </div>
          `;
  }).join("")}
    </div>
  `;
}
function renderHypothesisResult(report, copy = LAB_FALLBACK_I18N) {
  if (!report.hypothesisResult) {
    return "";
  }
  return `
    <div class="labx-report-section">
      <h3 class="labx-report-section__title">${escapeHtml(copy.t("mediaAnalysis.reportOverlay.user.hypothesisResult", "Hipotez Sonucu"))}</h3>
      <p class="labx-report-summary">${escapeHtml(report.hypothesisResult)}</p>
    </div>
  `;
}
function renderModuleSummary(report, copy = LAB_FALLBACK_I18N) {
  if (!Array.isArray(report.moduleSummary) || report.moduleSummary.length === 0) {
    return "";
  }
  return `
    <div class="labx-report-section">
      <h3 class="labx-report-section__title">${escapeHtml(copy.t("mediaAnalysis.reportOverlay.user.moduleSummary", "Modül Özeti"))}</h3>
      <div class="labx-report-manifest">
        ${report.moduleSummary.map(function(mod) {
    return `
              <div class="labx-report-manifest__entry">
                <span>${escapeHtml(mod.title || mod.id)}</span>
                <strong>${escapeHtml(mod.status)}</strong>
              </div>
            `;
  }).join("")}
      </div>
    </div>
  `;
}
function renderUserReport(report, copy = LAB_FALLBACK_I18N) {
  return `
    <div class="labx-report-section">
      <h3 class="labx-report-section__title">${escapeHtml(copy.t("mediaAnalysis.reportOverlay.user.summary", "Özet"))}</h3>
      <div class="labx-report-summary">${escapeHtml(report.summary)}</div>
      <div style="margin-top: 0.45rem; display: flex; gap: 0.45rem; align-items: center;">
        ${renderStatusChip(copy.t("mediaAnalysis.reportOverlay.user.confidence", "Güven"), "neutral")}
        ${renderConfidenceBadge(report.confidence, copy)}
        <span style="color: var(--labx-text-dim); font-size: 0.74rem;">${escapeHtml(copy.t("mediaAnalysis.reportOverlay.user.elapsedSeconds", "{seconds} sn", { seconds: report.elapsedSeconds }))}</span>
      </div>
    </div>

    <div class="labx-report-section">
      <h3 class="labx-report-section__title">${escapeHtml(copy.t("mediaAnalysis.reportOverlay.user.findings", "Bulgular"))}</h3>
      ${renderUserReportFindings(report.topFindings, copy)}
    </div>

    ${renderSuspiciousFrames(report, copy)}
    ${renderHypothesisResult(report, copy)}
    ${renderModuleSummary(report, copy)}
  `;
}
function getTraceStatusIcon(status) {
  switch (status) {
    case "completed":
      return "✓";
    case "failed":
      return "✕";
    case "running":
      return "▸";
    default:
      return "·";
  }
}
function renderManifest(manifest) {
  const keys = Object.keys(manifest);
  if (keys.length === 0) {
    return "";
  }
  return `
    <div class="labx-report-manifest">
      ${keys.map(function(key) {
    const val = manifest[key];
    return `
            <div class="labx-report-manifest__entry">
              <span>${escapeHtml(key)}</span>
              <strong>${escapeHtml(String(val ?? "--"))}</strong>
            </div>
          `;
  }).join("")}
    </div>
  `;
}
function renderModuleTraceTimeline(trace, copy = LAB_FALLBACK_I18N) {
  if (!trace || trace.length === 0) {
    return `<div class="labx-process-empty">${escapeHtml(copy.t("mediaAnalysis.reportOverlay.empty.noTimeline", "Zaman çizelgesi yok"))}</div>`;
  }
  return (Array.isArray(trace) ? trace.slice(0, 20) : []).map(function(entry) {
    const icon = getTraceStatusIcon(entry.status);
    return `
        <div class="labx-report-timeline-entry">
          <span class="labx-report-timeline-entry__status" data-status="${escapeHtml(entry.status)}">${icon}</span>
          <span class="labx-report-timeline-entry__time">${escapeHtml(formatDateTime(entry.timestamp))}</span>
	          <span>${escapeHtml(translateLabRuntimeText(entry.message || entry.stage, copy))}</span>
        </div>
      `;
  }).join("");
}
function renderTechnicalFindings(findings, copy = LAB_FALLBACK_I18N) {
  if (findings.length === 0) {
    return `<div class="labx-process-empty">${escapeHtml(copy.t("mediaAnalysis.reportOverlay.empty.noFindings", "Bulgu yok"))}</div>`;
  }
  return findings.map(function(f) {
    const evidenceHtml = f.artifactIds.length > 0 ? `<div class="labx-report-finding__evidence">${f.artifactIds.map(function(aId) {
      return `<span class="labx-report-evidence-tag">${escapeHtml(aId)}</span>`;
    }).join("")}</div>` : "";
    return `
        <div class="labx-report-finding">
          <div class="labx-report-finding__title">
            <strong>${escapeHtml(f.title)}</strong>
            ${renderConfidenceBadge(f.confidence, copy)}
            <span class="labx-report-evidence-tag">${escapeHtml(f.kind)}</span>
            ${f.code ? `<span class="labx-report-evidence-tag">${escapeHtml(f.code)}</span>` : ""}
          </div>
          <div class="labx-report-finding__detail">${escapeHtml(f.detail)}</div>
          ${evidenceHtml}
        </div>
      `;
  }).join("");
}
function renderArtifactList(artifacts, copy = LAB_FALLBACK_I18N) {
  if (artifacts.length === 0) {
    return `<div class="labx-process-empty">${escapeHtml(copy.t("mediaAnalysis.reportOverlay.empty.noArtifacts", "Artefakt yok"))}</div>`;
  }
  return `
    <div class="labx-report-manifest">
      ${artifacts.map(function(art) {
    return `
            <div class="labx-report-manifest__entry">
              <span>${escapeHtml(art.kind)}</span>
              <strong>${escapeHtml(art.fileName || art.id)}</strong>
            </div>
          `;
  }).join("")}
    </div>
  `;
}
function renderAiReport(report, copy = LAB_FALLBACK_I18N) {
  const warnings = Array.isArray(report.warnings) ? report.warnings : [];
  const errors = Array.isArray(report.errors) ? report.errors : [];
  const degraded = Array.isArray(report.degradedConditions) ? report.degradedConditions : [];
  const moduleTrace = Array.isArray(report.moduleTrace) ? report.moduleTrace : [];
  const findings = Array.isArray(report.findings) ? report.findings : [];
  const artifacts = Array.isArray(report.artifacts) ? report.artifacts : [];
  const warningsHtml = warnings.length > 0 ? warnings.map(function(w) {
    return `<div class="labx-report-warning">${escapeHtml(w)}</div>`;
  }).join("") : "";
  const errorsHtml = errors.length > 0 ? errors.map(function(e) {
    return `<div class="labx-report-error">${escapeHtml(e)}</div>`;
  }).join("") : "";
  const degradedHtml = degraded.length > 0 ? degraded.map(function(d) {
    return `<div class="labx-report-warning">${escapeHtml(d)}</div>`;
  }).join("") : "";
  return `
    <div class="labx-report-section">
      <h3 class="labx-report-section__title">${escapeHtml(copy.t("mediaAnalysis.reportOverlay.ai.manifest", "Manifest"))}</h3>
      ${renderManifest(report.manifest)}
    </div>

    <div class="labx-report-section">
      <h3 class="labx-report-section__title">${escapeHtml(copy.t("mediaAnalysis.reportOverlay.ai.moduleTimeline", "Modül Zaman Çizelgesi"))}</h3>
      ${renderModuleTraceTimeline(moduleTrace, copy)}
    </div>

    <div class="labx-report-section">
      <h3 class="labx-report-section__title">${escapeHtml(copy.t("mediaAnalysis.reportOverlay.ai.technicalFindings", "Bulgular (Teknik)"))}</h3>
      ${renderTechnicalFindings(findings, copy)}
    </div>

    <div class="labx-report-section">
      <h3 class="labx-report-section__title">${escapeHtml(copy.t("mediaAnalysis.reportOverlay.ai.artifacts", "Artefaktlar"))}</h3>
      ${renderArtifactList(artifacts, copy)}
    </div>

    ${degradedHtml ? `<div class="labx-report-section"><h3 class="labx-report-section__title">${escapeHtml(copy.t("mediaAnalysis.reportOverlay.ai.degraded", "Kısıtlamalar"))}</h3>${degradedHtml}</div>` : ""}
    ${warningsHtml ? `<div class="labx-report-section"><h3 class="labx-report-section__title">${escapeHtml(copy.t("mediaAnalysis.reportOverlay.ai.warnings", "Uyarılar"))}</h3>${warningsHtml}</div>` : ""}
    ${errorsHtml ? `<div class="labx-report-section"><h3 class="labx-report-section__title">${escapeHtml(copy.t("mediaAnalysis.reportOverlay.ai.errors", "Hatalar"))}</h3>${errorsHtml}</div>` : ""}
  `;
}
export function renderReportOverlay(state, copy = LAB_FALLBACK_I18N) {
  const isOpen = getReportOverlayOpen(state);
  const reports = getCurrentReports(state);
  const run = getCurrentRun(state);
  const reportView = state.ui.reportView;
  const userTabActive = reportView === "user";
  const aiTabActive = reportView === "ai";
  const contentHtml = userTabActive && reports.user ? renderUserReport(reports.user, copy) : aiTabActive && reports.ai ? renderAiReport(reports.ai, copy) : `<div class="labx-process-empty">${escapeHtml(reports.emptyReason ? translateLabRuntimeText(reports.emptyReason, copy) : copy.t("mediaAnalysis.reportOverlay.empty.noReport", "Rapor mevcut değil"))}</div>`;
  const runIdSuffix = run && typeof run.id === "string" ? run.id.slice(-6) || "—" : "—";
  const freshness = getReportFreshness(state);
  const runActive = isRunActive(state);
  const freshnessLabel = freshness?.state === "current" ? copy.t("mediaAnalysis.reportFreshness.current", "✓ Güncel") : freshness?.state === "previous-run" ? runActive ? copy.t(
    "mediaAnalysis.reportFreshness.previousRunActive",
    "⊘ Önceki çalışma · Analiz devam ediyor"
  ) : copy.t("mediaAnalysis.reportFreshness.previousRun", "⊘ Önceki çalışma") : freshness?.state === "stale" ? copy.t(
    "mediaAnalysis.reportFreshness.stale",
    "⊘ Eski çalışma · Son analiz başarısız"
  ) : "";
  const freshnessMeta = freshness && freshness.workspaceDirty ? `${freshnessLabel} · ${copy.t("mediaAnalysis.reportFreshness.workspaceDirty", "Workspace farklı")}` : freshnessLabel;
  return `
    <div class="labx-overlay-root" data-open="${isOpen ? "true" : "false"}" id="lab-report-overlay-root">
      ${isOpen ? `
            <button
              class="labx-overlay-backdrop"
              type="button"
              aria-label="${escapeHtml(copy.t("mediaAnalysis.reportOverlay.closeAria", "Raporu kapat"))}"
              data-lab-action="close-report-overlay"
            ></button>
            <section class="labx-report-overlay" role="dialog" aria-modal="true" aria-label="${escapeHtml(copy.t("mediaAnalysis.reportOverlay.ariaLabel", "Analiz Raporu"))}">
              <div class="labx-report-overlay__header">
                <div>
                  <p class="labx-card__eyebrow">${escapeHtml(copy.t("mediaAnalysis.reportOverlay.eyebrow", "Analiz Sonucu"))}</p>
                  <h2 class="labx-report-overlay__title">${escapeHtml(copy.t("mediaAnalysis.reportOverlay.title", "Rapor #{id}", { id: runIdSuffix }))}</h2>
                  ${freshnessMeta ? `<span class="labx-report-freshness" data-freshness="${escapeHtml(freshness?.state || "")}" data-workspace-dirty="${freshness?.workspaceDirty === true ? "true" : "false"}">${escapeHtml(freshnessMeta)}</span>` : ""}
                </div>
                <div class="labx-inline-actions">
                  <button class="labx-inline-action" type="button" data-lab-action="report-export-json">${escapeHtml(copy.t("mediaAnalysis.reportOverlay.actions.exportJson", "JSON Export"))}</button>
                  <button class="labx-inline-action" type="button" data-lab-action="report-export-pdf">${escapeHtml(copy.t("mediaAnalysis.reportOverlay.actions.exportPdf", "PDF Export"))}</button>
                  <button class="labx-inline-action" type="button" data-lab-action="close-report-overlay">${escapeHtml(copy.t("mediaAnalysis.reportOverlay.actions.close", "Kapat"))}</button>
                </div>
              </div>
              <div class="labx-report-tabs">
                <button
                  class="labx-report-tab ${userTabActive ? "labx-report-tab--active" : ""}"
                  type="button"
                  data-lab-action="report-tab-switch"
                  data-lab-value="user"
                >${escapeHtml(copy.t("mediaAnalysis.reportOverlay.tabs.user", "Kullanıcı Raporu"))}</button>
                <button
                  class="labx-report-tab ${aiTabActive ? "labx-report-tab--active" : ""}"
                  type="button"
                  data-lab-action="report-tab-switch"
                  data-lab-value="ai"
                >${escapeHtml(copy.t("mediaAnalysis.reportOverlay.tabs.ai", "Teknik Rapor"))}</button>
              </div>
              ${renderSnapshotSummary(state, copy)}
              ${renderIntentGroups(state, copy)}
              ${contentHtml}
            </section>
          ` : ""}
    </div>
  `;
}
