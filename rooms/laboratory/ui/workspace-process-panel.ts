import {
  CAPABILITY_FAMILIES,
  escapeHtml,
  getCapabilityFamilyIdsForIntentId,
  getIntentLabel,
  getModuleIdsForCapabilityFamily,
} from "../models/lab-types.js";
import type {
  CapabilityFamilyId,
  LabIntentId,
  LabIntentDirtyState,
  LabModuleState,
  LabProcessSectionId,
  LabStoreState,
  LabUserActionEvent,
} from "../models/lab-types.js";
import {
  getActiveModule,
  getActualOutputs,
  getCurrentRun,
  getExpectedOutputs,
  getRecentUserActions,
  getIntentDirtyMap,
  getRunSnapshotSummary,
  getSelectedIntents,
  getVisibleArtifacts,
  getVisibleLiveFindings,
  getWorkspaceDiff,
  getRunElapsedSeconds,
  hasMoreVisibleArtifacts,
  hasMoreVisibleLiveFindings,
  isExpectedOutputMatched,
  isProcessSectionCollapsed,
} from "../runtime/lab-selectors.js";
import { getLabUserActionDisplayText } from "../runtime/lab-user-actions.js";
import { renderArtifactItem } from "./components/artifact-item.js";
import { renderStatusChip } from "./components/status-chip.js";

const AUDIO_TRANSPORT_CAPABILITY_IDS: CapabilityFamilyId[] = [
  "audio-signal",
  "audio-recovery",
  "transcription",
  "speaker-analysis",
  "prosody-emotion",
  "sound-classification",
  "source-separation",
  "music-analysis",
];

type ExecutionModuleRow = {
  id: string;
  label: string;
  status: string;
};

function getStepStatusIcon(status: string) {
  switch (status) {
    case "completed":
    case "ready":
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

function getStepTone(status: string) {
  switch (status) {
    case "completed":
    case "ready":
      return "success";
    case "running":
      return "running";
    case "failed":
      return "error";
    default:
      return "neutral";
  }
}

function getModuleStatusLabel(status: string) {
  switch (status) {
    case "running":
      return "Çalışıyor";
    case "completed":
    case "ready":
      return "Tamamlandı";
    case "failed":
      return "Tamamlanamadı";
    case "queued":
      return "Bekliyor";
    case "skipped":
      return "Atlandı";
    case "cancelled":
      return "İptal edildi";
    default:
      return "Bekleniyor";
  }
}

function getModuleStatusTooltip(status: string) {
  return status === "failed" ? "Bu modül çalışmadı, diğerleri devam ediyor" : "";
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) {
    return `${String(seconds)} sn`;
  }
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m)} dk ${String(s).padStart(2, "0")} sn`;
}

function formatRelativeActionTime(timestamp: number | undefined) {
  if (typeof timestamp !== "number" || Number.isFinite(timestamp) !== true) {
    return "az önce";
  }
  const diffMs = Math.max(0, Date.now() - timestamp);
  const diffSeconds = Math.max(1, Math.round(diffMs / 1000));
  if (diffSeconds < 60) {
    return `${String(diffSeconds)} sn önce`;
  }
  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${String(diffMinutes)} dk önce`;
  }
  const diffHours = Math.round(diffMinutes / 60);
  return `${String(diffHours)} sa önce`;
}

function getRecentActionMeta(actionEvent: LabUserActionEvent) {
  if (actionEvent.status === "running") {
    return "devam ediyor";
  }
  return formatRelativeActionTime(actionEvent.finishedAt || actionEvent.startedAt);
}

function renderConfidenceGauge(confidence: string | null) {
  if (!confidence) {
    return "";
  }
  const level = confidence === "high" ? "high" : confidence === "medium" ? "medium" : "low";
  const label = level === "high" ? "Yüksek" : level === "medium" ? "Orta" : "Düşük";
  return `<span class="labx-confidence-gauge" data-level="${level}">${escapeHtml(label)}</span>`;
}

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

