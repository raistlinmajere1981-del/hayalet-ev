function clampConfidence(value) {
  return Math.max(0.3, Math.min(0.98, Number(value.toFixed(2))));
}
function createRoiSignature(selection) {
  if (selection.roi === void 0) {
    return "noroi";
  }
  return [
    Math.round(selection.roi.x * 1e3),
    Math.round(selection.roi.y * 1e3),
    Math.round(selection.roi.width * 1e3),
    Math.round(selection.roi.height * 1e3)
  ].join("-");
}
function createExecutionPlanId(input) {
  return [
    "plan",
    input.suggestion.id,
    input.suggestion.actionType,
    input.sourceKind || "unknown",
    input.inspectionMode,
    input.activeSelection.type,
    input.activeSelection.intent,
    String(input.activeSelection.startMs),
    String(input.activeSelection.endMs),
    createRoiSignature(input.activeSelection)
  ].join(":");
}
function buildRiskNotes(input) {
  const riskNotes = [];
  const selectionDurationMs = Math.max(
    0,
    input.activeSelection.endMs - input.activeSelection.startMs
  );
  const roi = input.activeSelection.roi;
  const roiArea = roi ? roi.width * roi.height : 0;
  if (selectionDurationMs > 0 && selectionDurationMs < 500) {
    riskNotes.push("Short selection windows may reduce context for reliable planning.");
  }
  if (selectionDurationMs > 1e4) {
    riskNotes.push("Wide selections may broaden review scope and dilute focus.");
  }
  if (roi !== void 0 && (roiArea < 0.05 || roi.width / Math.max(roi.height, 1e-3) > 3 || roi.height / Math.max(roi.width, 1e-3) > 3)) {
    riskNotes.push(
      "The selected region is narrow in context and may need a wider comparison view."
    );
  }
  if (input.suggestion.actionType === "focus-region" && roi === void 0) {
    riskNotes.push("No active region is defined yet, so the plan stays segment-scoped.");
  }
  if (input.inspectionMode === "motion" && input.sourceKind !== "video") {
    riskNotes.push("Motion-oriented review is less informative without video timing context.");
  }
  return riskNotes.length > 0 ? riskNotes : void 0;
}
function buildConfidence(input) {
  let confidence = input.suggestion.confidence;
  const selectionDurationMs = Math.max(
    0,
    input.activeSelection.endMs - input.activeSelection.startMs
  );
  const roi = input.activeSelection.roi;
  if (roi !== void 0) {
    if (input.suggestion.actionType === "focus-region" || input.suggestion.actionType === "inspect-motion" || input.suggestion.actionType === "enhance-visual" || input.suggestion.actionType === "stabilize-segment") {
      confidence += 0.04;
    }
  }
  if (selectionDurationMs > 0 && selectionDurationMs < 500) {
    confidence -= 0.08;
  } else if (selectionDurationMs > 2e3 && selectionDurationMs < 12e3) {
    confidence += 0.02;
  }
  if (input.inspectionMode === "motion" && input.sourceKind === "video") {
    confidence += 0.02;
  }
  return clampConfidence(confidence);
}
function createPlan(input, title, steps, expectedOutputs) {
  const riskNotes = buildRiskNotes(input);
  return {
    id: createExecutionPlanId(input),
    suggestionId: input.suggestion.id,
    actionType: input.suggestion.actionType,
    title,
    steps,
    expectedOutputs,
    confidence: buildConfidence(input),
    ...riskNotes ? { riskNotes } : {}
  };
}
export function buildExecutionPlan(input) {
  const selectionDurationMs = Math.max(
    0,
    input.activeSelection.endMs - input.activeSelection.startMs
  );
  const durationLabel = selectionDurationMs <= 0 ? "current selection context" : selectionDurationMs < 1e3 ? `${selectionDurationMs}ms selection` : `${(selectionDurationMs / 1e3).toFixed(1)}s selection`;
  const hasRoi = input.activeSelection.roi !== void 0;
  switch (input.suggestion.actionType) {
    case "analyze-segment":
      return createPlan(
        input,
        "Segment analysis plan",
        [
          {
            id: "boundary-check",
            label: "Confirm segment boundaries",
            description: `${durationLabel} is checked before deeper review begins.`,
            tool: "segment-boundary-check"
          },
          {
            id: "preprocess",
            label: "Prepare review inputs",
            description: "The segment would be normalized into a stable review window for pattern reading.",
            tool: "segment-preprocess"
          },
          {
            id: "scan",
            label: "Scan for anomalies and patterns",
            description: "Temporal, visual, and signal irregularities would be examined in sequence.",
            tool: "pattern-scan"
          },
          {
            id: "aggregate",
            label: "Aggregate findings",
            description: "Observed markers would be grouped into a readable review summary.",
            tool: "result-aggregation"
          }
        ],
        ["Anomaly markers", "Temporal patterns", "Confidence summary"]
      );
    case "inspect-audio":
      return createPlan(
        input,
        "Audio inspection plan",
        [
          {
            id: "isolate",
            label: "Isolate the active audio window",
            description: `${durationLabel} would be isolated from the preview transport path.`,
            tool: "audio-isolation"
          },
          {
            id: "band-scan",
            label: "Scan frequency bands",
            description: "Low, mid, and high frequency emphasis would be compared for signal balance.",
            tool: "frequency-band-scan"
          },
          {
            id: "transient-detect",
            label: "Inspect transients",
            description: "Short-lived spikes and discontinuities would be checked against the current focus.",
            tool: "transient-detection"
          },
          {
            id: "characterize",
            label: "Characterize the signal",
            description: "The signal would be summarized by noise floor, density, and spectral behavior.",
            tool: "signal-characterization"
          }
        ],
        ["Spectral profile", "Transient events", "Noise floor notes"]
      );
    case "extract-clip":
      return createPlan(
        input,
        "Segment extraction plan",
        [
          {
            id: "trim",
            label: "Trim the selected range",
            description: `${durationLabel} would be trimmed into a standalone review segment.`,
            tool: "segment-trim"
          },
          {
            id: "prep",
            label: "Prepare clip packaging",
            description: "The trimmed window would be staged for a safe encode/export path without starting it.",
            tool: "clip-packaging"
          }
        ],
        ["Video or audio clip", "Segment timing metadata"]
      );
    case "focus-region":
      return createPlan(
        input,
        hasRoi ? "Region focus plan" : "Focused review plan",
        [
          {
            id: "region-scope",
            label: hasRoi ? "Scope the active region" : "Prepare a narrower review window",
            description: hasRoi ? "The selected region would be isolated while preserving the surrounding frame relationship." : `${durationLabel} would stay segment-scoped until a region is selected.`,
            tool: "roi-scope"
          },
          {
            id: "clarify",
            label: "Clarify local detail",
            description: "Local contrast and structure would be emphasized for close inspection.",
            tool: "spatial-clarity-pass"
          },
          {
            id: "inspect",
            label: "Inspect the focused area",
            description: "The narrowed visual field would be reviewed for fine structure and edge detail.",
            tool: "detail-inspection"
          }
        ],
        hasRoi ? ["Region-focused frames", "Clarity review notes"] : ["Focused inspection notes", "Suggested region follow-up"]
      );
    case "inspect-motion":
      return createPlan(
        input,
        "Motion inspection plan",
        [
          {
            id: "anchor",
            label: "Anchor the active frame window",
            description: `${durationLabel} would be aligned for repeatable frame-to-frame inspection.`,
            tool: "frame-anchor"
          },
          {
            id: "track",
            label: "Track motion through the region",
            description: hasRoi ? "The selected region would be tracked for local movement consistency." : "The visible subject area would be tracked for motion continuity.",
            tool: "motion-track"
          },
          {
            id: "compare",
            label: "Compare motion stability",
            description: "Frame-level ambiguity, blur, and drift would be compared across the inspected span.",
            tool: "motion-compare"
          }
        ],
        ["Motion continuity notes", "Frame reference set", "Movement ambiguity summary"]
      );
    case "enhance-visual":
      return createPlan(
        input,
        "Visual clarity plan",
        [
          {
            id: "scope",
            label: hasRoi ? "Scope the visual focus area" : "Scope the visual review window",
            description: hasRoi ? "The selected region would be isolated for a clarity-first pass." : `${durationLabel} would be prepared for a broader visual improvement pass.`,
            tool: "visual-scope"
          },
          {
            id: "enhance",
            label: "Apply clarity-oriented enhancement",
            description: "Local contrast, edge readability, and fine detail would be emphasized.",
            tool: "visual-enhancement"
          },
          {
            id: "review",
            label: "Review enhanced output",
            description: "Enhanced frames would be checked against the original context before any action.",
            tool: "enhancement-review"
          }
        ],
        ["Enhanced frame references", "Clarity improvement notes"]
      );
    case "stabilize-segment":
      return createPlan(
        input,
        "Segment stabilization plan",
        [
          {
            id: "scope",
            label: "Define the stabilization window",
            description: `${durationLabel} would be constrained to a stable comparison window.`,
            tool: "stabilization-scope"
          },
          {
            id: "align",
            label: "Align motion across frames",
            description: hasRoi ? "The selected region would guide stabilization around the most relevant subject area." : "The preview would estimate a stable frame path across the full visible span.",
            tool: "frame-alignment"
          },
          {
            id: "compare",
            label: "Compare stabilized and original views",
            description: "The stabilized view would be checked for readability gains before any export.",
            tool: "stabilization-review"
          }
        ],
        ["Stabilized review frames", "Motion stability notes"]
      );
    default:
      return createPlan(
        input,
        "Generic execution plan",
        [
          {
            id: "scope",
            label: "Scope the current selection",
            description: `${durationLabel} would be framed as the active review target.`
          },
          {
            id: "prepare",
            label: "Prepare a safe review pass",
            description: "The current preview context would be translated into a reversible, non-destructive workflow."
          },
          {
            id: "summarize",
            label: "Summarize expected outputs",
            description: "The system would outline what to inspect next before any execution path is considered."
          }
        ],
        ["Review notes", "Suggested follow-up outputs"]
      );
  }
}
