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
import { createActionButton, createElement, createPanelShell } from "./pattern-panel-utils.js";

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
  onBack: () => void
): HTMLElement {
  const shell = createPanelShell("tenth-man", "10. Adam", onBack);
  const session = data.tenthManSession;
  const phase = session.phase ?? "idle";
  const device = createElement("div", "pattern-room-device pattern-room-slot-device");
  device.append(
    createElement(
      "span",
      "pattern-room-device-status",
      `${session.status} / ${PHASE_LABELS[phase]}`
    ),
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
  appendPhaseAction(device, session, actions);

  shell.append(device);
  return shell;
}
