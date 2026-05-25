import type { PatternActorId } from "../types/pattern-room-domain.js";
import type { PatternRoomCasePacket } from "../types/pattern-room-case-packet.js";
import {
  PATTERN_ROOM_CASE_REVIEW_MESSAGE_VERSION,
  PATTERN_ROOM_CASE_REVIEW_PROTOCOL_KEY,
  PATTERN_ROOM_CASE_REVIEW_SCENARIO,
  type PatternRoomCaseReviewMessage,
  type PatternRoomCaseReviewRoleSlot,
} from "../types/pattern-room-case-review-message.js";

export type PatternRoomCaseReviewMessageOptions = {
  maxCasePacketChars?: number;
};

export type PatternRoomCaseReviewMessageInput = {
  protocolText: string;
  casePacket: PatternRoomCasePacket;
  roleSlot: PatternActorId;
  taskPrompt?: string | null;
  options?: PatternRoomCaseReviewMessageOptions;
};

type RoleInstruction = {
  label: string;
  text: string;
};

const DEFAULT_TASK_PROMPT =
  "Bu vaka paketini temkinli biçimde gözden geçir; hüküm dili üretmeden önemli izleri, belirsizlikleri ve sonraki araştırma sorularını çıkar.";

const TRUNCATION_SUFFIX = "...";

const ROLE_INSTRUCTIONS: Readonly<Record<PatternRoomCaseReviewRoleSlot, RoleInstruction>> = {
  AI0: {
    label: "AI0 araştırmacı / düzenleyici",
    text: "Kaynakları, kanıt notlarını, bağlantıları ve açık soruları düzenle; eksik bağlamları ayrı tut.",
  },
  AI1: {
    label: "AI1 savunucu / güçlü yorum testçisi",
    text: "Mevcut yorumu en güçlü temkinli haliyle sınar; dayanakları, karşı işaretleri ve boşlukları ayır.",
  },
  AI2: {
    label: "AI2 10. Adam / karşı argüman ve boşluk arayıcı",
    text: "Varsayımları zorla; zayıf noktaları, alternatif açıklamaları ve görülmeyen araştırma sorularını çıkar.",
  },
  US1: {
    label: "US1 hakem / son gözden geçiren",
    text: "Bulguları, çelişkileri ve karar öncesi açık seçenekleri insan odağında toparla.",
  },
};

function normalizeBlockText(value: string | null | undefined): string {
  return value?.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim() ?? "";
}

function normalizePlainText(value: string | null | undefined): string {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function normalizeMaxCasePacketChars(value: number | undefined): number | null {
  if (value === undefined || Number.isFinite(value) === false) {
    return null;
  }

  return Math.max(0, Math.floor(value));
}

function isCaseReviewRoleSlot(value: PatternActorId): value is PatternRoomCaseReviewRoleSlot {
  return value === "AI0" || value === "AI1" || value === "AI2" || value === "US1";
}

function resolveRoleSlot(
  roleSlot: PatternActorId,
  warnings: string[]
): PatternRoomCaseReviewRoleSlot {
  if (isCaseReviewRoleSlot(roleSlot)) {
    return roleSlot;
  }

  warnings.push("system roleSlot dry-run case review hedefi değildir; US1 rolü kullanıldı.");
  return "US1";
}

function createProtocolNotice(protocolText: string): string {
  const normalizedProtocolText = normalizeBlockText(protocolText);
  const header = [
    "[Protocol Notice]",
    `protocolKey: ${PATTERN_ROOM_CASE_REVIEW_PROTOCOL_KEY}`,
    `scenario: ${PATTERN_ROOM_CASE_REVIEW_SCENARIO}`,
  ].join("\n");

  if (normalizedProtocolText === "") {
    return `${header}\n\nProtocol metni sağlanmadı; dry-run yalnızca rol, Case Packet ve görev bölümlerini gösterir.`;
  }

  return `${header}\n\n${normalizedProtocolText}`;
}

function createRoleInstructions(roleSlot: PatternRoomCaseReviewRoleSlot): {
  label: string;
  section: string;
} {
  const roleInstruction = ROLE_INSTRUCTIONS[roleSlot];
  return {
    label: roleInstruction.label,
    section: [
      "[Role Instructions]",
      `role: ${roleSlot} - ${roleInstruction.label}`,
      roleInstruction.text,
    ].join("\n"),
  };
}

function truncateCasePacketBody(
  serializedCasePacket: string,
  maxCasePacketChars: number | null,
  warnings: string[]
): string {
  if (maxCasePacketChars === null || serializedCasePacket.length <= maxCasePacketChars) {
    return serializedCasePacket;
  }

  warnings.push(`Case Packet bölümü ${maxCasePacketChars} karakterlik dry-run sınırına kırpıldı.`);

  if (maxCasePacketChars <= 0) {
    return "";
  }

  if (maxCasePacketChars <= TRUNCATION_SUFFIX.length) {
    return serializedCasePacket.slice(0, maxCasePacketChars);
  }

  return `${serializedCasePacket.slice(0, maxCasePacketChars - TRUNCATION_SUFFIX.length).trimEnd()}${TRUNCATION_SUFFIX}`;
}

function createCasePacketSection(
  casePacket: PatternRoomCasePacket,
  maxCasePacketChars: number | null,
  warnings: string[]
): string {
  const serializedCasePacket = JSON.stringify(casePacket, null, 2);
  const casePacketBody = truncateCasePacketBody(serializedCasePacket, maxCasePacketChars, warnings);

  return [
    "[Case Packet]",
    "Bu bölüm dinamik yerel Case Packet verisinin dry-run görünümüdür.",
    casePacketBody,
  ]
    .filter((part) => part !== "")
    .join("\n");
}

function createTaskPromptSection(taskPrompt: string | null | undefined): string {
  const normalizedTaskPrompt = normalizePlainText(taskPrompt);
  const resolvedTaskPrompt =
    normalizedTaskPrompt === "" ? DEFAULT_TASK_PROMPT : normalizedTaskPrompt;

  return ["[Task Prompt]", resolvedTaskPrompt].join("\n");
}

export function createPatternRoomCaseReviewMessage(
  input: PatternRoomCaseReviewMessageInput
): PatternRoomCaseReviewMessage {
  const warnings: string[] = [];
  const roleSlot = resolveRoleSlot(input.roleSlot, warnings);
  const roleInstructions = createRoleInstructions(roleSlot);
  const maxCasePacketChars = normalizeMaxCasePacketChars(input.options?.maxCasePacketChars);
  const sections = {
    protocolNotice: createProtocolNotice(input.protocolText),
    roleInstructions: roleInstructions.section,
    casePacket: createCasePacketSection(input.casePacket, maxCasePacketChars, warnings),
    taskPrompt: createTaskPromptSection(input.taskPrompt),
  };

  return {
    messageVersion: PATTERN_ROOM_CASE_REVIEW_MESSAGE_VERSION,
    roomId: "pattern-room",
    protocolKey: PATTERN_ROOM_CASE_REVIEW_PROTOCOL_KEY,
    scenario: PATTERN_ROOM_CASE_REVIEW_SCENARIO,
    roleSlot,
    roleLabel: roleInstructions.label,
    sections,
    previewText: [
      sections.protocolNotice,
      sections.roleInstructions,
      sections.casePacket,
      sections.taskPrompt,
    ].join("\n\n---\n\n"),
    warnings,
  };
}
