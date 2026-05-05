import { escapeHtml } from "../models/lab-types.js";
import type { LabPipelineBlock, LabStoreState } from "../models/lab-types.js";
import {
  getActiveExecutionAlternatives,
  getActiveExecutionCandidate,
  getActiveExecutionPayloadPreview,
  getActiveExecutionPlan,
  getActiveExecutionReadiness,
  getLaboratoryRightPanelContext,
  getReportFreshness,
  getWorkspaceDiff,
  isRunComplete,
  isWorkspaceDirty,
} from "../runtime/lab-selectors.js";
import {
  buildExecutionBridge,
  formatExecutionBridgeAdvisory,
} from "../runtime/lab-execution-bridge.js";
import { formatDecisionCoherenceAdvisory } from "../runtime/lab-decision-coherence.js";
import { buildExecutionDescriptor } from "../runtime/lab-execution-descriptor.js";
import { formatExecutionReadinessSignalAdvisory } from "../runtime/lab-execution-readiness-signal.js";
import type { LabExecutionReadinessSignal } from "../runtime/lab-execution-readiness-signal.js";
import type { LabI18n } from "./lab-i18n.js";
import { renderPipeline } from "./laboratory-layout.js";

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

export function renderResultMode(state: LabStoreState, copy: LabI18n) {
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

  const blocks: LabPipelineBlock[] = [
    {
      id: "run-warnings",
      render() {
        return warningsBanner;
      },
      type: "status",
      visible() {
        return warningsBanner.trim() !== "";
      },
    },
    {
      id: "context-summary",
      render() {
        return tier1;
      },
      type: "section",
    },
    {
      id: "decision-status",
      render() {
        return tier2;
      },
      type: "status",
    },
    {
      id: "execution-advisories",
      render() {
        return advisories;
      },
      type: "status",
      visible() {
        return advisories.trim() !== "";
      },
    },
    {
      id: "report-action",
      render() {
        return reportCta;
      },
      type: "action",
    },
    {
      id: "explore-toggle",
      render() {
        return exploreCta;
      },
      type: "action",
    },
  ];

  return renderPipeline(blocks, "result");
}

// ---------------------------------------------------------------------------
// Explore mode
// ---------------------------------------------------------------------------

export function renderExploreMode(state: LabStoreState, copy: LabI18n) {
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

  const blocks: LabPipelineBlock[] = [
    {
      id: "empty-warning",
      render() {
        return warningBanner;
      },
      type: "status",
      visible() {
        return warningBanner.trim() !== "";
      },
    },
    {
      id: "run-warnings",
      render() {
        return warningsMarkup;
      },
      type: "status",
      visible() {
        return warningsMarkup.trim() !== "";
      },
    },
    {
      id: "workspace-comparison",
      render() {
        return comparisonMarkup;
      },
      type: "section",
    },
    {
      id: "execution-alternatives",
      render() {
        return alternativesMarkup;
      },
      type: "output",
      visible() {
        return alternativesMarkup.trim() !== "";
      },
    },
    {
      id: "reanalyze-action",
      render() {
        return reanalyzeCta;
      },
      type: "action",
    },
    {
      id: "result-toggle",
      render() {
        return backToggle;
      },
      type: "action",
    },
  ];

  return renderPipeline(blocks, "explore");
}

// ---------------------------------------------------------------------------
