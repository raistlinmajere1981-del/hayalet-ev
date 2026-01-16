import { SlotController, SlotState } from "./slot-controller.js";
import { LogManager } from "./log-manager.js";

/**
 * Check if slot is ready for protocol communication
 * - Must be CONNECTED (not CONNECTING, DISCONNECTING, or ERROR)
 * @param {string} slot 
 * @returns {boolean}
 */
function isSlotReady(slot) {
  const state = SlotController.getState(slot);
  if (!state) return false;
  
  if (state.state !== SlotState.CONNECTED) {
    LogManager.addEvent(
      "protocol",
      "debug",
      `Slot ${slot} not ready for protocol: state=${state.state}`
    );
    return false;
  }
  
  if (state.urlExcluded) {
    LogManager.addEvent(
      "protocol",
      "debug",
      `Slot ${slot} URL excluded, skipping protocol`
    );
    return false;
  }
  
  return true;
}

function buildProtocolPayload({
  room = "",
  scenario = "",
  targets = [],
  context = {},
}) {
  const connected = (targets || []).filter((t) => isSlotReady(t));

  if (room === "analyze") {
    if (scenario === "user-ai-ai") {
      return {
        message: "Kullanıcı - AI - AI Analiz Sohbeti Başladı",
        protocolPath: "protocol/analyze-user-AI-AI.txt",
        targets: /** @type {any[]} */ (connected),
      };
    }
    if (scenario === "user-ai-ai-stop") {
      return {
        message: "Kullanıcı - AI - AI Analiz Sohbeti Durduruldu",
        targets: /** @type {any[]} */ (connected),
      };
    }

    if (scenario === "ai-ai") {
      const starter = context.starter === "ai2" ? "ai2" : "ai1";
      const protocolFile =
        starter === "ai2"
          ? "protocol/analyze-AI2-AI1.txt"
          : "protocol/analyze-AI1-AI2.txt";

      return {
        message: "AI-AI Analiz Sohbeti Başladı",
        protocolPath: protocolFile,
        targets: /** @type {any[]} */ (connected),
      };
    }

    if (scenario === "ai-ai-stop") {
      return {
        message: "AI-AI Analiz Sohbeti Durduruldu",
        targets: /** @type {any[]} */ (connected),
      };
    }
  }

  if (room === "server" && scenario === "takecontrol") {
    return {
      message: "Kontrol Devredildi",
      protocolPath: "protocol/takecontrol.txt",
      targets: /** @type {any[]} */ (connected),
    };
  }

  return null;
}

export const ProtocolHandler = {
  buildPayload: buildProtocolPayload,
};
