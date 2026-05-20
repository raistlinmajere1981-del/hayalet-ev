import type { PatternRoomMockData } from "../../shared/types/pattern-room.js";
import { createElement, createPanelShell } from "./pattern-panel-utils.js";

export function createTenthManPanel(data: PatternRoomMockData, onBack: () => void): HTMLElement {
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
  shell.append(device);
  return shell;
}
