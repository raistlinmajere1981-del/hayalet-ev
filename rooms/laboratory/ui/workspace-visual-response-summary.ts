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
    if (kind === "target-and-background-change-together") {
      return "Target and background change together.";
    }
    if (kind === "physical-environment-like-response") {
      return "Target response is similar to the surrounding physical scene.";
    }
    if (kind === "target-response-differs") {
      return "Target shows a different response curve; cause remains open.";
    }
    if (kind === "change-localized-to-target") {
      return "The transition appears localized toward the target ROI.";
    }
    if (kind === "sample-insufficient") return "Sample is insufficient.";
    return "Result is uncertain.";
  }
  if (kind === "target-and-background-change-together") {
    return "Target ve background birlikte değişiyor.";
  }
  if (kind === "physical-environment-like-response") {
    return "Hedef fiziksel çevre yapılarıyla benzer response gösteriyor.";
  }
  if (kind === "target-response-differs") {
    return "Hedef farklı response gösteriyor; neden açık bırakılıyor.";
  }
  if (kind === "change-localized-to-target") {
    return "Değişim target'a lokalize görünüyor.";
  }
  if (kind === "sample-insufficient") return "Örnek yetersiz.";
  return "Sonuç belirsiz.";
}

function sensorCompatibilityLabel(value: unknown, copy: LabI18n) {
  const kind = asNonEmptyString(value);
  if (kind === null || kind === "not-assessed" || kind === "unknown") return "";
  if (copy.locale !== "tr") {
    if (kind === "low-light-sensor-compatible") {
      return "This response is compatible with a global low-light / sensor explanation.";
    }
    if (kind === "not-explained-by-global-sensor-response-alone") {
      return "A global sensor response alone does not explain the target/background divergence.";
    }
    return "";
  }
  if (kind === "low-light-sensor-compatible") {
    return "Davranış düşük ışık / sensör açıklamasıyla uyumlu.";
  }
  if (kind === "not-explained-by-global-sensor-response-alone") {
    return "Target/background ayrışmasını yalnız global sensör cevabı açıklamıyor.";
  }
  return "";
}

function axisLabel(value: unknown) {
  return (asNonEmptyString(value) || "response").replaceAll("-", " ");
}

function roiLabel(value: unknown) {
  const roi = asLabRecord(value);
  const x = finite(roi, "x");
  const y = finite(roi, "y");
  const width = finite(roi, "width");
  const height = finite(roi, "height");
  if (x === null || y === null || width === null || height === null) return "—";
  return `x ${(x * 100).toFixed(1)}% · y ${(y * 100).toFixed(1)}% · w ${(width * 100).toFixed(1)}% · h ${(height * 100).toFixed(1)}%`;
}

function renderResponse(entry: Entry, copy: LabI18n) {
  const request = asLabRecord(entry["request"]);
  const temporal = asLabRecord(request["temporalRequest"]);
  const points = Array.isArray(entry["points"])
    ? entry["points"].map((point) => asLabRecord(point))
    : [];
  const targetCurve = points.map(
    (point) => finite(asLabRecord(point["target"]), "visibilityScore") ?? 0
  );
  const backgroundCurve = points.map(
    (point) => finite(asLabRecord(point["background"]), "visibilityScore") ?? 0
  );
  const differentialCurve = points.map(
    (point) => finite(asLabRecord(point["differential"]), "visibilityScore") ?? 0
  );
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
        <td>${escapeHtml(signed(finite(differential, "recoveredDarkFraction")))}</td>
        <td>${escapeHtml(signed(finite(differential, "nearBlackFraction")))}</td>
      </tr>`;
    })
    .join("");
  const interpretation = asLabRecord(entry["interpretation"]);
  const sensorLabel = sensorCompatibilityLabel(interpretation["sensorCompatibility"], copy);
  return `
    <section class="labx-strip-live-comparison" data-lab-response-summary="true">
      <div class="labx-strip-live-comparison__header">
        <strong>Visibility Response · ${escapeHtml(axisLabel(request["axis"]))}</strong>
        <span>${escapeHtml(interpretationLabel(interpretation["classification"], copy))}</span>
      </div>
      ${sensorLabel === "" ? "" : `<p class="labx-strip-live-note">${escapeHtml(sensorLabel)}</p>`}
      <p class="labx-strip-live-note">${escapeHtml(
        copy.locale === "tr"
          ? `Target ROI: ${roiLabel(temporal["roi"])} · Background ROI: ${roiLabel(request["backgroundRoi"])}`
          : `Target ROI: ${roiLabel(temporal["roi"])} · Background ROI: ${roiLabel(request["backgroundRoi"])}`
      )}</p>
      <p class="labx-strip-live-note">TARGET&nbsp;&nbsp;&nbsp;&nbsp;${escapeHtml(spark(targetCurve))}<br/>BACKGROUND&nbsp;${escapeHtml(spark(backgroundCurve))}<br/>DIFFERENCE&nbsp;${escapeHtml(
        spark(differentialCurve.map((value) => Math.max(0, Math.min(1, 0.5 + value))))
      )}</p>
      <div class="labx-strip-live-comparison__table-wrap">
        <table>
          <thead><tr><th>Axis</th><th>Target</th><th>Background</th><th>Δ Visibility</th><th>Δ Edge</th><th>Δ Recovered dark</th><th>Δ Near-black</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>`;
}

function renderTransition(entry: Entry, copy: LabI18n) {
  const request = asLabRecord(entry["request"]);
  const temporal = asLabRecord(request["temporalRequest"]);
  const phases = Array.isArray(entry["phases"])
    ? entry["phases"].map((phase) => asLabRecord(phase))
    : [];
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
        <td>${escapeHtml(signed(finite(differential, "frameDifferenceEnergy")))}</td>
        <td>${escapeHtml(signed(finite(differential, "edgePersistence")))}</td>
        <td>${escapeHtml(signed(finite(differential, "chromaDistance")))}</td>
      </tr>`;
    })
    .join("");
  const interpretation = asLabRecord(entry["interpretation"]);
  return `
    <section class="labx-strip-live-comparison" data-lab-transition-summary="true">
      <div class="labx-strip-live-comparison__header">
        <strong>Appearance / Disappearance Transition</strong>
        <span>${escapeHtml(interpretationLabel(interpretation["classification"], copy))}</span>
      </div>
      <p class="labx-strip-live-note">${escapeHtml(
        `Target ROI: ${roiLabel(temporal["roi"])} · Background ROI: ${roiLabel(request["backgroundRoi"])} · Event: ${typeof request["eventSeconds"] === "number" ? request["eventSeconds"].toFixed(3) : "—"} s`
      )}</p>
      <div class="labx-strip-live-comparison__table-wrap">
        <table>
          <thead><tr><th>Phase</th><th>Target</th><th>Background</th><th>Δ Visibility</th><th>Δ Frame</th><th>Δ Edge persist.</th><th>Δ Chroma</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>`;
}

