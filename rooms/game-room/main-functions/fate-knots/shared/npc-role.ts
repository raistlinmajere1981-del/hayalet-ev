import type {
  FateKnotsNpcRolePacket,
  FateKnotsRunState,
  FateKnotsUniversePackage,
} from "./contracts.js";

export type FateKnotsNpcRolePacketIssueCode =
  | "universe-run-mismatch"
  | "run-not-active"
  | "npc-not-found"
  | "role-definition-not-found"
  | "role-npc-mismatch"
  | "npc-not-at-active-location";

export interface FateKnotsNpcRolePacketIssue {
  code: FateKnotsNpcRolePacketIssueCode;
  value?: string;
}

export interface FateKnotsNpcRolePacketBuildResult {
  ok: boolean;
  packet: FateKnotsNpcRolePacket | null;
  issues: FateKnotsNpcRolePacketIssue[];
}

function uniqueTrimmed(values: readonly string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

/**
 * Builds AI0 knowledge from canonical universe data plus engine-approved legal
 * interactions. No coding-agent history, MCP memory or provider conversation is
 * consulted here; continuity is rebuilt from accepted Fate Knots state.
 */
export function buildFateKnotsNpcRolePacket(
  universe: FateKnotsUniversePackage,
  run: FateKnotsRunState,
  npcId: string,
  legalInteractionIds: readonly string[]
): FateKnotsNpcRolePacketBuildResult {
  if (universe.universeId !== run.universeId) {
    return {
      ok: false,
      packet: null,
      issues: [{ code: "universe-run-mismatch", value: run.universeId }],
    };
  }

  if (run.result !== "active") {
    return { ok: false, packet: null, issues: [{ code: "run-not-active" }] };
  }

  const npc = universe.npcs.find((candidate) => candidate.id === npcId) ?? null;
  if (!npc) {
    return { ok: false, packet: null, issues: [{ code: "npc-not-found", value: npcId }] };
  }

  const role = universe.npcRoles.find((candidate) => candidate.id === npc.rolePacketId) ?? null;
  if (!role) {
    return {
      ok: false,
      packet: null,
      issues: [{ code: "role-definition-not-found", value: npc.rolePacketId }],
    };
  }

  if (role.npcId !== npc.id) {
    return {
      ok: false,
      packet: null,
      issues: [{ code: "role-npc-mismatch", value: role.npcId }],
    };
  }

  if (run.activeLocationId !== npc.locationId) {
    return {
      ok: false,
      packet: null,
      issues: [{ code: "npc-not-at-active-location", value: npc.locationId }],
    };
  }

  const personaFacts = uniqueTrimmed([npc.publicSummary, ...role.personaFacts]);

  return {
    ok: true,
    packet: {
      universeId: universe.universeId,
      runId: run.runId,
      npcId: npc.id,
      locationId: npc.locationId,
      personaFacts,
      knownFacts: uniqueTrimmed(role.knownFacts),
      relationshipFacts: uniqueTrimmed(role.relationshipFacts),
      legalInteractionIds: uniqueTrimmed(legalInteractionIds),
    },
    issues: [],
  };
}
