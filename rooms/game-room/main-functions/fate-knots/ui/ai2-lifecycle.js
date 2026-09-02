/* global window, document, Element */

(function (global) {
  const base = global.GameRoomFateKnotsUi;
  if (!base || typeof base.handleCommandResult !== "function") return;

  let setupUniverseId = null;
  const baseHandleCommandResult = base.handleCommandResult;

  function readRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  }

  function readString(value) {
    return typeof value === "string" ? value : "";
  }

  function sendSetupCommand(commandName, universeId) {
    const roomApi = global.roomAPI;
    if (!roomApi || typeof roomApi.sendCommand !== "function" || !universeId) return;
    roomApi.sendCommand(commandName, { universeId: universeId });
  }

  base.handleCommandResult = function handleAi2LifecycleCommandResult(message) {
    const record = readRecord(message);
    const command = record ? readString(record.command) : "";
    const result = record ? readRecord(record.result) : null;

    if (command === "GameRoomFateKnotsGetRunSetup" && result?.ok === true) {
      const setup = readRecord(result.setup);
      setupUniverseId = setup ? readString(setup.universeId) || null : null;
    } else if (command === "GameRoomFateKnotsCreateRun" && result?.ok === true) {
      setupUniverseId = null;
    }

    return baseHandleCommandResult(message);
  };

  document.addEventListener("click", function (event) {
    const target = event.target;
    if (!(target instanceof Element) || !setupUniverseId) return;
    const button = target.closest("button.fate-knots-hub__button");
    if (!button) return;
    const label = button.textContent?.trim();

    if (label === "Kapat" && button.closest(".fate-knots-hub__setup")) {
      sendSetupCommand("GameRoomFateKnotsCancelAi2RunCharacter", setupUniverseId);
      setupUniverseId = null;
      return;
    }

    if (label !== "Kat" && label !== "Çıkar") return;
    const seat = button.closest(".fate-knots-hub__seat");
    const title = seat?.querySelector(".fate-knots-hub__seat-title")?.textContent?.trim();
    if (title !== "AI2") return;

    sendSetupCommand(
      label === "Kat"
        ? "GameRoomFateKnotsRequestAi2RunCharacter"
        : "GameRoomFateKnotsCancelAi2RunCharacter",
      setupUniverseId
    );
  });
})(window);
