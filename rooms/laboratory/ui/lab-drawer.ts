import { escapeHtml } from "../models/lab-types.js";
import type { LabDrawerMode, LabStoreState, LabWorkspaceSurface } from "../models/lab-types.js";
import {
  buildIntentPreviewSentence,
  getActiveExecutionAlternatives,
  getActiveExecutionCandidate,
  getActiveExecutionPayloadPreview,
  getActiveExecutionPlan,
  getActiveExecutionReadiness,
  getAnalysisActionBlockReason,
  getAvailableIntents,
  getDrawerCollapsed,
  getLaboratoryProcessSummary,
  getLaboratoryRightPanelContext,
  getPreflightSeverity,
  getPreflightWarnings,
  getReportFreshness,
  getSelectedIntents,
  getSourceReady,
  getWorkspaceDiff,
  isRunComplete,
  isWorkspaceDirty,
  resolveDrawerMode,
} from "../runtime/lab-selectors.js";
import { buildExecutionBridge } from "../runtime/lab-execution-bridge.js";
import { formatExecutionBridgeAdvisory } from "../runtime/lab-execution-bridge.js";
import { formatDecisionCoherenceAdvisory } from "../runtime/lab-decision-coherence.js";
import { buildExecutionDescriptor } from "../runtime/lab-execution-descriptor.js";
import { formatExecutionReadinessSignalAdvisory } from "../runtime/lab-execution-readiness-signal.js";
import type { LabExecutionReadinessSignal } from "../runtime/lab-execution-readiness-signal.js";
import { LAB_FALLBACK_I18N } from "./lab-i18n.js";
import type { LabI18n } from "./lab-i18n.js";

// ---------------------------------------------------------------------------
// Mode headers
// ---------------------------------------------------------------------------

const MODE_HEADERS: Record<
  LabDrawerMode,
  { eyebrowKey: string; eyebrowFallback: string; titleKey: string; titleFallback: string }
> = {
  setup: {
    eyebrowKey: "mediaAnalysis.drawer.setup.eyebrow",
    eyebrowFallback: "Yapılandırma",
    titleKey: "mediaAnalysis.drawer.setup.title",
    titleFallback: "Analiz Hazırlığı",
  },
  running: {
    eyebrowKey: "mediaAnalysis.drawer.running.eyebrow",
    eyebrowFallback: "Çalışıyor",
    titleKey: "mediaAnalysis.drawer.running.title",
    titleFallback: "Analiz İlerlemesi",
  },
  result: {
    eyebrowKey: "mediaAnalysis.drawer.result.eyebrow",
    eyebrowFallback: "Sonuç",
    titleKey: "mediaAnalysis.drawer.result.title",
    titleFallback: "Karar Yüzeyi",
  },
  explore: {
    eyebrowKey: "mediaAnalysis.drawer.explore.eyebrow",
    eyebrowFallback: "Keşif",
    titleKey: "mediaAnalysis.drawer.explore.title",
    titleFallback: "Alternatifler ve Karşılaştırma",
  },
};

