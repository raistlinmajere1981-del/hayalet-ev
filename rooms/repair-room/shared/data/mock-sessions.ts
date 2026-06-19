import {
  REPAIR_LOCAL_OWNER_SCOPE_ID,
  REPAIR_ROOM_ID,
  REPAIR_SESSION_SCHEMA_VERSION,
} from "../repair-constants.js";
import type {
  RepairSession,
  RepairSessionListItem,
} from "../types/index.js";
import { MOCK_REPAIR_EVENTS } from "./mock-events.js";
import { MOCK_REPAIR_KNOWLEDGE_PACKS } from "./mock-knowledge-packs.js";
import { MOCK_REPAIR_PCB_IMAGES } from "./mock-pcb-images.js";

function buildSession(
  partial: Omit<RepairSession, "schemaVersion" | "roomId" | "ownerScopeId">
): RepairSession {
  return {
    schemaVersion: REPAIR_SESSION_SCHEMA_VERSION,
    roomId: REPAIR_ROOM_ID,
    ownerScopeId: REPAIR_LOCAL_OWNER_SCOPE_ID,
    ...partial,
  };
}

export const MOCK_REPAIR_SESSIONS: Record<string, RepairSession> = {
  "psu-2025-0510": buildSession({
    id: "psu-2025-0510",
    title: "PSU-2025-0510",
    status: "in-progress",
    riskLevel: "medium",
    deviceInfo: {
      deviceType: "PSU / power board",
      deviceLabel: "ATX Power Supply",
      manufacturer: "Samsung",
      model: "BN44-00932A",
      boardCode: "BN44-00932A",
      serialNumber: "R21Z14CSN100123",
      intakeNotes: "No power. Bulk cap discharged before intake.",
    },
    symptoms: {
      primarySymptoms: ["No Power"],
      freeText: "Dead board. Confirms no 5V_STBY at output connector pin 9.",
      reportedAt: "2026-05-10T10:14:48.000Z",
    },
    pcbImage: MOCK_REPAIR_PCB_IMAGES["psu-2025-0510"] ?? null,
    knowledgePackId: "bn44-00932a",
    knowledgePack: MOCK_REPAIR_KNOWLEDGE_PACKS["bn44-00932a"] ?? null,
    events: MOCK_REPAIR_EVENTS["psu-2025-0510"] ?? [],
    sessionNotes:
      "Bulk cap reads 0 V, R201 open, U14 gate flatlined. Plan: replace R201, retest 5V_STBY, then probe gate drive.",
    startedAt: "2026-05-10T10:18:00.000Z",
    updatedAt: "2026-05-10T10:42:11.000Z",
    archivedAt: null,
  }),
  "lg-oled-main": buildSession({
    id: "lg-oled-main",
    title: "LG-OLED-MAIN",
    status: "archived",
    riskLevel: "high",
    deviceInfo: {
      deviceType: "TV main board",
      deviceLabel: "LG OLED 55C9 Main Board",
      manufacturer: "LG",
      model: "EBT66239903",
      boardCode: "EAX68253604",
      serialNumber: "910RMVH3F210",
      intakeNotes: "Backlight ok, no HDMI handshake on inputs 1-3.",
    },
    symptoms: {
      primarySymptoms: ["HDMI dead"],
      freeText: "All HDMI ports fail handshake. EDID read fails on TV side.",
      reportedAt: "2026-04-22T13:02:11.000Z",
    },
    pcbImage: MOCK_REPAIR_PCB_IMAGES["lg-oled-main"] ?? null,
    knowledgePackId: null,
    knowledgePack: null,
    events: [],
    sessionNotes: "HDMI level shifter (U2502) replaced. Handshake restored on all ports.",
    startedAt: "2026-04-22T13:14:08.000Z",
    updatedAt: "2026-04-23T18:31:48.000Z",
    archivedAt: "2026-04-23T18:32:02.000Z",
  }),
  "xbox-series-x": buildSession({
    id: "xbox-series-x",
    title: "XBOX-SERIES-X",
    status: "archived",
    riskLevel: "medium",
    deviceInfo: {
      deviceType: "Game console",
      deviceLabel: "Xbox Series X HDMI Repair",
      manufacturer: "Microsoft",
      model: "1882",
      boardCode: "X819994-002",
      serialNumber: "TM9402-2401-K3",
      intakeNotes: "No video out, faint click on power. Console boots audio-only.",
    },
    symptoms: {
      primarySymptoms: ["HDMI port damaged"],
      freeText: "Bent center pin on HDMI connector. APU still negotiating audio over eARC fallback.",
      reportedAt: "2026-03-14T09:22:00.000Z",
    },
    pcbImage: MOCK_REPAIR_PCB_IMAGES["xbox-series-x"] ?? null,
    knowledgePackId: null,
    knowledgePack: null,
    events: [],
    sessionNotes: "HDMI connector replaced. Video restored at 2160p120 RGB Full.",
    startedAt: "2026-03-14T09:30:00.000Z",
    updatedAt: "2026-03-14T12:14:48.000Z",
    archivedAt: "2026-03-14T12:15:02.000Z",
  }),
  "lenovo-note": buildSession({
    id: "lenovo-note",
    title: "LENOVO-NOTE",
    status: "archived",
    riskLevel: "low",
    deviceInfo: {
      deviceType: "Laptop anakart",
      deviceLabel: "Lenovo ThinkPad T14 Gen2",
      manufacturer: "Lenovo",
      model: "20W0-CTO1WW",
      boardCode: "NM-D461",
      serialNumber: "PF3RZ8L0",
      intakeNotes: "Won't power on. No charge LED, no fan spin on AC.",
    },
    symptoms: {
      primarySymptoms: ["No Power"],
      freeText: "EC fail to enter S0. PCH_PWRGD never asserts.",
      reportedAt: "2026-02-04T11:48:00.000Z",
    },
    pcbImage: MOCK_REPAIR_PCB_IMAGES["lenovo-note"] ?? null,
    knowledgePackId: null,
    knowledgePack: null,
    events: [],
    sessionNotes: "Short on +VCCIO traced to leaky decoupling cap C204. Replaced. Boots to BIOS.",
    startedAt: "2026-02-04T12:02:00.000Z",
    updatedAt: "2026-02-05T15:48:11.000Z",
    archivedAt: "2026-02-05T15:48:30.000Z",
  }),
};

export const MOCK_REPAIR_ACTIVE_SESSION_ID = "psu-2025-0510";

export const MOCK_REPAIR_SESSION_LIST: RepairSessionListItem[] = Object.values(
  MOCK_REPAIR_SESSIONS
).map((session) => ({
  id: session.id,
  title: session.title,
  deviceLabel: session.deviceInfo.deviceLabel,
  boardCode: session.deviceInfo.boardCode,
  serialNumber: session.deviceInfo.serialNumber,
  status: session.status,
  riskLevel: session.riskLevel,
  updatedAt: session.updatedAt,
  isArchived: session.status === "archived",
}));