function getCapabilityLabel(capabilityId: CapabilityFamilyId): string {
  return (
    CAPABILITY_FAMILIES.find(function (entry) {
      return entry.id === capabilityId;
    })?.label || capabilityId
  );
}

function getExecutionIntentIds(state: LabStoreState): LabIntentId[] {
  const snapshotSummary = getRunSnapshotSummary(state);
  if (snapshotSummary) {
    return Array.isArray(snapshotSummary.intentIds) ? snapshotSummary.intentIds.slice() : [];
  }
  const selectedIntents = getSelectedIntents(state);
  return Array.isArray(selectedIntents) ? selectedIntents.slice() : [];
}

function getExecutionTraceIntentIds(state: LabStoreState): string[] {
  const runIntentIds = getCurrentRun(state)?.analysisScope?.intentIds;
  if (Array.isArray(runIntentIds) && runIntentIds.length > 0) {
    return Array.from(
      new Set(
        runIntentIds.filter(function (intentId): intentId is string {
          return typeof intentId === "string" && intentId.trim() !== "";
        })
      )
    );
  }
  return getExecutionIntentIds(state).slice();
}

function getResolvedCapabilityIds(intentIds: LabIntentId[]): CapabilityFamilyId[] {
  const seen = new Set<CapabilityFamilyId>();
  intentIds.forEach(function (intentId) {
    getCapabilityFamilyIdsForIntentId(intentId).forEach(function (capabilityId) {
      seen.add(capabilityId);
    });
  });
  return Array.from(seen);
}

function getCapabilityIdsForIntent(
  intentId: LabIntentId,
  resolvedCapabilities: CapabilityFamilyId[]
): CapabilityFamilyId[] {
  const intentCapabilities = getCapabilityFamilyIdsForIntentId(intentId);
  return resolvedCapabilities.filter(function (capabilityId) {
    return intentCapabilities.includes(capabilityId);
  });
}

function getTransportFallbackCapabilityIds(
  moduleId: string,
  resolvedCapabilities: CapabilityFamilyId[],
  intentIds: LabIntentId[]
): CapabilityFamilyId[] {
  if (moduleId === "motion") {
    return resolvedCapabilities.includes("visual-structure") ? ["visual-structure"] : [];
  }
  if (moduleId === "visual-signal") {
    return resolvedCapabilities.includes("visual-forensics") ? ["visual-forensics"] : [];
  }
  if (moduleId === "audio") {
    return resolvedCapabilities.filter(function (capabilityId) {
      return AUDIO_TRANSPORT_CAPABILITY_IDS.includes(capabilityId);
    });
  }
  if (moduleId === "report" && intentIds.length === 1) {
    const [intentId] = intentIds;
    return intentId ? getCapabilityIdsForIntent(intentId, resolvedCapabilities) : [];
  }
  return [];
}

function getPlannedModuleIds(module: LabModuleState | undefined): string[] {
  const metadata = module?.metadata;
  const rawModuleIds = Array.isArray(metadata?.["moduleIds"]) ? metadata["moduleIds"] : [];
  return rawModuleIds.filter(
    (entry): entry is string => typeof entry === "string" && entry.trim() !== ""
  );
}

