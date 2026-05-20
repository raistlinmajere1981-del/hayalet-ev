import type { PatternRoomMockData } from "../../shared/types/pattern-room.js";
import { createElement, createPanelShell } from "./pattern-panel-utils.js";

export function createDeskPanel(data: PatternRoomMockData, onBack: () => void): HTMLElement {
  const shell = createPanelShell("desk", "Araştırma Masası", onBack);
  const layout = createElement("div", "pattern-room-desk-layout");

  const workSurface = createElement("div", "pattern-room-desk-surface");
  const surfaceHeader = createElement("header", "pattern-room-desk-header");
  surfaceHeader.append(
    createElement("span", "pattern-room-kicker", "Holografik masa"),
    createElement("h2", undefined, data.subject),
    createElement(
      "p",
      undefined,
      "İddia kartları yerel mock veriyle masa üstünde yan yana tutuluyor."
    )
  );
  const claimObjects = createElement("div", "pattern-room-claim-objects");
  data.claims.forEach((claim) => {
    const eyebrow = claim.stance === "primary" ? "Ana iz" : "Karşı iz";
    const claimCard = createElement("article", `pattern-room-claim-object ${claim.stance}`);
    claimCard.append(
      createElement("span", "pattern-room-list-eyebrow", eyebrow),
      createElement("h3", undefined, claim.label),
      createElement("p", undefined, claim.summary),
      createElement("small", undefined, "Yerel masa nesnesi")
    );
    claimObjects.append(claimCard);
  });
  workSurface.append(surfaceHeader, claimObjects);

  const lightbox = createElement("aside", "pattern-room-lightbox");
  const outputFrame = createElement("div", "pattern-room-lightbox-frame");
  outputFrame.append(
    createElement("span", "pattern-room-lightbox-label", "Dummy masa çıktısı"),
    createElement("strong", undefined, data.subject)
  );
  lightbox.append(
    createElement("span", "pattern-room-kicker", "Masa çıktısı"),
    outputFrame,
    createElement(
      "p",
      undefined,
      "İddialar yalnızca yerel mock veriyle yan yana tutuluyor; dış sağlayıcı veya kayıt sistemi yok."
    )
  );

  layout.append(workSurface, lightbox);
  shell.append(layout);
  return shell;
}
