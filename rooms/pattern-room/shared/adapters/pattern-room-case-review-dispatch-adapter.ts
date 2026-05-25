import type { PatternRoomCasePacket } from "../types/pattern-room-case-packet.js";
import {
  PATTERN_ROOM_CASE_REVIEW_DISPATCH_ACTION,
  PATTERN_ROOM_CASE_REVIEW_DISPATCH_CONNECT_POLICY,
  PATTERN_ROOM_CASE_REVIEW_DISPATCH_PROTOCOL,
  type PatternRoomCaseReviewDispatchDraft,
  type PatternRoomCaseReviewDispatchRoleSlot,
  type PatternRoomCaseReviewTargetSlot,
} from "../types/pattern-room-case-review-dispatch.js";

export type PatternRoomCaseReviewDispatchOptions = {
  maxCasePacketChars?: number;
  page?: string | null;
};

export type PatternRoomCaseReviewDispatchInput = {
  casePacket: PatternRoomCasePacket;
  roleSlot: PatternRoomCaseReviewDispatchRoleSlot;
  taskPrompt?: string | null;
  options?: PatternRoomCaseReviewDispatchOptions;
};

type RoleInstruction = {
  targetSlot: PatternRoomCaseReviewTargetSlot;
  label: string;
  text: string;
};

const DEFAULT_TASK_PROMPT =
  "Bu vaka paketini temkinli biçimde gözden geçir; hüküm dili üretmeden önemli izleri, belirsizlikleri ve sonraki araştırma sorularını çıkar.";

const TRUNCATION_SUFFIX = "...";

const ROLE_INSTRUCTIONS: Readonly<Record<PatternRoomCaseReviewDispatchRoleSlot, RoleInstruction>> =
  {
    AI0: {
      targetSlot: "ai0",
      label: "AI0 araştırmacı / düzenleyici",
      text: "İzleri sınıflandırır, kaynakları ve notları düzenler, eksik bağlamı ayrı belirtir.",
    },
    AI1: {
      targetSlot: "ai1",
      label: "AI1 savunucu / güçlü yorum testçisi",
      text: "Mevcut izlerden kurulabilecek güçlü yorumu dener, dayanakları ve boşlukları ayırır.",
    },
    AI2: {
      targetSlot: "ai2",
      label: "AI2 10. Adam",
      text: "Karşı argüman, zayıf nokta, çelişki ve boşluk arar; sonuç yerine test üretir.",
    },
    US1: {
      targetSlot: "us1",
      label: "US1 hakem / son gözden geçiren",
      text: "İnsan denetimi perspektifiyle riskleri, açık soruları ve seçenekleri toplar.",
    },
  };

function normalizePlainText(value: string | null | undefined): string {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function normalizeMaxCasePacketChars(value: number | undefined): number | null {
  if (value === undefined || Number.isFinite(value) === false) {
    return null;
  }

  return Math.max(0, Math.floor(value));
}

function createRoleInstructions(roleSlot: PatternRoomCaseReviewDispatchRoleSlot): string {
  const roleInstruction = ROLE_INSTRUCTIONS[roleSlot];

  return [
    "[Role Instructions]",
    `role: ${roleSlot} - ${roleInstruction.label}`,
    roleInstruction.text,
  ].join("\n");
}

function truncateCasePacketBody(
  serializedCasePacket: string,
  maxCasePacketChars: number | null,
  warnings: string[]
): string {
  if (maxCasePacketChars === null || serializedCasePacket.length <= maxCasePacketChars) {
    return serializedCasePacket;
  }

  warnings.push(`Case Packet bölümü ${maxCasePacketChars} karakterlik dispatch sınırına kırpıldı.`);

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

  return ["[Case Packet]", casePacketBody].filter((part) => part !== "").join("\n");
}

function createTaskPromptSection(taskPrompt: string | null | undefined): string {
  const normalizedTaskPrompt = normalizePlainText(taskPrompt);
  const resolvedTaskPrompt =
    normalizedTaskPrompt === "" ? DEFAULT_TASK_PROMPT : normalizedTaskPrompt;

  return ["[Task Prompt]", resolvedTaskPrompt].join("\n");
}

export function createPatternRoomCaseReviewDispatchDraft(
  input: PatternRoomCaseReviewDispatchInput
): PatternRoomCaseReviewDispatchDraft {
  const warnings: string[] = [];
  const roleInstruction = ROLE_INSTRUCTIONS[input.roleSlot];
  const maxCasePacketChars = normalizeMaxCasePacketChars(input.options?.maxCasePacketChars);
  const page = normalizePlainText(input.options?.page);
  const payloadBody = {
    text: [
      createRoleInstructions(input.roleSlot),
      createCasePacketSection(input.casePacket, maxCasePacketChars, warnings),
      createTaskPromptSection(input.taskPrompt),
    ].join("\n\n---\n\n"),
    protocol: { ...PATTERN_ROOM_CASE_REVIEW_DISPATCH_PROTOCOL },
    ...(page === "" ? {} : { page }),
  };

  return {
    roleSlot: input.roleSlot,
    targetSlot: roleInstruction.targetSlot,
    payload: {
      action: PATTERN_ROOM_CASE_REVIEW_DISPATCH_ACTION,
      toSlot: roleInstruction.targetSlot,
      connectPolicy: PATTERN_ROOM_CASE_REVIEW_DISPATCH_CONNECT_POLICY,
      payload: payloadBody,
    },
    warnings,
  };
}
