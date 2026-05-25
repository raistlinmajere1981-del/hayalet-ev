import type {
  PatternDummyRole,
  PatternPanelActions,
  PatternRoomMockData,
  PatternTenthManSession,
} from "../../shared/types/pattern-room.js";
import type {
  DebateLocalPhase,
  DebateLocalTurn,
} from "../../shared/state/pattern-room-local-state.js";
import {
  createPatternCaseReviewPreviewDraft,
  type PatternCaseReviewDispatchStatus,
  type PatternCaseReviewPreviewDraft,
} from "../pattern-case-review-preview.js";
import { createActionButton, createElement, createPanelShell } from "./pattern-panel-utils.js";

export type PatternCaseReviewPreviewPanelState = {
  preview: PatternCaseReviewPreviewDraft | null;
  dispatchStatus: PatternCaseReviewDispatchStatus;
  onPrepare: (preview: PatternCaseReviewPreviewDraft) => void;
  onSend: () => void;
};

const PHASE_LABELS: Record<DebateLocalPhase, string> = {
  idle: "Beklemede",
  preparation: "Hazırlık",
  role_assignment: "Rol atama",
  opening: "Açılış",
  counter_argument: "Karşı argüman",
  evidence_review: "Kanıt inceleme",
  weak_point: "Zayıf nokta",
  judge_mapping: "Hakem eşlemesi",
  completed: "Tamamlandı",
};

const DEBATE_PHASE_STEPS: readonly DebateLocalPhase[] = [
  "preparation",
  "role_assignment",
  "opening",
  "counter_argument",
  "evidence_review",
  "weak_point",
  "judge_mapping",
  "completed",
];

const TURN_ROLE_LABELS: Record<DebateLocalTurn["role"], string> = {
  researcher: "Araştırmacı",
  advocate: "Savunucu",
  "tenth-man": "10. Adam / Karşıt",
  arbiter: "Hakem",
};

function createDebateActionButton(
  label: string,
  datasetKey: string,
  onClick: () => void,
  disabled = false
): HTMLButtonElement {
  const button = createActionButton(label, onClick);
  button.dataset[datasetKey] = "true";
  button.disabled = disabled;
  return button;
}

function createPhaseStepIndicator(phase: DebateLocalPhase): HTMLElement {
  const phaseStep = DEBATE_PHASE_STEPS.indexOf(phase);
  const currentStep = phaseStep === -1 ? 0 : phaseStep + 1;

  return createElement(
    "span",
    "pattern-room-phase-step",
    `${currentStep} / ${DEBATE_PHASE_STEPS.length}`
  );
}

function appendReferences(device: HTMLElement, session: PatternTenthManSession): void {
  const references = createElement("section", "pattern-room-debate-references");
  references.append(
    createElement("span", "pattern-room-kicker", "Yerel referanslar"),
    createElement("h2", undefined, "10. Adam referans listesi")
  );

  if (session.references.length === 0) {
    references.append(
      createElement(
        "p",
        "pattern-room-empty-state",
        "Referans eklemek için Pano veya Arşiv üzerinden 10. Adam’a Ekle akışını kullan."
      )
    );
    device.append(references);
    return;
  }

  session.references.forEach((reference) => {
    const item = createElement("article", "pattern-room-reference-item");
    item.dataset["patternDebateReference"] = reference.id;
    item.append(
      createElement("span", "pattern-room-list-eyebrow", reference.kind),
      createElement("h3", undefined, reference.label),
      createElement("p", undefined, reference.note)
    );
    references.append(item);
  });
  device.append(references);
}

function createRoleSlot(role: PatternDummyRole): HTMLElement {
  const [slotId = role.label, slotName = role.label] = role.label.split(" — ");
  const slot = createElement(
    "article",
    role.connected === true ? "pattern-room-role-slot connected" : "pattern-room-role-slot"
  );
  slot.dataset["patternRoleConnected"] = role.connected === true ? "true" : "false";
  slot.append(
    createElement("span", "pattern-room-role-id", slotId),
    createElement("strong", undefined, role.label),
    createElement("span", "pattern-room-role-name", slotName),
    createElement(
      "span",
      "pattern-room-role-connection",
      role.connected === true ? "dummy bağlı" : "dummy beklemede"
    ),
    createElement("p", undefined, role.note)
  );
  slot.title = role.note;
  return slot;
}

