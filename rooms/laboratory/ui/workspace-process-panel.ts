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
  getActionOutputs,
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
import {
  getLabUserActionDisplayText,
  getLabUserActionOutputLabel,
  getLabUserActionPrimaryOutput,
} from "../runtime/lab-user-actions.js";
import { renderArtifactItem } from "./components/artifact-item.js";
import { buildLabAssetMetadataTitle } from "./lab-asset-display.js";
import { renderStatusChip } from "./components/status-chip.js";
import { LAB_FALLBACK_I18N } from "./lab-i18n.js";
import type { LabI18n } from "./lab-i18n.js";
import { formatLabExpectedOutputLabel, translateLabRuntimeText } from "./lab-runtime-i18n.js";

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

function getModuleStatusLabel(status: string, copy: LabI18n = LAB_FALLBACK_I18N) {
  switch (status) {
    case "running":
      return copy.t("mediaAnalysis.processPanel.status.running", "Çalışıyor");
    case "completed":
    case "ready":
      return copy.t("mediaAnalysis.processPanel.status.completed", "Tamamlandı");
    case "failed":
      return copy.t("mediaAnalysis.processPanel.status.failed", "Tamamlanamadı");
    case "queued":
      return copy.t("mediaAnalysis.processPanel.status.queued", "Bekliyor");
    case "skipped":
      return copy.t("mediaAnalysis.processPanel.status.skipped", "Atlandı");
    case "cancelled":
      return copy.t("mediaAnalysis.processPanel.status.cancelled", "İptal edildi");
    default:
      return copy.t("mediaAnalysis.processPanel.status.pending", "Bekleniyor");
  }
}

function getModuleStatusTooltip(status: string, copy: LabI18n = LAB_FALLBACK_I18N) {
  return status === "failed"
    ? copy.t(
        "mediaAnalysis.processPanel.statusTooltips.failed",
        "Bu modül çalışmadı, diğerleri devam ediyor"
      )
    : "";
}

function formatElapsed(seconds: number, copy: LabI18n = LAB_FALLBACK_I18N): string {
  if (seconds < 60) {
    return copy.t("mediaAnalysis.processPanel.time.seconds", "{value} sn", { value: seconds });
  }
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return copy.t("mediaAnalysis.processPanel.time.minutes", "{minutes} dk {seconds} sn", {
    minutes: m,
    seconds: String(s).padStart(2, "0"),
  });
}

function formatRelativeActionTime(
  timestamp: number | undefined,
  copy: LabI18n = LAB_FALLBACK_I18N
) {
  if (typeof timestamp !== "number" || Number.isFinite(timestamp) !== true) {
    return copy.t("mediaAnalysis.processPanel.time.justNow", "az önce");
  }
  const diffMs = Math.max(0, Date.now() - timestamp);
  const diffSeconds = Math.max(1, Math.round(diffMs / 1000));
  if (diffSeconds < 60) {
    return copy.t("mediaAnalysis.processPanel.time.secondsAgo", "{value} sn önce", {
      value: diffSeconds,
    });
  }
  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) {
    return copy.t("mediaAnalysis.processPanel.time.minutesAgo", "{value} dk önce", {
      value: diffMinutes,
    });
  }
  const diffHours = Math.round(diffMinutes / 60);
  return copy.t("mediaAnalysis.processPanel.time.hoursAgo", "{value} sa önce", {
    value: diffHours,
  });
}

function getRecentActionMeta(actionEvent: LabUserActionEvent, copy: LabI18n = LAB_FALLBACK_I18N) {
  if (actionEvent.status === "running") {
    return copy.t("mediaAnalysis.processPanel.recent.running", "devam ediyor");
  }
  return formatRelativeActionTime(actionEvent.finishedAt || actionEvent.startedAt, copy);
}

