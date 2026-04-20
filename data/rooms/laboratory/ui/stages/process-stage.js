import { asLabRecord, asNonEmptyString, escapeHtml, formatDateTime } from "../../models/lab-types.js";
import {
  getActivePreviewArtifact,
  getComparisonVariants,
  getCurrentRun,
  getGlobalActivityFeed,
  getPreviewArtifacts,
  getProcessAnalysisScope,
  getVisibleArtifacts,
  getVisibleEventOffset,
  getVisibleEvents,
  getVisibleLiveFindings,
  getVisibleRawLogs,
  hasMoreVisibleArtifacts,
  hasMoreVisibleEvents,
  hasMoreVisibleLiveFindings
} from "../../runtime/lab-selectors.js";
import { renderAnalysisScopeSummary } from "../components/analysis-scope-summary.js";
import { renderArtifactItem } from "../components/artifact-item.js";
import { renderCompactCard } from "../components/compact-card.js";
import { renderEmptyState } from "../components/empty-state.js";
import { renderEventFeed } from "../components/event-feed.js";
import { renderLiveFindingsStream } from "../components/live-findings-stream.js";
import { renderModuleRow } from "../components/module-row.js";
import { renderPreviewSurface } from "../components/preview-surface.js";
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
function getScopeInputValue(value) {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}
function getProcessRecord(state) {
  const snapshot = asLabRecord(state.snapshot);
  const activeProject = asLabRecord(snapshot["activeProject"]);
  const processRecords = asLabRecord(asLabRecord(activeProject["process"])["records"]);
  return asLabRecord(processRecords[state.featureId]);
}
function getModuleToggleState(state) {
  return asLabRecord(asLabRecord(state.workbench)["moduleToggles"]);
}
function getMediaVisualCatalogModules(state) {
  const snapshot = asLabRecord(state.snapshot);
  const catalog = asLabRecord(snapshot["visualAnalysisCatalog"]);
  const processRecord = getProcessRecord(state);
  const processModules = Array.isArray(processRecord["modules"]) ? processRecord["modules"].map(asLabRecord) : [];
  const capabilityState = processModules.reduce(function(accumulator, moduleEntry) {
    const metadata = asLabRecord(moduleEntry["metadata"]);
    const nextState = asLabRecord(metadata["capabilityState"]);
    return Object.keys(nextState).length > 0 ? nextState : accumulator;
  }, {}) || {};
  const modules = Array.isArray(catalog["modules"]) ? catalog["modules"] : [];
  return modules.map(function(entry) {
    const record = asLabRecord(entry);
    const moduleId = asNonEmptyString(record["id"]) || "visual-module";
    const capabilityEntry = asLabRecord(asLabRecord(capabilityState)[moduleId]);
    return {
      id: moduleId,
      label: asNonEmptyString(record["label"]) || asNonEmptyString(record["title"]) || moduleId,
      status: asNonEmptyString(capabilityEntry["status"]) || asNonEmptyString(record["status"]) || "planned",
      summary: asNonEmptyString(capabilityEntry["summary"]) || asNonEmptyString(record["summary"])
    };
  });
}
function getFeatureModules(state) {
  if (state.featureId === "media-analysis") {
    return getMediaVisualCatalogModules(state);
  }
  const processRecord = getProcessRecord(state);
  const modules = Array.isArray(processRecord["modules"]) ? processRecord["modules"] : [];
  return modules.map(function(entry) {
    const record = asLabRecord(entry);
    const moduleId = asNonEmptyString(record["id"]) || "module";
    return {
      id: moduleId,
      label: asNonEmptyString(record["title"]) || asNonEmptyString(record["label"]) || moduleId,
      status: asNonEmptyString(record["status"]) || "idle",
      summary: asNonEmptyString(record["summary"])
    };
  });
}
function renderFeatureReadiness(state) {
  if (state.featureId !== "media-analysis" && state.featureId !== "subtitle-analysis") {
    return "";
  }
  const snapshot = asLabRecord(state.snapshot);
  const modules = state.featureId === "media-analysis" ? getMediaVisualCatalogModules(state) : getFeatureModules(state);
  const providerSnapshotKey = state.featureId === "media-analysis" ? "visualAnalysisProviders" : "subtitleAnalysisProviders";
  const providers = Array.isArray(asLabRecord(snapshot[providerSnapshotKey])["providers"]) ? asLabRecord(snapshot[providerSnapshotKey])["providers"].map(asLabRecord) : [];
  const toolState = asLabRecord(asLabRecord(state.toolState)["tools"]);
  const readyToolCount = providers.filter(function(provider) {
    const toolId = asNonEmptyString(provider["toolId"]);
    if (toolId === null) {
      return asNonEmptyString(provider["status"]) === "ready";
    }
    return asLabRecord(toolState[toolId])["installed"] === true;
  }).length;
  const readyCapabilityCount = modules.filter(function(entry) {
    return entry.status === "ready" || entry.status === "queued";
  }).length;
  return `
    <div class="labx-summary-list">
      <div><span>Tool readiness</span><strong>${escapeHtml(`${readyToolCount}/${providers.length || 0}`)}</strong></div>
      <div><span>Capability readiness</span><strong>${escapeHtml(`${readyCapabilityCount}/${modules.length || 0}`)}</strong></div>
      <div><span>Density</span><strong>1 preview / 1 stream</strong></div>
    </div>
  `;
}
function renderModuleToggleCards(state) {
  const moduleToggles = getModuleToggleState(state);
  const modules = getFeatureModules(state);
  if (modules.length === 0) {
    return `<p class="labx-panel-hint">Aktif feature icin toggle edilebilir module bulunamadi.</p>`;
  }
  return modules.map(function(entry) {
    const override = moduleToggles[entry.id];
    const enabled = override !== false;
    return `
        <article class="labx-module-card" data-selected="${enabled ? "true" : "false"}">
          <div class="labx-module-card__head">
            <div>
              <strong>${escapeHtml(entry.label)}</strong>
              <span>${escapeHtml(entry.status)}</span>
            </div>
          </div>
          <p class="labx-panel-hint">${escapeHtml(
      entry.summary || "Module toggle stored on the active workbench snapshot."
    )}</p>
          <div class="labx-module-card__actions">
            <button
              class="labx-inline-action"
              type="button"
              data-lab-action="module-toggle"
              data-lab-value="${escapeHtml(entry.id)}"
            >
              ${enabled ? "Modulu kapat" : "Modulu ac"}
            </button>
          </div>
        </article>
      `;
  }).join("");
}
function getScopeSummaryHint(state, run) {
  const processRecord = getProcessRecord(state);
  const queuedProcessInstance = asLabRecord(processRecord["queuedProcessInstance"]);
  if (run?.state === "running") {
    const queuedRunId = asNonEmptyString(queuedProcessInstance["runId"]);
    if (queuedRunId !== null) {
      return `Scope artik frozen. Yeni ayarlar ${queuedRunId} icin kuyruga alinmis yeni process instance uzerinden uygulanacak.`;
    }
    return "Scope artik frozen. Buradaki degisiklikler yeni bir process instance olustugunda kullanilir.";
  }
  if (state.featureId === "media-analysis") {
    return "Visual exploration panel brightness, contrast, gamma, channel isolate ve reveal mode taramalarini mevcut module toggle mantigiyla saklar.";
  }
  return "Scope ve module toggles workbench snapshot uzerinden bir sonraki managed run'a tasinir.";
}
function renderAnalysisControlsCard(state, run) {
  const scope = getProcessAnalysisScope(state);
  const controlsCollapsed = state.ui.analysisControlsCollapsed;
  return renderCompactCard({
    eyebrow: "Interactive Controls",
    title: "Scope ve Module Controls",
    tone: "accent",
    body: `
      ${renderFeatureReadiness(state)}
      <div class="labx-inline-actions">
        <button class="labx-inline-action" type="button" data-lab-action="toggle-analysis-controls">
          ${controlsCollapsed ? "Kontrolleri ac" : "Kontrolleri daralt"}
        </button>
      </div>
      ${controlsCollapsed ? `<p class="labx-panel-hint">${escapeHtml(getScopeSummaryHint(state, run))}</p>` : `
              <div class="labx-grid labx-grid--analysis-controls">
                <div class="labx-list-stack">
                  <label class="labx-field">
                    <span>Focus</span>
                    <select class="labx-select" data-lab-field="scope.focus">
                      ${["", "visual", "audio", "subtitle", "cross-modal"].map(function(entry) {
      return `<option value="${entry}" ${(scope?.focus || "") === entry ? "selected" : ""}>${escapeHtml(entry || "global")}</option>`;
    }).join("")}
                    </select>
                  </label>
                  <div class="labx-inline-grid">
                    <label class="labx-field">
                      <span>Time Start (ms)</span>
                      <input class="labx-input" type="number" min="0" data-lab-field="scope.timeStartMs" value="${escapeHtml(getScopeInputValue(scope?.timeRange?.startMs))}" />
                    </label>
                    <label class="labx-field">
                      <span>Time End (ms)</span>
                      <input class="labx-input" type="number" min="0" data-lab-field="scope.timeEndMs" value="${escapeHtml(getScopeInputValue(scope?.timeRange?.endMs))}" />
                    </label>
                  </div>
                  <div class="labx-inline-grid">
                    <label class="labx-field">
                      <span>Frame Start</span>
                      <input class="labx-input" type="number" min="0" data-lab-field="scope.frameStart" value="${escapeHtml(getScopeInputValue(scope?.frameRange?.startFrame))}" />
                    </label>
                    <label class="labx-field">
                      <span>Frame End</span>
                      <input class="labx-input" type="number" min="0" data-lab-field="scope.frameEnd" value="${escapeHtml(getScopeInputValue(scope?.frameRange?.endFrame))}" />
                    </label>
                  </div>
                  <div class="labx-inline-grid">
                    <label class="labx-field">
                      <span>ROI X</span>
                      <input class="labx-input" type="number" min="0" data-lab-field="scope.regionX" value="${escapeHtml(getScopeInputValue(scope?.region?.x))}" />
                    </label>
                    <label class="labx-field">
                      <span>ROI Y</span>
                      <input class="labx-input" type="number" min="0" data-lab-field="scope.regionY" value="${escapeHtml(getScopeInputValue(scope?.region?.y))}" />
                    </label>
                    <label class="labx-field">
                      <span>ROI W</span>
                      <input class="labx-input" type="number" min="1" data-lab-field="scope.regionWidth" value="${escapeHtml(getScopeInputValue(scope?.region?.width))}" />
                    </label>
                    <label class="labx-field">
                      <span>ROI H</span>
                      <input class="labx-input" type="number" min="1" data-lab-field="scope.regionHeight" value="${escapeHtml(getScopeInputValue(scope?.region?.height))}" />
                    </label>
                  </div>
                  <label class="labx-field">
                    <span>Hypothesis</span>
                    <textarea class="labx-textarea" data-lab-field="scope.hypothesis" placeholder="su aralikta gorunmeyen obje olabilir">${escapeHtml(scope?.hypothesis || "")}</textarea>
                  </label>
                  <p class="labx-panel-hint">${escapeHtml(getScopeSummaryHint(state, run))}</p>
                </div>
                <div class="labx-list-stack">
                  <p class="labx-panel-hint">
                    ${escapeHtml(
      state.featureId === "media-analysis" ? "Visual exploration panel mevcut reveal ve forensics module toggle deseniyle calisir." : "Module toggles ready/gated truth modelini korur ve disabled module'leri sonraki run icin skip eder."
    )}
                  </p>
                  ${renderModuleToggleCards(state)}
                </div>
              </div>
            `}
    `
  });
}
export function renderProcessStage(deps) {
  const run = getCurrentRun(deps.state);
  const events = getVisibleEvents(deps.state);
  const rawLog = getVisibleRawLogs(deps.state);
  const artifacts = getVisibleArtifacts(deps.state);
  const liveFindings = getVisibleLiveFindings(deps.state);
  const previewArtifacts = getPreviewArtifacts(deps.state);
  const activePreviewArtifact = getActivePreviewArtifact(deps.state);
  const comparisonVariants = getComparisonVariants(deps.state);
  const scope = getProcessAnalysisScope(deps.state);
  const hasMoreEvents = hasMoreVisibleEvents(deps.state);
  const hasMoreArtifacts = hasMoreVisibleArtifacts(deps.state);
  const hasMoreLiveFindings = hasMoreVisibleLiveFindings(deps.state);
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
    ${renderAnalysisControlsCard(deps.state, run)}
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
              <div><span>Live Stream</span><strong>${escapeHtml(String(run.liveFindings.length))}</strong></div>
              <div><span>Preview Variants</span><strong>${escapeHtml(String(run.previewArtifacts.length))}</strong></div>
              <div><span>Room Activity</span><strong>${escapeHtml(String(activityFeedCount))}</strong></div>
            </div>
            ${renderAnalysisScopeSummary(scope, run.confidence)}
          `
    }),
    renderCompactCard({
      eyebrow: "Live Findings",
      title: "Canli Bulgu Akisi",
      body: run.liveFindings.length > 0 ? renderLiveFindingsStream({
        canExpand: hasMoreLiveFindings,
        expanded: deps.state.ui.liveFindingsExpanded,
        findings: liveFindings,
        totalCount: run.liveFindings.length
      }) : `<p class="labx-panel-hint">${escapeHtml(getProcessFindingHint(run))}</p>`
    }),
    renderCompactCard({
      eyebrow: "Preview Surface",
      title: "Aktif Preview",
      body: renderPreviewSurface({
        activeArtifact: activePreviewArtifact,
        comparisonVariants,
        previewArtifacts
      })
    }),
    renderCompactCard({
      eyebrow: "Artifacts",
      title: "Artefaktlar",
      body: artifacts.length > 0 ? artifacts.map(renderArtifactItem).join("") : `<p class="labx-panel-hint">${escapeHtml(getProcessArtifactHint(run))}</p>`,
      footer: hasMoreArtifacts ? `<button class="labx-inline-action" type="button" data-lab-action="show-more-artifacts">Daha fazlasını göster</button>` : run.artifacts.length > 12 ? `<button class="labx-inline-action" type="button" data-lab-action="toggle-artifacts">Listeyi daralt</button>` : null
    })
  ].join("") : renderCompactCard({
    eyebrow: "Runtime",
    title: "Scope Snapshot",
    body: `
          ${renderAnalysisScopeSummary(scope, null)}
          <p class="labx-panel-hint">${escapeHtml(
      deps.primaryDetail || "Run hazır olduğunda gerçek runtime çıktısı burada görünür."
    )}</p>
        `
  });
  return { main, side };
}
