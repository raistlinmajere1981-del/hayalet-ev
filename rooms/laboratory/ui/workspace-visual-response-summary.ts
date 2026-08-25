import { asLabRecord, asNonEmptyString, escapeHtml } from "../domain/lab-types.js";
import type { LabEditConfig } from "../domain/lab-types.js";
import type { LabI18n } from "./lab-i18n.js";

type Entry = Record<string, unknown>;

function history(editConfig: LabEditConfig | null) {
  const value = asLabRecord(editConfig)["temporalStressTests"];
  return Array.isArray(value) ? value.map((entry) => asLabRecord(entry)) : [];
}

function finite(record: Entry, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function pct(value: number | null) {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

function signed(value: number | null) {
  if (value === null) return "—";
  const rounded = Math.round(value * 100);
  return `${rounded >= 0 ? "+" : ""}${rounded}%`;
}

function bars(value: number | null) {
  if (value === null) return "░░░░░░░░░░";
  const count = Math.max(0, Math.min(10, Math.round(value * 10)));
  return `${"█".repeat(count)}${"░".repeat(10 - count)}`;
}

function spark(values: number[]) {
  const glyphs = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
  return values
    .map((value) => glyphs[Math.max(0, Math.min(glyphs.length - 1, Math.round(value * 7)))] ?? "▁")
    .join("");
}

function interpretationLabel(value: unknown, copy: LabI18n) {
  const kind = asNonEmptyString(value) || "result-uncertain";
  if (copy.locale !== "tr") {
    if (kind === "target-and-background-change-together") return "Target and background change together.";
    if (kind === "physical-environment-like-response") return "Target response is similar to the surrounding physical scene.";
    if (kind === "target-response-differs") return "Target shows a different response curve; cause remains open.";
    if (kind === "change-localized-to-target") return "The transition appears localized toward the target ROI.";
    if (kind === "sample-insufficient") return "Sample is insufficient.";
    return "Result is uncertain.";
  }
  if (kind === "target-and-background-change-together") return "Target ve background birlikte değişiyor.";
  if (kind === "physical-environment-like-response") return "Hedef fiziksel çevre yapılarıyla benzer response gösteriyor.";
  if (kind === "target-response-differs") return "Hedef farklı response gösteriyor; neden açık bırakılıyor.";
  if (kind === "change-localized-to-target") return "Değişim target'a lokalize görünüyor.";
  if (kind === "sample-insufficient") return "Örnek yetersiz.";
  return "Sonuç belirsiz.";
}

function axisLabel(value: unknown) {
  return (asNonEmptyString(value) || "response").replaceAll("-", " ");
}

function renderResponse(entry: Entry, copy: LabI18n) {
  const request = asLabRecord(entry["request"]);
  const points = Array.isArray(entry["points"]) ? entry["points"].map((point) => asLabRecord(point)) : [];
  const targetCurve = points.map((point) => finite(asLabRecord(point["target"]), "visibilityScore") ?? 0);
  const backgroundCurve = points.map((point) => finite(asLabRecord(point["background"]), "visibilityScore") ?? 0);
  const differentialCurve = points.map((point) => finite(asLabRecord(point["differential"]), "visibilityScore") ?? 0);
  const rows = points
    .map(function (point) {
      const target = asLabRecord(point["target"]);
      const background = asLabRecord(point["background"]);
      const differential = asLabRecord(point["differential"]);
      const value = point["value"];
      return `<tr>
        <td>${escapeHtml(typeof value === "number" ? String(Number(value.toFixed(3))) : "—")}</td>
        <td>${escapeHtml(pct(finite(target, "visibilityScore")))}</td>
        <td>${escapeHtml(pct(finite(background, "visibilityScore")))}</td>
        <td>${escapeHtml(signed(finite(differential, "visibilityScore")))}</td>
        <td>${escapeHtml(signed(finite(differential, "edgeEnergy")))}</td>
        <td>${escapeHtml(signed(finite(differential, "nearBlackFraction")))}</td>
      </tr>`;
    })
    .join("");
  const interpretation = asLabRecord(entry["interpretation"]);
  return `
    <section class="labx-strip-live-comparison" data-lab-response-summary="true">
      <div class="labx-strip-live-comparison__header">
        <strong>${escapeHtml(copy.locale === "tr" ? `Visibility Response · ${axisLabel(request["axis"])}` : `Visibility Response · ${axisLabel(request["axis"])}`)}</strong>
        <span>${escapeHtml(interpretationLabel(interpretation["classification"], copy))}</span>
      </div>
      <p class="labx-strip-live-note">TARGET&nbsp;&nbsp;&nbsp;&nbsp;${escapeHtml(spark(targetCurve))}<br/>BACKGROUND&nbsp;${escapeHtml(spark(backgroundCurve))}<br/>DIFFERENCE&nbsp;${escapeHtml(spark(differentialCurve.map((value) => Math.max(0, Math.min(1, 0.5 + value)))))} </p>
      <div class="labx-strip-live-comparison__table-wrap">
        <table>
          <thead><tr><th>Axis</th><th>Target</th><th>Background</th><th>Δ Visibility</th><th>Δ Edge</th><th>Δ Near-black</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>`;
}

function renderTransition(entry: Entry, copy: LabI18n) {
  const phases = Array.isArray(entry["phases"]) ? entry["phases"].map((phase) => asLabRecord(phase)) : [];
  const rows = phases
    .map(function (phase) {
      const target = asLabRecord(phase["target"]);
      const background = asLabRecord(phase["background"]);
      const differential = asLabRecord(phase["differential"]);
      return `<tr>
        <th>${escapeHtml((asNonEmptyString(phase["phase"]) || "phase").toUpperCase())}</th>
        <td>${escapeHtml(`${bars(finite(target, "visibilityScore"))} ${pct(finite(target, "visibilityScore"))}`)}</td>
        <td>${escapeHtml(`${bars(finite(background, "visibilityScore"))} ${pct(finite(background, "visibilityScore"))}`)}</td>
        <td>${escapeHtml(signed(finite(differential, "visibilityScore")))}</td>
        <td>${escapeHtml(signed(finite(differential, "edgeEnergy")))}</td>
      </tr>`;
    })
    .join("");
  const interpretation = asLabRecord(entry["interpretation"]);
  return `
    <section class="labx-strip-live-comparison" data-lab-transition-summary="true">
      <div class="labx-strip-live-comparison__header">
        <strong>${escapeHtml(copy.locale === "tr" ? "Appearance / Disappearance Transition" : "Appearance / Disappearance Transition")}</strong>
        <span>${escapeHtml(interpretationLabel(interpretation["classification"], copy))}</span>
      </div>
      <div class="labx-strip-live-comparison__table-wrap">
        <table>
          <thead><tr><th>Phase</th><th>Target</th><th>Background</th><th>Δ Visibility</th><th>Δ Edge</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>`;
}

function renderRecompressionLadder(entry: Entry, copy: LabI18n) {
  const steps = Array.isArray(entry["steps"]) ? entry["steps"].map((step) => asLabRecord(step)) : [];
  const rows = steps
    .map(function (step) {
      const target = asLabRecord(asLabRecord(step["target"])["delta"]);
      const background = asLabRecord(asLabRecord(step["background"])["delta"]);
      const differential = asLabRecord(step["differential"]);
      return `<tr>
        <th>CRF ${escapeHtml(String(step["crf"] ?? "—"))}</th>
        <td>${escapeHtml(signed(finite(target, "meanFrameDifferenceEnergy")))}</td>
        <td>${escapeHtml(signed(finite(background, "meanFrameDifferenceEnergy")))}</td>
        <td>${escapeHtml(signed(finite(differential, "meanFrameDifferenceEnergy")))}</td>
        <td>${escapeHtml(signed(finite(differential, "meanEdgeEnergy")))}</td>
      </tr>`;
    })
    .join("");
  return `
    <section class="labx-strip-live-comparison" data-lab-recompression-ladder="true">
      <div class="labx-strip-live-comparison__header">
        <strong>Codec Degradation · CRF 18 → 24 → 30 → 36 → 42</strong>
        <span>${escapeHtml(copy.locale === "tr" ? "Target ve background bozulma eğrileri ayrı tutulur." : "Target and background degradation curves remain separate.")}</span>
      </div>
      <div class="labx-strip-live-comparison__table-wrap">
        <table>
          <thead><tr><th>Step</th><th>Target Δ Frame</th><th>Background Δ Frame</th><th>Differential</th><th>Δ Edge diff.</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>`;
}

export function renderWorkspaceVisualResponseSummaries(
  editConfig: LabEditConfig | null,
  copy: LabI18n
) {
  const entries = history(editConfig);
  const latestResponses = entries.filter((entry) => entry["kind"] === "visibility-response").slice(0, 4);
  const transition = entries.find((entry) => entry["kind"] === "appearance-transition");
  const ladder = entries.find((entry) => entry["kind"] === "recompression-ladder");
  return [
    ...latestResponses.map((entry) => renderResponse(entry, copy)),
    transition === undefined ? "" : renderTransition(transition, copy),
    ladder === undefined ? "" : renderRecompressionLadder(ladder, copy),
  ].join("");
}
