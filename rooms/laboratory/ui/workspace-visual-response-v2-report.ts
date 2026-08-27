import { asLabRecord, asNonEmptyString } from "../domain/lab-types.js";
import type { LabI18n } from "./lab-i18n.js";
import { formatLaboratoryVisualReportMarkdown } from "./workspace-visual-response-summary.js";

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

export function formatLaboratoryVisualReportV2Markdown(entry: Entry, copy: LabI18n) {
  const base = formatLaboratoryVisualReportMarkdown(entry, copy);
  const tracking = asLabRecord(entry["trackingV2"]);
  if (tracking["algorithm"] !== "feature-similarity-ransac-v2") return base;
  const interpretation = asLabRecord(entry["interpretation"]);
  const quality = asNonEmptyString(tracking["quality"]) || "unreliable";
  const gate = asNonEmptyString(interpretation["trackingQualityGate"]) || "advisory";
  const coordinateMode =
    asNonEmptyString(tracking["measurementCoordinateMode"]) ||
    asNonEmptyString(interpretation["photometricCoordinateMode"]) ||
    "fixed-roi-legacy";
  const lines = [
    "",
    "## ROI Tracking / Stabilization v2",
    `- Tracking quality: ${quality.toUpperCase()}`,
    `- Quality gate: ${gate}`,
    `- Algorithm/version: ${asNonEmptyString(tracking["algorithm"]) || "feature-similarity-ransac-v2"} / ${String(tracking["version"] ?? 2)}`,
    `- Transform model: ${asNonEmptyString(tracking["transformModel"]) || "similarity-dx-dy-rotation-scale"}`,
    `- Tracking mode: ${asNonEmptyString(tracking["mode"]) || "unknown"}`,
    `- Cache ID: ${asNonEmptyString(tracking["cacheId"]) || "—"}`,
    `- Anchor: ${decimal(finite(tracking, "anchorSeconds"), 3)} s`,
    `- Confidence: ${pct(finite(tracking, "confidence"))}`,
    `- Inlier ratio: ${pct(finite(tracking, "inlierRatio"))}`,
    `- Forward/backward consistency: ${pct(finite(tracking, "forwardBackwardRatio"))}`,
    `- Residual error: ${decimal(finite(tracking, "residualErrorPx"), 3)} px`,
    `- Feature count: ${decimal(finite(tracking, "featureCount"), 0)}`,
    `- Fallback used: ${tracking["fallbackUsed"] === true ? "yes" : "no"}`,
    `- Measurement coordinate mode: ${coordinateMode}`,
    "- This photometric result keeps the legacy fixed-ROI metric path in the current v2 integration. Camera Tracking v2 is provenance and a quality gate here; it must not be described as dynamically stabilized photometry.",
    "- Source media remains immutable.",
  ];
  return `${base}\n${lines.join("\n")}`;
}
