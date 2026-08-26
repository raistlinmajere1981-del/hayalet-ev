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

function signedPct(value: number | null) {
  if (value === null) return "—";
  const rounded = Math.round(value * 100);
  return `${rounded >= 0 ? "+" : ""}${String(rounded)}%`;
}

function decimal(value: number | null, digits = 2) {
  return value === null ? "—" : String(Number(value.toFixed(digits)));
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

function structuralAssessmentLabel(value: unknown, copy: LabI18n) {
  const kind = asNonEmptyString(value) || "structural-result-uncertain";
  if (copy.locale !== "tr") {
    if (kind === "target-and-control-structurally-similar") {
      return "Target and control show similar structural change.";
    }
    if (kind === "structural-change-target-localized") {
      return "Target structure decreases more than the scene controls; the excess is target-localized in this measurement.";
    }
    if (kind === "structural-change-scene-wide-with-target-excess") {
      return "Part of the structural change is scene-wide, with additional change at the target.";
    }
    if (kind === "structural-change-scene-wide") {
      return "Structural change is distributed across the scene controls.";
    }
    if (kind === "roi-drift-may-affect-result") {
      return "Camera / ROI drift may be large enough to affect the structural result.";
    }
    return "Structural evidence is uncertain.";
  }
  if (kind === "target-and-control-structurally-similar") {
    return "Target ve control benzer yapısal değişim gösteriyor.";
  }
  if (kind === "structural-change-target-localized") {
    return "Target yapısal imzası sahne kontrollerinden daha fazla azalıyor; ölçülen ek fark target'a lokalize.";
  }
  if (kind === "structural-change-scene-wide-with-target-excess") {
    return "Değişimin bir bölümü sahne geneline yayılıyor; target'ta ek yapısal değişim ölçülüyor.";
  }
  if (kind === "structural-change-scene-wide") {
    return "Yapısal değişim sahne kontrollerine de yayılıyor.";
  }
  if (kind === "roi-drift-may-affect-result") {
    return "Kamera / ROI drift'i structural sonucu etkileyebilecek düzeyde.";
  }
  return "Structural evidence belirsiz.";
}

function photometricAssessmentLabel(value: unknown, copy: LabI18n) {
  const kind = asNonEmptyString(value) || "result-uncertain";
  if (copy.locale !== "tr") {
    if (kind === "target-and-background-change-together")
      return "Target/background change together.";
    if (kind === "change-localized-to-target")
      return "Photometric change is localized toward target.";
    return "Photometric result is uncertain.";
  }
  if (kind === "target-and-background-change-together")
    return "Target/background birlikte değişiyor.";
  if (kind === "change-localized-to-target")
    return "Fotometrik değişim target'a lokalize görünüyor.";
  return "Fotometrik sonuç belirsiz.";
}

function convergenceAssessmentLabel(value: unknown, copy: LabI18n) {
  const kind = asNonEmptyString(value) || "reference-convergence-uncertain";
  if (copy.locale !== "tr") {
    if (kind === "target-loss-with-reference-convergence") {
      return "Target loses PRE structure while converging toward the user-defined background reference.";
    }
    if (kind === "reference-convergence-without-strong-target-loss") {
      return "The target region converges toward the reference, without strong accompanying Target structural loss.";
    }
    if (kind === "target-loss-without-reference-convergence") {
      return "Target structural loss is measured without clear convergence toward the background reference.";
    }
    return "Background-reference convergence is uncertain.";
  }
  if (kind === "target-loss-with-reference-convergence") {
    return "Target PRE yapısını kaybederken kullanıcı tanımlı arka plan referansına yapısal yakınlaşma ölçülüyor.";
  }
  if (kind === "reference-convergence-without-strong-target-loss") {
    return "Arka plan referansına yakınlaşma ölçülüyor, ancak güçlü Target structural loss eşlik etmiyor.";
  }
  if (kind === "target-loss-without-reference-convergence") {
    return "Target yapısal kayıp gösteriyor, ancak arka plan referansına belirgin yakınlaşma ölçülmüyor.";
  }
  return "Arka plan referansına structural yakınlaşma belirsiz.";
}

function convergenceShapeLabel(value: unknown, copy: LabI18n) {
  const shape = asNonEmptyString(value) || "weak-or-nonconvergent";
  if (copy.locale !== "tr") {
    if (shape === "gradual") return "gradual";
    if (shape === "abrupt") return "abrupt";
    if (shape === "mixed") return "mixed";
    return "weak / non-convergent";
  }
  if (shape === "gradual") return "kademeli";
  if (shape === "abrupt") return "ani";
  if (shape === "mixed") return "karma";
  return "zayıf / yakınlaşma yok";
}

function stabilityRiskLabel(value: unknown, copy: LabI18n) {
  const risk = asNonEmptyString(value) || "unknown";
  if (copy.locale !== "tr") return risk;
  if (risk === "negligible") return "ihmal edilebilir";
  if (risk === "low") return "düşük";
  if (risk === "moderate") return "orta";
  if (risk === "high") return "yüksek";
  return "bilinmiyor";
}

function comparabilityLabel(value: unknown, copy: LabI18n) {
  const record = asLabRecord(value);
  const score = finite(record, "score");
  if (score === null) return "";
  const status = asNonEmptyString(record["status"]) || "unknown";
  if (copy.locale !== "tr") {
    return `Control comparability: ${status} (${pct(score)}) — measurement-quality only.`;
  }
  const localized =
    status === "high"
      ? "yüksek"
      : status === "medium"
        ? "orta"
        : status === "low"
          ? "düşük"
          : "bilinmiyor";
  return `Control karşılaştırılabilirliği: ${localized} (${pct(score)}) — yalnız measurement-quality göstergesi.`;
}

function stabilitySummary(value: unknown, copy: LabI18n) {
  const stability = asLabRecord(value);
  const mode = asNonEmptyString(stability["mode"]);
  if (mode === null) return "";
  const confidence = finite(stability, "trackingConfidence");
  const dx = finite(stability, "netDx");
  const dy = finite(stability, "netDy");
  const peak = finite(stability, "peakDisplacement");
  const risk = stabilityRiskLabel(stability["risk"], copy);
  const fallback = stability["fallbackUsed"] === true;
  if (copy.locale !== "tr") {
    return `ROI stabilization: ${mode} · confidence ${pct(confidence)} · net dx/dy ${decimal(dx)} / ${decimal(dy)} px · peak ${decimal(peak)} px · drift risk ${risk}${fallback ? " · unreliable tracking, fixed ROI fallback used" : ""}`;
  }
  return `ROI stabilization: ${mode} · confidence ${pct(confidence)} · net dx/dy ${decimal(dx)} / ${decimal(dy)} px · peak ${decimal(peak)} px · drift riski ${risk}${fallback ? " · tracking güvenilmez, fixed ROI fallback kullanıldı" : ""}`;
}

function structuralMetrics(roleValue: unknown) {
  return asLabRecord(asLabRecord(roleValue)["metrics"]);
}

function hasRole(value: unknown) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function phaseLabel(value: string, copy: LabI18n) {
  if (copy.locale !== "tr") return value.toUpperCase();
  return value.toUpperCase();
}

function convergenceTimeline(structural: Entry) {
  const revealed = asLabRecord(structural["revealedBackground"]);
  return Array.isArray(revealed["timeline"])
    ? revealed["timeline"].map((entry) => asLabRecord(entry))
    : [];
}

function convergencePointForOffset(structural: Entry, offsetSeconds: number | null) {
  if (offsetSeconds === null) return null;
  return convergenceTimeline(structural).reduce<Entry | null>(function (best, point) {
    const offset = finite(point, "offsetSeconds");
    if (offset === null) return best;
    if (best === null) return point;
    const bestOffset = finite(best, "offsetSeconds");
    if (bestOffset === null) return point;
    return Math.abs(offset - offsetSeconds) < Math.abs(bestOffset - offsetSeconds) ? point : best;
  }, null);
}

function convergenceMetrics(point: unknown) {
  return asLabRecord(asLabRecord(point)["metrics"]);
}

function structuralPhaseRows(structural: Entry, copy: LabI18n) {
  const phaseSummary = asLabRecord(structural["phaseSummary"]);
  return ["pre", "event", "post"]
    .map(function (phaseName) {
      const pointValue = phaseSummary[phaseName];
      if (!hasRole(pointValue)) return "";
      const point = asLabRecord(pointValue);
      const target = structuralMetrics(point["target"]);
      const control = hasRole(point["control"]) ? structuralMetrics(point["control"]) : null;
      const background = structuralMetrics(point["background"]);
      const differential = asLabRecord(point["differential"]);
      return `<tr>
        <th scope="row">${escapeHtml(phaseLabel(phaseName, copy))}</th>
        <td>${escapeHtml(pct(finite(target, "structuralPersistence")))}</td>
        <td>${escapeHtml(control === null ? "—" : pct(finite(control, "structuralPersistence")))}</td>
        <td>${escapeHtml(pct(finite(background, "structuralPersistence")))}</td>
        <td>${escapeHtml(signedPct(finite(differential, "targetVsControlStructuralLoss")))}</td>
        <td>${escapeHtml(signedPct(finite(differential, "targetVsBackgroundStructuralLoss")))}</td>
      </tr>`;
    })
    .join("");
}

function structuralTimelineRows(structural: Entry) {
  const timeline = Array.isArray(structural["timeline"])
    ? structural["timeline"].map((entry) => asLabRecord(entry))
    : [];
  return timeline
    .map(function (point) {
      const target = structuralMetrics(point["target"]);
      const control = hasRole(point["control"]) ? structuralMetrics(point["control"]) : null;
      const background = structuralMetrics(point["background"]);
      const differential = asLabRecord(point["differential"]);
      const offset = finite(point, "offsetSeconds");
      const referencePoint = convergencePointForOffset(structural, offset);
      const referenceMetrics = convergenceMetrics(referencePoint);
      return `<tr>
        <th scope="row">${escapeHtml(offset === null ? "—" : `${offset >= 0 ? "+" : ""}${decimal(offset, 1)} s`)}</th>
        <td>${escapeHtml(pct(finite(target, "structuralSimilarity")))}</td>
        <td>${escapeHtml(pct(finite(target, "normalizedPixelCorrelation")))}</td>
        <td>${escapeHtml(pct(finite(target, "edgeSimilarity")))}</td>
        <td>${escapeHtml(pct(finite(target, "structuralPersistence")))}</td>
        <td>${escapeHtml(control === null ? "—" : pct(finite(control, "structuralPersistence")))}</td>
        <td>${escapeHtml(pct(finite(background, "structuralPersistence")))}</td>
        <td>${escapeHtml(pct(finite(referenceMetrics, "structuralPersistence")))}</td>
        <td>${escapeHtml(signedPct(finite(differential, "targetVsControlStructuralLoss")))}</td>
      </tr>`;
    })
    .join("");
}

function photometricPhaseRows(entry: Entry) {
  const phases = Array.isArray(entry["phases"])
    ? entry["phases"].map((phase) => asLabRecord(phase))
    : [];
  return phases
    .map(function (phase) {
      const target = asLabRecord(phase["target"]);
      const background = asLabRecord(phase["background"]);
      const control = hasRole(phase["control"]) ? asLabRecord(phase["control"]) : null;
      const targetVsControl = hasRole(phase["targetVsControl"])
        ? asLabRecord(phase["targetVsControl"])
        : null;
      const targetVsBackground = asLabRecord(
        phase["targetVsBackground"] ?? phase["differential"]
      );
      return `<tr>
        <th scope="row">${escapeHtml((asNonEmptyString(phase["phase"]) || "phase").toUpperCase())}</th>
        <td>${escapeHtml(pct(finite(target, "visibilityScore")))}</td>
        <td>${escapeHtml(control === null ? "—" : pct(finite(control, "visibilityScore")))}</td>
        <td>${escapeHtml(pct(finite(background, "visibilityScore")))}</td>
        <td>${escapeHtml(targetVsControl === null ? "—" : signedPct(finite(targetVsControl, "visibilityScore")))}</td>
        <td>${escapeHtml(signedPct(finite(targetVsBackground, "visibilityScore")))}</td>
      </tr>`;
    })
    .join("");
}

function markdownCell(value: string) {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function pushBackgroundReferenceMarkdown(lines: string[], structural: Entry, copy: LabI18n) {
  const revealed = asLabRecord(structural["revealedBackground"]);
  const status = asNonEmptyString(revealed["status"]);
  if (status !== "assessed") {
    if (status === "unavailable") {
      lines.push(
        "",
        "## Background Reference Convergence",
        `- Status: unavailable${asNonEmptyString(revealed["error"]) === null ? "" : ` — ${asNonEmptyString(revealed["error"])}`}`
      );
    }
    return;
  }
  const assessment = asLabRecord(revealed["assessment"]);
  const phaseSummary = asLabRecord(revealed["phaseSummary"]);
  lines.push(
    "",
    "## Background Reference Convergence",
    `- Reference time: ${decimal(finite(revealed, "referenceTimeSeconds"), 3)} s`,
    `- Assessment: ${convergenceAssessmentLabel(assessment["classification"], copy)}`,
    `- Transition shape: ${convergenceShapeLabel(assessment["transitionShape"], copy)}`,
    `- Convergence gain: ${signedPct(finite(assessment, "convergenceGain"))}`,
    `- Edge convergence gain: ${signedPct(finite(assessment, "edgeConvergenceGain"))}`,
    `- Target structural loss at peak convergence: ${pct(finite(assessment, "targetStructuralLossAtPeak"))}`,
    `- Peak post convergence: ${pct(finite(assessment, "peakPostConvergence"))} at ${decimal(finite(assessment, "peakPostOffsetSeconds"), 1)} s`,
    "| Phase | Reference convergence | SSIM-like | Correlation | Edge convergence |",
    "| --- | ---: | ---: | ---: | ---: |"
  );
  ["pre", "event", "post", "peakPost"].forEach(function (phaseName) {
    const point = asLabRecord(phaseSummary[phaseName]);
    if (Object.keys(point).length === 0) return;
    const metrics = convergenceMetrics(point);
    const label = phaseName === "peakPost" ? "PEAK POST" : phaseName.toUpperCase();
    lines.push(
      `| ${label} | ${pct(finite(metrics, "structuralPersistence"))} | ${pct(finite(metrics, "structuralSimilarity"))} | ${pct(finite(metrics, "normalizedPixelCorrelation"))} | ${pct(finite(metrics, "edgeSimilarity"))} |`
    );
  });
}

export function formatLaboratoryStructuralTransitionMarkdown(entry: Entry, copy: LabI18n) {
  const structural = asLabRecord(entry["structural"]);
  const request = asLabRecord(entry["request"]);
  const temporal = asLabRecord(request["temporalRequest"]);
  const interpretation = asLabRecord(entry["interpretation"]);
  const assessment = asLabRecord(structural["assessment"]);
  const stability = asLabRecord(structural["roiStability"]);
  const revealed = asLabRecord(structural["revealedBackground"]);
  const revealedAssessment = asLabRecord(revealed["assessment"]);
  const controlComparability = interpretation["controlComparability"];
  const lines = ["# Hayalet Ev Laboratory — Structural Transition"];
  const createdAt = asNonEmptyString(entry["createdAt"]);
  const sourcePath = asNonEmptyString(entry["sourcePath"]);
  if (createdAt !== null) lines.push(`- Created: ${markdownCell(createdAt)}`);
  if (sourcePath !== null) lines.push(`- Source: ${markdownCell(sourcePath)}`);
  lines.push("- Interpretation policy: measurement only; no real/fake or mechanism verdict.");
  lines.push(
    "",
    "## Selection",
    `- Target ROI: ${roiLabel(temporal["roi"])}`,
    `- Control ROI: ${roiLabel(request["controlRoi"])}`,
    `- Background ROI: ${roiLabel(request["backgroundRoi"])}`,
    `- Event: ${decimal(finite(request, "eventSeconds"), 3)} s`
  );
  if (revealed["status"] === "assessed") {
    lines.push(
      `- Background reference: ${decimal(finite(revealed, "referenceTimeSeconds"), 3)} s · same Target ROI coordinates`
    );
  }
  lines.push(
    "",
    "## Assessment",
    `- Structural: ${structuralAssessmentLabel(assessment["classification"], copy)}`,
    `- Photometric baseline: ${photometricAssessmentLabel(interpretation["photometricClassification"], copy)}`
  );
  if (revealed["status"] === "assessed") {
    lines.push(
      `- Background convergence: ${convergenceAssessmentLabel(revealedAssessment["classification"], copy)}`,
      `- Convergence shape: ${convergenceShapeLabel(revealedAssessment["transitionShape"], copy)}`
    );
  }
  const controlQuality = comparabilityLabel(controlComparability, copy);
  if (controlQuality !== "") lines.push(`- ${controlQuality}`);
  const stabilityText = stabilitySummary(stability, copy);
  if (stabilityText !== "") lines.push(`- ${stabilityText}`);

  const phases = Array.isArray(entry["phases"])
    ? entry["phases"].map((phase) => asLabRecord(phase))
    : [];
  lines.push(
    "",
    "## Photometric PRE / EVENT / POST",
    "| Phase | Target visibility | Control visibility | Background visibility | Target-Control Δ | Target-Background Δ |",
    "| --- | ---: | ---: | ---: | ---: | ---: |"
  );
  phases.forEach(function (phase) {
    const target = asLabRecord(phase["target"]);
    const background = asLabRecord(phase["background"]);
    const control = hasRole(phase["control"]) ? asLabRecord(phase["control"]) : null;
    const targetVsControl = hasRole(phase["targetVsControl"])
      ? asLabRecord(phase["targetVsControl"])
      : null;
    const targetVsBackground = asLabRecord(
      phase["targetVsBackground"] ?? phase["differential"]
    );
    lines.push(
      `| ${(asNonEmptyString(phase["phase"]) || "phase").toUpperCase()} | ${pct(finite(target, "visibilityScore"))} | ${control === null ? "—" : pct(finite(control, "visibilityScore"))} | ${pct(finite(background, "visibilityScore"))} | ${targetVsControl === null ? "—" : signedPct(finite(targetVsControl, "visibilityScore"))} | ${signedPct(finite(targetVsBackground, "visibilityScore"))} |`
    );
  });

  const phaseSummary = asLabRecord(structural["phaseSummary"]);
  lines.push(
    "",
    "## Structural PRE / EVENT / POST",
    "| Phase | Target persistence | Control persistence | Background persistence | Target-Control structural loss | Target-Background structural loss |",
    "| --- | ---: | ---: | ---: | ---: | ---: |"
  );
  ["pre", "event", "post"].forEach(function (phaseName) {
    const pointValue = phaseSummary[phaseName];
    if (!hasRole(pointValue)) return;
    const point = asLabRecord(pointValue);
    const target = structuralMetrics(point["target"]);
    const control = hasRole(point["control"]) ? structuralMetrics(point["control"]) : null;
    const background = structuralMetrics(point["background"]);
    const differential = asLabRecord(point["differential"]);
    lines.push(
      `| ${phaseName.toUpperCase()} | ${pct(finite(target, "structuralPersistence"))} | ${control === null ? "—" : pct(finite(control, "structuralPersistence"))} | ${pct(finite(background, "structuralPersistence"))} | ${signedPct(finite(differential, "targetVsControlStructuralLoss"))} | ${signedPct(finite(differential, "targetVsBackgroundStructuralLoss"))} |`
    );
  });

  const timeline = Array.isArray(structural["timeline"])
    ? structural["timeline"].map((point) => asLabRecord(point))
    : [];
  lines.push(
    "",
    "## Structural Timeline",
    "| Offset | Target SSIM-like | Target corr. | Target edge sim. | Target persistence | Control persistence | Background persistence | Reference convergence | Target-Control loss Δ |",
    "| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |"
  );
  timeline.forEach(function (point) {
    const target = structuralMetrics(point["target"]);
    const control = hasRole(point["control"]) ? structuralMetrics(point["control"]) : null;
    const background = structuralMetrics(point["background"]);
    const differential = asLabRecord(point["differential"]);
    const offset = finite(point, "offsetSeconds");
    const offsetText =
      offset === null ? "—" : `${offset >= 0 ? "+" : ""}${decimal(offset, 1)} s`;
    const referencePoint = convergencePointForOffset(structural, offset);
    const referenceMetrics = convergenceMetrics(referencePoint);
    lines.push(
      `| ${offsetText} | ${pct(finite(target, "structuralSimilarity"))} | ${pct(finite(target, "normalizedPixelCorrelation"))} | ${pct(finite(target, "edgeSimilarity"))} | ${pct(finite(target, "structuralPersistence"))} | ${control === null ? "—" : pct(finite(control, "structuralPersistence"))} | ${pct(finite(background, "structuralPersistence"))} | ${pct(finite(referenceMetrics, "structuralPersistence"))} | ${signedPct(finite(differential, "targetVsControlStructuralLoss"))} |`
    );
  });

  pushBackgroundReferenceMarkdown(lines, structural, copy);

  lines.push(
    "",
    "## ROI Stability",
    `- Mode: ${asNonEmptyString(stability["mode"]) || "off"}`,
    `- Tracking confidence: ${pct(finite(stability, "trackingConfidence"))}`,
    `- Net dx/dy: ${decimal(finite(stability, "netDx"))} / ${decimal(finite(stability, "netDy"))} px`,
    `- Peak displacement: ${decimal(finite(stability, "peakDisplacement"))} px`,
    `- Drift risk: ${stabilityRiskLabel(stability["risk"], copy)} (${pct(finite(stability, "riskRatio"))} of target minimum dimension)`,
    `- Fallback used: ${stability["fallbackUsed"] === true ? "yes — fixed ROI measurements" : "no"}`,
    "",
    "## Method",
    "- Structural baseline: PRE midpoint template.",
    "- Structural similarity: deterministic global grayscale SSIM-like metric; not canonical windowed SSIM.",
    "- Correlation: grayscale Pearson correlation; report uses normalized correlation for compact comparison.",
    "- Edge similarity: gradient-map correlation.",
    "- Stabilization: translation-only reference tracking; rotation/zoom/perspective are not modeled."
  );
  if (revealed["status"] === "assessed") {
    lines.push(
      "- Background-reference convergence: user-selected reference time, sampled from the same normalized Target ROI coordinates.",
      "- Reference-time alignment: fixed ROI only; camera translation between the event and reference frame is not modeled.",
      "- Convergence describes image-structure similarity only; it does not identify a physical or compositing mechanism."
    );
  } else {
    lines.push(
      "- Background-reference convergence: not assessed; capture a clean reference frame to enable this measurement."
    );
  }
  return lines.join("\n");
}

function reportActions(entry: Entry, copy: LabI18n) {
  const markdown = formatLaboratoryStructuralTransitionMarkdown(entry, copy);
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

export function renderWorkspaceStructuralTransitionSummary(
  editConfig: LabEditConfig | null,
  copy: LabI18n
) {
  const entry = history(editConfig).find(function (candidate) {
    return (
      candidate["kind"] === "appearance-transition" &&
      Object.keys(asLabRecord(candidate["structural"])).length > 0
    );
  });
  if (entry === undefined) return "";
  const structural = asLabRecord(entry["structural"]);
  if (structural["status"] === "unavailable") {
    const error = asNonEmptyString(structural["error"]);
    return `
      <section class="labx-strip-live-comparison" data-lab-structural-transition-summary="true">
        <div class="labx-strip-live-comparison__header">
          <strong>Structural Transition</strong>
          <span>${escapeHtml(copy.locale === "tr" ? "Structural ölçüm kullanılamadı; eski fotometrik Transition sonucu korunuyor." : "Structural measurement unavailable; legacy photometric Transition result remains available.")}</span>
        </div>
        ${error === null ? "" : `<p class="labx-strip-live-note">${escapeHtml(error)}</p>`}
      </section>`;
  }

  const request = asLabRecord(entry["request"]);
  const temporal = asLabRecord(request["temporalRequest"]);
  const interpretation = asLabRecord(entry["interpretation"]);
  const assessment = asLabRecord(structural["assessment"]);
  const stability = asLabRecord(structural["roiStability"]);
  const revealed = asLabRecord(structural["revealedBackground"]);
  const revealedAssessment = asLabRecord(revealed["assessment"]);
  const controlQuality = comparabilityLabel(interpretation["controlComparability"], copy);
  const stabilityText = stabilitySummary(stability, copy);
  const createdAt = (asNonEmptyString(entry["createdAt"]) || "report").replace(
    /[^a-zA-Z0-9._-]+/g,
    "-"
  );
  const convergenceNote =
    revealed["status"] === "assessed"
      ? `${convergenceAssessmentLabel(revealedAssessment["classification"], copy)} · ${copy.locale === "tr" ? "şekil" : "shape"}: ${convergenceShapeLabel(revealedAssessment["transitionShape"], copy)}`
      : "";
  return `
    <section class="labx-strip-live-comparison" data-lab-structural-transition-summary="true" data-lab-exportable-report="true" data-lab-report-filename="laboratory-structural-transition-${escapeHtml(createdAt)}">
      <div class="labx-strip-live-comparison__header">
        <strong>Structural Transition</strong>
        <span>${escapeHtml(structuralAssessmentLabel(assessment["classification"], copy))}</span>
        ${reportActions(entry, copy)}
      </div>
      <p class="labx-strip-live-note">${escapeHtml(`Target ROI: ${roiLabel(temporal["roi"])} · Control ROI: ${roiLabel(request["controlRoi"])} · Background ROI: ${roiLabel(request["backgroundRoi"])}`)}</p>
      ${revealed["status"] === "assessed" ? `<p class="labx-strip-live-note">${escapeHtml(`Background reference: ${decimal(finite(revealed, "referenceTimeSeconds"), 3)} s · ${convergenceNote}`)}</p>` : ""}
      ${controlQuality === "" ? "" : `<p class="labx-strip-live-note">${escapeHtml(controlQuality)}</p>`}
      ${stabilityText === "" ? "" : `<p class="labx-strip-live-note">${escapeHtml(stabilityText)}</p>`}
      <p class="labx-strip-live-note">${escapeHtml(`${copy.locale === "tr" ? "Fotometrik baseline" : "Photometric baseline"}: ${photometricAssessmentLabel(interpretation["photometricClassification"], copy)}`)}</p>
      <div class="labx-strip-live-comparison__table-wrap">
        <table>
          <thead><tr><th scope="col">Phase</th><th scope="col">Target vis.</th><th scope="col">Control vis.</th><th scope="col">Background vis.</th><th scope="col">T-C Δ</th><th scope="col">T-B Δ</th></tr></thead>
          <tbody>${photometricPhaseRows(entry)}</tbody>
        </table>
      </div>
      <div class="labx-strip-live-comparison__table-wrap">
        <table>
          <thead><tr><th scope="col">Structural</th><th scope="col">Target persist.</th><th scope="col">Control persist.</th><th scope="col">Background persist.</th><th scope="col">T-C loss Δ</th><th scope="col">T-B loss Δ</th></tr></thead>
          <tbody>${structuralPhaseRows(structural, copy)}</tbody>
        </table>
      </div>
      <p class="labx-strip-live-note"><strong>TIMELINE</strong> · PRE template'e göre structural response</p>
      <div class="labx-strip-live-comparison__table-wrap">
        <table>
          <thead><tr><th scope="col">t</th><th scope="col">Target SSIM*</th><th scope="col">Target corr.</th><th scope="col">Target edge</th><th scope="col">Target persist.</th><th scope="col">Control persist.</th><th scope="col">Background persist.</th><th scope="col">Reference conv.</th><th scope="col">T-C loss Δ</th></tr></thead>
          <tbody>${structuralTimelineRows(structural)}</tbody>
        </table>
      </div>
      <p class="labx-strip-live-note">${escapeHtml(copy.locale === "tr" ? "* SSIM*: global grayscale SSIM-benzeri deterministik skor; canonical windowed SSIM değildir. Background-reference ölçümü aynı Target ROI koordinatını kullanıcı tarafından seçilen referans zamanda örnekler; referans-zaman kamera hareketi modellenmez." : "* SSIM*: deterministic global grayscale SSIM-like score, not canonical windowed SSIM. Background-reference measurement samples the same Target ROI coordinates at the user-selected reference time; reference-time camera motion is not modeled.")}</p>
    </section>`;
}
