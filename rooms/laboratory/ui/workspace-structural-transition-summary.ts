import { asLabRecord, asNonEmptyString } from "../domain/lab-types.js";
import type { AnalysisReportModel } from "../domain/lab-analysis-results.js";
import type { LabI18n } from "./lab-i18n.js";
import { formatLaboratoryAnalysisReportSummary } from "./workspace-analysis-report-status.js";

type Entry = Record<string, unknown>;

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
    if (kind === "roi-tracking-quality-limits-structural-result") {
      return "Tracking quality limits the structural result; measurements are retained for diagnostics.";
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
  if (kind === "roi-tracking-quality-limits-structural-result") {
    return "Tracking kalitesi structural sonucu sınırlıyor; ölçümler tanı amacıyla korunuyor.";
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

function stabilitySummary(value: unknown, trackingValue: unknown, copy: LabI18n) {
  const stability = asLabRecord(value);
  const tracking = asLabRecord(trackingValue);
  const mode = asNonEmptyString(tracking["mode"]);
  if (mode === null) return "";
  const confidence = finite(tracking, "confidence");
  const quality = asNonEmptyString(tracking["quality"]) || "unreliable";
  const residualError = finite(tracking, "residualErrorPx");
  const risk = stabilityRiskLabel(stability["risk"], copy);
  const fallback = tracking["fallbackUsed"] === true;
  if (copy.locale !== "tr") {
    return `ROI tracking: ${mode} · quality ${quality} · confidence ${pct(confidence)} · residual alignment error ${decimal(residualError, 3)} px · drift risk ${risk}${fallback ? " · fixed ROI fallback used" : ""}`;
  }
  return `ROI tracking: ${mode} · kalite ${quality} · confidence ${pct(confidence)} · residual alignment error ${decimal(residualError, 3)} px · drift riski ${risk}${fallback ? " · fixed ROI fallback kullanıldı" : ""}`;
}

function structuralMetrics(roleValue: unknown) {
  return asLabRecord(asLabRecord(roleValue)["metrics"]);
}

function hasRole(value: unknown) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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

function markdownCell(value: string) {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function trackingQualityText(quality: string, copy: LabI18n) {
  if (copy.locale !== "tr") {
    if (quality === "high") return "HIGH — suitable for small-ROI structural comparison.";
    if (quality === "medium") return "MEDIUM — usable, with tracking diagnostics retained.";
    if (quality === "low") {
      return "LOW — structural differential may contain ROI drift contamination.";
    }
    return "UNRELIABLE — fixed ROI fallback; do not use tracking for a strong structural conclusion.";
  }
  if (quality === "high") return "YÜKSEK — küçük ROI structural karşılaştırması için uygun.";
  if (quality === "medium") return "ORTA — kullanılabilir; tracking diagnostics dikkate alınmalı.";
  if (quality === "low") return "DÜŞÜK — structural differential ROI drift kirliliği içerebilir.";
  return "GÜVENİLMEZ — fixed ROI fallback; güçlü structural çıkarım yapılmamalı.";
}

function coordinateModeLabel(value: string) {
  if (value === "camera-similarity") return "camera similarity";
  if (value === "fixed-roi-fallback") return "fixed ROI fallback";
  if (value === "fixed-roi") return "fixed ROI";
  return value.replaceAll("-", " ");
}

function pushStructuralTrackingMarkdown(
  lines: string[],
  entry: Entry,
  structural: Entry,
  copy: LabI18n
) {
  const tracking = asLabRecord(entry["tracking"]);
  const stability = asLabRecord(structural["roiStability"]);
  const assessment = asLabRecord(structural["assessment"]);
  const interpretation = asLabRecord(entry["interpretation"]);
  const quality = asNonEmptyString(tracking["quality"]) || "unreliable";
  const fallback = tracking["fallbackUsed"] === true;
  const coordinateMode =
    asNonEmptyString(interpretation["structuralCoordinateMode"]) ||
    (fallback ? "fixed-roi-fallback" : "camera-similarity");
  const status = asNonEmptyString(tracking["status"]);
  const algorithm = asNonEmptyString(tracking["algorithm"]);
  const version = finite(tracking, "version");
  const transformModel = asNonEmptyString(tracking["transformModel"]);
  const mode = asNonEmptyString(tracking["mode"]);
  const cacheId = asNonEmptyString(tracking["cacheId"]);
  const confidence = finite(tracking, "confidence");
  const inlierRatio = finite(tracking, "inlierRatio");
  const forwardBackwardRatio = finite(tracking, "forwardBackwardRatio");
  const featureCount = finite(tracking, "featureCount");
  const residualErrorPx = finite(tracking, "residualErrorPx");
  const qualityGate =
    asNonEmptyString(assessment["trackingQualityGate"]) ||
    (fallback || quality === "low" || quality === "unreliable" ? "limited" : "pass");

  lines.push("", "## ROI Tracking / Stabilization");
  if (status !== null) lines.push(`- Status: ${status}`);
  lines.push(
    `- Tracking quality: ${trackingQualityText(quality, copy)}`,
    `- Quality gate: ${qualityGate}`
  );
  if (algorithm !== null) lines.push(`- Algorithm: ${algorithm}`);
  if (version !== null) lines.push(`- Provenance version: ${decimal(version, 0)}`);
  if (transformModel !== null) lines.push(`- Transform model: ${transformModel}`);
  if (mode !== null) lines.push(`- Tracking mode: ${mode}`);
  if (cacheId !== null) lines.push(`- Transform cache: ${cacheId}`);
  const anchorSeconds = finite(tracking, "anchorSeconds");
  if (anchorSeconds !== null) {
    lines.push(`- Anchor/reference frame: ${decimal(anchorSeconds, 3)} s`);
  }
  if (confidence !== null) lines.push(`- Confidence: ${pct(confidence)}`);
  if (inlierRatio !== null) lines.push(`- Inlier ratio: ${pct(inlierRatio)}`);
  if (forwardBackwardRatio !== null) {
    lines.push(`- Forward/backward consistency: ${pct(forwardBackwardRatio)}`);
  }
  if (featureCount !== null) lines.push(`- Feature count: ${decimal(featureCount, 0)}`);
  if (residualErrorPx !== null) {
    lines.push(`- Residual alignment error: ${decimal(residualErrorPx, 3)} px`);
  }
  const peakDisplacement = finite(stability, "peakDisplacement");
  const peakRotation = finite(stability, "peakRotationDegrees");
  const peakScaleDelta = finite(stability, "peakScaleDelta");
  if (peakDisplacement !== null) {
    lines.push(`- Peak displacement: ${decimal(peakDisplacement, 3)} px`);
  }
  if (peakRotation !== null) {
    lines.push(`- Peak rotation: ${decimal(peakRotation, 3)}°`);
  }
  if (peakScaleDelta !== null) {
    lines.push(`- Peak scale Δ: ${decimal(peakScaleDelta, 5)}`);
  }
  lines.push(
    `- Fallback used: ${fallback ? "yes — fixed ROI fallback" : "no"}`,
    `- Measurement coordinate mode: ${coordinateModeLabel(coordinateMode)}`
  );
  const trackingError = asNonEmptyString(tracking["error"]);
  if (trackingError !== null) lines.push(`- Tracking error: ${trackingError}`);
  lines.push(
    "- Target and Control regions are excluded from global camera-feature estimation; Background/Reference is preferred as a local fallback region.",
    "- Structural Target/Control/Background coordinates use the similarity transform when the tracking quality gate passes; fixed ROI is used when tracking is limited.",
    "- Photometric PRE/EVENT/POST measurements use fixed ROI coordinates. Tracking diagnostics are provenance and a quality gate, not dynamically stabilized photometry.",
    "- Source media remains immutable; stabilization changes measurement coordinates only.",
    "- Rotated ROIs are represented by an axis-aligned bounding box after transform; perspective/homography is not modeled."
  );
}

function pushBackgroundReferenceMarkdown(lines: string[], structural: Entry, copy: LabI18n) {
  const revealed = asLabRecord(structural["revealedBackground"]);
  const status = asNonEmptyString(revealed["status"]);
  if (status !== "assessed" && status !== "limited") {
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
  const tracking = asLabRecord(revealed["tracking"]);
  const phaseSummary = asLabRecord(revealed["phaseSummary"]);
  lines.push(
    "",
    "## Background Reference Convergence",
    `- Status: ${
      status === "limited"
        ? `LIMITED — ${asNonEmptyString(assessment["classification"]) || "reference-convergence-uncertain"}`
        : status
    }`,
    `- Reference time: ${decimal(finite(revealed, "referenceTimeSeconds"), 3)} s`,
    `- Assessment: ${convergenceAssessmentLabel(assessment["classification"], copy)}`,
    `- Transition shape: ${convergenceShapeLabel(assessment["transitionShape"], copy)}`,
    `- Convergence gain: ${signedPct(finite(assessment, "convergenceGain"))}`,
    `- Edge convergence gain: ${signedPct(finite(assessment, "edgeConvergenceGain"))}`,
    `- Target structural loss at peak convergence: ${pct(finite(assessment, "targetStructuralLossAtPeak"))}`,
    `- Peak post convergence: ${pct(finite(assessment, "peakPostConvergence"))} at ${decimal(finite(assessment, "peakPostOffsetSeconds"), 1)} s`
  );
  if (status === "limited") {
    lines.push(
      `- Reference tracking quality: ${asNonEmptyString(tracking["quality"]) || "unreliable"}`
    );
    const referenceConfidence = finite(tracking, "referenceConfidence");
    const referenceInlierRatio = finite(tracking, "inlierRatio");
    const referenceResidualError = finite(tracking, "residualErrorPx");
    if (referenceConfidence !== null) {
      lines.push(`- Reference confidence: ${pct(referenceConfidence)}`);
    }
    if (referenceInlierRatio !== null) {
      lines.push(`- Reference inlier ratio: ${pct(referenceInlierRatio)}`);
    }
    if (referenceResidualError !== null) {
      lines.push(`- Reference residual alignment error: ${decimal(referenceResidualError, 3)} px`);
    }
    lines.push(
      "- The convergence measurements are retained for diagnostics, but tracking quality limits the interpretation."
    );
  }
  lines.push(
    "",
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

export function buildLaboratoryStructuralTransitionReportModel(
  entry: Entry,
  copy: LabI18n
): AnalysisReportModel {
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
  if (revealed["status"] === "assessed" || revealed["status"] === "limited") {
    lines.push(
      `- Background reference: ${decimal(finite(revealed, "referenceTimeSeconds"), 3)} s · camera-aligned Target ROI coordinates when tracking passes; fixed ROI fallback otherwise`
    );
  }
  lines.push(
    "",
    "## Assessment",
    `- Structural: ${structuralAssessmentLabel(assessment["classification"], copy)}`,
    `- Photometric baseline: ${photometricAssessmentLabel(interpretation["classification"], copy)}`
  );
  if (revealed["status"] === "assessed" || revealed["status"] === "limited") {
    lines.push(
      `- Background convergence: ${convergenceAssessmentLabel(revealedAssessment["classification"], copy)}`,
      `- Convergence shape: ${convergenceShapeLabel(revealedAssessment["transitionShape"], copy)}`
    );
  }
  const controlQuality = comparabilityLabel(controlComparability, copy);
  if (controlQuality !== "") lines.push(`- ${controlQuality}`);
  const stabilityText = stabilitySummary(stability, entry["tracking"], copy);
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
    const targetVsBackground = asLabRecord(phase["differential"]);
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
    const offsetText = offset === null ? "—" : `${offset >= 0 ? "+" : ""}${decimal(offset, 1)} s`;
    const referencePoint = convergencePointForOffset(structural, offset);
    const referenceMetrics = convergenceMetrics(referencePoint);
    lines.push(
      `| ${offsetText} | ${pct(finite(target, "structuralSimilarity"))} | ${pct(finite(target, "normalizedPixelCorrelation"))} | ${pct(finite(target, "edgeSimilarity"))} | ${pct(finite(target, "structuralPersistence"))} | ${control === null ? "—" : pct(finite(control, "structuralPersistence"))} | ${pct(finite(background, "structuralPersistence"))} | ${pct(finite(referenceMetrics, "structuralPersistence"))} | ${signedPct(finite(differential, "targetVsControlStructuralLoss"))} |`
    );
  });

  pushBackgroundReferenceMarkdown(lines, structural, copy);

  pushStructuralTrackingMarkdown(lines, entry, structural, copy);

  lines.push(
    "",
    "## Method",
    "- Structural baseline: PRE midpoint template.",
    "- Structural similarity: deterministic global grayscale SSIM-like metric; not canonical windowed SSIM.",
    "- Correlation: grayscale Pearson correlation; report uses normalized correlation for compact comparison.",
    "- Edge similarity: gradient-map correlation.",
    "- Stabilization: feature consensus with a similarity transform (dx/dy/rotation/scale); perspective/homography is not modeled."
  );
  if (revealed["status"] === "assessed" || revealed["status"] === "limited") {
    lines.push(
      "- Background-reference convergence: user-selected reference time, with the Target ROI mapped through camera similarity tracking when the quality gate passes.",
      "- Reference-time alignment: event-to-reference camera similarity transform; fixed ROI fallback is used when tracking is limited.",
      "- Convergence describes image-structure similarity only; it does not identify a physical or compositing mechanism."
    );
  } else {
    lines.push(
      "- Background-reference convergence: not assessed; capture a clean reference frame to enable this measurement."
    );
  }
  const structuralStatus = asNonEmptyString(structural["status"]);
  const primarySummary = formatLaboratoryAnalysisReportSummary(
    structuralStatus === "unavailable"
      ? "structural-measurement-unavailable"
      : assessment["classification"],
    copy
  );
  const convergenceClassification =
    revealed["status"] === "assessed" || revealed["status"] === "limited"
      ? asNonEmptyString(revealedAssessment["classification"])
      : null;
  const summary =
    convergenceClassification === null ||
    convergenceClassification === "reference-convergence-uncertain"
      ? primarySummary
      : `${primarySummary} · ${formatLaboratoryAnalysisReportSummary(convergenceClassification, copy)}`;
  return {
    classification: asNonEmptyString(assessment["classification"]),
    createdAt: createdAt ?? "",
    id: asNonEmptyString(entry["id"]) ?? "",
    kind: "appearance-transition",
    sections: [{ lines, title: "Structural Transition" }],
    status: structuralStatus,
    summary,
    title: "Structural Transition",
  };
}

export function formatLaboratoryStructuralTransitionMarkdown(entry: Entry, copy: LabI18n) {
  return buildLaboratoryStructuralTransitionReportModel(entry, copy)
    .sections.map((section) => section.lines.join("\n"))
    .join("\n");
}
