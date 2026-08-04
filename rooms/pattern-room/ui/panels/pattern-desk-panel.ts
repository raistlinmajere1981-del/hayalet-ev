import type {
  PatternPanelActions,
  PatternRoomWorkspaceModel,
} from "../../shared/types/pattern-room.js";
import {
  createPatternWorkspaceTranslator,
  type PatternWorkspaceTranslator,
} from "../pattern-room-workspace-i18n.js";
import { createElement, createPanelShell } from "./pattern-panel-utils.js";

export function createDeskPanel(
  data: PatternRoomWorkspaceModel,
  _actions: PatternPanelActions,
  onBack: () => void,
  text: PatternWorkspaceTranslator = createPatternWorkspaceTranslator("tr", null)
): HTMLElement {
  const shell = createPanelShell("desk", text("connections.title"), onBack);
  const layout = createElement(
    "div",
    "pattern-room-desk-layout pattern-room-connections-workspace pattern-room-connections-canvas-only"
  );

  const workSurface = createElement("section", "pattern-room-desk-surface");
  workSurface.ariaLabel = text("connections.title");
  const surfaceHeader = createElement("header", "pattern-room-desk-header");
  surfaceHeader.append(
    createElement("span", "pattern-room-kicker", text("connections.kicker")),
    createElement("h2", undefined, data.subject),
    createElement("p", undefined, text("connections.intro"))
  );

  const connectionMap = createElement("div", "pattern-room-connection-map");
  connectionMap.dataset["patternConnectionMap"] = "true";
  const claimObjects = createElement("div", "pattern-room-claim-objects");
  data.claims.forEach((claim, index) => {
    const eyebrow = claim.stance === "primary" ? "Ana iz" : "Karşı iz";
    const claimCard = createElement("article", "pattern-room-claim-object " + claim.stance);
    claimCard.dataset["patternConnectionClaim"] = claim.id;
    claimCard.append(
      createElement("span", "pattern-room-list-eyebrow", eyebrow),
      createElement("span", "pattern-room-connection-node-index", String(index + 1)),
      createElement("h3", undefined, claim.label),
      createElement("p", undefined, claim.summary),
      createElement("small", undefined, "Yerel masa nesnesi")
    );
    claimObjects.append(claimCard);
  });
  const relationship = createElement("div", "pattern-room-connection-axis");
  relationship.ariaHidden = "true";
  connectionMap.append(claimObjects, relationship);
  workSurface.append(surfaceHeader, connectionMap);
  layout.append(workSurface);
  shell.append(layout);
  return shell;
}