function renderDrawerHeader(mode: LabDrawerMode, copy: LabI18n) {
  const h = MODE_HEADERS[mode];
  return `
    <div class="labx-drawer__header">
      <p class="labx-card__eyebrow">${escapeHtml(copy.t(h.eyebrowKey, h.eyebrowFallback))}</p>
      <h2>${escapeHtml(copy.t(h.titleKey, h.titleFallback))}</h2>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Setup mode
// ---------------------------------------------------------------------------

function renderSetupMode(state: LabStoreState, surface: LabWorkspaceSurface, copy: LabI18n) {
  const sourceReady = getSourceReady(state);
  const intents = getAvailableIntents(state);
  const selectedIntents = getSelectedIntents(state);
  const blockReason = getAnalysisActionBlockReason(state);
  const preflightSeverity = getPreflightSeverity(state);
  const preflightWarnings = getPreflightWarnings(state);
  const previewSentence = buildIntentPreviewSentence(state);

  const intentsMarkup = sourceReady
    ? `<section class="labx-drawer__section labx-drawer__intents">
        <h3>${escapeHtml(copy.t("mediaAnalysis.drawer.setup.intentsTitle", "Analiz Amaçları"))}</h3>
        <div class="labx-drawer__intent-list">
          ${intents
            .map(function (intent) {
              const selected = intent.selected;
              const blocked = intent.readiness === "blocked";
              return `
                <label class="labx-drawer__intent-item" data-blocked="${String(blocked)}">
                  <input
                    type="checkbox"
                    ${selected ? "checked" : ""}
                    ${blocked ? "disabled" : ""}
                    data-lab-action="workspace-intent-toggle"
                    data-lab-value="${escapeHtml(intent.id)}"
                  />
                  <span>${escapeHtml(intent.label)}</span>
                  ${intent.blockReason ? `<small class="labx-drawer__intent-block">${escapeHtml(intent.blockReason)}</small>` : ""}
                </label>
              `;
            })
            .join("")}
        </div>
      </section>`
    : "";

  const preflightSection =
    selectedIntents.length > 0
      ? `<section class="labx-drawer__section labx-drawer__preflight" data-severity="${escapeHtml(preflightSeverity)}">
          <h3>${escapeHtml(copy.t("mediaAnalysis.drawer.setup.preflightTitle", "Ön Kontrol"))}</h3>
          ${
            preflightWarnings.length > 0
              ? `<ul class="labx-drawer__preflight-list">${preflightWarnings
                  .map(function (w) {
                    return `<li>${escapeHtml(w)}</li>`;
                  })
                  .join("")}</ul>`
              : `<p class="labx-drawer__ok">${escapeHtml(copy.t("mediaAnalysis.drawer.setup.preflightOk", "Tüm araçlar hazır"))}</p>`
          }
        </section>`
      : "";

  const previewMarkup =
    previewSentence !== ""
      ? `<p class="labx-drawer__preview">${escapeHtml(previewSentence)}</p>`
      : "";

  const ctaMarkup = `
    <div class="labx-drawer__cta">
      <button
        class="labx-cta"
        type="button"
        data-lab-action="run-deep-analysis"
        ${blockReason !== null ? "disabled" : ""}
        ${blockReason !== null ? `title="${escapeHtml(blockReason)}"` : ""}
      >
        ${escapeHtml(copy.t("mediaAnalysis.drawer.setup.cta", "Analizi Başlat"))}
      </button>
      ${previewMarkup}
      ${preflightSeverity === "warning" ? `<p class="labx-drawer__cta-warn">${escapeHtml(copy.t("mediaAnalysis.drawer.setup.partialWarn", "Bazı araçlar eksik — kısmi sonuç olabilir."))}</p>` : ""}
    </div>
  `;

  const sideControls =
    surface.side.trim() !== ""
      ? `<div class="labx-drawer__side-controls">${surface.side}</div>`
      : "";

  return `${intentsMarkup}${preflightSection}${ctaMarkup}${sideControls}`;
}

// ---------------------------------------------------------------------------
// Running mode
// ---------------------------------------------------------------------------

function renderRunningMode(state: LabStoreState, copy: LabI18n) {
  const summary = getLaboratoryProcessSummary(state);
  const run = state.run;
  const moduleOrder = run?.moduleOrder ?? [];
  const modules = run?.modules ?? {};

  const pipelineMarkup =
    moduleOrder.length > 0
      ? `<section class="labx-drawer__section labx-drawer__pipeline">
        <h3>${escapeHtml(copy.t("mediaAnalysis.drawer.running.pipelineTitle", "Pipeline"))}</h3>
        <ul class="labx-drawer__module-list">
          ${moduleOrder
            .map(function (modId) {
              const mod = modules[modId];
              const status = mod?.status ?? "idle";
              const label = mod?.title ?? modId;
              return `<li class="labx-drawer__module" data-status="${escapeHtml(status)}"><span class="labx-drawer__module-dot" aria-hidden="true"></span>${escapeHtml(label)}</li>`;
            })
            .join("")}
        </ul>
      </section>`
      : "";

  const earlySignals = run?.liveFindings ?? [];
  const earlySignalMarkup =
    earlySignals.length > 0
      ? `<section class="labx-drawer__section labx-drawer__signals">
        <h3>${escapeHtml(copy.t("mediaAnalysis.drawer.running.signalsTitle", "Erken Sinyaller"))}</h3>
        <ul class="labx-drawer__signal-list">
          ${earlySignals
            .slice(0, 8)
            .map(function (f) {
              return `<li class="labx-drawer__signal" data-severity="${escapeHtml(f.severity ?? "info")}"><strong>${escapeHtml(f.title)}</strong><span>${escapeHtml(f.detail)}</span></li>`;
            })
            .join("")}
        </ul>
      </section>`
      : "";

  const taskLabel =
    summary.activeTaskLabel ?? copy.t("mediaAnalysis.drawer.running.task", "Analiz devam ediyor…");
  const progressLabel = summary.progressLabel ?? "";

  const statusMarkup = `
    <section class="labx-drawer__section labx-drawer__status">
      <p class="labx-drawer__task-label">${escapeHtml(taskLabel)}</p>
      ${progressLabel !== "" ? `<p class="labx-drawer__progress-label">${escapeHtml(progressLabel)}</p>` : ""}
    </section>
  `;

  const cancelCta = `
    <div class="labx-drawer__cta">
      <button class="labx-cta labx-cta--danger" type="button" data-lab-action="cancel-analysis">
        ${escapeHtml(copy.t("mediaAnalysis.drawer.running.cancel", "Analizi İptal Et"))}
      </button>
      <p class="labx-drawer__cta-sub">${escapeHtml(copy.t("mediaAnalysis.drawer.running.cancelSub", "Çalışan analiz durdurulacak"))}</p>
    </div>
  `;

  return `${statusMarkup}${pipelineMarkup}${earlySignalMarkup}${cancelCta}`;
}

// ---------------------------------------------------------------------------
// Result mode — Decision Surface
// ---------------------------------------------------------------------------

type DrawerCandidateStatus = "viable" | "unstable" | "not-viable" | null;
type DrawerCommitmentStatus = "inactive" | "committed" | "revoked" | "none" | null;
type DrawerStagingStatus = "staged" | "not-staged" | "none" | null;
type RuntimeLocale = "en" | "tr";

function assertUnhandledDrawerStatus(status: never): never {
  throw new Error(`Unhandled drawer status: ${String(status)}`);
}

function getCandidateAccent(status: DrawerCandidateStatus): string {
  switch (status) {
    case "viable":
      return "success";
    case "unstable":
      return "warning";
    case "not-viable":
      return "error";
    case null:
      return "none";
    default:
      return assertUnhandledDrawerStatus(status);
  }
}

function getRuntimeLocale(copy: LabI18n): RuntimeLocale {
  return copy.locale === "tr" ? "tr" : "en";
}

function getCandidateDisplayLabel(status: DrawerCandidateStatus, copy: LabI18n): string {
  switch (status) {
    case "viable":
      return copy.t("mediaAnalysis.rightContext.status.viable", "Valid");
    case "unstable":
      return copy.t("mediaAnalysis.rightContext.status.unstable", "Unstable");
    case "not-viable":
      return copy.t("mediaAnalysis.rightContext.status.notViable", "Invalid");
    case null:
      return copy.t("mediaAnalysis.rightContext.status.none", "-");
    default:
      return assertUnhandledDrawerStatus(status);
  }
}

function getCommitmentDisplayLabel(status: DrawerCommitmentStatus, copy: LabI18n): string {
  switch (status) {
    case "committed":
      return copy.t("mediaAnalysis.rightContext.status.committed", "Approved");
    case "revoked":
      return copy.t("mediaAnalysis.rightContext.status.revoked", "Revoked");
    case "inactive":
    case "none":
    case null:
      return copy.t("mediaAnalysis.rightContext.status.none", "-");
    default:
      return assertUnhandledDrawerStatus(status);
  }
}

function getStagingDisplayLabel(status: DrawerStagingStatus, copy: LabI18n): string {
  switch (status) {
    case "staged":
      return copy.t("mediaAnalysis.rightContext.status.staged", "Ready");
    case "not-staged":
      return copy.t("mediaAnalysis.rightContext.status.notStaged", "Pending");
    case "none":
    case null:
      return copy.t("mediaAnalysis.rightContext.status.none", "-");
    default:
      return assertUnhandledDrawerStatus(status);
  }
}

function getCommitmentAccent(status: DrawerCommitmentStatus): string {
  if (status === "committed") return "success";
  if (status === "revoked") return "error";
  return "none";
}

function getStagingAccent(status: DrawerStagingStatus): string {
  if (status === "staged") return "success";
  if (status === "not-staged") return "warning";
  return "none";
}

function getCandidateImplication(status: DrawerCandidateStatus, copy: LabI18n): string {
  switch (status) {
    case "viable":
      return copy.t(
        "mediaAnalysis.drawer.result.impl.candidateViable",
        "Yapısal olarak çalıştırılabilir"
      );
    case "unstable":
      return copy.t(
        "mediaAnalysis.drawer.result.impl.candidateUnstable",
        "Yapı eksik \u2014 değerlendirme gerekli"
      );
    case "not-viable":
      return copy.t(
        "mediaAnalysis.drawer.result.impl.candidateNotViable",
        "Geçersiz \u2014 yol revizyonu gerekli"
      );
    case null:
      return copy.t("mediaAnalysis.drawer.result.impl.candidateNone", "Değerlendirme bekleniyor");
    default:
      return assertUnhandledDrawerStatus(status);
  }
}

function getCommitmentImplication(status: DrawerCommitmentStatus, copy: LabI18n): string {
  switch (status) {
    case "committed":
      return copy.t(
        "mediaAnalysis.drawer.result.impl.commitmentCommitted",
        "Yol staging için seçildi"
      );
    case "revoked":
      return copy.t("mediaAnalysis.drawer.result.impl.commitmentRevoked", "Onay geri çekildi");
    case "inactive":
    case "none":
    case null:
      return copy.t("mediaAnalysis.drawer.result.impl.commitmentNone", "Henüz onaylanmış yol yok");
    default:
      return assertUnhandledDrawerStatus(status);
  }
}

function getStagingImplication(status: DrawerStagingStatus, copy: LabI18n): string {
  switch (status) {
    case "staged":
      return copy.t("mediaAnalysis.drawer.result.impl.stagingStaged", "Çalıştırma için hazırlandı");
    case "not-staged":
      return copy.t("mediaAnalysis.drawer.result.impl.stagingNotStaged", "Henüz hazırlanmadı");
    case "none":
    case null:
      return copy.t("mediaAnalysis.drawer.result.impl.stagingNone", "Staging hazırlığı bekleniyor");
    default:
      return assertUnhandledDrawerStatus(status);
  }
}

function getCoherenceState(status: DrawerCandidateStatus): "aligned" | "mixed" | "conflicted" {
  if (status === "viable") return "aligned";
  if (status === "not-viable") return "conflicted";
  return "mixed";
}

function getReadinessSignalLevel(status: string | undefined): LabExecutionReadinessSignal["level"] {
  if (status === "ready") return "steady";
  if (status === "blocked") return "strained";
  return "guarded";
}

function buildReadinessSignalSummary(
  candidate: ReturnType<typeof getActiveExecutionCandidate>,
  readiness: ReturnType<typeof getActiveExecutionReadiness>,
  locale: RuntimeLocale
) {
  if (candidate === null || readiness === null) {
    return null;
  }
  const signal: LabExecutionReadinessSignal = {
    level: getReadinessSignalLevel(readiness.status),
    decisionPressure: candidate.decisionPressure,
    goalOutcome: "neutral",
    patternStrength: "neutral",
    alignment: readiness.status === "ready" ? "matches-simulation" : "partial",
    alternativesConfidenceBand:
      typeof readiness.confidence === "number"
        ? readiness.confidence >= 0.75
          ? "high"
          : readiness.confidence >= 0.45
            ? "medium"
            : "low"
        : "unknown",
    projectionAlignment: "none",
    score: typeof readiness.confidence === "number" ? readiness.confidence : 0,
    reasons: readiness.blockers ?? [],
  };
  return formatExecutionReadinessSignalAdvisory(signal, locale);
}

function renderResultMode(state: LabStoreState, copy: LabI18n) {
  const context = getLaboratoryRightPanelContext(state);
  const runtimeLocale = getRuntimeLocale(copy);
  const freshness = getReportFreshness(state);
  const dirty = isWorkspaceDirty(state);
  const candidate = getActiveExecutionCandidate(state);
  const readiness = getActiveExecutionReadiness(state);
  const plan = getActiveExecutionPlan(state);
  const payloadPreview = getActiveExecutionPayloadPreview(state);
  const bridge =
    plan !== null
      ? buildExecutionBridge(
          buildExecutionDescriptor({
            actionType: plan.actionType,
            executionPayloadPreview: payloadPreview,
            executionPlan: plan,
          })
        )
      : null;
  const coherenceState = getCoherenceState(context.candidateStatus);
  const coherenceSummary =
    candidate !== null
      ? formatDecisionCoherenceAdvisory(
          {
            state: coherenceState,
            dominantAxis: candidate.decisionPressure === "high" ? "safety" : "neutral",
            confidence: typeof candidate.confidence === "number" ? candidate.confidence : 0,
            summary: "",
          },
          runtimeLocale
        )
      : null;
  const readinessSummary = buildReadinessSignalSummary(candidate, readiness, runtimeLocale);
  const bridgeSummary =
    bridge !== null ? formatExecutionBridgeAdvisory(bridge, runtimeLocale) : null;
  const run = state.run;
  const runWarnings = run?.warnings ?? [];

  const warningsBanner =
    runWarnings.length > 0 && isRunComplete(state)
      ? `<div class="labx-drawer__banner labx-drawer__banner--warning">
        <p>${escapeHtml(copy.t("mediaAnalysis.drawer.result.partialWarn", "Analiz tamamlandı ancak bazı modüller uyarı verdi."))}</p>
        <ul>${runWarnings
          .map(function (w) {
            return `<li>${escapeHtml(w)}</li>`;
          })
          .join("")}</ul>
      </div>`
      : "";

  const tier1 = `
    <div class="labx-right-context__tier-1">
      <div class="labx-right-context__item">
        <span>${escapeHtml(copy.t("mediaAnalysis.rightContext.selection", "Selection"))}</span>
        <strong>${escapeHtml(context.selectionRangeLabel ?? copy.t("mediaAnalysis.rightContext.emptySelection", "No active selection"))}</strong>
      </div>
      <div class="labx-right-context__item">
        <span>${escapeHtml(copy.t("mediaAnalysis.rightContext.intent", "Intent"))}</span>
        <strong>${escapeHtml(context.activeIntentLabel ?? copy.t("mediaAnalysis.rightContext.emptyIntent", "No intent selected"))}</strong>
      </div>
    </div>
  `;

  const tier2 = `
    <div class="labx-right-context__tier-2">
      <div class="labx-right-context__decision-card" data-accent="${getCandidateAccent(context.candidateStatus)}" data-decision-card="candidate">
        <span>${escapeHtml(copy.t("mediaAnalysis.rightContext.candidate", "Candidate"))}</span>
        <strong>${escapeHtml(getCandidateDisplayLabel(context.candidateStatus, copy))}</strong>
        <p class="labx-right-context__implication">${escapeHtml(getCandidateImplication(context.candidateStatus, copy))}</p>
      </div>
      <div class="labx-right-context__decision-card" data-accent="${getCommitmentAccent(context.commitmentStatus)}" data-decision-card="commitment">
        <span>${escapeHtml(copy.t("mediaAnalysis.rightContext.commitment", "Commitment"))}</span>
        <strong>${escapeHtml(getCommitmentDisplayLabel(context.commitmentStatus, copy))}</strong>
        <p class="labx-right-context__implication">${escapeHtml(getCommitmentImplication(context.commitmentStatus, copy))}</p>
      </div>
      <div class="labx-right-context__decision-card" data-accent="${getStagingAccent(context.stagingStatus)}" data-decision-card="staging">
        <span>${escapeHtml(copy.t("mediaAnalysis.rightContext.staging", "Staging"))}</span>
        <strong>${escapeHtml(getStagingDisplayLabel(context.stagingStatus, copy))}</strong>
        <p class="labx-right-context__implication">${escapeHtml(getStagingImplication(context.stagingStatus, copy))}</p>
      </div>
    </div>
  `;

  const coherenceSection =
    candidate !== null
      ? `<details class="labx-drawer__advisory-details"${coherenceState === "conflicted" ? " open" : ""}>
        <summary>${escapeHtml(coherenceSummary ?? candidate.summary)}</summary>
        <div class="labx-drawer__advisory-body">
          <p><strong>${escapeHtml(copy.t("mediaAnalysis.drawer.result.coherenceState", "State"))}</strong> ${escapeHtml(coherenceState)}</p>
          <p><strong>${escapeHtml(copy.t("mediaAnalysis.drawer.result.coherenceAxis", "Dominant axis"))}</strong> ${escapeHtml(candidate.decisionPressure === "high" ? "safety" : "neutral")}</p>
          <p><strong>${escapeHtml(copy.t("mediaAnalysis.drawer.result.coherenceIntegrity", "Yapısal Bütünlük"))}</strong> ${escapeHtml(candidate.structuralIntegrity)}</p>
          ${typeof candidate.confidence === "number" ? `<p><strong>${escapeHtml(copy.t("mediaAnalysis.drawer.result.coherenceConfidence", "Güven"))}</strong> ${String(Math.round(candidate.confidence * 100))}%</p>` : ""}
          <div class="labx-drawer__polarity-bar" data-polarity="${escapeHtml(coherenceState)}">
            <div class="labx-drawer__polarity-fill" style="width:${String(typeof candidate.confidence === "number" ? Math.round(candidate.confidence * 100) : 50)}%"></div>
          </div>
        </div>
      </details>`
      : "";

  const readinessSection =
    readiness !== null
      ? `<details class="labx-drawer__advisory-details"${getReadinessSignalLevel(readiness.status) === "strained" ? " open" : ""}>
        <summary>${escapeHtml(readinessSummary ?? readiness.summary)}</summary>
        <div class="labx-drawer__advisory-body">
          <p><strong>${escapeHtml(copy.t("mediaAnalysis.drawer.result.readinessLevel", "Seviye"))}</strong> ${escapeHtml(readiness.status)}</p>
          ${candidate !== null ? `<p><strong>${escapeHtml(copy.t("mediaAnalysis.drawer.result.readinessPressure", "Decision pressure"))}</strong> ${escapeHtml(candidate.decisionPressure)}</p>` : ""}
          ${typeof readiness.confidence === "number" ? `<p><strong>${escapeHtml(copy.t("mediaAnalysis.drawer.result.readinessConfidence", "Güven"))}</strong> ${String(Math.round(readiness.confidence * 100))}%</p>` : ""}
          ${
            (readiness.blockers ?? []).length > 0
              ? `<ul>${(readiness.blockers ?? [])
                  .map(function (b) {
                    return `<li>${escapeHtml(b)}</li>`;
                  })
                  .join("")}</ul>`
              : ""
          }
        </div>
      </details>`
      : "";

  const bridgeSection =
    bridge !== null
      ? `<details class="labx-drawer__advisory-details">
        <summary>${escapeHtml(bridgeSummary ?? plan?.title ?? bridge.summary)}</summary>
        <div class="labx-drawer__advisory-body">
          <p><strong>${escapeHtml(copy.t("mediaAnalysis.drawer.result.bridgeAdapter", "Adapter"))}</strong> ${escapeHtml(bridge.adapter)}</p>
          <p><strong>${escapeHtml(copy.t("mediaAnalysis.drawer.result.bridgeOperation", "Operation"))}</strong> ${escapeHtml(bridge.operation)}</p>
          <p><strong>${escapeHtml(copy.t("mediaAnalysis.drawer.result.bridgeRequired", "Required"))}</strong> ${escapeHtml(bridge.inputContract.required.join(", ") || "general")}</p>
          <p><strong>${escapeHtml(copy.t("mediaAnalysis.drawer.result.bridgeOutput", "Output"))}</strong> ${escapeHtml(bridge.outputContract.type)}</p>
        </div>
      </details>`
      : "";

  const advisories =
    coherenceSection !== "" || readinessSection !== "" || bridgeSection !== ""
      ? `<section class="labx-drawer__section labx-drawer__advisories">
        <h3>${escapeHtml(copy.t("mediaAnalysis.drawer.result.advisoriesTitle", "Değerlendirmeler"))}</h3>
        ${coherenceSection}${readinessSection}${bridgeSection}
      </section>`
      : "";

  const freshnessLabel =
    freshness?.state === "current"
      ? copy.t("mediaAnalysis.drawer.result.fresh", "Güncel")
      : freshness?.state === "stale"
        ? copy.t("mediaAnalysis.drawer.result.stale", "Eski")
        : "";
  const dirtyBadge = dirty
    ? `<span class="labx-drawer__dirty-badge">${escapeHtml(copy.t("mediaAnalysis.drawer.result.dirty", "Workspace farklı"))}</span>`
    : "";

  const reportCta = `
    <div class="labx-drawer__cta">
      <button class="labx-cta" type="button" data-lab-action="open-report-overlay">
        ${escapeHtml(copy.t("mediaAnalysis.drawer.result.reportCta", "Raporu Görüntüle"))}
      </button>
      ${freshnessLabel !== "" ? `<p class="labx-drawer__cta-sub">${escapeHtml(freshnessLabel)} ${dirtyBadge}</p>` : dirtyBadge}
    </div>
  `;

  const exploreCta = `
    <button class="labx-drawer__explore-toggle" type="button" data-lab-action="drawer-explore-toggled">
      ${escapeHtml(copy.t("mediaAnalysis.drawer.result.explore", "Keşif Moduna Geç"))}
    </button>
  `;

  return `${warningsBanner}${tier1}${tier2}${advisories}${reportCta}${exploreCta}`;
}

// ---------------------------------------------------------------------------
// Explore mode
// ---------------------------------------------------------------------------

function renderExploreMode(state: LabStoreState, copy: LabI18n) {
  const diff = getWorkspaceDiff(state);
  const changedKeys = diff?.changedKeys ?? [];
  const alternatives = getActiveExecutionAlternatives(state);

  const comparisonMarkup =
    changedKeys.length > 0
      ? `<section class="labx-drawer__section labx-drawer__comparison">
        <h3>${escapeHtml(copy.t("mediaAnalysis.drawer.explore.comparisonTitle", "Değişiklikler"))}</h3>
        <ul>${changedKeys
          .map(function (k) {
            return `<li>${escapeHtml(k)}</li>`;
          })
          .join("")}</ul>
      </section>`
      : `<section class="labx-drawer__section"><p>${escapeHtml(copy.t("mediaAnalysis.drawer.explore.noDiff", "Parametrelerde değişiklik yok"))}</p></section>`;

  const run = state.run;
  const emptyReason = run?.emptyReason;
  const warningBanner = emptyReason
    ? `<div class="labx-drawer__banner labx-drawer__banner--warning">${escapeHtml(emptyReason)}</div>`
    : "";

  const runWarnings = run?.warnings ?? [];
  const warningsMarkup =
    runWarnings.length > 0
      ? `<div class="labx-drawer__banner labx-drawer__banner--info">
        <p>${escapeHtml(copy.t("mediaAnalysis.drawer.explore.partialWarn", "Analiz tamamlandı ancak bazı modüller uyarı verdi."))}</p>
        <ul>${runWarnings
          .map(function (w) {
            return `<li>${escapeHtml(w)}</li>`;
          })
          .join("")}</ul>
      </div>`
      : "";

  const alternativesMarkup =
    alternatives !== null && alternatives.alternatives.length > 0
      ? `<section class="labx-drawer__section labx-drawer__alternatives" data-lab-drawer-alternatives="true">
          <h3>${escapeHtml(copy.t("mediaAnalysis.drawer.explore.alternativesTitle", "Alternatifler"))}</h3>
          <p>${escapeHtml(alternatives.summary)}</p>
          <ul>
            ${alternatives.alternatives
              .map(function (alternative) {
                return `<li><strong>${escapeHtml(alternative.label)}</strong><span>${escapeHtml(alternative.tradeoff)}</span></li>`;
              })
              .join("")}
          </ul>
          ${alternatives.comparisonNote ? `<p>${escapeHtml(alternatives.comparisonNote)}</p>` : ""}
        </section>`
      : "";

  const reanalyzeCta = `
    <div class="labx-drawer__cta">
      <button class="labx-cta" type="button" data-lab-action="run-deep-analysis">
        ${escapeHtml(copy.t("mediaAnalysis.drawer.explore.reanalyze", "Tekrar Analiz Et"))}
      </button>
      <p class="labx-drawer__cta-sub">${escapeHtml(copy.t("mediaAnalysis.drawer.explore.reanalyzeSub", "Güncel parametrelerle yeni analiz başlat"))}</p>
    </div>
  `;

  const backToggle = `
    <button class="labx-drawer__explore-toggle" type="button" data-lab-action="drawer-explore-toggled">
      ${escapeHtml(copy.t("mediaAnalysis.drawer.explore.backToResult", "Sonuç Moduna Dön"))}
    </button>
  `;

  return `${warningBanner}${warningsMarkup}${comparisonMarkup}${alternativesMarkup}${reanalyzeCta}${backToggle}`;
}

// ---------------------------------------------------------------------------
// Skeleton (loading)
// ---------------------------------------------------------------------------

function renderDrawerSkeleton() {
  return `
    <div class="labx-drawer-skeleton">
      <div class="labx-skeleton-block" style="height: 2.5rem"></div>
      <div class="labx-skeleton-block" style="height: 8rem"></div>
      <div class="labx-skeleton-block" style="height: 3rem"></div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Public render
// ---------------------------------------------------------------------------

export function renderLabDrawer(
  state: LabStoreState,
  surface: LabWorkspaceSurface,
  copy: LabI18n = LAB_FALLBACK_I18N
) {
  const collapsed = getDrawerCollapsed(state);
  const mode = resolveDrawerMode(state);

  if (collapsed) {
    return "";
  }

  if (!state.bootReady) {
    return `
      <aside class="labx-drawer" data-drawer-mode="${escapeHtml(mode)}">
        ${renderDrawerHeader(mode, copy)}
        ${renderDrawerSkeleton()}
      </aside>
    `;
  }

  let modeContent: string;
  switch (mode) {
    case "setup":
      modeContent = renderSetupMode(state, surface, copy);
      break;
    case "running":
      modeContent = renderRunningMode(state, copy);
      break;
    case "result":
      modeContent = renderResultMode(state, copy);
      break;
    case "explore":
      modeContent = renderExploreMode(state, copy);
      break;
    default:
      modeContent = "";
  }

  return `
    <aside class="labx-drawer" data-drawer-mode="${escapeHtml(mode)}">
      ${renderDrawerHeader(mode, copy)}
      <div class="labx-drawer__body">
        ${modeContent}
      </div>
    </aside>
  `;
}