// NOTE: Managed runs can surface transport wrappers plus an inner module plan in metadata.
function getExecutionModuleRowsForCapability(
  state: LabStoreState,
  capabilityId: CapabilityFamilyId,
  resolvedCapabilities: CapabilityFamilyId[]
): ExecutionModuleRow[] {
  const run = getCurrentRun(state);
  if (!run || !Array.isArray(run.moduleOrder)) {
    return [];
  }
  const intentIds = getExecutionIntentIds(state);
  const seen = new Set<string>();
  const expectedModuleIds = new Set(
    getModuleIdsForCapabilityFamily(capabilityId).concat(capabilityId)
  );
  const rows: ExecutionModuleRow[] = [];

  run.moduleOrder.forEach(function (moduleId) {
    const module = run.modules[moduleId];
    const moduleStatus = module?.status || "idle";
    const moduleLabel = module?.title || module?.id || moduleId;
    const plannedModuleIds = getPlannedModuleIds(module).filter(function (plannedModuleId) {
      return expectedModuleIds.has(plannedModuleId);
    });

    if (expectedModuleIds.has(moduleId) && !seen.has(moduleId)) {
      seen.add(moduleId);
      rows.push({
        id: moduleId,
        label: moduleLabel,
        status: moduleStatus,
      });
    }

    plannedModuleIds.forEach(function (plannedModuleId) {
      if (seen.has(plannedModuleId)) {
        return;
      }
      seen.add(plannedModuleId);
      rows.push({
        id: plannedModuleId,
        label: plannedModuleId,
        status: moduleStatus,
      });
    });

    if (plannedModuleIds.length > 0) {
      return;
    }

    const transportCapabilityIds = getTransportFallbackCapabilityIds(
      moduleId,
      resolvedCapabilities,
      intentIds
    );
    if (!transportCapabilityIds.includes(capabilityId) || seen.has(moduleId)) {
      return;
    }

    seen.add(moduleId);
    rows.push({
      id: moduleId,
      label: moduleLabel,
      status: moduleStatus,
    });
  });

  return rows;
}

function getCapabilityExecutionStatus(
  state: LabStoreState,
  capabilityId: CapabilityFamilyId,
  resolvedCapabilities: CapabilityFamilyId[]
): string {
  const run = getCurrentRun(state);
  if (!run) {
    return "pending";
  }
  const moduleRows = getExecutionModuleRowsForCapability(state, capabilityId, resolvedCapabilities);
  if (moduleRows.length === 0) {
    return "pending";
  }
  const relevantStatuses = moduleRows.map(function (moduleRow) {
    return moduleRow.status;
  });
  if (
    relevantStatuses.some(function (status) {
      return status === "failed";
    })
  ) {
    return "failed";
  }
  if (
    relevantStatuses.some(function (status) {
      return status === "running";
    })
  ) {
    return "running";
  }
  if (
    relevantStatuses.some(function (status) {
      return status === "queued";
    })
  ) {
    return "queued";
  }
  if (
    relevantStatuses.every(function (status) {
      return status === "completed" || status === "ready" || status === "skipped";
    })
  ) {
    return "completed";
  }
  return "pending";
}

function renderCapabilityModules(
  state: LabStoreState,
  capabilityId: CapabilityFamilyId,
  run: ReturnType<typeof getCurrentRun>,
  resolvedCapabilities: CapabilityFamilyId[]
) {
  const moduleRows = run
    ? getExecutionModuleRowsForCapability(state, capabilityId, resolvedCapabilities)
    : getModuleIdsForCapabilityFamily(capabilityId).map(function (moduleId) {
        return {
          id: moduleId,
          label: moduleId,
          status: "queued",
        };
      });
  if (moduleRows.length === 0) {
    return `<div class="labx-process-empty">${run ? "Modül bekleniyor" : "Modül planı yok"}</div>`;
  }
  return moduleRows
    .map(function (moduleRow) {
      const moduleStatus = moduleRow.status;
      const tooltip = run ? getModuleStatusTooltip(moduleStatus) : "";
      return `
        <div class="labx-intent-map__module">
          <span class="labx-intent-map__module-name">${escapeHtml(moduleRow.label)}</span>
          <strong class="labx-intent-map__module-status" data-tone="${escapeHtml(getStepTone(moduleStatus))}" ${tooltip ? `title="${escapeHtml(tooltip)}"` : ""}>${escapeHtml(getModuleStatusLabel(moduleStatus))}</strong>
        </div>
      `;
    })
    .join("");
}

