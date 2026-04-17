import {
  FORGE_PREFLIGHT_SCHEMA_VERSION,
  FORGE_ROOM_ID,
  FORGE_TARGET_ROOM_ID,
  FORGE_WORKBENCH_FEATURE_ID
} from "../shared/forge-constants.js";
import {
  isForgeSelectedOperatorProfileEmpty,
  isForgeSessionContextSelectionEmpty
} from "../shared/types/index.js";
import { nowIso, uniqueStrings } from "./forge-runtime-support.js";
const FORGE_CAPABILITY_DESCRIPTORS = [
  {
    id: "forge-guided-ui",
    title: "Guided workbench UI",
    summary: "Forge keeps planning, response review, and export review in three guided rails so the operator can move without managing cross-agent chatter.",
    tags: ["ui", "relay"],
    relevantModules: [
      "rooms/forge-room/ui/forge-room-ui-runtime.ts",
      "rooms/forge-room/ui/panels/goal-input-panel.ts",
      "rooms/forge-room/ui/panels/responses-panel.ts",
      "rooms/forge-room/ui/panels/synthesis-panel.ts"
    ],
    roomIds: [FORGE_ROOM_ID]
  },
  {
    id: "forge-session-storage",
    title: "Room-local session storage",
    summary: "Forge persists sessions, exports, and operator context under room-local storage so runs can reopen without touching workspace source files.",
    tags: ["storage", "archive"],
    relevantModules: [
      "rooms/forge-room/host/forge-session-storage.ts",
      "rooms/forge-room/shared/host/forge-paths.ts",
      "rooms/forge-room/host/forge-operator-profile-storage.ts"
    ],
    roomIds: [FORGE_ROOM_ID]
  },
  {
    id: "forge-protocol-bridge",
    title: "Prompt protocol bridge",
    summary: "Forge AI calls stay behind the dispatch bridge and protocol registry so prompts can be enriched without changing the room command surface.",
    tags: ["protocol", "relay"],
    relevantModules: [
      "rooms/forge-room/host/runtime.ts",
      "rooms/forge-room/main-functions/forge-workbench/protocols/forge-room-breakdown-architect.md",
      "rooms/forge-room/main-functions/forge-workbench/protocols/forge-room-task-response.md",
      "rooms/forge-room/main-functions/forge-workbench/protocols/forge-room-synthesis.md"
    ],
    roomIds: [FORGE_ROOM_ID]
  },
  {
    id: "forge-repair-handoff",
    title: "Repair Room handoff contract",
    summary: "Forge ends in a compact JSON handoff that stays oriented around Repair Room intake instead of broad implementation detail.",
    tags: ["archive", "protocol", "repair-room"],
    relevantModules: [
      "rooms/forge-room/host/forge-handoff-export.ts",
      "rooms/forge-room/shared/types/forge-handoff.ts",
      "rooms/forge-room/host/forge-task-runtime.ts"
    ],
    roomIds: [FORGE_ROOM_ID, FORGE_TARGET_ROOM_ID]
  },
  {
    id: "forge-response-synthesis",
    title: "Response review and synthesis",
    summary: "Forge captures seat-specific answers, groups compare conflicts, then synthesizes one export-ready direction while keeping the conflict trail visible.",
    tags: ["relay", "archive", "ui"],
    relevantModules: [
      "rooms/forge-room/host/forge-task-runtime.ts",
      "rooms/forge-room/host/forge-synthesis-runtime.ts",
      "rooms/forge-room/ui/panels/responses-panel.ts"
    ],
    roomIds: [FORGE_ROOM_ID]
  },
  {
    id: "laboratory-image-analysis",
    title: "Laboratory visual analysis lanes",
    summary: "The Laboratory room can analyze visual inputs and derived artifacts, but those image-heavy lanes stay outside the core Forge planning loop unless the goal explicitly needs them.",
    tags: ["camera", "image", "archive"],
    relevantModules: [
      "rooms/laboratory/main-functions/media-analysis/host/profile-preflight.ts",
      "rooms/laboratory/services/preflight-service.ts"
    ],
    roomIds: ["laboratory"]
  }
];
function titleCaseRoomId(roomId) {
  return roomId.split(/[^a-z0-9]+/i).filter((segment) => segment !== "").map((segment) => `${segment.slice(0, 1).toUpperCase()}${segment.slice(1)}`).join("");
}
export function listForgeCapabilityDescriptors() {
  return FORGE_CAPABILITY_DESCRIPTORS.map((entry) => ({
    ...entry,
    relevantModules: [...entry.relevantModules],
    roomIds: [...entry.roomIds],
    tags: [...entry.tags]
  }));
}
export function buildForgeCoreSystemMetadata(sessionId) {
  return {
    featureId: FORGE_WORKBENCH_FEATURE_ID,
    mode: "guided",
    roomId: FORGE_ROOM_ID,
    schemaVersion: Number.parseInt(FORGE_PREFLIGHT_SCHEMA_VERSION.slice(1), 10) || 2,
    sessionId
  };
}
export function buildForgeAppArchitectureSummary() {
  return {
    exportBoundary: "Forge ends in a Repair Room-oriented JSON handoff and does not dispatch implementation work itself.",
    relevantModules: [
      "rooms/forge-room/host/runtime.ts",
      "rooms/forge-room/host/forge-task-runtime.ts",
      "rooms/forge-room/host/forge-synthesis-runtime.ts",
      "rooms/forge-room/host/forge-handoff-export.ts"
    ],
    storageBoundary: "Persistent operator profile lives beside room storage, while run-specific overrides, preflight state, syntheses, and exports stay session-local.",
    summary: "Forge is a guided orchestration room: it drafts tasks, captures lane responses, resolves conflicts, then exports a narrow handoff package."
  };
}
export function buildForgeTargetRoomContext(targetRoomId) {
  if (targetRoomId !== FORGE_TARGET_ROOM_ID) {
    return {
      targetRoomId,
      constraints: [
        "Forge only guarantees a guided planning handoff.",
        "Downstream target-specific contracts should stay explicit and compact."
      ],
      relevantModules: [
        "rooms/forge-room/host/runtime.ts",
        "rooms/forge-room/host/forge-handoff-export.ts"
      ],
      summary: `Target room ${titleCaseRoomId(
        targetRoomId
      )} is not a first-class Forge export target, so the bundle should stay generic and conservative.`
    };
  }
  return {
    targetRoomId,
    constraints: [
      "Export should stay handoff-oriented and JSON-based.",
      "Scope should stay narrow enough for downstream repair execution.",
      "Open questions belong in the handoff instead of hidden assumptions."
    ],
    relevantModules: [
      "rooms/forge-room/host/forge-handoff-export.ts",
      "rooms/forge-room/shared/types/forge-handoff.ts"
    ],
    summary: "Repair Room is the canonical Forge target, so the preflight should favor narrow exports, explicit constraints, and practical downstream intake."
  };
}
export function buildForgeSelectedOperatorProfile(params) {
  const { operatorProfile, sessionContextSelection } = params;
  return {
    skill: {
      level: sessionContextSelection.skill.level === true ? operatorProfile.skill.level : null,
      soldering: sessionContextSelection.skill.soldering === true ? operatorProfile.skill.soldering : null,
      measurement: sessionContextSelection.skill.measurement === true ? operatorProfile.skill.measurement : null,
      mechanical: sessionContextSelection.skill.mechanical === true ? operatorProfile.skill.mechanical : null
    },
    tools: {
      multimeter: sessionContextSelection.tools.multimeter === true ? operatorProfile.tools.multimeter : null,
      solderingIron: sessionContextSelection.tools.solderingIron === true ? operatorProfile.tools.solderingIron : null,
      hotAir: sessionContextSelection.tools.hotAir === true ? operatorProfile.tools.hotAir : null,
      benchPowerSupply: sessionContextSelection.tools.benchPowerSupply === true ? operatorProfile.tools.benchPowerSupply : null,
      magnification: sessionContextSelection.tools.magnification === true ? operatorProfile.tools.magnification : null
    },
    preferences: {
      mode: sessionContextSelection.preferences.mode === true ? operatorProfile.preferences.mode : null,
      riskTolerance: sessionContextSelection.preferences.riskTolerance === true ? operatorProfile.preferences.riskTolerance : null
    }
  };
}
export function mergeForgeSelectedOperatorTools(profile, runOverride) {
  return {
    ...profile.tools,
    ...runOverride?.tools ?? {}
  };
}
export function summarizeForgeSelectedOperatorContext(params) {
  const { runOverride, selectedOperatorProfile, sessionContextSelection } = params;
  const effectiveTools = mergeForgeSelectedOperatorTools(selectedOperatorProfile, runOverride);
  const availableTools = Object.entries(effectiveTools).filter(([, enabled]) => enabled === true).map(([toolId]) => toolId);
  const unavailableTools = Object.entries(effectiveTools).filter(([, enabled]) => enabled === false).map(([toolId]) => toolId);
  const overrideTools = Object.entries(runOverride?.tools ?? {}).filter(([, enabled]) => enabled === true).map(([toolId]) => toolId);
  const skillSummary = [
    selectedOperatorProfile.skill.level ? `level ${selectedOperatorProfile.skill.level}` : null,
    selectedOperatorProfile.skill.soldering ? `soldering ${selectedOperatorProfile.skill.soldering}` : null,
    selectedOperatorProfile.skill.measurement ? `measurement ${selectedOperatorProfile.skill.measurement}` : null,
    selectedOperatorProfile.skill.mechanical ? `mechanical ${selectedOperatorProfile.skill.mechanical}` : null
  ].filter((entry) => typeof entry === "string");
  const preferenceSummary = [
    selectedOperatorProfile.preferences.mode ? `working mode ${selectedOperatorProfile.preferences.mode}` : null,
    selectedOperatorProfile.preferences.riskTolerance ? `risk tolerance ${selectedOperatorProfile.preferences.riskTolerance}` : null
  ].filter((entry) => typeof entry === "string");
  if (isForgeSessionContextSelectionEmpty(sessionContextSelection) && overrideTools.length === 0 && (runOverride?.notes.trim() ?? "") === "") {
    return [
      "No operator context was selected for this run; do not assume tools, skill level, or risk preference beyond the goal itself."
    ];
  }
  if (isForgeSelectedOperatorProfileEmpty(selectedOperatorProfile) && overrideTools.length === 0 && (runOverride?.notes.trim() ?? "") === "") {
    return [
      "Selected operator context has no defined values yet; do not assume tools, skill level, or risk preference beyond the goal itself."
    ];
  }
  return uniqueStrings(
    [
      skillSummary.length > 0 ? `Operator skill: ${skillSummary.join("; ")}.` : null,
      availableTools.length > 0 ? `Available tools: ${availableTools.join(", ")}.` : null,
      unavailableTools.length > 0 ? `Unavailable tools: ${unavailableTools.join(", ")}.` : null,
      preferenceSummary.length > 0 ? `${preferenceSummary.join("; ")}.` : null,
      overrideTools.length > 0 ? `Run override adds temporary tools: ${overrideTools.join(", ")}.` : null,
      runOverride?.notes.trim() ? `Run override note: ${runOverride.notes.trim().slice(0, 180)}` : null
    ].filter((entry) => typeof entry === "string" && entry.trim() !== "")
  );
}
export function buildForgeDerivedConstraints(params) {
  const { goal, runOverride, selectedOperatorProfile } = params;
  const effectiveTools = mergeForgeSelectedOperatorTools(selectedOperatorProfile, runOverride);
  const derived = [...goal.constraints];
  if (effectiveTools.hotAir === false) {
    derived.push("Do not assume hot air rework is available.");
  }
  if (effectiveTools.multimeter === false) {
    derived.push("Avoid diagnostic flows that require a multimeter as the primary path.");
  }
  if (selectedOperatorProfile.skill.level === "beginner") {
    derived.push("Keep steps low-risk and explicit for a beginner operator.");
  }
  if (selectedOperatorProfile.preferences.mode === "learn-first") {
    derived.push("Leave enough rationale for the operator to learn from the run.");
  }
  if (selectedOperatorProfile.preferences.riskTolerance === "low") {
    derived.push("Prefer reversible and lower-risk paths over speed.");
  }
  if (runOverride?.notes.trim()) {
    derived.push(`Temporary run condition: ${runOverride.notes.trim()}`);
  }
  return uniqueStrings(derived);
}
export function createForgePreflightCreatedAt() {
  return nowIso();
}
