import { FORGE_TASK_PROMPT_CONTEXT_BUDGET } from "../shared/forge-constants.js";
import type {
  ForgeContextCapsule,
  ForgeGoal,
  ForgePreflightBundle,
  ForgePreflightState,
  ForgeRunOverride,
  ForgeRunSignature,
  ForgeOperatorProfile,
  ForgeRovoPreAnalysis,
  ForgeSynthesisProvenance,
} from "../shared/types/index.js";
import {
  toJsonText,
  toRecord,
  asNonEmptyString,
  asStringArray,
  uniqueStrings,
} from "./forge-runtime-support.js";
import {
  buildForgeAppArchitectureSummary,
  buildForgeCoreSystemMetadata,
  buildForgeDerivedConstraints,
  buildForgeTargetRoomContext,
  createForgePreflightCreatedAt,
  listForgeCapabilityDescriptors,
  summarizeForgeOperatorProfile,
} from "./forge-preflight-metadata.js";
import { selectForgeCapabilityContext } from "./forge-capability-selector.js";
import { buildForgeRunSignature } from "./forge-run-signature.js";

type ForgeDispatchBridge = (payload: Record<string, unknown>) => Promise<unknown>;

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function appendBudgetedSegments(segments: string[], budget: number): string {
  let remaining = Math.max(0, budget);
  const rendered: string[] = [];

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

function normalizeRovoPreAnalysis(value: unknown): ForgeRovoPreAnalysis | null {
  const record = toRecord(value);
  const summary = asNonEmptyString(record["summary"]);
  if (summary === null) {
    return null;
  }
  return {
    status: asNonEmptyString(record["status"]) === "warning" ? "warning" : "completed",
    summary,
    warnings: asStringArray(record["warnings"]).slice(0, 3),
    missingInfo: asStringArray(record["missingInfo"]).slice(0, 3),
  };
}

function buildPreAnalysisPrompt(params: {
  goal: ForgeGoal;
  operatorProfile: ForgeOperatorProfile;
  runOverride: ForgeRunOverride | null;
}): string {
  const summaryLines = summarizeForgeOperatorProfile(params);
  return [
    "Return JSON only using this exact schema:",
    toJsonText({
      summary: "Short observation-only summary",
      warnings: ["Optional warning"],
      missingInfo: ["Optional missing information item"],
      status: "completed",
    }),
    `Goal summary: ${params.goal.summary}`,
    `Goal brief: ${params.goal.brief || "No additional brief provided."}`,
    `Constraints: ${params.goal.constraints.join(" | ") || "None"}`,
    `Target room: ${params.goal.targetRoomId}`,
    "Operator profile:",
    ...summaryLines.map((line) => `- ${line}`),
    params.runOverride?.notes.trim() ? `Run override note: ${params.runOverride.notes.trim()}` : "",
    "Rules:",
    "- Observations only. Do not make decisions or produce task breakdowns.",
    "- Mention blockers or missing information only if they are explicit from the context.",
    "- Keep warnings factual and concise.",
  ]
    .filter((entry) => entry.trim() !== "")
    .join("\n");
}

async function maybeRunForgeRovoPreAnalysis(params: {
  dispatchBridge: ForgeDispatchBridge | null;
  goal: ForgeGoal;
  operatorProfile: ForgeOperatorProfile;
  protocol: {
    key: string;
    scenario: string;
    room: string;
  };
  runOverride: ForgeRunOverride | null;
}): Promise<ForgeRovoPreAnalysis | null> {
  if (params.dispatchBridge === null || params.runOverride?.enableRovoPreAnalysis !== true) {
    return null;
  }

  const result = toRecord(
    await params.dispatchBridge({
      action: "message.sendWait",
      timeoutMs: 180000,
      toSlot: "ai1",
      payload: {
        page: "forge-room:preflight",
        text: buildPreAnalysisPrompt(params),
        protocol: {
          room: params.protocol.room,
          scenario: params.protocol.scenario,
          protocolKey: params.protocol.key,
        },
      },
    })
  );
  if (result["success"] !== true) {
    return {
      status: "warning",
      summary: asNonEmptyString(result["message"]) ?? "Rovo pre-analysis did not complete cleanly.",
      warnings: [asNonEmptyString(result["message"]) ?? "Pre-analysis request failed."],
      missingInfo: [],
    };
  }

  const reply = toRecord(result["reply"]);
  const replyText = asNonEmptyString(reply["text"]);
  if (replyText === null) {
    return {
      status: "warning",
      summary: "Rovo pre-analysis returned without readable text.",
      warnings: ["Pre-analysis reply text was empty."],
      missingInfo: [],
    };
  }

  try {
    return normalizeRovoPreAnalysis(JSON.parse(replyText)) ?? {
      status: "warning",
      summary: "Rovo pre-analysis reply was not valid observation JSON.",
      warnings: ["Pre-analysis response could not be parsed."],
      missingInfo: [],
    };
  } catch {
    return {
      status: "warning",
      summary: "Rovo pre-analysis reply was not valid observation JSON.",
      warnings: ["Pre-analysis response could not be parsed."],
      missingInfo: [],
    };
  }
}

export async function buildForgePreflightState(params: {
  dispatchBridge: ForgeDispatchBridge | null;
  goal: ForgeGoal;
  operatorProfile: ForgeOperatorProfile;
  protocol: {
    key: string;
    room: string;
    scenario: string;
  };
  runOverride: ForgeRunOverride | null;
  sessionId: string | null;
}): Promise<{ runSignature: ForgeRunSignature; state: ForgePreflightState }> {
  const capabilityContext = selectForgeCapabilityContext({
    descriptors: listForgeCapabilityDescriptors(),
    goal: params.goal,
  });
  const rovoPreAnalysis = await maybeRunForgeRovoPreAnalysis(params);
  const warnings = [
    ...(rovoPreAnalysis?.warnings ?? []),
    ...(rovoPreAnalysis?.status === "warning" && rovoPreAnalysis.summary.trim() !== ""
      ? [rovoPreAnalysis.summary]
      : []),
  ];
  const bundle: ForgePreflightBundle = {
    schemaVersion: "v2",
    createdAt: createForgePreflightCreatedAt(),
    coreSystemMetadata: buildForgeCoreSystemMetadata(params.sessionId),
    appArchitectureSummary: buildForgeAppArchitectureSummary(),
    targetRoomContext: buildForgeTargetRoomContext(params.goal.targetRoomId),
    capabilityContext,
    operatorProfile: params.operatorProfile,
    runOverride: params.runOverride,
    rovoPreAnalysis,
    constraints: buildForgeDerivedConstraints(params),
  };
  const runSignature = buildForgeRunSignature({
    goal: params.goal,
    operatorProfile: params.operatorProfile,
    runOverride: params.runOverride,
  });
  const promptCharCount = renderForgePromptContext({
    bundle,
    contextCapsule: null,
    decisionTrace: [],
    runSignature,
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
      warnings,
    },
  };
}

export function buildForgeFallbackPreflightState(params: {
  errorMessage: string;
  goal: ForgeGoal;
  operatorProfile: ForgeOperatorProfile;
  runOverride: ForgeRunOverride | null;
  sessionId: string | null;
}): { runSignature: ForgeRunSignature; state: ForgePreflightState } {
  const bundle: ForgePreflightBundle = {
    schemaVersion: "v2",
    createdAt: createForgePreflightCreatedAt(),
    coreSystemMetadata: buildForgeCoreSystemMetadata(params.sessionId),
    appArchitectureSummary: buildForgeAppArchitectureSummary(),
    targetRoomContext: buildForgeTargetRoomContext(params.goal.targetRoomId),
    capabilityContext: null,
    operatorProfile: params.operatorProfile,
    runOverride: params.runOverride,
    rovoPreAnalysis: null,
    constraints: buildForgeDerivedConstraints(params),
  };
  const runSignature = buildForgeRunSignature({
    goal: params.goal,
    operatorProfile: params.operatorProfile,
    runOverride: params.runOverride,
  });
  const warnings = [
    "Preflight fell back to minimal context because the full bundle could not be prepared.",
    params.errorMessage,
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
        runSignature,
      }).length,
      ranAt: bundle.createdAt,
      staleReason: null,
      status: "warning",
      warnings,
    },
  };
}

