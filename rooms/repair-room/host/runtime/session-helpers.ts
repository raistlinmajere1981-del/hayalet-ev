import {
  REPAIR_LOCAL_OWNER_SCOPE_ID,
  REPAIR_ROOM_ID,
  REPAIR_SESSION_SCHEMA_VERSION,
} from "../../shared/repair-constants.js";
import { MOCK_REPAIR_PCB_IMAGES } from "../../shared/data/index.js";
import type {
  RepairSession,
  RepairSessionListItem,
  RepairWizardDraft,
} from "../../shared/types/index.js";
import type { RepairRuntimeState } from "../state/repair-runtime-state.js";
import { createEventId } from "./event-factory.js";
import { safeString } from "./guards.js";

export function buildSessionList(sessions: Record<string, RepairSession>): RepairSessionListItem[] {
  return Object.values(sessions)
    .map((session) => ({
      id: session.id,
      title: session.title,
      deviceLabel: session.deviceInfo.deviceLabel,
      boardCode: session.deviceInfo.boardCode,
      serialNumber: session.deviceInfo.serialNumber,
      status: session.status,
      riskLevel: session.riskLevel,
      updatedAt: session.updatedAt,
      isArchived: session.status === "archived",
    }))
    .sort(
      (a, b) =>
        Number(a.isArchived) - Number(b.isArchived) || b.updatedAt.localeCompare(a.updatedAt)
    );
}

export function getActiveSession(state: RepairRuntimeState): RepairSession | null {
  return state.activeSessionId === null ? null : (state.sessions[state.activeSessionId] ?? null);
}

export function phaseForSession(session: RepairSession | null): RepairRuntimeState["phase"] {
  if (session === null) return "idle";
  if (session.status === "paused") return "session-paused";
  if (session.status === "draft" || session.status === "research" || session.status === "ready") {
    return "wizard-active";
  }
  return "session-active";
}

export function getSessionTimelineMs(session: RepairSession | null): number {
  if (session === null) return 0;
  const lastEventMs =
    session.events.length === 0
      ? 0
      : Math.max(
          ...session.events.map((event) =>
            Math.max(0, Date.parse(event.occurredAt) - Date.parse(session.startedAt))
          )
        );
  return Math.max(0, lastEventMs);
}

export function patchWizardDraftFromPayload(
  payload: Record<string, unknown>
): Partial<RepairWizardDraft> | null {
  const draftPayload = payload["wizardDraft"];
  if (typeof draftPayload === "object" && draftPayload !== null) {
    const raw = draftPayload as Record<string, unknown>;
    const patch: Partial<RepairWizardDraft> = {};
    const stringFields: Array<keyof Omit<RepairWizardDraft, "primarySymptoms">> = [
      "manufacturer",
      "model",
      "boardCode",
      "serialNumber",
      "intakeNotes",
      "symptomFreeText",
    ];
    stringFields.forEach((field) => {
      const value = raw[field];
      if (typeof value === "string") {
        patch[field] = value;
      }
    });
    const symptoms = raw["primarySymptoms"];
    if (Array.isArray(symptoms)) {
      patch.primarySymptoms = symptoms.filter((item): item is string => typeof item === "string");
    }
    return Object.keys(patch).length === 0 ? null : patch;
  }

  const field = safeString(payload["wizardField"]);
  const value = payload["value"];
  if (
    field === "manufacturer" ||
    field === "model" ||
    field === "boardCode" ||
    field === "serialNumber" ||
    field === "intakeNotes" ||
    field === "symptomFreeText"
  ) {
    return typeof value === "string" ? { [field]: value } : null;
  }
  if (field === "primarySymptoms" && Array.isArray(value)) {
    return { primarySymptoms: value.filter((item): item is string => typeof item === "string") };
  }
  return null;
}

export function createDraftSession(state: RepairRuntimeState, iso: string): RepairSession {
  const draft = state.wizard.draft;
  const id = createEventId("repair-draft", iso);
  const boardCode = draft.boardCode.trim() || "BOARD-PENDING";
  return {
    schemaVersion: REPAIR_SESSION_SCHEMA_VERSION,
    id,
    roomId: REPAIR_ROOM_ID,
    ownerScopeId: REPAIR_LOCAL_OWNER_SCOPE_ID,
    title: `RR-${iso.slice(5, 10).replace("-", "")}-${iso.slice(11, 16).replace(":", "")}`,
    status: "draft",
    riskLevel: "medium",
    deviceInfo: {
      deviceLabel: draft.model.trim() || "Bench intake draft",
      manufacturer: draft.manufacturer.trim() || "Unknown",
      model: draft.model.trim() || "Model pending",
      boardCode,
      serialNumber: draft.serialNumber.trim() || "S/N pending",
      intakeNotes: draft.intakeNotes.trim() || "Awaiting intake notes.",
    },
    symptoms: {
      primarySymptoms: draft.primarySymptoms,
      freeText: draft.symptomFreeText.trim() || "Symptoms pending.",
      reportedAt: iso,
    },
    pcbImage: MOCK_REPAIR_PCB_IMAGES["psu-2025-0510"] ?? null,
    knowledgePackId: null,
    knowledgePack: null,
    events: [
      {
        kind: "session-start",
        id: createEventId("evt-draft-start", iso),
        sessionId: id,
        occurredAt: iso,
        source: "system",
        linkedEventIds: [],
        title: "Draft repair session opened",
      },
    ],
    sessionNotes: "Draft session created from Repair Room wizard.",
    startedAt: iso,
    updatedAt: iso,
    archivedAt: null,
  };
}