function renderConfidenceGauge(confidence: string | null, copy: LabI18n = LAB_FALLBACK_I18N) {
  if (!confidence) {
    return "";
  }
  const level = confidence === "high" ? "high" : confidence === "medium" ? "medium" : "low";
  const label = copy.t(
    `mediaAnalysis.processPanel.confidence.${level}`,
    level === "high" ? "Yüksek" : level === "medium" ? "Orta" : "Düşük"
  );
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

function formatDiffLabel(
  key: "timeline" | "hypothesis" | "intents",
  copy: LabI18n = LAB_FALLBACK_I18N
): string {
  switch (key) {
    case "timeline":
      return copy.t("mediaAnalysis.processPanel.diff.timeline", "Timeline");
    case "hypothesis":
      return copy.t("mediaAnalysis.processPanel.diff.hypothesis", "Hypothesis");
    case "intents":
      return copy.t("mediaAnalysis.processPanel.diff.intents", "Intents");
    default:
      return key;
  }
}

function getCapabilityLabel(
  capabilityId: CapabilityFamilyId,
  copy: LabI18n = LAB_FALLBACK_I18N
): string {
  const fallback =
    CAPABILITY_FAMILIES.find(function (entry) {
      return entry.id === capabilityId;
    })?.label || capabilityId;
  return copy.t(`mediaAnalysis.capabilities.${capabilityId}.label`, fallback);
}

function getProcessIntentLabel(intentId: string, copy: LabI18n = LAB_FALLBACK_I18N): string {
  return copy.t(`mediaAnalysis.workspace.intents.${intentId}.label`, getIntentLabel(intentId));
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
  resolvedCapabilities: CapabilityFamilyId[],
  copy: LabI18n = LAB_FALLBACK_I18N
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
    return `<div class="labx-process-empty">${escapeHtml(
      run
        ? copy.t("mediaAnalysis.processPanel.empty.moduleWaiting", "Modül bekleniyor")
        : copy.t("mediaAnalysis.processPanel.empty.noModulePlan", "Modül planı yok")
    )}</div>`;
  }
  return moduleRows
    .map(function (moduleRow) {
      const moduleStatus = moduleRow.status;
      const tooltip = run ? getModuleStatusTooltip(moduleStatus, copy) : "";
      return `
        <div class="labx-intent-map__module">
          <span class="labx-intent-map__module-name">${escapeHtml(moduleRow.label)}</span>
          <strong class="labx-intent-map__module-status" data-tone="${escapeHtml(getStepTone(moduleStatus))}" ${tooltip ? `title="${escapeHtml(tooltip)}"` : ""}>${escapeHtml(getModuleStatusLabel(moduleStatus, copy))}</strong>
        </div>
      `;
    })
    .join("");
}

