import { createPatternRoomCasePacket } from "../shared/adapters/pattern-room-case-packet-adapter.js";
import { createPatternRoomCaseReviewDispatchDraft } from "../shared/adapters/pattern-room-case-review-dispatch-adapter.js";
import type { PatternRoomMockData } from "../shared/types/pattern-room.js";
import type {
  PatternRoomCaseReviewDispatchDraft,
  PatternRoomCaseReviewDispatchProtocol,
  PatternRoomCaseReviewTargetSlot,
} from "../shared/types/pattern-room-case-review-dispatch.js";

const CASE_REVIEW_PREVIEW_ROLE_SLOT = "AI2";
const CASE_REVIEW_PREVIEW_TASK_PROMPT =
  "Bu vaka paketini 10. Adam rolüyle incele; varsayımları, zayıf noktaları, çelişkileri ve sonraki araştırma sorularını çıkar. Kesin hüküm üretme.";

export type PatternCaseReviewPreviewDraft = {
  dispatchDraft: PatternRoomCaseReviewDispatchDraft;
  roleSlot: typeof CASE_REVIEW_PREVIEW_ROLE_SLOT;
  targetSlot: PatternRoomCaseReviewTargetSlot;
  protocol: PatternRoomCaseReviewDispatchProtocol;
  text: string;
  warnings: readonly string[];
};

export type PatternCaseReviewDispatchStatusKind = "idle" | "sending" | "sent" | "failed";

export type PatternCaseReviewDispatchStatus = {
  kind: PatternCaseReviewDispatchStatusKind;
  message: string | null;
};

export function createPatternCaseReviewPreviewDraft(
  data: PatternRoomMockData
): PatternCaseReviewPreviewDraft {
  const casePacket = createPatternRoomCasePacket(data);
  const draft = createPatternRoomCaseReviewDispatchDraft({
    casePacket,
    roleSlot: CASE_REVIEW_PREVIEW_ROLE_SLOT,
    taskPrompt: CASE_REVIEW_PREVIEW_TASK_PROMPT,
  });

  return {
    dispatchDraft: draft,
    roleSlot: CASE_REVIEW_PREVIEW_ROLE_SLOT,
    targetSlot: draft.targetSlot,
    protocol: draft.payload.payload.protocol,
    text: draft.payload.payload.text,
    warnings: draft.warnings,
  };
}
