import { asLabRecord, asNonEmptyString, escapeHtml } from "../domain/lab-types.js";
import type { AnalysisReportModel } from "../domain/lab-analysis-results.js";
import type { LabEditConfig } from "../domain/lab-types.js";
import type { LabI18n } from "./lab-i18n.js";
import { formatLaboratoryAnalysisReportSummary } from "./workspace-analysis-report-status.js";

type Entry = Record<string, unknown>;

type VisualReportKind = "response" | "transition" | "codec";

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

function decimal(value: number | null, digits = 3) {
  return value === null ? "—" : String(Number(value.toFixed(digits)));
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
    if (kind === "background-not-comparable") {
      return "Target/background separation is visible, but the background ROI is not comparable enough for a differential interpretation.";
    }
    if (kind === "visibility-only-separation") {
      return "Visibility curves separate, but supporting edge / recovered-dark / temporal metrics are weak.";
    }
    if (kind === "target-response-differs") {
      return "Target/background curves separate across multiple metrics; the cause remains open.";
    }
    if (kind === "roi-tracking-quality-limits-response-result") {
      return "Tracking quality limits the response result; fixed-ROI photometry is retained for diagnostics.";
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
  if (kind === "background-not-comparable") {
    return "Eğriler ayrışıyor, ancak Background ROI diferansiyel yorum için yeterince karşılaştırılabilir değil.";
  }
  if (kind === "visibility-only-separation") {
    return "Visibility eğrileri ayrışıyor; edge / recovered-dark / temporal desteği zayıf.";
  }
  if (kind === "target-response-differs") {
    return "Target/background eğrileri birden fazla metrikte ayrışıyor; neden açık bırakılıyor.";
  }
  if (kind === "roi-tracking-quality-limits-response-result") {
    return "Tracking kalitesi response sonucunu sınırlıyor; fixed-ROI fotometri tanı amacıyla korunuyor.";
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
      return "A global sensor response alone is insufficient for the measured multi-metric divergence.";
    }
    return "";
  }
  if (kind === "low-light-sensor-compatible") {
    return "Davranış düşük ışık / sensör açıklamasıyla uyumlu.";
  }
  if (kind === "not-explained-by-global-sensor-response-alone") {
    return "Ölçülen çoklu-metrik ayrışmayı yalnız global sensör cevabı açıklamakta yetersiz kalıyor.";
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

function markdownCell(value: string) {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function reportMeta(entry: Entry, label: string) {
  const lines = [`# Hayalet Ev Laboratory — ${label}`];
  const createdAt = asNonEmptyString(entry["createdAt"]);
  const sourcePath = asNonEmptyString(entry["sourcePath"]);
  if (createdAt !== null) lines.push(`- Created: ${markdownCell(createdAt)}`);
  if (sourcePath !== null) lines.push(`- Source: ${markdownCell(sourcePath)}`);
  lines.push("- Interpretation policy: measurement only; no real/fake or mechanism verdict.");
  return lines;
}

function comparabilityStatusLabel(status: string, copy: LabI18n) {
  if (copy.locale !== "tr") return status;
  if (status === "high") return "yüksek";
  if (status === "moderate") return "orta";
  if (status === "low") return "düşük";
  return "bilinmiyor";
}

function comparabilitySummary(interpretation: Entry, copy: LabI18n) {
  const comparability = asLabRecord(interpretation["comparability"]);
  const score = finite(comparability, "score");
  if (score === null) return "";
  const areaRatio = finite(comparability, "roiAreaRatio");
  const status = asNonEmptyString(comparability["status"]) || "unknown";
  const corroboration = asLabRecord(interpretation["corroboration"]);
  const count = finite(corroboration, "supportingMetricCount");
  if (copy.locale !== "tr") {
    return `ROI comparability: ${comparabilityStatusLabel(status, copy)} (${pct(score)})${areaRatio === null ? "" : ` · area ratio ${pct(areaRatio)}`}${count === null ? "" : ` · supporting metrics ${String(Math.round(count))}/4`}`;
  }
  return `ROI karşılaştırılabilirliği: ${comparabilityStatusLabel(status, copy)} (${pct(score)})${areaRatio === null ? "" : ` · alan oranı ${pct(areaRatio)}`}${count === null ? "" : ` · destekleyen metrik ${String(Math.round(count))}/4`}`;
}

function trackingCoordinateModeLabel(value: string) {
  if (value === "fixed-roi") return "fixed ROI";
  if (value === "fixed-roi-fallback") return "fixed ROI fallback";
  if (value === "camera-similarity") return "camera similarity";
  return value.replaceAll("-", " ");
}

function visualTrackingMarkdown(entry: Entry) {
  const tracking = asLabRecord(entry["tracking"]);
  if (Object.keys(tracking).length === 0) return [];
  const interpretation = asLabRecord(entry["interpretation"]);
  const status = asNonEmptyString(tracking["status"]);
  const quality = asNonEmptyString(tracking["quality"]) || "unreliable";
  const qualityGate = asNonEmptyString(interpretation["trackingQualityGate"]) || "advisory";
  const coordinateMode = asNonEmptyString(tracking["measurementCoordinateMode"]) || "fixed-roi";
  const lines = ["## ROI Tracking / Stabilization"];
  if (status !== null) lines.push(`- Status: ${status}`);
  lines.push(`- Tracking quality: ${quality.toUpperCase()}`, `- Quality gate: ${qualityGate}`);
  const algorithm = asNonEmptyString(tracking["algorithm"]);
  if (algorithm !== null) lines.push(`- Algorithm: ${algorithm}`);
  const version = finite(tracking, "version");
  if (version !== null) lines.push(`- Provenance version: ${decimal(version, 0)}`);
  const transformModel = asNonEmptyString(tracking["transformModel"]);
  if (transformModel !== null) lines.push(`- Transform model: ${transformModel}`);
  const mode = asNonEmptyString(tracking["mode"]);
  if (mode !== null) lines.push(`- Tracking mode: ${mode}`);
  const cacheId = asNonEmptyString(tracking["cacheId"]);
  if (cacheId !== null) lines.push(`- Cache ID: ${cacheId}`);
  const anchorSeconds = finite(tracking, "anchorSeconds");
  if (anchorSeconds !== null) lines.push(`- Anchor: ${decimal(anchorSeconds, 3)} s`);
  const confidence = finite(tracking, "confidence");
  if (confidence !== null) lines.push(`- Confidence: ${pct(confidence)}`);
  const inlierRatio = finite(tracking, "inlierRatio");
  if (inlierRatio !== null) lines.push(`- Inlier ratio: ${pct(inlierRatio)}`);
  const forwardBackwardRatio = finite(tracking, "forwardBackwardRatio");
  if (forwardBackwardRatio !== null) {
    lines.push(`- Forward/backward consistency: ${pct(forwardBackwardRatio)}`);
  }
  const residualErrorPx = finite(tracking, "residualErrorPx");
  if (residualErrorPx !== null) {
    lines.push(`- Residual alignment error: ${decimal(residualErrorPx, 3)} px`);
  }
  const featureCount = finite(tracking, "featureCount");
  if (featureCount !== null) lines.push(`- Feature count: ${decimal(featureCount, 0)}`);
  lines.push(
    `- Fallback used: ${tracking["fallbackUsed"] === true ? "yes — fixed ROI fallback" : "no"}`,
    `- Measurement coordinate mode: ${trackingCoordinateModeLabel(coordinateMode)}`
  );
  const trackingError = asNonEmptyString(tracking["error"]);
  if (trackingError !== null) lines.push(`- Tracking error: ${trackingError}`);
  lines.push(
    "- Photometric measurements use fixed ROI coordinates. ROI Tracking / Stabilization is retained as provenance and a quality gate; it is not dynamically stabilized photometry.",
    "- Source media remains immutable."
  );
  return lines;
}

function responseMarkdown(entry: Entry, copy: LabI18n) {
  const request = asLabRecord(entry["request"]);
  const temporal = asLabRecord(request["temporalRequest"]);
  const points = Array.isArray(entry["points"])
    ? entry["points"].map((point) => asLabRecord(point))
    : [];
  const interpretation = asLabRecord(entry["interpretation"]);
  const classification = interpretationLabel(interpretation["classification"], copy);
  const sensorLabel = sensorCompatibilityLabel(interpretation["sensorCompatibility"], copy);
  const comparability = comparabilitySummary(interpretation, copy);
  const lines = reportMeta(entry, `Visibility Response · ${axisLabel(request["axis"])}`);
  lines.push(
    "",
    "## Selection",
    `- Target ROI: ${roiLabel(temporal["roi"])}`,
    `- Background ROI: ${roiLabel(request["backgroundRoi"])}`,
    `- Time: ${decimal(finite(temporal, "startSeconds"))}–${decimal(finite(temporal, "endSeconds"))} s`,
    "",
    "## Assessment",
    `- ${classification}`
  );
  if (comparability !== "") lines.push(`- ${comparability}`);
  if (sensorLabel !== "") lines.push(`- ${sensorLabel}`);
  lines.push(
    "",
    "## Measurements",
    "| Axis | Target visibility | Background visibility | Δ Visibility | Δ Edge | Δ Recovered dark | Δ Near-black |",
    "| ---: | ---: | ---: | ---: | ---: | ---: | ---: |"
  );
  points.forEach(function (point) {
    const target = asLabRecord(point["target"]);
    const background = asLabRecord(point["background"]);
    const differential = asLabRecord(point["differential"]);
    const value =
      typeof point["value"] === "number" ? String(Number(point["value"].toFixed(3))) : "—";
    lines.push(
      `| ${value} | ${pct(finite(target, "visibilityScore"))} | ${pct(finite(background, "visibilityScore"))} | ${signed(finite(differential, "visibilityScore"))} | ${signed(finite(differential, "edgeEnergy"))} | ${signed(finite(differential, "recoveredDarkFraction"))} | ${signed(finite(differential, "nearBlackFraction"))} |`
    );
  });
  return lines.join("\n");
}

function transitionMarkdown(entry: Entry, copy: LabI18n) {
  const request = asLabRecord(entry["request"]);
  const temporal = asLabRecord(request["temporalRequest"]);
  const phases = Array.isArray(entry["phases"])
    ? entry["phases"].map((phase) => asLabRecord(phase))
    : [];
  const interpretation = asLabRecord(entry["interpretation"]);
  const lines = reportMeta(entry, "Appearance / Disappearance Transition");
  lines.push(
    "",
    "## Selection",
    `- Target ROI: ${roiLabel(temporal["roi"])}`,
    `- Background ROI: ${roiLabel(request["backgroundRoi"])}`,
    `- Event: ${decimal(finite(request, "eventSeconds"))} s`,
    "",
    "## Assessment",
    `- ${interpretationLabel(interpretation["classification"], copy)}`,
    "",
    "## Measurements",
    "| Phase | Target visibility | Background visibility | Δ Visibility | Δ Frame | Δ Edge persistence | Δ Chroma |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |"
  );
  phases.forEach(function (phase) {
    const target = asLabRecord(phase["target"]);
    const background = asLabRecord(phase["background"]);
    const differential = asLabRecord(phase["differential"]);
    lines.push(
      `| ${(asNonEmptyString(phase["phase"]) || "phase").toUpperCase()} | ${pct(finite(target, "visibilityScore"))} | ${pct(finite(background, "visibilityScore"))} | ${signed(finite(differential, "visibilityScore"))} | ${signed(finite(differential, "frameDifferenceEnergy"))} | ${signed(finite(differential, "edgePersistence"))} | ${signed(finite(differential, "chromaDistance"))} |`
    );
  });
  return lines.join("\n");
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

function codecMarkdown(entry: Entry, copy: LabI18n) {
  const steps = Array.isArray(entry["steps"])
    ? entry["steps"].map((step) => asLabRecord(step))
    : [];
  const request = asLabRecord(entry["request"]);
  const temporal = asLabRecord(request["temporalRequest"]);
  const lines = reportMeta(entry, "Codec Degradation · CRF 18 → 24 → 30 → 36 → 42");
  lines.push(
    "",
    "## Selection",
    `- Target ROI: ${roiLabel(temporal["roi"])}`,
    `- Background ROI: ${roiLabel(request["backgroundRoi"])}`,
    "",
    "## Assessment",
    `- ${codecInterpretation(steps, copy)}`,
    "",
    "## Measurements",
    "| Step | Target Δ Frame | Background Δ Frame | Differential | Δ Edge diff. |",
    "| --- | ---: | ---: | ---: | ---: |"
  );
  steps.forEach(function (step) {
    const target = asLabRecord(asLabRecord(step["target"])["delta"]);
    const backgroundEntry = asLabRecord(step["background"]);
    const background = asLabRecord(backgroundEntry["delta"]);
    const differential = asLabRecord(step["differential"]);
    lines.push(
      `| CRF ${String(step["crf"] ?? "—")} | ${signed(finite(target, "meanFrameDifferenceEnergy"))} | ${Object.keys(backgroundEntry).length === 0 ? "—" : signed(finite(background, "meanFrameDifferenceEnergy"))} | ${signed(finite(differential, "meanFrameDifferenceEnergy"))} | ${signed(finite(differential, "meanEdgeEnergy"))} |`
    );
  });
  return lines.join("\n");
}

export function buildLaboratoryVisualReportModel(
  entry: Entry,
  copy: LabI18n
): AnalysisReportModel | null {
  const kind = entry["kind"];
  if (kind !== "visibility-response" && kind !== "appearance-transition") return null;
  const request = asLabRecord(entry["request"]);
  const title =
    kind === "visibility-response"
      ? `Visibility Response · ${axisLabel(request["axis"])}`
      : "Appearance / Disappearance Transition";
  const interpretation = asLabRecord(entry["interpretation"]);
  const summaryStatus =
    kind === "visibility-response"
      ? interpretation["trackingQualityGate"] === "limited"
        ? "roi-tracking-quality-limits-response-result"
        : interpretation["classification"]
      : interpretation["classification"];
  const report =
    kind === "visibility-response"
      ? responseMarkdown(entry, copy)
      : transitionMarkdown(entry, copy);
  const tracking = visualTrackingMarkdown(entry);
  const sections: AnalysisReportModel["sections"] = [{ lines: report.split("\n"), title }];
  if (tracking.length > 0) {
    sections.push({ lines: ["", ...tracking], title: "ROI Tracking / Stabilization" });
  }
  return {
    classification: asNonEmptyString(interpretation["classification"]),
    createdAt: asNonEmptyString(entry["createdAt"]) ?? "",
    id: asNonEmptyString(entry["id"]) ?? "",
    kind,
    sections,
    status: asNonEmptyString(entry["status"]),
    summary: formatLaboratoryAnalysisReportSummary(summaryStatus, copy),
    title,
  };
}

function formatAnalysisReportModel(model: AnalysisReportModel) {
  return model.sections.map((section) => section.lines.join("\n")).join("\n");
}

export function formatLaboratoryVisualReportMarkdown(entry: Entry, copy: LabI18n): string {
  const model = buildLaboratoryVisualReportModel(entry, copy);
  if (model !== null) return formatAnalysisReportModel(model);
  if (entry["kind"] !== "recompression-ladder") return "";
  const report = codecMarkdown(entry, copy);
  const tracking = visualTrackingMarkdown(entry);
  return tracking.length === 0 ? report : `${report}\n\n${tracking.join("\n")}`;
}

function reportActions(entry: Entry, copy: LabI18n, _kind: VisualReportKind) {
  const markdown = formatLaboratoryVisualReportMarkdown(entry, copy);
  const copyLabel = copy.locale === "tr" ? "Kopyala" : "Copy";
  const copiedLabel = copy.locale === "tr" ? "Kopyalandı" : "Copied";
  const exportLabel = copy.locale === "tr" ? "MD Dışa Aktar" : "Export MD";
  const exportedLabel = copy.locale === "tr" ? "Dışa aktarıldı" : "Exported";
  const failedLabel = copy.locale === "tr" ? "Başarısız" : "Failed";
  return `
    <div class="labx-controls-actions labx-visual-report-actions">
      <button class="labx-inline-action" type="button" data-lab-report-copy="true" data-lab-report-idle-label="${escapeHtml(copyLabel)}" data-lab-report-success-label="${escapeHtml(copiedLabel)}" data-lab-report-error-label="${escapeHtml(failedLabel)}">${escapeHtml(copyLabel)}</button>
      <button class="labx-inline-action" type="button" data-lab-report-export="true" data-lab-report-idle-label="${escapeHtml(exportLabel)}" data-lab-report-success-label="${escapeHtml(exportedLabel)}" data-lab-report-error-label="${escapeHtml(failedLabel)}">${escapeHtml(exportLabel)}</button>
    </div>
    <textarea hidden data-lab-report-markdown="true">${escapeHtml(markdown)}</textarea>`;
}

function exportableAttributes(entry: Entry, kind: VisualReportKind) {
  const createdAt = asNonEmptyString(entry["createdAt"]) || "report";
  const request = asLabRecord(entry["request"]);
  const axis = kind === "response" ? `-${axisLabel(request["axis"])}` : "";
  return `data-lab-exportable-report="true" data-lab-report-filename="${escapeHtml(`laboratory-${kind}${axis}-${createdAt}`)}"`;
}

function renderResponse(entry: Entry, copy: LabI18n) {
  const reportModel = buildLaboratoryVisualReportModel(entry, copy);
  if (reportModel === null) return "";
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
  const comparability = comparabilitySummary(interpretation, copy);
  return `
    <section class="labx-strip-live-comparison" data-lab-response-summary="true" ${exportableAttributes(entry, "response")}>
      <div class="labx-strip-live-comparison__header">
        <strong>${escapeHtml(reportModel.title)}</strong>
        <span>${escapeHtml(reportModel.summary)}</span>
        ${reportActions(entry, copy, "response")}
      </div>
      ${comparability === "" ? "" : `<p class="labx-strip-live-note">${escapeHtml(comparability)}</p>`}
      ${sensorLabel === "" ? "" : `<p class="labx-strip-live-note">${escapeHtml(sensorLabel)}</p>`}
      <p class="labx-strip-live-note">${escapeHtml(
        `Target ROI: ${roiLabel(temporal["roi"])} · Background ROI: ${roiLabel(request["backgroundRoi"])}`
      )}</p>
      <p class="labx-strip-live-note">TARGET&nbsp;&nbsp;&nbsp;&nbsp;${escapeHtml(spark(targetCurve))}<br/>BACKGROUND&nbsp;${escapeHtml(spark(backgroundCurve))}<br/>DIFFERENCE&nbsp;${escapeHtml(
        spark(differentialCurve.map((value) => Math.max(0, Math.min(1, 0.5 + value))))
      )}</p>
      <div class="labx-strip-live-comparison__table-wrap">
        <table>
          <thead><tr><th scope="col">Axis</th><th scope="col">Target</th><th scope="col">Background</th><th scope="col">Δ Visibility</th><th scope="col">Δ Edge</th><th scope="col">Δ Recovered dark</th><th scope="col">Δ Near-black</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>`;
}

function renderTransition(entry: Entry, copy: LabI18n) {
  const reportModel = buildLaboratoryVisualReportModel(entry, copy);
  if (reportModel === null) return "";
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
        <th scope="row">${escapeHtml((asNonEmptyString(phase["phase"]) || "phase").toUpperCase())}</th>
        <td>${escapeHtml(`${bars(finite(target, "visibilityScore"))} ${pct(finite(target, "visibilityScore"))}`)}</td>
        <td>${escapeHtml(`${bars(finite(background, "visibilityScore"))} ${pct(finite(background, "visibilityScore"))}`)}</td>
        <td>${escapeHtml(signed(finite(differential, "visibilityScore")))}</td>
        <td>${escapeHtml(signed(finite(differential, "frameDifferenceEnergy")))}</td>
        <td>${escapeHtml(signed(finite(differential, "edgePersistence")))}</td>
        <td>${escapeHtml(signed(finite(differential, "chromaDistance")))}</td>
      </tr>`;
    })
    .join("");
  return `
    <section class="labx-strip-live-comparison" data-lab-transition-summary="true" ${exportableAttributes(entry, "transition")}>
      <div class="labx-strip-live-comparison__header">
        <strong>${escapeHtml(reportModel.title)}</strong>
        <span>${escapeHtml(reportModel.summary)}</span>
        ${reportActions(entry, copy, "transition")}
      </div>
      <p class="labx-strip-live-note">${escapeHtml(
        `Target ROI: ${roiLabel(temporal["roi"])} · Background ROI: ${roiLabel(request["backgroundRoi"])} · Event: ${typeof request["eventSeconds"] === "number" ? request["eventSeconds"].toFixed(3) : "—"} s`
      )}</p>
      <div class="labx-strip-live-comparison__table-wrap">
        <table>
          <thead><tr><th scope="col">Phase</th><th scope="col">Target</th><th scope="col">Background</th><th scope="col">Δ Visibility</th><th scope="col">Δ Frame</th><th scope="col">Δ Edge persist.</th><th scope="col">Δ Chroma</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>`;
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
        <th scope="row">CRF ${escapeHtml(String(step["crf"] ?? "—"))}</th>
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
    <section class="labx-strip-live-comparison" data-lab-recompression-ladder="true" ${exportableAttributes(entry, "codec")}>
      <div class="labx-strip-live-comparison__header">
        <strong>Codec Degradation · CRF 18 → 24 → 30 → 36 → 42</strong>
        <span>${escapeHtml(codecInterpretation(steps, copy))}</span>
        ${reportActions(entry, copy, "codec")}
      </div>
      <div class="labx-strip-live-comparison__table-wrap">
        <table>
          <thead><tr><th scope="col">Step</th><th scope="col">Target Δ Frame</th><th scope="col">Background Δ Frame</th><th scope="col">Differential</th><th scope="col">Δ Edge diff.</th></tr></thead>
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
