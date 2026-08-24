import { asLabRecord, escapeHtml } from "../domain/lab-types.js";
import type { LabEditConfig } from "../domain/lab-types.js";
import {
  interpretLaboratoryControlDelta,
  interpretLaboratoryTemporalSummary,
} from "../shared/stress-test-interpretation.js";
import type {
  LaboratoryControlSummaryInterpretation,
  LaboratoryMetricChangeInterpretation,
  LaboratoryTemporalSummaryInterpretation,
} from "../shared/stress-test-interpretation.js";
import type { LabI18n } from "./lab-i18n.js";

function readFiniteMetric(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatMetric(value: number | null) {
  return value === null ? "—" : value.toFixed(3);
}

function formatPercent(value: number | null) {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

function formatSignedMetric(value: number | null) {
  if (value === null) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(3)}`;
}

function formatSignedPercent(value: number | null) {
  if (value === null) return "—";
  const percent = Math.round(value * 100);
  return `${percent >= 0 ? "+" : ""}${percent}%`;
}

function getTemporalHistory(editConfig: LabEditConfig | null) {
  const edit = asLabRecord(editConfig);
  return Array.isArray(edit["temporalStressTests"]) ? edit["temporalStressTests"] : [];
}

function readTemporalInterpretation(
  latest: Record<string, unknown>,
  summary: Record<string, unknown>
): LaboratoryTemporalSummaryInterpretation {
  const persisted = asLabRecord(latest["interpretation"]);
  if (
    persisted["schemaVersion"] === 1 &&
    persisted["kind"] === "temporal-baseline" &&
    (persisted["frameActivity"] === "very-low" ||
      persisted["frameActivity"] === "low" ||
      persisted["frameActivity"] === "moderate" ||
      persisted["frameActivity"] === "high")
  ) {
    return persisted as unknown as LaboratoryTemporalSummaryInterpretation;
  }
  return interpretLaboratoryTemporalSummary(summary);
}

function readControlInterpretation(
  latest: Record<string, unknown>,
  delta: Record<string, unknown>
): LaboratoryControlSummaryInterpretation {
  const persisted = asLabRecord(latest["interpretation"]);
  if (
    persisted["schemaVersion"] === 1 &&
    persisted["kind"] === "control-injection" &&
    (persisted["overallImpact"] === "negligible" ||
      persisted["overallImpact"] === "small" ||
      persisted["overallImpact"] === "moderate" ||
      persisted["overallImpact"] === "strong")
  ) {
    return persisted as unknown as LaboratoryControlSummaryInterpretation;
  }
  return interpretLaboratoryControlDelta(delta);
}

function describeTemporalInterpretation(
  interpretation: LaboratoryTemporalSummaryInterpretation,
  locale: string
) {
  const tr = locale === "tr";
  const activity =
    interpretation.frameActivity === "very-low"
      ? tr
        ? "Seçili aralık kareden kareye oldukça durağan."
        : "The selected interval is very stable from frame to frame."
      : interpretation.frameActivity === "low"
        ? tr
          ? "Kareler arasında düşük düzeyde değişim var."
          : "There is a low level of frame-to-frame change."
        : interpretation.frameActivity === "moderate"
          ? tr
            ? "Kareler arasında orta düzeyde hareket/değişim var."
            : "There is a moderate level of frame-to-frame motion/change."
          : tr
            ? "Kareler arasında yüksek düzeyde hareket/değişim var."
            : "There is a high level of frame-to-frame motion/change.";
  const edges =
    interpretation.edgePersistence === "low"
      ? tr
        ? "Kalıcı kenar yapısı zayıf veya ölçülemeyecek kadar düşük."
        : "Persistent edge structure is weak or below the current measurement threshold."
      : interpretation.edgePersistence === "intermittent"
        ? tr
          ? "Kenar yapısı aralığın yalnız bir bölümünde süreklilik gösteriyor."
          : "Edge structure persists through only part of the interval."
        : tr
          ? "Kenar yapısı zaman boyunca belirgin süreklilik gösteriyor."
          : "Edge structure shows clear persistence through time.";
  const photometric =
    interpretation.luminanceVariation === "stable" && interpretation.chromaVariation === "stable"
      ? tr
        ? "Parlaklık ve renk dağılımı büyük ölçüde sabit."
        : "Brightness and color distribution are largely stable."
      : interpretation.luminanceVariation === "variable" || interpretation.chromaVariation === "variable"
        ? tr
          ? "Parlaklık veya renk dağılımında belirgin değişkenlik var."
          : "Brightness or color distribution shows clear variability."
        : tr
          ? "Parlaklık veya renk dağılımında hafif değişkenlik var."
          : "Brightness or color distribution shows mild variability.";
  return `${activity} ${edges} ${photometric}`;
}

function metricChangeSentence(
  labelTr: string,
  labelEn: string,
  interpretation: LaboratoryMetricChangeInterpretation,
  locale: string
) {
  if (interpretation.magnitude === "negligible") {
    return null;
  }
  const tr = locale === "tr";
  const label = tr ? labelTr : labelEn;
  const strength =
    interpretation.magnitude === "strong"
      ? tr
        ? "güçlü biçimde"
        : "strongly"
      : interpretation.magnitude === "moderate"
        ? tr
          ? "belirgin biçimde"
          : "clearly"
        : tr
          ? "hafifçe"
          : "slightly";
  const direction =
    interpretation.direction === "increase"
      ? tr
        ? "arttı"
        : "increased"
      : tr
        ? "azaldı"
        : "decreased";
  return `${label} ${strength} ${direction}.`;
}

function describeControlInterpretation(
  interpretation: LaboratoryControlSummaryInterpretation,
  locale: string
) {
  const tr = locale === "tr";
  const opening =
    interpretation.overallImpact === "negligible"
      ? tr
        ? "Bu control, ölçülen temporal özelliklerde belirgin bir değişiklik oluşturmadı."
        : "This control produced no clear change in the measured temporal features."
      : interpretation.overallImpact === "small"
        ? tr
          ? "Bu control küçük ama ölçülebilir bir değişiklik oluşturdu."
          : "This control produced a small but measurable change."
        : interpretation.overallImpact === "moderate"
          ? tr
            ? "Bu control ölçülen yapıyı belirgin biçimde değiştirdi."
            : "This control clearly changed the measured structure."
          : tr
            ? "Bu control ölçülen yapıyı güçlü biçimde değiştirdi."
            : "This control strongly changed the measured structure.";
  const details = [
    metricChangeSentence("Kareler arası değişim", "Frame-to-frame change", interpretation.frameDifference, locale),
    metricChangeSentence("Kenar sürekliliği", "Edge persistence", interpretation.edgePersistence, locale),
    metricChangeSentence("Kenar enerjisi", "Edge energy", interpretation.edgeEnergy, locale),
    metricChangeSentence("Parlaklık aralığı", "Luminance range", interpretation.luminanceRange, locale),
    metricChangeSentence("Renk aralığı", "Color range", interpretation.chromaRange, locale),
  ].filter((entry): entry is string => entry !== null);
  const stable =
    details.length === 0
      ? tr
        ? "İzlenen metrikler paired baseline'a yakın kaldı."
        : "The tracked metrics remained close to the paired baseline."
      : "";
  return [opening, ...details, stable].filter(Boolean).join(" ");
}

function localizeControlKind(kind: string, locale: string) {
  if (locale !== "tr") return kind;
  if (kind === "noise") return "Gürültü";
  if (kind === "blur") return "Bulanıklık";
  if (kind === "sharpen") return "Keskinleştirme";
  if (kind === "low-light") return "Düşük ışık";
  return kind;
}

function renderLatestTemporalStressSummary(editConfig: LabEditConfig | null, copy: LabI18n) {
  const latest = asLabRecord(
    getTemporalHistory(editConfig).find(function (entry) {
      return asLabRecord(entry)["kind"] !== "control-injection";
    })
  );
  if (Object.keys(latest).length === 0) {
    return "";
  }
  const request = asLabRecord(latest["request"]);
  const metrics = asLabRecord(latest["metrics"]);
  const summary = asLabRecord(metrics["summary"]);
  const interpretation = readTemporalInterpretation(latest, summary);
  const startSeconds = readFiniteMetric(request, "startSeconds");
  const endSeconds = readFiniteMetric(request, "endSeconds");
  const windowLabel =
    startSeconds === null || endSeconds === null
      ? "—"
      : `${startSeconds.toFixed(2)}–${endSeconds.toFixed(2)} s`;
  const meanDifference = readFiniteMetric(summary, "meanFrameDifferenceEnergy");
  const peakDifference = readFiniteMetric(summary, "peakFrameDifferenceEnergy");
  const edgePersistence = readFiniteMetric(summary, "edgePersistenceRatio");
  const lumaRange = readFiniteMetric(summary, "lumaRange");
  const chromaURange = readFiniteMetric(summary, "chromaURange");
  const chromaVRange = readFiniteMetric(summary, "chromaVRange");
  const title = copy.locale === "tr" ? "Son Temporal Tarama" : "Latest Temporal Scan";
  const meaningTitle = copy.locale === "tr" ? "Ölçümün anlamı" : "What the measurement means";
  const caveat =
    copy.locale === "tr"
      ? "Bu özet yalnız seçili klibin hareket, kenar ve ışık/renk davranışını tanımlar; hedef yapının gerçekliği veya kaynağı hakkında hüküm vermez."
      : "This summary only describes motion, edge, and light/color behavior in the selected clip; it does not judge the reality or source of a target feature.";

  return `
    <section class="labx-card labx-controls-card" data-lab-temporal-stress-summary="true">
      <div class="labx-card__body">
        <p class="labx-card__eyebrow">${escapeHtml(title)}</p>
        <p class="labx-card__meta">${escapeHtml(windowLabel)} · ${asLabRecord(request["roi"])["width"] === undefined ? (copy.locale === "tr" ? "tam kare" : "full frame") : "ROI"}</p>
        <p class="labx-card__eyebrow">${escapeHtml(meaningTitle)}</p>
        <p class="labx-card__meta" data-lab-stress-interpretation="temporal">${escapeHtml(describeTemporalInterpretation(interpretation, copy.locale))}</p>
        <div class="labx-controls-stack">
          <div class="labx-control-row"><span class="labx-control-row__label">Frame Δ mean / peak</span><span class="labx-control-row__value">${escapeHtml(`${formatMetric(meanDifference)} / ${formatMetric(peakDifference)}`)}</span></div>
          <div class="labx-control-row"><span class="labx-control-row__label">Edge persistence</span><span class="labx-control-row__value">${escapeHtml(formatPercent(edgePersistence))}</span></div>
          <div class="labx-control-row"><span class="labx-control-row__label">Luma range</span><span class="labx-control-row__value">${escapeHtml(formatMetric(lumaRange))}</span></div>
          <div class="labx-control-row"><span class="labx-control-row__label">Chroma U / V range</span><span class="labx-control-row__value">${escapeHtml(`${formatMetric(chromaURange)} / ${formatMetric(chromaVRange)}`)}</span></div>
        </div>
        <p class="labx-card__meta">${escapeHtml(caveat)}</p>
      </div>
    </section>
  `;
}

function renderLatestControlInjectionSummary(editConfig: LabEditConfig | null, copy: LabI18n) {
  const latest = asLabRecord(
    getTemporalHistory(editConfig).find(function (entry) {
      return asLabRecord(entry)["kind"] === "control-injection";
    })
  );
  if (Object.keys(latest).length === 0) {
    return "";
  }
  const request = asLabRecord(latest["request"]);
  const temporalRequest = asLabRecord(request["temporalRequest"]);
  const params = asLabRecord(request["params"]);
  const delta = asLabRecord(latest["delta"]);
  const interpretation = readControlInterpretation(latest, delta);
  const kind = typeof request["kind"] === "string" ? request["kind"] : "control";
  const startSeconds = readFiniteMetric(temporalRequest, "startSeconds");
  const endSeconds = readFiniteMetric(temporalRequest, "endSeconds");
  const windowLabel =
    startSeconds === null || endSeconds === null
      ? "—"
      : `${startSeconds.toFixed(2)}–${endSeconds.toFixed(2)} s`;
  const meanDifferenceDelta = readFiniteMetric(delta, "meanFrameDifferenceEnergy");
  const peakDifferenceDelta = readFiniteMetric(delta, "peakFrameDifferenceEnergy");
  const edgePersistenceDelta = readFiniteMetric(delta, "edgePersistenceRatio");
  const edgeEnergyDelta = readFiniteMetric(delta, "meanEdgeEnergy");
  const lumaRangeDelta = readFiniteMetric(delta, "lumaRange");
  const chromaURangeDelta = readFiniteMetric(delta, "chromaURange");
  const chromaVRangeDelta = readFiniteMetric(delta, "chromaVRange");
  const title = copy.locale === "tr" ? "Son Destruction Control" : "Latest Destruction Control";
  const meaningTitle = copy.locale === "tr" ? "Control sonucu" : "Control result";
  const methodHint =
    copy.locale === "tr"
      ? "Δ = aynı trim/ROI/codec ile üretilen paired baseline → injected değişimi."
      : "Δ = paired baseline → injected change with identical trim/ROI/codec.";
  const caveat =
    copy.locale === "tr"
      ? "Bu yorum yalnız control filtresinin ölçülen metriklere etkisini anlatır. Hedef yapının yok olduğu, üretildiği veya kaynağının açıklanmış olduğu anlamına gelmez."
      : "This interpretation only describes the control filter's effect on measured metrics. It does not mean a target feature was destroyed, reproduced, or explained.";

  return `
    <section class="labx-card labx-controls-card" data-lab-control-injection-summary="true">
      <div class="labx-card__body">
        <p class="labx-card__eyebrow">${escapeHtml(title)}</p>
        <p class="labx-card__meta">${escapeHtml(`${localizeControlKind(kind, copy.locale)} · ${windowLabel} · ${JSON.stringify(params)}`)}</p>
        <p class="labx-card__eyebrow">${escapeHtml(meaningTitle)}</p>
        <p class="labx-card__meta" data-lab-stress-interpretation="control">${escapeHtml(describeControlInterpretation(interpretation, copy.locale))}</p>
        <div class="labx-controls-stack">
          <div class="labx-control-row"><span class="labx-control-row__label">Δ Frame mean / peak</span><span class="labx-control-row__value">${escapeHtml(`${formatSignedMetric(meanDifferenceDelta)} / ${formatSignedMetric(peakDifferenceDelta)}`)}</span></div>
          <div class="labx-control-row"><span class="labx-control-row__label">Δ Edge persistence</span><span class="labx-control-row__value">${escapeHtml(formatSignedPercent(edgePersistenceDelta))}</span></div>
          <div class="labx-control-row"><span class="labx-control-row__label">Δ Edge energy</span><span class="labx-control-row__value">${escapeHtml(formatSignedMetric(edgeEnergyDelta))}</span></div>
          <div class="labx-control-row"><span class="labx-control-row__label">Δ Luma range</span><span class="labx-control-row__value">${escapeHtml(formatSignedMetric(lumaRangeDelta))}</span></div>
          <div class="labx-control-row"><span class="labx-control-row__label">Δ Chroma U / V</span><span class="labx-control-row__value">${escapeHtml(`${formatSignedMetric(chromaURangeDelta)} / ${formatSignedMetric(chromaVRangeDelta)}`)}</span></div>
        </div>
        <p class="labx-card__meta">${escapeHtml(methodHint)}</p>
        <p class="labx-card__meta">${escapeHtml(caveat)}</p>
      </div>
    </section>
  `;
}

export function renderWorkspaceStressTestSummaries(editConfig: LabEditConfig | null, copy: LabI18n) {
  return `${renderLatestTemporalStressSummary(editConfig, copy)}${renderLatestControlInjectionSummary(editConfig, copy)}`;
}
