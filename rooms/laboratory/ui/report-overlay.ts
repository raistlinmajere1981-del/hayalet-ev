import { escapeHtml, formatDateTime, getIntentLabel } from "../models/lab-types.js";
import type {
  LabAiReport,
  LabArtifactProjection,
  LabFindingProjection,
  LabModuleTraceEntry,
  LabRecord,
  LabStoreState,
  LabUserReport,
} from "../models/lab-types.js";
import { buildIntentReportGroups } from "../services/report-builder.js";
import {
  getCurrentReports,
  getReportFreshness,
  getReportOverlayOpen,
  getCurrentRun,
  getIntentDirtyMap,
  getRunSnapshotSummary,
  getWorkspaceDiff,
  isRunActive,
} from "../runtime/lab-selectors.js";
import { renderStatusChip } from "./components/status-chip.js";

function formatTimelineMs(ms: number | null): string {
  if (ms === null) {
    return "—";
  }
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${String(hours)}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatDiffLabel(key: "timeline" | "hypothesis" | "intents"): string {
  switch (key) {
    case "timeline":
      return "Timeline";
    case "hypothesis":
      return "Hypothesis";
    case "intents":
      return "Intents";
    default:
      return key;
  }
}

function renderSnapshotSummary(state: LabStoreState) {
  const snapshotSummary = getRunSnapshotSummary(state);
  if (!snapshotSummary) {
    return "";
  }

  const workspaceDiff = getWorkspaceDiff(state);
  const timelineSummary =
    snapshotSummary.timelineStartMs !== null || snapshotSummary.timelineEndMs !== null
      ? `${formatTimelineMs(snapshotSummary.timelineStartMs)} - ${formatTimelineMs(snapshotSummary.timelineEndMs)}`
      : "Full source";
  const intentSummary =
    snapshotSummary.intentIds.length > 0
      ? snapshotSummary.intentIds.map(getIntentLabel).join(", ")
      : "No intent snapshot";
  const diffBadges =
    workspaceDiff && workspaceDiff.changedKeys.length > 0
      ? `<div class="labx-workspace-diff-badges">${workspaceDiff.changedKeys
          .map(function (key) {
            return `<span class="labx-workspace-diff-badge">${escapeHtml(formatDiffLabel(key))}</span>`;
          })
          .join("")}</div>`
      : "";

  return `
    <div class="labx-report-section">
      <div class="labx-process-snapshot__head">
        <h3 class="labx-report-section__title">Snapshot Summary</h3>
        ${diffBadges}
      </div>
      <div class="labx-process-snapshot__grid">
        <div class="labx-process-snapshot__item">
          <span>Focus</span>
          <strong>${escapeHtml(snapshotSummary.focus || "Unspecified")}</strong>
        </div>
        <div class="labx-process-snapshot__item">
          <span>Timeline</span>
          <strong>${escapeHtml(timelineSummary)}</strong>
        </div>
        <div class="labx-process-snapshot__item">
          <span>Intents</span>
          <strong>${escapeHtml(intentSummary)}</strong>
        </div>
      </div>
      ${
        snapshotSummary.hypothesis
          ? `<p class="labx-process-snapshot__hypothesis">${escapeHtml(snapshotSummary.hypothesis)}</p>`
          : ""
      }
      ${
        workspaceDiff && workspaceDiff.workspaceDirty
          ? `<p class="labx-workspace-diff-hint">Live workspace changed in ${escapeHtml(workspaceDiff.changedKeys.map(formatDiffLabel).join(", "))}. Report still reflects the frozen snapshot.</p>`
          : `<p class="labx-workspace-diff-hint">Report reflects the frozen run snapshot.</p>`
      }
    </div>
  `;
}

function renderIntentGroups(state: LabStoreState) {
  const run = getCurrentRun(state);
  const intentGroups = buildIntentReportGroups(run);
  if (intentGroups.length === 0) {
    return "";
  }

  const dirtyMap = getIntentDirtyMap(state);
  return `
    <div class="labx-report-section">
      <h3 class="labx-report-section__title">Intent Groups</h3>
      ${intentGroups
        .map(function (group) {
          const dirtyState = dirtyMap[group.intentId];
          const dirtyHint = dirtyState.dirty
            ? `<p class="labx-report-section__hint">Live workspace drift: ${escapeHtml(dirtyState.changedKeys.join(", "))}</p>`
            : "";
          const findingsHtml =
            group.findings.length > 0
              ? group.findings
                  .slice(0, 3)
                  .map(function (finding) {
                    return `<div class="labx-report-finding"><div class="labx-report-finding__title"><strong>${escapeHtml(finding.title)}</strong></div><div class="labx-report-finding__detail">${escapeHtml(finding.detail)}</div></div>`;
                  })
                  .join("")
              : `<div class="labx-process-empty">No findings mapped to this intent.</div>`;
          const artifactHtml =
            group.artifacts.length > 0
              ? `<div class="labx-report-manifest">${group.artifacts
                  .slice(0, 4)
                  .map(function (artifact) {
                    return `<div class="labx-report-manifest__entry"><span>${escapeHtml(artifact.kind)}</span><strong>${escapeHtml(artifact.fileName || artifact.id)}</strong></div>`;
                  })
                  .join("")}</div>`
              : "";
          return `
            <div class="labx-report-section">
              <h4 class="labx-report-section__title">${escapeHtml(group.label)}</h4>
              <p class="labx-report-section__hint">${escapeHtml(`${String(group.modules.length)} modules · ${String(group.findings.length)} findings · ${String(group.artifacts.length)} artifacts`)}</p>
              ${dirtyHint}
              ${findingsHtml}
              ${artifactHtml}
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderConfidenceBadge(confidence: string) {
  const level = confidence === "high" ? "high" : confidence === "medium" ? "medium" : "low";
  const label = level === "high" ? "Yüksek" : level === "medium" ? "Orta" : "Düşük";
  return `<span class="labx-confidence-gauge" data-level="${level}">${escapeHtml(label)}</span>`;
}

function renderUserReportFindings(findings: LabUserReport["topFindings"]) {
  if (findings.length === 0) {
    return `<div class="labx-process-empty">Bulgu yok</div>`;
  }
  return findings
    .map(function (f) {
      const evidenceHtml =
        f.evidence.length > 0
          ? `<div class="labx-report-finding__evidence">${f.evidence
              .map(function (e) {
                return `<span class="labx-report-evidence-tag">${escapeHtml(e)}</span>`;
              })
              .join("")}</div>`
          : "";
      return `
        <div class="labx-report-finding">
          <div class="labx-report-finding__title">
            <strong>${escapeHtml(f.title)}</strong>
            ${renderConfidenceBadge(f.confidence)}
          </div>
          <div class="labx-report-finding__detail">${escapeHtml(f.detail)}</div>
          ${evidenceHtml}
        </div>
      `;
    })
    .join("");
}

function renderSuspiciousFrames(report: LabUserReport) {
  if (!Array.isArray(report.suspiciousFrames) || report.suspiciousFrames.length === 0) {
    return "";
  }
  return `
    <div class="labx-report-section">
      <h3 class="labx-report-section__title">Şüpheli Kareler</h3>
      <p class="labx-report-section__hint">Otomatik tespit edilen dikkat çekici kareler</p>
      ${report.suspiciousFrames
        .map(function (frame) {
          return `
            <div class="labx-report-suspicious-frame">
              <img src="${escapeHtml(frame.previewUrl)}" alt="${escapeHtml(frame.label)}" loading="lazy" />
              <span class="labx-report-suspicious-frame__label">${escapeHtml(frame.label)}</span>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderHypothesisResult(report: LabUserReport) {
  if (!report.hypothesisResult) {
    return "";
  }
  return `
    <div class="labx-report-section">
      <h3 class="labx-report-section__title">Hipotez Sonucu</h3>
      <p class="labx-report-summary">${escapeHtml(report.hypothesisResult)}</p>
    </div>
  `;
}

function renderModuleSummary(report: LabUserReport) {
  if (!Array.isArray(report.moduleSummary) || report.moduleSummary.length === 0) {
    return "";
  }
  return `
    <div class="labx-report-section">
      <h3 class="labx-report-section__title">Modül Özeti</h3>
      <div class="labx-report-manifest">
        ${report.moduleSummary
          .map(function (mod) {
            return `
              <div class="labx-report-manifest__entry">
                <span>${escapeHtml(mod.title || mod.id)}</span>
                <strong>${escapeHtml(mod.status)}</strong>
              </div>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
}

function renderUserReport(report: LabUserReport) {
  return `
    <div class="labx-report-section">
      <h3 class="labx-report-section__title">Özet</h3>
      <div class="labx-report-summary">${escapeHtml(report.summary)}</div>
      <div style="margin-top: 0.45rem; display: flex; gap: 0.45rem; align-items: center;">
        ${renderStatusChip("Güven", "neutral")}
        ${renderConfidenceBadge(report.confidence)}
        <span style="color: var(--labx-text-dim); font-size: 0.74rem;">${escapeHtml(String(report.elapsedSeconds))} sn</span>
      </div>
    </div>

    <div class="labx-report-section">
      <h3 class="labx-report-section__title">Bulgular</h3>
      ${renderUserReportFindings(report.topFindings)}
    </div>

    ${renderSuspiciousFrames(report)}
    ${renderHypothesisResult(report)}
    ${renderModuleSummary(report)}
  `;
}

function getTraceStatusIcon(status: string) {
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

function renderManifest(manifest: LabRecord) {
  const keys = Object.keys(manifest);
  if (keys.length === 0) {
    return "";
  }
  return `
    <div class="labx-report-manifest">
      ${keys
        .map(function (key) {
          const val = manifest[key];
          return `
            <div class="labx-report-manifest__entry">
              <span>${escapeHtml(key)}</span>
              <strong>${escapeHtml(String(val ?? "--"))}</strong>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderModuleTraceTimeline(trace: LabModuleTraceEntry[] | undefined) {
  if (!trace || trace.length === 0) {
    return `<div class="labx-process-empty">Zaman çizelgesi yok</div>`;
  }
  return (Array.isArray(trace) ? trace.slice(0, 20) : [])
    .map(function (entry) {
      const icon = getTraceStatusIcon(entry.status);
      return `
        <div class="labx-report-timeline-entry">
          <span class="labx-report-timeline-entry__status" data-status="${escapeHtml(entry.status)}">${icon}</span>
          <span class="labx-report-timeline-entry__time">${escapeHtml(formatDateTime(entry.timestamp))}</span>
          <span>${escapeHtml(entry.message || entry.stage)}</span>
        </div>
      `;
    })
    .join("");
}

function renderTechnicalFindings(findings: LabFindingProjection[]) {
  if (findings.length === 0) {
    return `<div class="labx-process-empty">Bulgu yok</div>`;
  }
  return findings
    .map(function (f) {
      const evidenceHtml =
        f.artifactIds.length > 0
          ? `<div class="labx-report-finding__evidence">${f.artifactIds
              .map(function (aId) {
                return `<span class="labx-report-evidence-tag">${escapeHtml(aId)}</span>`;
              })
              .join("")}</div>`
          : "";
      return `
        <div class="labx-report-finding">
          <div class="labx-report-finding__title">
            <strong>${escapeHtml(f.title)}</strong>
            ${renderConfidenceBadge(f.confidence)}
            <span class="labx-report-evidence-tag">${escapeHtml(f.kind)}</span>
            ${f.code ? `<span class="labx-report-evidence-tag">${escapeHtml(f.code)}</span>` : ""}
          </div>
          <div class="labx-report-finding__detail">${escapeHtml(f.detail)}</div>
          ${evidenceHtml}
        </div>
      `;
    })
    .join("");
}

function renderArtifactList(artifacts: LabArtifactProjection[]) {
  if (artifacts.length === 0) {
    return `<div class="labx-process-empty">Artefakt yok</div>`;
  }
  return `
    <div class="labx-report-manifest">
      ${artifacts
        .map(function (art) {
          return `
            <div class="labx-report-manifest__entry">
              <span>${escapeHtml(art.kind)}</span>
              <strong>${escapeHtml(art.fileName || art.id)}</strong>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderAiReport(report: LabAiReport) {
  const warnings = Array.isArray(report.warnings) ? report.warnings : [];
  const errors = Array.isArray(report.errors) ? report.errors : [];
  const degraded = Array.isArray(report.degradedConditions) ? report.degradedConditions : [];
  const moduleTrace = Array.isArray(report.moduleTrace) ? report.moduleTrace : [];
  const findings = Array.isArray(report.findings) ? report.findings : [];
  const artifacts = Array.isArray(report.artifacts) ? report.artifacts : [];

  const warningsHtml =
    warnings.length > 0
      ? warnings
          .map(function (w) {
            return `<div class="labx-report-warning">${escapeHtml(w)}</div>`;
          })
          .join("")
      : "";
  const errorsHtml =
    errors.length > 0
      ? errors
          .map(function (e) {
            return `<div class="labx-report-error">${escapeHtml(e)}</div>`;
          })
          .join("")
      : "";
  const degradedHtml =
    degraded.length > 0
      ? degraded
          .map(function (d) {
            return `<div class="labx-report-warning">${escapeHtml(d)}</div>`;
          })
          .join("")
      : "";

  return `
    <div class="labx-report-section">
      <h3 class="labx-report-section__title">Manifest</h3>
      ${renderManifest(report.manifest)}
    </div>

    <div class="labx-report-section">
      <h3 class="labx-report-section__title">Modül Zaman Çizelgesi</h3>
      ${renderModuleTraceTimeline(moduleTrace)}
    </div>

    <div class="labx-report-section">
      <h3 class="labx-report-section__title">Bulgular (Teknik)</h3>
      ${renderTechnicalFindings(findings)}
    </div>

    <div class="labx-report-section">
      <h3 class="labx-report-section__title">Artefaktlar</h3>
      ${renderArtifactList(artifacts)}
    </div>

    ${degradedHtml ? `<div class="labx-report-section"><h3 class="labx-report-section__title">Kısıtlamalar</h3>${degradedHtml}</div>` : ""}
    ${warningsHtml ? `<div class="labx-report-section"><h3 class="labx-report-section__title">Uyarılar</h3>${warningsHtml}</div>` : ""}
    ${errorsHtml ? `<div class="labx-report-section"><h3 class="labx-report-section__title">Hatalar</h3>${errorsHtml}</div>` : ""}
  `;
}

export function renderReportOverlay(state: LabStoreState) {
  const isOpen = getReportOverlayOpen(state);
  const reports = getCurrentReports(state);
  const run = getCurrentRun(state);
  const reportView = state.ui.reportView;

  const userTabActive = reportView === "user";
  const aiTabActive = reportView === "ai";

  const contentHtml =
    userTabActive && reports.user
      ? renderUserReport(reports.user)
      : aiTabActive && reports.ai
        ? renderAiReport(reports.ai)
        : `<div class="labx-process-empty">${reports.emptyReason || "Rapor mevcut değil"}</div>`;

  const runIdSuffix = run && typeof run.id === "string" ? run.id.slice(-6) || "—" : "—";
  const freshness = getReportFreshness(state);
  const runActive = isRunActive(state);
  const freshnessLabel =
    freshness?.state === "current"
      ? "\u2713 Güncel"
      : freshness?.state === "previous-run"
        ? runActive
          ? "\u2298 Önceki çalışma \u00b7 Analiz devam ediyor"
          : "\u2298 Önceki çalışma"
        : freshness?.state === "stale"
          ? "\u2298 Eski çalışma \u00b7 Son analiz başarısız"
          : "";
  const freshnessMeta =
    freshness && freshness.workspaceDirty
      ? `${freshnessLabel} \u00b7 Workspace farklı`
      : freshnessLabel;

  return `
    <div class="labx-overlay-root" data-open="${isOpen ? "true" : "false"}" id="lab-report-overlay-root">
      ${
        isOpen
          ? `
            <button
              class="labx-overlay-backdrop"
              type="button"
              aria-label="Raporu kapat"
              data-lab-action="close-report-overlay"
            ></button>
            <section class="labx-report-overlay" role="dialog" aria-modal="true" aria-label="Analiz Raporu">
              <div class="labx-report-overlay__header">
                <div>
                  <p class="labx-card__eyebrow">Analiz Sonucu</p>
                  <h2 class="labx-report-overlay__title">Rapor #${escapeHtml(runIdSuffix)}</h2>
                  ${
                    freshnessMeta
                      ? `<span class="labx-report-freshness" data-freshness="${escapeHtml(freshness?.state || "")}" data-workspace-dirty="${freshness?.workspaceDirty === true ? "true" : "false"}">${escapeHtml(freshnessMeta)}</span>`
                      : ""
                  }
                </div>
                <div class="labx-inline-actions">
                  <button class="labx-inline-action" type="button" data-lab-action="report-export-json">JSON Export</button>
                  <button class="labx-inline-action" type="button" data-lab-action="report-export-pdf">PDF Export</button>
                  <button class="labx-inline-action" type="button" data-lab-action="close-report-overlay">Kapat</button>
                </div>
              </div>
              <div class="labx-report-tabs">
                <button
                  class="labx-report-tab ${userTabActive ? "labx-report-tab--active" : ""}"
                  type="button"
                  data-lab-action="report-tab-switch"
                  data-lab-value="user"
                >Kullanıcı Raporu</button>
                <button
                  class="labx-report-tab ${aiTabActive ? "labx-report-tab--active" : ""}"
                  type="button"
                  data-lab-action="report-tab-switch"
                  data-lab-value="ai"
                >Teknik Rapor</button>
              </div>
              ${renderSnapshotSummary(state)}
              ${renderIntentGroups(state)}
              ${contentHtml}
            </section>
          `
          : ""
      }
    </div>
  `;
}
