import type { PatternActorId } from "./pattern-room-domain.js";

export const PATTERN_ROOM_CASE_REVIEW_MESSAGE_VERSION = 1 as const;
export const PATTERN_ROOM_CASE_REVIEW_PROTOCOL_KEY = "pattern-room-case-review" as const;
export const PATTERN_ROOM_CASE_REVIEW_SCENARIO = "case-review" as const;

export type PatternRoomCaseReviewRoleSlot = Exclude<PatternActorId, "system">;

export type PatternRoomCaseReviewMessageSections = {
  protocolNotice: string;
  roleInstructions: string;
  casePacket: string;
  taskPrompt: string;
};

export type PatternRoomCaseReviewMessage = {
  messageVersion: typeof PATTERN_ROOM_CASE_REVIEW_MESSAGE_VERSION;
  roomId: "pattern-room";
  protocolKey: typeof PATTERN_ROOM_CASE_REVIEW_PROTOCOL_KEY;
  scenario: typeof PATTERN_ROOM_CASE_REVIEW_SCENARIO;
  roleSlot: PatternRoomCaseReviewRoleSlot;
  roleLabel: string;
  sections: PatternRoomCaseReviewMessageSections;
  previewText: string;
  warnings: string[];
};
