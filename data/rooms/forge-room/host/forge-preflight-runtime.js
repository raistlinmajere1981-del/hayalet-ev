import { FORGE_TASK_PROMPT_CONTEXT_BUDGET } from "../shared/forge-constants.js";
import {
  toJsonText,
  toRecord,
  asNonEmptyString,
  asStringArray,
  uniqueStrings
} from "./forge-runtime-support.js";
import {
  buildForgeAppArchitectureSummary,
  buildForgeCoreSystemMetadata,
  buildForgeSelectedOperatorProfile,
  buildForgeDerivedConstraints,
  buildForgeTargetRoomContext,
  createForgePreflightCreatedAt,
  listForgeCapabilityDescriptors,
  summarizeForgeSelectedOperatorContext
} from "./forge-preflight-metadata.js";
import { selectForgeCapabilityContext } from "./forge-capability-selector.js";
import { buildForgeRunSignature } from "./forge-run-signature.js";
function compactWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}
function appendBudgetedSegments(segments, budget) {
  let remaining = Math.max(0, budget);
  const rendered = [];
  for (const segment of segments) {
    const separatorLength = rendered.length > 0 ? 2 : 0;
    const available = remaining - separatorLength;
    if (available <= 0) {
      break;
    }
    if (segment.length <= available) {
      rendered.push(segment);
      remaining -= separatorLength + segment.length;
      continue;
    }
    if (available > 12) {
      rendered.push(`${segment.slice(0, Math.max(0, available - 1)).trimEnd()}…`);
    }
    break;
  }
  return rendered.join("\n\n").trim();
}
function normalizeRovoPreAnalysis(value) {
  const record = toRecord(value);
  const summary = asNonEmptyString(record["summary"]);
  if (summary === null) {
    return null;
  }
  return {
    status: asNonEmptyString(record["status"]) === "warning" ? "warning" : "completed",
    summary,
    warnings: asStringArray(record["warnings"]).slice(0, 3),
    missingInfo: asStringArray(record["missingInfo"]).slice(0, 3)
  };
}
function buildPreAnalysisPrompt(params) {
  const summaryLines = summarizeForgeSelectedOperatorContext(params);
  return [
    "Return JSON only using this exact schema:",
    toJsonText({
      summary: "Short observation-only summary",
      warnings: ["Optional warning"],
      missingInfo: ["Optional missing information item"],
      status: "completed"
    }),
    `Goal summary: ${params.goal.summary}`,
    `Goal brief: ${params.goal.brief || "No additional brief provided."}`,
    `Constraints: ${params.goal.constraints.join(" | ") || "None"}`,
    `Target room: ${params.goal.targetRoomId}`,
    "Selected operator context:",
    ...summaryLines.map((line) => `- ${line}`),
    params.runOverride?.notes.trim() ? `Run override note: ${params.runOverride.notes.trim()}` : "",
    "Rules:",
    "- Observations only. Do not make decisions or produce task breakdowns.",
    "- Mention blockers or missing information only if they are explicit from the context.",
    "- Keep warnings factual and concise."
  ].filter((entry) => entry.trim() !== "").join("\n");
}
async function maybeRunForgeRovoPreAnalysis(params) {
  if (params.dispatchBridge === null || params.runOverride?.enableRovoPreAnalysis !== true) {
    return null;
  }
  const result = toRecord(
    await params.dispatchBridge({
      action: "message.sendWait",
      timeoutMs: 18e4,
      toSlot: "ai1",
      payload: {
        page: "forge-room:preflight",
        text: buildPreAnalysisPrompt(params),
        protocol: {
          room: params.protocol.room,
          scenario: params.protocol.scenario,
          protocolKey: params.protocol.key
        }
      }
    })
  );
  if (result["success"] !== true) {
    return {
      status: "warning",
      summary: asNonEmptyString(result["message"]) ?? "Rovo pre-analysis did not complete cleanly.",
      warnings: [asNonEmptyString(result["message"]) ?? "Pre-analysis request failed."],
      missingInfo: []
    };
  }
  const reply = toRecord(result["reply"]);
  const replyText = asNonEmptyString(reply["text"]);
  if (replyText === null) {
    return {
      status: "warning",
      summary: "Rovo pre-analysis returned without readable text.",
      warnings: ["Pre-analysis reply text was empty."],
      missingInfo: []
    };
  }
  try {
    return normalizeRovoPreAnalysis(JSON.parse(replyText)) ?? {
      status: "warning",
      summary: "Rovo pre-analysis reply was not valid observation JSON.",
      warnings: ["Pre-analysis response could not be parsed."],
      missingInfo: []
    };
  } catch {
    return {
      status: "warning",
      summary: "Rovo pre-analysis reply was not valid observation JSON.",
      warnings: ["Pre-analysis response could not be parsed."],
      missingInfo: []
    };
  }
}
export async function buildForgePreflightState(params) {
  const selectedOperatorProfile = buildForgeSelectedOperatorProfile({
    operatorProfile: params.operatorProfile,
    sessionContextSelection: params.sessionContextSelection
  });
  const capabilityContext = selectForgeCapabilityContext({
    descriptors: listForgeCapabilityDescriptors(),
    goal: params.goal
  });
  const rovoPreAnalysis = await maybeRunForgeRovoPreAnalysis({
    ...params,
    selectedOperatorProfile
  });
  const warnings = [
    ...rovoPreAnalysis?.warnings ?? [],
    ...rovoPreAnalysis?.status === "warning" && rovoPreAnalysis.summary.trim() !== "" ? [rovoPreAnalysis.summary] : []
  ];
  const bundle = {
    schemaVersion: "v2",
    createdAt: createForgePreflightCreatedAt(),
    coreSystemMetadata: buildForgeCoreSystemMetadata(params.sessionId),
    appArchitectureSummary: buildForgeAppArchitectureSummary(),
    targetRoomContext: buildForgeTargetRoomContext(params.goal.targetRoomId),
    capabilityContext,
    selectedOperatorProfile,
    runOverride: params.runOverride,
    rovoPreAnalysis,
    sessionContextSelection: params.sessionContextSelection,
    constraints: buildForgeDerivedConstraints({
      goal: params.goal,
      runOverride: params.runOverride,
      selectedOperatorProfile
    })
  };
  const runSignature = buildForgeRunSignature({
    goal: params.goal,
    selectedOperatorProfile,
    runOverride: params.runOverride
  });
  const promptCharCount = renderForgePromptContext({
    bundle,
    contextCapsule: null,
    decisionTrace: [],
    runSignature
  }).length;
  return {
    runSignature,
    state: {
      bundle,
      errorMessage: null,
      promptCharCount,
      ranAt: bundle.createdAt,
      staleReason: null,
      status: warnings.length > 0 ? "warning" : "fresh",
      warnings
    }
  };
}
export function buildForgeFallbackPreflightState(params) {
  const selectedOperatorProfile = buildForgeSelectedOperatorProfile({
    operatorProfile: params.operatorProfile,
    sessionContextSelection: params.sessionContextSelection
  });
  const bundle = {
    schemaVersion: "v2",
    createdAt: createForgePreflightCreatedAt(),
    coreSystemMetadata: buildForgeCoreSystemMetadata(params.sessionId),
    appArchitectureSummary: buildForgeAppArchitectureSummary(),
    targetRoomContext: buildForgeTargetRoomContext(params.goal.targetRoomId),
    capabilityContext: null,
    selectedOperatorProfile,
    runOverride: params.runOverride,
    rovoPreAnalysis: null,
    sessionContextSelection: params.sessionContextSelection,
    constraints: buildForgeDerivedConstraints({
      goal: params.goal,
      runOverride: params.runOverride,
      selectedOperatorProfile
    })
  };
  const runSignature = buildForgeRunSignature({
    goal: params.goal,
    selectedOperatorProfile,
    runOverride: params.runOverride
  });
  const warnings = [
    "Preflight fell back to minimal context because the full bundle could not be prepared.",
    params.errorMessage
  ];
  return {
    runSignature,
    state: {
      bundle,
      errorMessage: params.errorMessage,
      promptCharCount: renderForgePromptContext({
        bundle,
        contextCapsule: null,
        decisionTrace: [],
        runSignature
      }).length,
      ranAt: bundle.createdAt,
      staleReason: null,
      status: "warning",
      warnings
    }
  };
}
export function summarizeForgePreflightWarningsForExport(preflight) {
  const rawError = preflight.errorMessage?.trim() ?? "";
  return uniqueStrings(
    preflight.warnings.filter((warning) => {
      const normalized = warning.trim();
      if (normalized === "") {
        return false;
      }
      if (rawError === "") {
        return true;
      }
      return normalized !== rawError && normalized.includes(rawError) === false;
    })
  ).slice(0, 3);
}
export function buildForgeSynthesisProvenance(params) {
  return {
    runSignature: params.runSignature?.value ?? null,
    operatorProfileSummary: summarizeForgeSelectedOperatorContext({
      runOverride: params.runOverride,
      selectedOperatorProfile: params.selectedOperatorProfile,
      sessionContextSelection: params.sessionContextSelection
    }),
    preflightWarnings: summarizeForgePreflightWarningsForExport(params.preflight)
  };
}
export function renderForgePromptContext(params) {
  const budget = Math.max(240, params.budget ?? FORGE_TASK_PROMPT_CONTEXT_BUDGET);
  const segments = [];
  if (params.runSignature?.value) {
    segments.push(`Run signature: ${params.runSignature.value}`);
  }
  if (params.bundle !== null) {
    segments.push(
      `Architecture summary: ${compactWhitespace(params.bundle.appArchitectureSummary.summary)}`
    );
    if (params.bundle.targetRoomContext?.summary) {
      segments.push(
        `Target room context: ${compactWhitespace(params.bundle.targetRoomContext.summary)}`
      );
    }
    if (params.bundle.capabilityContext?.summary) {
      segments.push(
        `Capability context: ${compactWhitespace(params.bundle.capabilityContext.summary)}`
      );
    }
    segments.push(
      `Operator context: ${summarizeForgeSelectedOperatorContext({
        runOverride: params.bundle.runOverride,
        selectedOperatorProfile: params.bundle.selectedOperatorProfile,
        sessionContextSelection: params.bundle.sessionContextSelection
      }).join(" ")}`
    );
    if (params.bundle.constraints.length > 0) {
      segments.push(`Context constraints: ${params.bundle.constraints.join(" | ")}`);
    }
    if (params.bundle.rovoPreAnalysis?.summary) {
      segments.push(
        `Pre-analysis observations: ${compactWhitespace(params.bundle.rovoPreAnalysis.summary)}`
      );
    }
  }
  if (params.decisionTrace.length > 0) {
    segments.push(`Decision trace: ${params.decisionTrace.join(" | ")}`);
  }
  if (params.contextCapsule !== null) {
    const capsuleSegments = [
      params.contextCapsule.summary.trim() ? `Summary: ${params.contextCapsule.summary.trim()}` : "",
      params.contextCapsule.relevantModules.length > 0 ? `Relevant modules: ${params.contextCapsule.relevantModules.join(", ")}` : "",
      params.contextCapsule.constraints.length > 0 ? `Capsule constraints: ${params.contextCapsule.constraints.join(" | ")}` : ""
    ].filter((entry) => entry !== "");
    if (capsuleSegments.length > 0) {
      segments.push(`Task capsule: ${capsuleSegments.join(" ; ")}`);
    }
  }
  return appendBudgetedSegments(
    segments.filter((entry) => entry.trim() !== "").map((entry) => compactWhitespace(entry)),
    budget
  );
}