function renderIntentExecutionMap(state: LabStoreState, sourceReady: boolean): string {
  const run = getCurrentRun(state);
  if (sourceReady !== true) {
    return "";
  }

  const intentIds = getExecutionIntentIds(state);
  const resolvedCapabilities = getResolvedCapabilityIds(intentIds);
  if (!run && (intentIds.length === 0 || resolvedCapabilities.length === 0)) {
    return `
      <section class="labx-intent-map">
        <div class="labx-intent-map__head">
          <strong>Intent → Execution Map</strong>
        </div>
        <div class="labx-process-empty">Henüz yürütme yok</div>
      </section>
    `;
  }

  if (intentIds.length === 0 || resolvedCapabilities.length === 0) {
    return `
      <section class="labx-intent-map">
        <div class="labx-intent-map__head">
          <strong>Intent → Execution Map</strong>
        </div>
        <div class="labx-process-empty">Intent seçimi yok</div>
      </section>
    `;
  }

  const dirtyMap = getIntentDirtyMap(state);
  return `
      <section class="labx-intent-map">
        <div class="labx-intent-map__head">
          <strong>Intent → Execution Map</strong>
        </div>
        ${!run ? `<div class="labx-process-empty">Henüz yürütme yok</div>` : ""}
        <div class="labx-intent-map__body">
        ${intentIds
          .map(function (intentId) {
            const capabilityIds = getCapabilityIdsForIntent(intentId, resolvedCapabilities);
            const dirtyState = (dirtyMap as Partial<Record<LabIntentId, LabIntentDirtyState>>)[
              intentId
            ];
            const dirtyHint =
              dirtyState && dirtyState.dirty
                ? `<span class="labx-intent-map__hint">Live drift: ${escapeHtml(dirtyState.changedKeys.join(", "))}</span>`
                : "";
            const capabilitiesHtml =
              capabilityIds.length > 0
                ? capabilityIds
                    .map(function (capabilityId) {
                      const capabilityStatus = run
                        ? getCapabilityExecutionStatus(state, capabilityId, resolvedCapabilities)
                        : "queued";
                      const moduleRows = renderCapabilityModules(
                        state,
                        capabilityId,
                        run,
                        resolvedCapabilities
                      );
                      return `
                        <div class="labx-intent-map__capability">
                          <div class="labx-intent-map__capability-head">
                            <span>${escapeHtml(getCapabilityLabel(capabilityId))}</span>
                            ${renderStatusChip(getModuleStatusLabel(capabilityStatus), getStepTone(capabilityStatus))}
                          </div>
                          <div class="labx-intent-map__modules">${moduleRows}</div>
                        </div>
                      `;
                    })
                    .join("")
                : `<div class="labx-process-empty">Yetenek eşleşmesi yok</div>`;
            return `
              <article class="labx-intent-map__intent">
                <div class="labx-intent-map__intent-head">
                  <strong>${escapeHtml(getIntentLabel(intentId))}</strong>
                  ${dirtyHint}
                </div>
                <div class="labx-intent-map__capabilities">${capabilitiesHtml}</div>
              </article>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderIntentOutputTrace(state: LabStoreState, sourceReady: boolean): string {
  if (sourceReady !== true) {
    return "";
  }

  const intentIds = getExecutionTraceIntentIds(state);
  if (intentIds.length === 0) {
    return "";
  }

  return `
    <section class="labx-output-trace">
      <div class="labx-output-trace__head">
        <strong>INTENT OUTPUT TRACE</strong>
      </div>
      <div class="labx-output-trace__body">
        ${intentIds
          .map(function (intentId) {
            const expectedOutputs = getExpectedOutputs(intentId);
            const actualOutputs = getActualOutputs(state, intentId);
            const expectedHtml =
              expectedOutputs.length > 0
                ? expectedOutputs
                    .map(function (expectedOutput) {
                      const matched = isExpectedOutputMatched(expectedOutput, actualOutputs);
                      return `
                        <div class="labx-output-trace__expected-row" data-matched="${matched ? "true" : "false"}">
                          <span class="labx-output-trace__mark">${matched ? "✔" : "✖"}</span>
                          <span>${escapeHtml(expectedOutput.label)}</span>
                        </div>
                      `;
                    })
                    .join("")
                : `<div class="labx-output-trace__empty">Bu intent için beklenen çıktı tanımı yok</div>`;
            const actualHtml =
              actualOutputs.length > 0
                ? actualOutputs
                    .map(function (asset) {
                      return `
                        <div class="labx-output-trace__asset">
                          <span class="labx-output-trace__asset-type">${escapeHtml(asset.type)}</span>
                          <span>${escapeHtml(asset.name)}</span>
                        </div>
                      `;
                    })
                    .join("")
                : `<div class="labx-output-trace__empty">Bu intent herhangi bir çıktı üretmedi</div>`;

            return `
              <article class="labx-output-trace__intent">
                <div class="labx-output-trace__intent-head">
                  <strong>${escapeHtml(getIntentLabel(intentId))}</strong>
                </div>
                <div class="labx-output-trace__group">
                  <span class="labx-output-trace__label">Beklenen:</span>
                  <div class="labx-output-trace__rows">${expectedHtml}</div>
                </div>
                <div class="labx-output-trace__group">
                  <span class="labx-output-trace__label">Üretilen:</span>
                  <div class="labx-output-trace__rows">${actualHtml}</div>
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderRunSnapshotSummary(state: LabStoreState): string {
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
  const hypothesisHtml = snapshotSummary.hypothesis
    ? `<p class="labx-process-snapshot__hypothesis">${escapeHtml(snapshotSummary.hypothesis)}</p>`
    : "";
  const diffHint =
    workspaceDiff && workspaceDiff.workspaceDirty
      ? `<p class="labx-workspace-diff-hint">Live workspace changed in ${escapeHtml(workspaceDiff.changedKeys.map(formatDiffLabel).join(", "))}. Snapshot stays frozen for this run.</p>`
      : `<p class="labx-workspace-diff-hint">Snapshot stays frozen for this run.</p>`;

  return `
    <section class="labx-process-snapshot">
      <div class="labx-process-snapshot__head">
        <strong>Run Snapshot</strong>
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
      ${hypothesisHtml}
      ${diffHint}
    </section>
  `;
}

function renderSectionHeader(
  sectionId: LabProcessSectionId,
  label: string,
  badge: number,
  collapsed: boolean
) {
  const chevron = collapsed ? "▸" : "▾";
  const badgeHtml =
    badge > 0 ? `<span class="labx-process-section__badge">${String(badge)}</span>` : "";
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

function renderPipelineSection(
  run: NonNullable<ReturnType<typeof getCurrentRun>>,
  activeStepId: string | null,
  collapsed: boolean
) {
  const moduleOrder = Array.isArray(run.moduleOrder) ? run.moduleOrder : [];
  if (moduleOrder.length === 0) {
    return `<div class="labx-process-empty">Pipeline resolving...</div>`;
  }

  const completedCount = moduleOrder.filter(function (id) {
    const mod = run.modules[id];
    return mod && (mod.status === "completed" || mod.status === "ready");
  }).length;
  const totalCount = moduleOrder.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const bodyHtml = `
    <div class="labx-process-section__body">
      <div class="labx-process-progress">
        <div class="labx-process-progress__bar">
          <div class="labx-process-progress__fill" style="width: ${String(progressPct)}%"></div>
        </div>
        <span class="labx-process-progress__label">${String(completedCount)}/${String(totalCount)} adım · ${String(progressPct)}%</span>
      </div>
      <div class="labx-process-steps">
        ${moduleOrder
          .map(function (moduleId) {
            const mod = run.modules[moduleId];
            if (!mod) {
              return "";
            }
            const isActive = moduleId === activeStepId;
            const isCurrent = mod.status === "running";
            const tooltip = getModuleStatusTooltip(mod.status);
            return `
              <button
                class="labx-process-step ${isActive ? "labx-process-step--selected" : ""} ${isCurrent ? "labx-process-step--current" : ""}"
                type="button"
                data-lab-action="workspace-step-preview"
                data-lab-value="${escapeHtml(moduleId)}"
                ${tooltip ? `title="${escapeHtml(tooltip)}"` : ""}
              >
                <span class="labx-process-step__icon" data-status="${escapeHtml(mod.status)}">${getStepStatusIcon(mod.status)}</span>
                <div class="labx-process-step__body">
                  <strong>${escapeHtml(mod.title || mod.id)}</strong>
                  <small>${escapeHtml(mod.message || getModuleStatusLabel(mod.status))}</small>
                </div>
              </button>
            `;
          })
          .join("")}
      </div>
    </div>
  `;

  return `
    <div class="labx-process-section" data-collapsed="${collapsed ? "true" : "false"}">
      ${renderSectionHeader("pipeline", "Pipeline", moduleOrder.length, collapsed)}
      ${collapsed ? "" : bodyHtml}
    </div>
  `;
}

function renderFindingsSection(
  liveFindings: ReturnType<typeof getVisibleLiveFindings>,
  hasMore: boolean,
  collapsed: boolean
) {
  const visibleFindings = Array.isArray(liveFindings) ? liveFindings.slice(0, 4) : [];
  const bodyHtml = `
    <div class="labx-process-section__body">
      ${
        visibleFindings.length > 0
          ? visibleFindings
              .map(function (finding) {
                return `<div class="labx-finding-line"><strong>${escapeHtml(finding.title)}</strong><small>${escapeHtml(finding.detail || "")}</small></div>`;
              })
              .join("")
          : `<div class="labx-process-empty">Bulgu yok</div>`
      }
      ${hasMore ? `<button class="labx-inline-action labx-inline-action--small" type="button" data-lab-action="toggle-live-findings">Daha fazla</button>` : ""}
    </div>
  `;

  return `
    <div class="labx-process-section" data-collapsed="${collapsed ? "true" : "false"}">
      ${renderSectionHeader("findings", "Bulgular", Array.isArray(liveFindings) ? liveFindings.length : 0, collapsed)}
      ${collapsed ? "" : bodyHtml}
    </div>
  `;
}

function renderArtifactsSection(
  artifacts: ReturnType<typeof getVisibleArtifacts>,
  hasMore: boolean,
  collapsed: boolean
) {
  const visibleArtifacts = Array.isArray(artifacts) ? artifacts.slice(0, 4) : [];
  const bodyHtml = `
    <div class="labx-process-section__body">
      ${
        visibleArtifacts.length > 0
          ? visibleArtifacts.map(renderArtifactItem).join("")
          : `<div class="labx-process-empty">Artefakt yok</div>`
      }
      ${hasMore ? `<button class="labx-inline-action labx-inline-action--small" type="button" data-lab-action="show-more-artifacts">Daha fazla</button>` : ""}
    </div>
  `;

  return `
    <div class="labx-process-section" data-collapsed="${collapsed ? "true" : "false"}">
      ${renderSectionHeader("artifacts", "Artefaktlar", Array.isArray(artifacts) ? artifacts.length : 0, collapsed)}
      ${collapsed ? "" : bodyHtml}
    </div>
  `;
}

function renderRecentActionsSection(state: LabStoreState) {
  const recentActions = getRecentUserActions(state, 6);
  return `
    <section class="labx-process-recent-actions">
      <div class="labx-process-recent-actions__head">
        <strong>Son işlemler</strong>
      </div>
      ${
        recentActions.length > 0
          ? `
            <div class="labx-process-recent-actions__list">
              ${recentActions
                .map(function (actionEvent) {
                  return `
                    <div
                      class="labx-process-recent-actions__item"
                      data-tone="${escapeHtml(actionEvent.status)}"
                    >
                      <span class="labx-process-recent-actions__label">${escapeHtml(
                        getLabUserActionDisplayText(actionEvent)
                      )}</span>
                      <small class="labx-process-recent-actions__meta">${escapeHtml(
                        getRecentActionMeta(actionEvent)
                      )}</small>
                    </div>
                  `;
                })
                .join("")}
            </div>
          `
          : `<div class="labx-process-empty">Henüz işlem yok</div>`
      }
    </section>
  `;
}

function renderIdleProcessPanel(state: LabStoreState, sourceReady: boolean): string {
  if (sourceReady !== true) {
    return `
      <section class="labx-process-panel labx-process-panel--empty" id="lab-process-panel">
        <div class="labx-process-empty">Henüz analiz çalışması yok.</div>
        ${renderRecentActionsSection(state)}
      </section>
    `;
  }

  const selectedIntents = getExecutionIntentIds(state);
  return `
    <section class="labx-process-panel" id="lab-process-panel">
      <div class="labx-process-header">
        <div class="labx-process-header__title">
          ${renderStatusChip("Hazır", "neutral")}
          <strong>Analiz akışı</strong>
        </div>
        <div class="labx-process-header__meta">
          <span>${escapeHtml(String(selectedIntents.length))} intent</span>
        </div>
      </div>
      ${renderIntentExecutionMap(state, sourceReady)}
      ${renderIntentOutputTrace(state, sourceReady)}
      ${renderRecentActionsSection(state)}
    </section>
  `;
}

export function renderWorkspaceProcessPanel(
  state: LabStoreState,
  options: { sourceReady: boolean }
) {
  const run = getCurrentRun(state);
  if (!run) {
    return renderIdleProcessPanel(state, options.sourceReady);
  }

  const liveFindings = getVisibleLiveFindings(state);
  const artifacts = getVisibleArtifacts(state);
  const executionIntentIds = getExecutionIntentIds(state);
  const hasMoreFindings = hasMoreVisibleLiveFindings(state);
  const hasMoreArts = hasMoreVisibleArtifacts(state);
  const activeStepId = state.ui.workspace.activeStepPreviewId;
  const elapsedSeconds = getRunElapsedSeconds(state);
  const activeModule = getActiveModule(state);

  const pipelineCollapsed = isProcessSectionCollapsed(state, "pipeline");
  const findingsCollapsed = isProcessSectionCollapsed(state, "findings");
  const artifactsCollapsed = isProcessSectionCollapsed(state, "artifacts");

  const statusTone = getStepTone(run.state);
  const statusLabel =
    run.state === "running"
      ? "Analiz ediliyor"
      : run.state === "completed" || run.state === "ready"
        ? "Tamamlandı"
        : run.state === "failed"
          ? "Hata"
          : run.state === "cancelled"
            ? "İptal"
            : "Sırada";
  const activeModuleLabel = activeModule ? activeModule.title || activeModule.id : null;
  const runIdLabel = (run.id || "").slice(-6) || "—";

  return `
    <section class="labx-process-panel" id="lab-process-panel">
      <div class="labx-process-header">
        <div class="labx-process-header__title">
          ${renderStatusChip(statusLabel, statusTone)}
          <strong>Analiz #${escapeHtml(runIdLabel)}</strong>
        </div>
        ${
          activeModuleLabel
            ? `<div class="labx-process-header__subline">Çalışan modül: ${escapeHtml(activeModuleLabel)}</div>`
            : ""
        }
        <div class="labx-process-header__meta">
          <span>${escapeHtml(String(executionIntentIds.length))} intent</span>
          <span>${escapeHtml(String(Array.isArray(run.moduleOrder) ? run.moduleOrder.length : 0))} adım</span>
          <span>${formatElapsed(elapsedSeconds)}</span>
          ${renderConfidenceGauge(run.confidence)}
        </div>
        ${run.error ? `<div class="labx-process-error">${escapeHtml(run.error)}</div>` : ""}
      </div>
      ${renderRunSnapshotSummary(state)}
      ${renderIntentExecutionMap(state, options.sourceReady)}
      ${renderIntentOutputTrace(state, options.sourceReady)}

      ${renderPipelineSection(run, activeStepId, pipelineCollapsed)}
      ${renderFindingsSection(liveFindings, hasMoreFindings, findingsCollapsed)}
      ${renderArtifactsSection(artifacts, hasMoreArts, artifactsCollapsed)}
      ${renderRecentActionsSection(state)}
    </section>
  `;
}
