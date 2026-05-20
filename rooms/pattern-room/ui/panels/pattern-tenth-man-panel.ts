import type { PatternPanelActions, PatternRoomMockData } from "../../shared/types/pattern-room.js";
import { createElement, createPanelShell } from "./pattern-panel-utils.js";

export function createTenthManPanel(
  data: PatternRoomMockData,
  _actions: PatternPanelActions,
  onBack: () => void
): HTMLElement {
  const shell = createPanelShell("tenth-man", "10. Adam", onBack);
  const device = createElement("div", "pattern-room-device pattern-room-slot-device");
  device.append(
    createElement("span", "pattern-room-device-status", data.tenthManSession.status),
    createElement("h2", undefined, data.tenthManSession.label),
    createElement("p", undefined, data.tenthManSession.prompt)
  );

  const slots = createElement("div", "pattern-room-device-slots");
  data.tenthManSession.roles.forEach((role) => {
    const [slotId = role.label, slotName = role.label] = role.label.split(" — ");
    const slot = createElement("article", "pattern-room-role-slot");
    slot.append(
      createElement("span", "pattern-room-role-id", slotId),
      createElement("strong", undefined, role.label),
      createElement("span", "pattern-room-role-name", slotName),
      createElement("p", undefined, role.note)
    );
    slot.title = role.note;
    slots.append(slot);
  });
  device.append(slots);

  if (data.tenthManSession.references.length > 0) {
    const references = createElement("section", "pattern-room-debate-references");
    references.append(
      createElement("span", "pattern-room-kicker", "Yerel referanslar"),
      createElement("h2", undefined, "10. Adam referans listesi")
    );
    data.tenthManSession.references.forEach((reference) => {
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

  shell.append(device);
  return shell;
}