function codecInterpretation(steps: Entry[], copy: LabI18n) {
  const last = steps[steps.length - 1];
  if (last === undefined) {
    return copy.locale === "tr" ? "Örnek yetersiz." : "Sample is insufficient.";
  }
  const delta = finite(asLabRecord(last["differential"]), "meanFrameDifferenceEnergy");
  if (delta === null) {
    return copy.locale === "tr"
      ? "Background karşılaştırması yok; yalnız target degradation ölçüldü."
      : "No background comparison; only target degradation was measured.";
  }
  if (delta > 0.05) {
    return copy.locale === "tr"
      ? "Codec degradation hedefi background'dan daha hızlı bozuyor."
      : "Codec degradation disrupts the target faster than the background.";
  }
  if (Math.abs(delta) <= 0.025) {
    return copy.locale === "tr"
      ? "Hedef ve background codec degradation altında benzer hızda bozuluyor."
      : "Target and background degrade at a similar rate under codec stress.";
  }
  return copy.locale === "tr"
    ? "Codec degradation farkı var ama sınıflandırma için zayıf / belirsiz."
    : "A codec degradation difference exists, but it is weak / uncertain.";
}

function renderRecompressionLadder(entry: Entry, copy: LabI18n) {
  const steps = Array.isArray(entry["steps"])
    ? entry["steps"].map((step) => asLabRecord(step))
    : [];
  const rows = steps
    .map(function (step) {
      const target = asLabRecord(asLabRecord(step["target"])["delta"]);
      const backgroundEntry = asLabRecord(step["background"]);
      const background = asLabRecord(backgroundEntry["delta"]);
      const differential = asLabRecord(step["differential"]);
      return `<tr>
        <th>CRF ${escapeHtml(String(step["crf"] ?? "—"))}</th>
        <td>${escapeHtml(signed(finite(target, "meanFrameDifferenceEnergy")))}</td>
        <td>${escapeHtml(
          Object.keys(backgroundEntry).length === 0
            ? "—"
            : signed(finite(background, "meanFrameDifferenceEnergy"))
        )}</td>
        <td>${escapeHtml(signed(finite(differential, "meanFrameDifferenceEnergy")))}</td>
        <td>${escapeHtml(signed(finite(differential, "meanEdgeEnergy")))}</td>
      </tr>`;
    })
    .join("");
  return `
    <section class="labx-strip-live-comparison" data-lab-recompression-ladder="true">
      <div class="labx-strip-live-comparison__header">
        <strong>Codec Degradation · CRF 18 → 24 → 30 → 36 → 42</strong>
        <span>${escapeHtml(codecInterpretation(steps, copy))}</span>
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
  const latestResponses = entries
    .filter((entry) => entry["kind"] === "visibility-response")
    .slice(0, 4);
  const transition = entries.find((entry) => entry["kind"] === "appearance-transition");
  const ladder = entries.find((entry) => entry["kind"] === "recompression-ladder");
  return [
    ...latestResponses.map((entry) => renderResponse(entry, copy)),
    transition === undefined ? "" : renderTransition(transition, copy),
    ladder === undefined ? "" : renderRecompressionLadder(ladder, copy),
  ].join("");
}
