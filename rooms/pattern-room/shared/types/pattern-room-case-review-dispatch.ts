import type { PatternActorId } from "./pattern-room-domain.js";

export const PATTERN_ROOM_CASE_REVIEW_DISPATCH_ACTION = "message.send" as const;
export const PATTERN_ROOM_CASE_REVIEW_DISPATCH_COMMAND = "pattern:case-review-dispatch" as const;
export const PATTERN_ROOM_CASE_REVIEW_DISPATCHED_EVENT = "pattern:case-review-dispatched" as const;
export const PATTERN_ROOM_CASE_REVIEW_DISPATCH_FAILED_EVENT =
  "pattern:case-review-dispatch-failed" as const;
export const PATTERN_ROOM_CASE_REVIEW_DISPATCH_CONNECT_POLICY = "ensure" as const;
export const PATTERN_ROOM_CASE_REVIEW_DISPATCH_PROTOCOL = {
  room: "pattern-room",
  scenario: "case-review",
  protocolKey: "pattern-room-case-review",
} as const;

export type PatternRoomCaseReviewDispatchRoleSlot = Exclude<PatternActorId, "system">;

export type PatternRoomCaseReviewTargetSlot = "ai0" | "ai1" | "ai2" | "us1";

export type PatternRoomCaseReviewDispatchProtocol =
  typeof PATTERN_ROOM_CASE_REVIEW_DISPATCH_PROTOCOL;

export type PatternRoomCaseReviewDispatchPayload = {
  action: typeof PATTERN_ROOM_CASE_REVIEW_DISPATCH_ACTION;
  toSlot: PatternRoomCaseReviewTargetSlot;
  connectPolicy: typeof PATTERN_ROOM_CASE_REVIEW_DISPATCH_CONNECT_POLICY;
  payload: {
    text: string;
    protocol: PatternRoomCaseReviewDispatchProtocol;
    page?: string;
  };
};

export type PatternRoomCaseReviewDispatchDraft = {
  roleSlot: PatternRoomCaseReviewDispatchRoleSlot;
  targetSlot: PatternRoomCaseReviewTargetSlot;
  payload: PatternRoomCaseReviewDispatchPayload;
  warnings: string[];
};

export type PatternRoomCaseReviewDispatchCommandPayload = {
  draft: PatternRoomCaseReviewDispatchDraft;
};

export type PatternRoomCaseReviewDispatchedEventPayload = {
  roleSlot: PatternRoomCaseReviewDispatchRoleSlot;
  success: true;
  targetSlot: PatternRoomCaseReviewTargetSlot;
  warnings: string[];
};

export type PatternRoomCaseReviewDispatchFailedEventPayload = {
  error: string;
  success: false;
};