function appendTurnList(device: HTMLElement, turns: readonly DebateLocalTurn[]): void {
  if (turns.length === 0) {
    return;
  }

  const turnList = createElement("section", "pattern-room-debate-turns");
  turnList.append(
    createElement("span", "pattern-room-kicker", "Local tur akışı"),
    createElement("h2", undefined, "Dummy tartışma turları")
  );
  turns.forEach((turn) => {
    const card = createElement("article", "pattern-room-debate-turn");
    card.dataset["patternDebateTurn"] = turn.phaseKey;
    card.append(
      createElement("span", "pattern-room-list-eyebrow", PHASE_LABELS[turn.phaseKey]),
      createElement("h3", undefined, `${turn.actorId} — ${TURN_ROLE_LABELS[turn.role]}`),
      createElement("p", undefined, turn.content)
    );
    turnList.append(card);
  });
  device.append(turnList);
}

function appendVerdict(device: HTMLElement, verdict: string | null | undefined): void {
  if (verdict === null || verdict === undefined) {
    return;
  }

  const verdictCard = createElement("section", "pattern-room-debate-verdict");
  verdictCard.append(
    createElement("span", "pattern-room-kicker", "Local sonuç"),
    createElement("h2", undefined, "Oturum özeti"),
    createElement("p", undefined, verdict)
  );
  device.append(verdictCard);
}

function appendPreviewWarnings(container: HTMLElement, warnings: readonly string[]): void {
  if (warnings.length === 0) {
    return;
  }

  const warningList = createElement("ul", "pattern-room-case-review-preview-warnings");
  warnings.forEach((warning) => {
    warningList.append(createElement("li", undefined, warning));
  });
  container.append(warningList);
}

function renderCaseReviewPreview(
  container: HTMLElement,
  preview: PatternCaseReviewPreviewDraft
): void {
  const meta = createElement("div", "pattern-room-case-review-preview-meta");
  meta.append(
    createElement(
      "span",
      "pattern-room-device-status pattern-room-device-status-secondary",
      `Target: ${preview.roleSlot} / ${preview.targetSlot}`
    ),
    createElement(
      "span",
      "pattern-room-device-status pattern-room-device-status-secondary",
      `Protocol: ${preview.protocol.protocolKey}`
    )
  );

  const textPreview = createElement("pre", "pattern-room-case-review-preview-text");
  textPreview.dataset["patternCaseReviewPreviewText"] = "true";
  textPreview.textContent = preview.text;

  container.replaceChildren(meta, textPreview);
  appendPreviewWarnings(container, preview.warnings);
}

function appendDispatchStatus(
  container: HTMLElement,
  status: PatternCaseReviewDispatchStatus
): void {
  if (status.message === null) {
    return;
  }

  const statusLine = createElement(
    "p",
    `pattern-room-case-review-preview-status ${status.kind}`,
    status.message
  );
  statusLine.dataset["patternCaseReviewDispatchStatus"] = "true";
  container.append(statusLine);
}

