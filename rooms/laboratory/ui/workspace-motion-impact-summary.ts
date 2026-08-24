import { asLabRecord, escapeHtml } from "../domain/lab-types.js";
import type { LabEditConfig } from "../domain/lab-types.js";
import type { LabI18n } from "./lab-i18n.js";

type LaboratoryRecord = Record<string, unknown>;

function readHistory(editConfig: LabEditConfig | null): LaboratoryRecord[] {
  const history = asLabRecord(editConfig)["temporalStressTests"];
  return Array.isArray(history) ? history.map(asLabRecord) : [];
}

function readFinite(record: LaboratoryRecord, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatNumber(value: number | null, digits = 2) {
  return value === null ? "—" : value.toFixed(digits);
}

function formatSigned(value: number | null, digits = 2) {
  if (value === null) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function formatPercent(value: number | null) {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

function formatAngle(value: number | null) {
  return value === null ? "—" : `${value.toFixed(1)}°`;
}

function formatTime(value: number | null) {
  return value === null ? "—" : `${value.toFixed(3)} s`;
}

function formatLag(value: number | null) {
  if (value === null) return "—";
  return `${value >= 0 ? "+" : ""}${Math.round(value)} ms`;
}

function readSummary(container: LaboratoryRecord) {
  return asLabRecord(container["summary"]);
}

function renderVectorRows(label: string, vector: LaboratoryRecord) {
  if (Object.keys(vector).length === 0) {
    return `
      <div class="labx-control-row">
        <span class="labx-control-row__label">${escapeHtml(label)}</span>
        <span class="labx-control-row__value">—</span>
      </div>
    `;
  }
  const dx = readFinite(vector, "dx");
  const dy = readFinite(vector, "dy");
  const magnitude = readFinite(vector, "magnitude");
  const angle = readFinite(vector, "angleDegrees");
  const confidence = readFinite(vector, "confidence");
  return `
    <div class="labx-control-row">
      <span class="labx-control-row__label">${escapeHtml(`${label} dx / dy`)}</span>
      <span class="labx-control-row__value">${escapeHtml(`${formatSigned(dx)} / ${formatSigned(dy)} px/frame`)}</span>
    </div>
    <div class="labx-control-row">
      <span class="labx-control-row__label">${escapeHtml(`${label} magnitude / angle`)}</span>
      <span class="labx-control-row__value">${escapeHtml(`${formatNumber(magnitude)} px/frame · ${formatAngle(angle)}`)}</span>
    </div>
    <div class="labx-control-row">
      <span class="labx-control-row__label">${escapeHtml(`${label} confidence`)}</span>
      <span class="labx-control-row__value">${escapeHtml(formatPercent(confidence))}</span>
    </div>
  `;
}

function renderLatestMotionProbe(editConfig: LabEditConfig | null, copy: LabI18n) {
  const latest = readHistory(editConfig).find(function (entry) {
    return entry["kind"] === "motion-vector-probe";
  });
  if (latest === undefined) {
    return "";
  }
  const request = asLabRecord(latest["request"]);
  const target = readSummary(asLabRecord(latest["target"]));
  const reference = readSummary(asLabRecord(latest["reference"]));
  const relative = asLabRecord(latest["relative"]);
  const startSeconds = readFinite(request, "startSeconds");
  const endSeconds = readFinite(request, "endSeconds");
  const rangeLabel =
    startSeconds === null || endSeconds === null
      ? "—"
      : `${startSeconds.toFixed(2)}–${endSeconds.toFixed(2)} s`;
  const hasReference = Object.keys(reference).length > 0;
  const note =
    copy.locale === "tr"
      ? hasReference
        ? "Göreli vektör = hedef hareketi − kilitli referans hareketi. Değerler kaynak video pikseli/kare uzayındadır. Düşük confidence, düşük doku veya belirsiz hizalamaya işaret eder."
        : "Referans ROI kilitli değil; bu sonuç yalnız hedef ROI hareketini ölçer. Değerler kaynak video pikseli/kare uzayındadır."
      : hasReference
        ? "Relative vector = target motion − locked reference motion. Values are source-video pixels per frame. Low confidence indicates weak texture or ambiguous alignment."
        : "No reference ROI is locked; this result measures target motion only. Values are source-video pixels per frame.";
  const caveat =
    copy.locale === "tr"
      ? "Bu ilk sürüm yalnız translasyon tahmin eder; rotation, zoom veya optical flow modeli değildir."
      : "This first version estimates translation only; it is not a rotation, zoom, or optical-flow model.";

  return `
    <section class="labx-card labx-controls-card" data-lab-motion-probe-summary="true">
      <div class="labx-card__body">
        <p class="labx-card__eyebrow">${escapeHtml(copy.locale === "tr" ? "Motion Vector Probe" : "Motion Vector Probe")}</p>
        <p class="labx-card__meta">${escapeHtml(rangeLabel)} · ${asLabRecord(request["roi"])["width"] === undefined ? (copy.locale === "tr" ? "tam kare" : "full frame") : "ROI"}</p>
        <div class="labx-controls-stack">
          ${renderVectorRows(copy.locale === "tr" ? "Hedef" : "Target", target)}
          ${hasReference ? renderVectorRows(copy.locale === "tr" ? "Referans" : "Reference", reference) : ""}
          ${Object.keys(relative).length > 0 ? renderVectorRows(copy.locale === "tr" ? "Göreli" : "Relative", relative) : ""}
          <div class="labx-control-row"><span class="labx-control-row__label">Target Frame Δ mean / peak</span><span class="labx-control-row__value">${escapeHtml(`${formatNumber(readFinite(target, "frameDifferenceMean"), 3)} / ${formatNumber(readFinite(target, "frameDifferencePeak"), 3)}`)}</span></div>
        </div>
        <p class="labx-card__meta">${escapeHtml(note)}</p>
        <p class="labx-card__meta">${escapeHtml(caveat)}</p>
      </div>
    </section>
  `;
}

function readWindowVector(windowRecord: LaboratoryRecord, key: "target" | "reference" | "relative") {
  const value = asLabRecord(windowRecord[key]);
  return key === "relative" ? value : readSummary(value);
}

function renderLatestImpactCompare(editConfig: LabEditConfig | null, copy: LabI18n) {
  const latest = readHistory(editConfig).find(function (entry) {
    return entry["kind"] === "impact-window-compare";
  });
  if (latest === undefined) {
    return "";
  }
  const before = asLabRecord(latest["before"]);
  const after = asLabRecord(latest["after"]);
  const compare = asLabRecord(latest["compare"]);
  const beforeTarget = readWindowVector(before, "target");
  const afterTarget = readWindowVector(after, "target");
  const beforeReference = readWindowVector(before, "reference");
  const afterReference = readWindowVector(after, "reference");
  const beforeRelative = readWindowVector(before, "relative");
  const afterRelative = readWindowVector(after, "relative");
  const impactTime = readFinite(latest, "impactTimeSeconds");
  const hasReference = Object.keys(beforeReference).length > 0 && Object.keys(afterReference).length > 0;
  const caveat =
    copy.locale === "tr"
      ? "Temas anı seçili timeline aralığının orta noktasıdır. Pozitif reference lag, referans/kamera hareket zirvesinin hedef zirvesinden daha sonra ölçüldüğü anlamına gelir; nedensellik kanıtı değildir."
      : "Impact time is the midpoint of the selected timeline range. Positive reference lag means the reference/camera motion peak was measured later than the target peak; it is not proof of causality.";

  return `
    <section class="labx-card labx-controls-card" data-lab-impact-window-summary="true">
      <div class="labx-card__body">
        <p class="labx-card__eyebrow">Impact Window Compare ±500 ms</p>
        <p class="labx-card__meta">${escapeHtml(`${copy.locale === "tr" ? "Temas merkezi" : "Impact center"}: ${formatTime(impactTime)}`)}</p>
        <div class="labx-controls-stack">
          <div class="labx-control-row"><span class="labx-control-row__label">Before target magnitude</span><span class="labx-control-row__value">${escapeHtml(`${formatNumber(readFinite(beforeTarget, "magnitude"))} px/frame`)}</span></div>
          <div class="labx-control-row"><span class="labx-control-row__label">After target magnitude</span><span class="labx-control-row__value">${escapeHtml(`${formatNumber(readFinite(afterTarget, "magnitude"))} px/frame`)}</span></div>
          ${
            hasReference
              ? `<div class="labx-control-row"><span class="labx-control-row__label">Before relative magnitude</span><span class="labx-control-row__value">${escapeHtml(`${formatNumber(readFinite(beforeRelative, "magnitude"))} px/frame`)}</span></div>
                 <div class="labx-control-row"><span class="labx-control-row__label">After relative magnitude</span><span class="labx-control-row__value">${escapeHtml(`${formatNumber(readFinite(afterRelative, "magnitude"))} px/frame`)}</span></div>`
              : ""
          }
          <div class="labx-control-row"><span class="labx-control-row__label">Δ relative magnitude</span><span class="labx-control-row__value">${escapeHtml(`${formatSigned(readFinite(compare, "relativeMagnitudeDelta"))} px/frame`)}</span></div>
          <div class="labx-control-row"><span class="labx-control-row__label">Δ relative direction</span><span class="labx-control-row__value">${escapeHtml(formatAngle(readFinite(compare, "relativeDirectionDeltaDegrees")))}</span></div>
          <div class="labx-control-row"><span class="labx-control-row__label">Target peak</span><span class="labx-control-row__value">${escapeHtml(formatTime(readFinite(compare, "targetPeakTimeSeconds")))}</span></div>
          <div class="labx-control-row"><span class="labx-control-row__label">Reference peak</span><span class="labx-control-row__value">${escapeHtml(formatTime(readFinite(compare, "referencePeakTimeSeconds")))}</span></div>
          <div class="labx-control-row"><span class="labx-control-row__label">Reference lag</span><span class="labx-control-row__value">${escapeHtml(formatLag(readFinite(compare, "referenceLagMs")))}</span></div>
          <div class="labx-control-row"><span class="labx-control-row__label">Δ target / reference Frame energy</span><span class="labx-control-row__value">${escapeHtml(`${formatSigned(readFinite(compare, "targetFrameDifferenceDelta"), 3)} / ${formatSigned(readFinite(compare, "referenceFrameDifferenceDelta"), 3)}`)}</span></div>
        </div>
        <p class="labx-card__meta">${escapeHtml(caveat)}</p>
      </div>
    </section>
  `;
}

export function renderWorkspaceMotionImpactSummaries(
  editConfig: LabEditConfig | null,
  copy: LabI18n
) {
  return `${renderLatestMotionProbe(editConfig, copy)}${renderLatestImpactCompare(editConfig, copy)}`;
}