export function summarizeForgePreflightWarningsForExport(
  preflight: ForgePreflightState
): string[] {
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

export function buildForgeSynthesisProvenance(params: {
  operatorProfile: ForgeOperatorProfile;
  preflight: ForgePreflightState;
  runOverride: ForgeRunOverride | null;
  runSignature: ForgeRunSignature | null;
}): ForgeSynthesisProvenance {
  return {
    runSignature: params.runSignature?.value ?? null,
    operatorProfileSummary: summarizeForgeOperatorProfile({
      operatorProfile: params.operatorProfile,
      runOverride: params.runOverride,
    }),
    preflightWarnings: summarizeForgePreflightWarningsForExport(params.preflight),
  };
}

export function renderForgePromptContext(params: {
  bundle: ForgePreflightBundle | null;
  contextCapsule: ForgeContextCapsule | null;
  decisionTrace: string[];
  runSignature: ForgeRunSignature | null;
  budget?: number;
}): string {
  const budget = Math.max(240, params.budget ?? FORGE_TASK_PROMPT_CONTEXT_BUDGET);
  const segments: string[] = [];

  if (params.runSignature?.value) {
    segments.push(`Run signature: ${params.runSignature.value}`);
  }

  if (params.bundle !== null) {
    segments.push(`Architecture summary: ${compactWhitespace(params.bundle.appArchitectureSummary.summary)}`);
    if (params.bundle.targetRoomContext?.summary) {
      segments.push(`Target room context: ${compactWhitespace(params.bundle.targetRoomContext.summary)}`);
    }
    if (params.bundle.capabilityContext?.summary) {
      segments.push(`Capability context: ${compactWhitespace(params.bundle.capabilityContext.summary)}`);
    }
    segments.push(
      `Operator profile: ${summarizeForgeOperatorProfile({
        operatorProfile: params.bundle.operatorProfile,
        runOverride: params.bundle.runOverride,
      }).join(" ")}`
    );
    if (params.bundle.constraints.length > 0) {
      segments.push(`Context constraints: ${params.bundle.constraints.join(" | ")}`);
    }
    if (params.bundle.rovoPreAnalysis?.summary) {
      segments.push(`Pre-analysis observations: ${compactWhitespace(params.bundle.rovoPreAnalysis.summary)}`);
    }
  }

  if (params.decisionTrace.length > 0) {
    segments.push(`Decision trace: ${params.decisionTrace.join(" | ")}`);
  }

  if (params.contextCapsule !== null) {
    const capsuleSegments = [
      params.contextCapsule.summary.trim() ? `Summary: ${params.contextCapsule.summary.trim()}` : "",
      params.contextCapsule.relevantModules.length > 0
        ? `Relevant modules: ${params.contextCapsule.relevantModules.join(", ")}`
        : "",
      params.contextCapsule.constraints.length > 0
        ? `Capsule constraints: ${params.contextCapsule.constraints.join(" | ")}`
        : "",
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