function appendCaseReviewPreview(
  device: HTMLElement,
  data: PatternRoomMockData,
  previewState: PatternCaseReviewPreviewPanelState
): void {
  const previewSection = createElement("section", "pattern-room-case-review-preview");
  previewSection.dataset["patternCaseReviewPreview"] = "true";
  const previewResult = createElement("div", "pattern-room-case-review-preview-result");
  if (previewState.preview === null) {
    previewResult.append(
      createElement("p", "pattern-room-empty-state", "Önizleme henüz hazırlanmadı.")
    );
  } else {
    renderCaseReviewPreview(previewResult, previewState.preview);
  }

  const prepareButton = createActionButton("Önizleme Hazırla", () => {
    previewState.onPrepare(createPatternCaseReviewPreviewDraft(data));
  });
  prepareButton.dataset["patternCaseReviewPreviewPrepare"] = "true";

  const sendButton = createActionButton("AI2’ye İnceleme Gönder", previewState.onSend);
  sendButton.dataset["patternCaseReviewDispatchSend"] = "true";
  sendButton.disabled =
    previewState.preview === null || previewState.dispatchStatus.kind === "sending";

  const actionRow = createElement("div", "pattern-room-action-row");
  actionRow.append(prepareButton, sendButton);
  appendDispatchStatus(previewResult, previewState.dispatchStatus);

  previewSection.append(
    createElement("span", "pattern-room-kicker", "Dry-run"),
    createElement("h2", undefined, "AI2 Vaka İnceleme Önizlemesi"),
    createElement(
      "p",
      undefined,
      "Bu önizleme AI’ya gönderilecek araştırma paketinin taslağını gösterir. Bu aşamada hiçbir mesaj gönderilmez."
    ),
    actionRow,
    previewResult
  );
  device.append(previewSection);
}

function appendPhaseAction(
  device: HTMLElement,
  session: PatternTenthManSession,
  actions: PatternPanelActions
): void {
  const phase = session.phase ?? "idle";
  const actionRow = createElement("div", "pattern-room-action-row pattern-room-debate-actions");

  if (phase === "idle") {
    actionRow.append(
      createDebateActionButton(
        "Oturumu Hazırla",
        "patternPrepareDebate",
        actions.prepareDebate,
        session.references.length === 0
      )
    );
  }

  if (phase === "preparation") {
    actionRow.append(
      createDebateActionButton("Rolleri Ata", "patternAssignDebateRoles", actions.assignDebateRoles)
    );
  }

  if (phase === "role_assignment") {
    actionRow.append(
      createDebateActionButton("Oturumu Başlat", "patternStartDebate", actions.startDebate)
    );
  }

  if (
    phase === "opening" ||
    phase === "counter_argument" ||
    phase === "evidence_review" ||
    phase === "weak_point"
  ) {
    actionRow.append(
      createDebateActionButton("Sonraki Tur", "patternAdvanceDebate", actions.advanceDebatePhase)
    );
  }

  if (phase === "judge_mapping") {
    actionRow.append(
      createDebateActionButton("Oturumu Tamamla", "patternCompleteDebate", actions.completeDebate)
    );
  }

  if (phase === "completed") {
    actionRow.append(
      createDebateActionButton(
        "Rapora Yansıt",
        "patternReflectDebate",
        actions.reflectDebateToReport
      )
    );
  }

  device.append(actionRow);
}

export function createTenthManPanel(
  data: PatternRoomMockData,
  actions: PatternPanelActions,
  onBack: () => void,
  caseReviewPreviewState: PatternCaseReviewPreviewPanelState
): HTMLElement {
  const shell = createPanelShell("tenth-man", "10. Adam", onBack);
  const session = data.tenthManSession;
  const phase = session.phase ?? "idle";
  const device = createElement("div", "pattern-room-device pattern-room-slot-device");
  const statusRow = createElement("div", "pattern-room-device-status-row");
  statusRow.append(
    createElement(
      "span",
      "pattern-room-device-status",
      `${session.status} / ${PHASE_LABELS[phase]}`
    ),
    createElement(
      "span",
      "pattern-room-device-status pattern-room-device-status-secondary",
      "Yerel Simülasyon"
    ),
    createPhaseStepIndicator(phase)
  );

  device.append(
    statusRow,
    createElement("h2", undefined, session.label),
    createElement("p", undefined, session.prompt)
  );

  const slots = createElement("div", "pattern-room-device-slots");
  session.roles.forEach((role) => {
    slots.append(createRoleSlot(role));
  });
  device.append(slots);

  appendReferences(device, session);
  appendTurnList(device, session.turns ?? []);
  appendVerdict(device, session.verdict);
  appendCaseReviewPreview(device, data, caseReviewPreviewState);
  appendPhaseAction(device, session, actions);

  shell.append(device);
  return shell;
}