function renderIntentExecutionMap(
  state: LabStoreState,
  sourceReady: boolean,
  copy: LabI18n = LAB_FALLBACK_I18N
): string {
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
          <strong>${escapeHtml(copy.t("mediaAnalysis.processPanel.executionMap.title", "Intent → Execution Map"))}</strong>
        </div>
        <div class="labx-process-empty">${escapeHtml(copy.t("mediaAnalysis.processPanel.empty.noExecution", "Henüz yürütme yok"))}</div>
      </section>
    `;
  }

  if (intentIds.length === 0 || resolvedCapabilities.length === 0) {
    return `
      <section class="labx-intent-map">
        <div class="labx-intent-map__head">
          <strong>${escapeHtml(copy.t("mediaAnalysis.processPanel.executionMap.title", "Intent → Execution Map"))}</strong>
        </div>
        <div class="labx-process-empty">${escapeHtml(copy.t("mediaAnalysis.processPanel.empty.noIntentSelection", "Intent seçimi yok"))}</div>
      </section>
    `;
  }

  const dirtyMap = getIntentDirtyMap(state);
  return `
      <section class="labx-intent-map">
        <div class="labx-intent-map__head">
          <strong>${escapeHtml(copy.t("mediaAnalysis.processPanel.executionMap.title", "Intent → Execution Map"))}</strong>
        </div>
        ${!run ? `<div class="labx-process-empty">${escapeHtml(copy.t("mediaAnalysis.processPanel.empty.noExecution", "Henüz yürütme yok"))}</div>` : ""}
        <div class="labx-intent-map__body">
        ${intentIds
          .map(function (intentId) {
            const capabilityIds = getCapabilityIdsForIntent(intentId, resolvedCapabilities);
            const dirtyState = (dirtyMap as Partial<Record<LabIntentId, LabIntentDirtyState>>)[
              intentId
            ];
            const dirtyHint =
              dirtyState && dirtyState.dirty
                ? `<span class="labx-intent-map__hint">${escapeHtml(copy.t("mediaAnalysis.processPanel.executionMap.liveDrift", "Live drift"))}: ${escapeHtml(dirtyState.changedKeys.join(", "))}</span>`
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
                        resolvedCapabilities,
                        copy
                      );
                      return `
                        <div class="labx-intent-map__capability">
                          <div class="labx-intent-map__capability-head">
                            <span>${escapeHtml(getCapabilityLabel(capabilityId, copy))}</span>
                            ${renderStatusChip(getModuleStatusLabel(capabilityStatus, copy), getStepTone(capabilityStatus))}
                          </div>
                          <div class="labx-intent-map__modules">${moduleRows}</div>
                        </div>
                      `;
                    })
                    .join("")
                : `<div class="labx-process-empty">${escapeHtml(copy.t("mediaAnalysis.processPanel.empty.noCapabilityMatch", "Yetenek eşleşmesi yok"))}</div>`;
            return `
              <article class="labx-intent-map__intent">
                <div class="labx-intent-map__intent-head">
                  <strong>${escapeHtml(getProcessIntentLabel(intentId, copy))}</strong>
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

function renderIntentOutputTrace(
  state: LabStoreState,
  sourceReady: boolean,
  copy: LabI18n = LAB_FALLBACK_I18N
): string {
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
        <strong>${escapeHtml(copy.t("mediaAnalysis.processPanel.outputTrace.title", "INTENT OUTPUT TRACE"))}</strong>
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
	                          <span>${escapeHtml(formatLabExpectedOutputLabel(expectedOutput, copy))}</span>
                        </div>
                      `;
                    })
                    .join("")
                : `<div class="labx-output-trace__empty">${escapeHtml(copy.t("mediaAnalysis.processPanel.outputTrace.noExpected", "Bu intent için beklenen çıktı tanımı yok"))}</div>`;
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
                : `<div class="labx-output-trace__empty">${escapeHtml(copy.t("mediaAnalysis.processPanel.outputTrace.noActual", "Bu intent herhangi bir çıktı üretmedi"))}</div>`;

            return `
              <article class="labx-output-trace__intent">
                <div class="labx-output-trace__intent-head">
                  <strong>${escapeHtml(getProcessIntentLabel(intentId, copy))}</strong>
                </div>
                <div class="labx-output-trace__group">
                  <span class="labx-output-trace__label">${escapeHtml(copy.t("mediaAnalysis.processPanel.outputTrace.expected", "Beklenen:"))}</span>
                  <div class="labx-output-trace__rows">${expectedHtml}</div>
                </div>
                <div class="labx-output-trace__group">
                  <span class="labx-output-trace__label">${escapeHtml(copy.t("mediaAnalysis.processPanel.outputTrace.actual", "Üretilen:"))}</span>
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

function renderRunSnapshotSummary(state: LabStoreState, copy: LabI18n = LAB_FALLBACK_I18N): string {
  const snapshotSummary = getRunSnapshotSummary(state);
  if (!snapshotSummary) {
    return "";
  }

  const workspaceDiff = getWorkspaceDiff(state);
  const timelineSummary =
    snapshotSummary.timelineStartMs !== null || snapshotSummary.timelineEndMs !== null
      ? `${formatTimelineMs(snapshotSummary.timelineStartMs)} - ${formatTimelineMs(snapshotSummary.timelineEndMs)}`
      : copy.t("mediaAnalysis.processPanel.snapshot.fullSource", "Full source");
  const intentSummary =
    snapshotSummary.intentIds.length > 0
      ? snapshotSummary.intentIds
          .map((intentId) => getProcessIntentLabel(intentId, copy))
          .join(", ")
      : copy.t("mediaAnalysis.processPanel.snapshot.noIntent", "No intent snapshot");
  const diffBadges =
    workspaceDiff && workspaceDiff.changedKeys.length > 0
      ? `<div class="labx-workspace-diff-badges">${workspaceDiff.changedKeys
          .map(function (key) {
            return `<span class="labx-workspace-diff-badge">${escapeHtml(formatDiffLabel(key, copy))}</span>`;
          })
          .join("")}</div>`
      : "";
  const hypothesisHtml = snapshotSummary.hypothesis
    ? `<p class="labx-process-snapshot__hypothesis">${escapeHtml(snapshotSummary.hypothesis)}</p>`
    : "";
  const diffHint =
    workspaceDiff && workspaceDiff.workspaceDirty
      ? `<p class="labx-workspace-diff-hint">${escapeHtml(copy.t("mediaAnalysis.processPanel.snapshot.liveWorkspaceChanged", "Live workspace changed in {keys}. Snapshot stays frozen for this run.", { keys: workspaceDiff.changedKeys.map((key) => formatDiffLabel(key, copy)).join(", ") }))}</p>`
      : `<p class="labx-workspace-diff-hint">${escapeHtml(copy.t("mediaAnalysis.processPanel.snapshot.frozen", "Snapshot stays frozen for this run."))}</p>`;

  return `
    <section class="labx-process-snapshot">
      <div class="labx-process-snapshot__head">
        <strong>${escapeHtml(copy.t("mediaAnalysis.processPanel.snapshot.title", "Run Snapshot"))}</strong>
        ${diffBadges}
      </div>
      <div class="labx-process-snapshot__grid">
        <div class="labx-process-snapshot__item">
          <span>${escapeHtml(copy.t("mediaAnalysis.processPanel.snapshot.focus", "Focus"))}</span>
          <strong>${escapeHtml(snapshotSummary.focus || copy.t("mediaAnalysis.processPanel.snapshot.unspecified", "Unspecified"))}</strong>
        </div>
        <div class="labx-process-snapshot__item">
          <span>${escapeHtml(copy.t("mediaAnalysis.processPanel.snapshot.timeline", "Timeline"))}</span>
          <strong>${escapeHtml(timelineSummary)}</strong>
        </div>
        <div class="labx-process-snapshot__item">
          <span>${escapeHtml(copy.t("mediaAnalysis.processPanel.snapshot.intents", "Intents"))}</span>
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
  collapsed: boolean,
  copy: LabI18n = LAB_FALLBACK_I18N
) {
  const moduleOrder = Array.isArray(run.moduleOrder) ? run.moduleOrder : [];
  if (moduleOrder.length === 0) {
    return `<div class="labx-process-empty">${escapeHtml(copy.t("mediaAnalysis.processPanel.empty.pipelineResolving", "Pipeline resolving..."))}</div>`;
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
        <span class="labx-process-progress__label">${escapeHtml(copy.t("mediaAnalysis.processPanel.progressLabel", "{completed}/{total} adım · {percent}%", { completed: completedCount, total: totalCount, percent: progressPct }))}</span>
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
            const tooltip = getModuleStatusTooltip(mod.status, copy);
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
	                  <small>${escapeHtml(mod.message ? translateLabRuntimeText(mod.message, copy) : getModuleStatusLabel(mod.status, copy))}</small>
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
      ${renderSectionHeader("pipeline", copy.t("mediaAnalysis.processPanel.sections.pipeline", "Pipeline"), moduleOrder.length, collapsed)}
      ${collapsed ? "" : bodyHtml}
    </div>
  `;
}

function renderFindingsSection(
  liveFindings: ReturnType<typeof getVisibleLiveFindings>,
  hasMore: boolean,
  collapsed: boolean,
  copy: LabI18n = LAB_FALLBACK_I18N
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
          : `<div class="labx-process-empty">${escapeHtml(copy.t("mediaAnalysis.processPanel.empty.noFindings", "Bulgu yok"))}</div>`
      }
      ${hasMore ? `<button class="labx-inline-action labx-inline-action--small" type="button" data-lab-action="toggle-live-findings">${escapeHtml(copy.t("mediaAnalysis.processPanel.actions.more", "Daha fazla"))}</button>` : ""}
    </div>
  `;

  return `
    <div class="labx-process-section" data-collapsed="${collapsed ? "true" : "false"}">
      ${renderSectionHeader("findings", copy.t("mediaAnalysis.processPanel.sections.findings", "Bulgular"), Array.isArray(liveFindings) ? liveFindings.length : 0, collapsed)}
      ${collapsed ? "" : bodyHtml}
    </div>
  `;
}

function renderArtifactsSection(
  artifacts: ReturnType<typeof getVisibleArtifacts>,
  hasMore: boolean,
  collapsed: boolean,
  copy: LabI18n = LAB_FALLBACK_I18N
) {
  const visibleArtifacts = Array.isArray(artifacts) ? artifacts.slice(0, 4) : [];
  const bodyHtml = `
    <div class="labx-process-section__body">
      ${
        visibleArtifacts.length > 0
          ? visibleArtifacts.map((artifact) => renderArtifactItem(artifact, copy)).join("")
          : `<div class="labx-process-empty">${escapeHtml(copy.t("mediaAnalysis.processPanel.empty.noArtifacts", "Artefakt yok"))}</div>`
      }
      ${hasMore ? `<button class="labx-inline-action labx-inline-action--small" type="button" data-lab-action="show-more-artifacts">${escapeHtml(copy.t("mediaAnalysis.processPanel.actions.more", "Daha fazla"))}</button>` : ""}
    </div>
  `;

  return `
    <div class="labx-process-section" data-collapsed="${collapsed ? "true" : "false"}">
      ${renderSectionHeader("artifacts", copy.t("mediaAnalysis.processPanel.sections.artifacts", "Artefaktlar"), Array.isArray(artifacts) ? artifacts.length : 0, collapsed)}
      ${collapsed ? "" : bodyHtml}
    </div>
  `;
}

function renderRecentActionsSection(state: LabStoreState, copy: LabI18n = LAB_FALLBACK_I18N) {
  const CAP = 3;
  const allActions = getRecentUserActions(state, 10);
  const recentActions = allActions.slice(0, CAP);
  const hasMore = allActions.length > CAP;
  return `
    <section class="labx-process-recent-actions">
      <div class="labx-process-recent-actions__head">
        <strong>${escapeHtml(copy.t("mediaAnalysis.processPanel.recent.title", "Son işlemler"))}</strong>
        ${hasMore ? `<button class="labx-inline-action labx-inline-action--small" type="button" data-lab-action="show-all-recent-actions">${escapeHtml(copy.t("mediaAnalysis.processPanel.recent.showAll", "Tümü"))}</button>` : ""}
      </div>
      ${
        recentActions.length > 0
          ? `
            <div class="labx-process-recent-actions__list">
              ${recentActions
                .map(function (actionEvent) {
                  const outputs = getActionOutputs(state, actionEvent.id);
                  const primaryOutput = getLabUserActionPrimaryOutput(outputs);
                  const outputLabel = getLabUserActionOutputLabel(outputs);
                  return `
                    <div
                      class="labx-process-recent-actions__item"
                      data-tone="${escapeHtml(actionEvent.status)}"
                    >
                      <span class="labx-process-recent-actions__copy">
                        <span class="labx-process-recent-actions__label">${escapeHtml(
                          getLabUserActionDisplayText(actionEvent)
                        )}</span>
                        ${
                          actionEvent.status === "success" &&
                          primaryOutput !== null &&
                          outputLabel !== null
                            ? `
                              <button
                                class="labx-process-recent-actions__result"
                                type="button"
                                data-lab-action="asset-preview"
                                data-lab-value="${escapeHtml(primaryOutput.id)}"
                                title="${escapeHtml(buildLabAssetMetadataTitle(primaryOutput))}"
                              >
                                &rarr; ${escapeHtml(outputLabel)}
                              </button>
                            `
                            : ""
                        }
                      </span>
                      <small class="labx-process-recent-actions__meta">${escapeHtml(
                        getRecentActionMeta(actionEvent, copy)
                      )}</small>
                    </div>
                  `;
                })
                .join("")}
            </div>
          `
          : `<div class="labx-process-empty">${escapeHtml(copy.t("mediaAnalysis.processPanel.empty.noRecentActions", "Henüz işlem yok"))}</div>`
      }
    </section>
  `;
}

function renderIdleProcessPanel(
  state: LabStoreState,
  sourceReady: boolean,
  copy: LabI18n = LAB_FALLBACK_I18N
): string {
  if (sourceReady !== true) {
    return `
      <section class="labx-process-panel labx-process-panel--empty" id="lab-process-panel">
        <div class="labx-process-idle-skeleton">
          ${renderStatusChip(copy.t("mediaAnalysis.processPanel.status.waiting", "Waiting"), "neutral")}
        </div>
        <p class="labx-process-idle-hint">${escapeHtml(copy.t("mediaAnalysis.processPanel.idleHint", "Load a source to begin analysis."))}</p>
        ${renderRecentActionsSection(state, copy)}
      </section>
    `;
  }

  const selectedIntents = getExecutionIntentIds(state);
  return `
    <section class="labx-process-panel" id="lab-process-panel">
      <div class="labx-process-header">
        <div class="labx-process-header__title">
          ${renderStatusChip(copy.t("mediaAnalysis.processPanel.status.ready", "Hazır"), "neutral")}
          <strong>${escapeHtml(copy.t("mediaAnalysis.processPanel.idleTitle", "Analiz akışı"))}</strong>
        </div>
        <div class="labx-process-header__meta">
          <span>${escapeHtml(copy.t("mediaAnalysis.processPanel.intentCount", "{count} intent", { count: selectedIntents.length }))}</span>
        </div>
      </div>
      ${renderIntentExecutionMap(state, sourceReady, copy)}
      ${renderIntentOutputTrace(state, sourceReady, copy)}
      ${renderRecentActionsSection(state, copy)}
    </section>
  `;
}

export function renderWorkspaceProcessPanel(
  state: LabStoreState,
  options: { copy?: LabI18n; sourceReady: boolean }
) {
  const copy = options.copy ?? LAB_FALLBACK_I18N;
  const run = getCurrentRun(state);
  if (!run) {
    return renderIdleProcessPanel(state, options.sourceReady, copy);
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
      ? copy.t("mediaAnalysis.processPanel.runStatus.analyzing", "Analiz ediliyor")
      : run.state === "completed" || run.state === "ready"
        ? copy.t("mediaAnalysis.processPanel.runStatus.completed", "Tamamlandı")
        : run.state === "failed"
          ? copy.t("mediaAnalysis.processPanel.runStatus.failed", "Hata")
          : run.state === "cancelled"
            ? copy.t("mediaAnalysis.processPanel.runStatus.cancelled", "İptal")
            : copy.t("mediaAnalysis.processPanel.runStatus.queued", "Sırada");
  const activeModuleLabel = activeModule ? activeModule.title || activeModule.id : null;
  const runIdLabel = (run.id || "").slice(-6) || "—";

  return `
    <section class="labx-process-panel" id="lab-process-panel">
      <div class="labx-process-header">
        <div class="labx-process-header__title">
          ${renderStatusChip(statusLabel, statusTone)}
          <strong>${escapeHtml(copy.t("mediaAnalysis.processPanel.runTitle", "Analiz #{id}", { id: runIdLabel }))}</strong>
        </div>
        ${
          activeModuleLabel
            ? `<div class="labx-process-header__subline">${escapeHtml(copy.t("mediaAnalysis.processPanel.activeModule", "Çalışan modül: {module}", { module: activeModuleLabel }))}</div>`
            : ""
        }
        <div class="labx-process-header__meta">
          <span>${escapeHtml(copy.t("mediaAnalysis.processPanel.intentCount", "{count} intent", { count: executionIntentIds.length }))}</span>
          <span>${escapeHtml(copy.t("mediaAnalysis.processPanel.stepCount", "{count} adım", { count: Array.isArray(run.moduleOrder) ? run.moduleOrder.length : 0 }))}</span>
          <span>${escapeHtml(formatElapsed(elapsedSeconds, copy))}</span>
          ${renderConfidenceGauge(run.confidence, copy)}
        </div>
        ${run.error ? `<div class="labx-process-error">${escapeHtml(run.error)}</div>` : ""}
      </div>
      ${renderRunSnapshotSummary(state, copy)}
      ${renderIntentExecutionMap(state, options.sourceReady, copy)}
      ${renderIntentOutputTrace(state, options.sourceReady, copy)}

      ${renderPipelineSection(run, activeStepId, pipelineCollapsed, copy)}
      ${renderFindingsSection(liveFindings, hasMoreFindings, findingsCollapsed, copy)}
      ${renderArtifactsSection(artifacts, hasMoreArts, artifactsCollapsed, copy)}
      ${renderRecentActionsSection(state, copy)}
    </section>
  `;
}
