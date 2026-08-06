import type {
  PatternPanelActions,
  PatternRoomWorkspaceModel,
} from "../../shared/types/pattern-room.js";
import {
  createPatternWorkspaceTranslator,
  type PatternWorkspaceTranslator,
} from "../pattern-room-workspace-i18n.js";
import { createElement, createEmptyState, createPanelShell } from "./pattern-panel-utils.js";

export function createDeskPanel(
  data: PatternRoomWorkspaceModel,
  actions: PatternPanelActions,
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
  if (data.claims.length === 0) {
    claimObjects.append(
      createEmptyState("Grafikte gösterilecek iddia veya karşı iz yok.", "data-empty")
    );
  }
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
  const relationship = createElement("section", "pattern-room-connection-list");
  relationship.dataset["patternConnectionList"] = "true";
  const connectionButtons: HTMLButtonElement[] = [];
  const updateSelectedConnection = (connectionId: string | null): void => {
    connectionButtons.forEach((button) => {
      const isSelected = button.dataset["patternConnectionEdge"] === connectionId;
      button.ariaPressed = isSelected ? "true" : "false";
      if (isSelected) {
        button.classList.add("active");
      } else {
        button.classList.remove("active");
      }
    });
  };

  if (data.connections.length === 0) {
    relationship.append(
      createEmptyState(
        "Henüz seçilebilir bir bağlantı yok. Sağ panelden yeni bağlantı kurabilirsiniz.",
        "data-empty",
        { className: "pattern-room-connection-empty" }
      )
    );
  } else {
    data.connections.forEach((connection, index) => {
      const button = createElement("button", "pattern-room-connection-card " + connection.scope);
      button.type = "button";
      button.dataset["patternConnectionEdge"] = connection.id;
      button.ariaPressed = "false";
      button.append(
        createElement("span", "pattern-room-connection-node-index", String(index + 1)),
        createElement("strong", undefined, connection.sourceLabel),
        createElement("span", "pattern-room-connection-edge-label", connection.edgeTypeLabel),
        createElement("strong", undefined, connection.targetLabel),
        createElement(
          "small",
          undefined,
          connection.scope === "local" ? "Yerel bağlantı" : "Domain bağlantısı"
        )
      );
      button.addEventListener("click", () => {
        actions.selectConnection(connection.id);
        updateSelectedConnection(connection.id);
      });
      connectionButtons.push(button);
      relationship.append(button);
    });
  }
  updateSelectedConnection(actions.getSelectedConnectionId());
  connectionMap.append(claimObjects, relationship);
  workSurface.append(surfaceHeader, connectionMap);
  layout.append(workSurface);
  shell.append(layout);
  return shell;
}
