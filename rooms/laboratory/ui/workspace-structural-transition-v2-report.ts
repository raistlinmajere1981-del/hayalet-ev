import { asLabRecord, asNonEmptyString } from "../domain/lab-types.js";
import type { LabI18n } from "./lab-i18n.js";
import { formatLaboratoryStructuralTransitionMarkdown } from "./workspace-structural-transition-summary.js";

type Entry = Record<string, unknown>;

function finite(record: Entry, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function pct(value: number | null) {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

function decimal(value: number | null, digits = 2) {
  return value === null ? "—" : String(Number(value.toFixed(digits)));
}

function trackingQualityText(quality: string, copy: LabI18n) {
  if (copy.locale !== "tr") {
    if (quality === "high") return "HIGH — suitable for small-ROI structural comparison.";
    if (quality === "medium") return "MEDIUM — usable, with tracking diagnostics retained.";
    if (quality === "low")
      return "LOW — structural differential may contain ROI drift contamination.";
    return "UNRELIABLE — fixed ROI fallback; do not use tracking for a strong structural conclusion.";
  }
  if (quality === "high") return "YÜKSEK — küçük ROI structural karşılaştırması için uygun.";
  if (quality === "medium") return "ORTA — kullanılabilir; tracking diagnostics dikkate alınmalı.";
  if (quality === "low") return "DÜŞÜK — structural differential ROI drift kirliliği içerebilir.";
  return "GÜVENİLMEZ — fixed ROI fallback; güçlü structural çıkarım yapılmamalı.";
}

function formatTransformPoint(value: unknown) {
  const point = asLabRecord(value);
  const transform = asLabRecord(point["transform"]);
  return {
    timeSeconds: finite(point, "timeSeconds"),
    confidence: finite(point, "confidence"),
    inlierRatio: finite(point, "inlierRatio"),
    forwardBackwardRatio: finite(point, "forwardBackwardRatio"),
    residualErrorPx: finite(point, "residualErrorPx"),
    quality: asNonEmptyString(point["quality"]) || "unreliable",
    dx: finite(transform, "dx"),
    dy: finite(transform, "dy"),
    rotationDegrees: finite(transform, "rotationDegrees"),
    scale: finite(transform, "scale"),
  };
}

export function formatLaboratoryStructuralTransitionV2Markdown(entry: Entry, copy: LabI18n) {
  let markdown = formatLaboratoryStructuralTransitionMarkdown(entry, copy);
  const tracking = asLabRecord(entry["trackingV2"]);
  if (tracking["algorithm"] !== "feature-similarity-ransac-v2") return markdown;

  markdown = markdown
    .replace(
      "- Stabilization: translation-only reference tracking; rotation/zoom/perspective are not modeled.",
      "- Stabilization: Camera Tracking v2 feature consensus with similarity transform (dx/dy/rotation/scale); perspective/homography is not modeled."
    )
    .replace(
      "- Background-reference convergence: user-selected reference time, sampled from the same normalized Target ROI coordinates.",
      "- Background-reference convergence: user-selected reference time, with Target ROI mapped through Camera Tracking v2 when the reference transform passes the quality gate."
    )
    .replace(
      "- Reference-time alignment: fixed ROI only; camera translation between the event and reference frame is not modeled.",
      "- Reference-time alignment: event-to-reference Camera Tracking v2 similarity transform; fixed ROI is used only when tracking is unreliable."
    )
    .replace(
      "· same Target ROI coordinates",
      "· camera-aligned Target ROI coordinates when tracking passes"
    );

  const structural = asLabRecord(entry["structural"]);
  const stability = asLabRecord(structural["roiStability"]);
  const corrected = asLabRecord(stability["correctedResidual"]);
  const revealed = asLabRecord(structural["revealedBackground"]);
  const revealedAssessment = asLabRecord(revealed["assessment"]);
  const revealedTracking = asLabRecord(revealed["tracking"]);
  const quality =
    asNonEmptyString(tracking["quality"]) ||
    asNonEmptyString(stability["trackingQuality"]) ||
    "unreliable";
  const transforms = Array.isArray(tracking["transformSeries"])
    ? (tracking["transformSeries"] as unknown[])
    : [];
  const lines = [
    "",
    "## ROI Tracking / Stabilization v2",
    `- Tracking quality: ${trackingQualityText(quality, copy)}`,
    `- Algorithm/version: ${asNonEmptyString(tracking["algorithm"]) || "feature-similarity-ransac-v2"} / ${String(tracking["version"] ?? 2)}`,
    `- Transform model: ${asNonEmptyString(tracking["transformModel"]) || "similarity-dx-dy-rotation-scale"}`,
    `- Tracking mode: ${asNonEmptyString(tracking["mode"]) || "unknown"}`,
    `- Transform cache: ${asNonEmptyString(tracking["cacheId"]) || "—"}`,
    `- Anchor/reference frame: ${decimal(finite(tracking, "anchorSeconds"), 3)} s`,
    `- Confidence: ${pct(finite(tracking, "confidence") ?? finite(stability, "trackingConfidence"))}`,
    `- Inlier ratio: ${pct(finite(tracking, "inlierRatio") ?? finite(stability, "inlierRatio"))}`,
    `- Forward/backward consistency: ${pct(finite(tracking, "forwardBackwardRatio") ?? finite(stability, "forwardBackwardRatio"))}`,
    `- Feature count: ${decimal(finite(tracking, "featureCount") ?? finite(stability, "featureCount"), 0)}`,
    `- Fallback used: ${tracking["fallbackUsed"] === true ? "yes — fixed ROI fallback" : "no"}`,
    "",
    "### Raw camera drift",
    `- dx / dy: ${decimal(finite(stability, "netDx"))} / ${decimal(finite(stability, "netDy"))} px`,
    `- rotation: ${decimal(finite(stability, "rotationDegrees"), 3)}°`,
    `- scale: ${decimal(finite(stability, "scale"), 5)}`,
    `- peak displacement: ${decimal(finite(stability, "peakDisplacement"))} px`,
    `- peak rotation: ${decimal(finite(stability, "peakRotationDegrees"), 3)}°`,
    `- peak scale Δ: ${decimal(finite(stability, "peakScaleDelta"), 5)}`,
    "",
    "### Corrected residual drift",
    `- dx / dy: ${decimal(finite(corrected, "dx"))} / ${decimal(finite(corrected, "dy"))} px`,
    `- rotation: ${decimal(finite(corrected, "rotationDegrees"), 3)}°`,
    `- scale: ${decimal(finite(corrected, "scale"), 5)}`,
    `- residual error: ${decimal(finite(corrected, "errorPx") ?? finite(tracking, "residualErrorPx"), 3)} px`,
  ];

  if (revealed["status"] === "limited") {
    lines.push(
      "",
      "### Background Reference Alignment",
      `- Status: LIMITED — ${asNonEmptyString(revealedAssessment["classification"]) || "reference-alignment-tracking-unreliable"}`,
      `- Reference time: ${decimal(finite(revealed, "referenceTimeSeconds"), 3)} s`,
      `- Reference confidence: ${pct(finite(revealedTracking, "referenceConfidence"))}`,
      `- Reference inlier ratio: ${pct(finite(revealedTracking, "inlierRatio"))}`,
      `- Reference residual: ${decimal(finite(revealedTracking, "residualErrorPx"), 3)} px`,
      "- Convergence values may be retained for diagnostics, but the quality gate blocks a strong background-convergence interpretation."
    );
  }

  lines.push(
    "",
    "### Transform series",
    "| Time | Quality | Confidence | Inlier | F/B | dx | dy | Rotation | Scale | Residual |",
    "| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |"
  );
  transforms.forEach(function (value) {
    const point = formatTransformPoint(value);
    lines.push(
      `| ${decimal(point.timeSeconds, 3)} s | ${point.quality} | ${pct(point.confidence)} | ${pct(point.inlierRatio)} | ${pct(point.forwardBackwardRatio)} | ${decimal(point.dx)} | ${decimal(point.dy)} | ${decimal(point.rotationDegrees, 3)}° | ${decimal(point.scale, 5)} | ${decimal(point.residualErrorPx, 3)} px |`
    );
  });
  lines.push(
    "",
    "- Target and Control regions are excluded from global camera-feature estimation; Background/Reference is preferred as a local fallback region.",
    "- Structural Target/Control/Background coordinates use the similarity transform when the tracking quality gate passes.",
    "- Legacy photometric PRE/EVENT/POST and Visibility Response measurements remain fixed-ROI in this v2 integration; tracking quality is attached as provenance/gate so those results are not overstated.",
    "- Source media remains immutable; stabilization changes measurement coordinates only.",
    "- Rotated ROIs are represented by an axis-aligned bounding box after transform; perspective/homography is not modeled."
  );
  return `${markdown}\n${lines.join("\n")}`;
}
