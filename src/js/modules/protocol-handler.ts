import { SlotController, SlotState } from "./slot-controller.js";
import { LogCategory } from "@shared/logging-core";
import { Logger } from "./logger/index.js";
import { START_STOP_PROTOCOL_HEADERS } from "./protocol-default-headers.js";

function isSlotReady(slot: string): boolean {
  const state = SlotController.getState(slot);
  if (state === null) return false;

  if (state.state !== SlotState.CONNECTED) {
    return false;
  }

  if (state.urlExcluded === true) {
    Logger.debug(LogCategory.SYSTEM, `Slot ${slot} URL excluded, skipping protocol`, {
      category: "protocol",
    });
    return false;
  }

  return true;
}

type ProtocolPayload = {
  message: string;
  protocolKey?: string;
  targets: string[];
};

function buildProtocolPayload({
  room = "",
  scenario = "",
  targets = [] as string[],
  context = {} as { starter?: string },
}): ProtocolPayload | null {
  const connected = targets.filter((t) => isSlotReady(t));

  if (room === "analyze") {
    if (scenario === "user-ai-ai") {
      return {
        message: START_STOP_PROTOCOL_HEADERS.ANALYZE_USER_AI_AI_START,
        protocolKey: "analyze-user-AI-AI",
        targets: /** @type {any[]} */ connected,
      };
    }
    if (scenario === "user-ai-ai-stop") {
      return {
        message: START_STOP_PROTOCOL_HEADERS.ANALYZE_USER_AI_AI_STOP,
        targets: /** @type {any[]} */ connected,
      };
    }

    if (scenario === "ai-ai") {
      const starter = context.starter === "ai2" ? "ai2" : "ai1";
      const protocolKey = starter === "ai2" ? "analyze-AI2-AI1" : "analyze-AI1-AI2";

      return {
        message: START_STOP_PROTOCOL_HEADERS.ANALYZE_AI_AI_START,
        protocolKey,
        targets: /** @type {any[]} */ connected,
      };
    }

    if (scenario === "ai-ai-stop") {
      return {
        message: START_STOP_PROTOCOL_HEADERS.ANALYZE_AI_AI_STOP,
        targets: /** @type {any[]} */ connected,
      };
    }

    if (scenario === "ai-asistan-stop") {
      return {
        message: START_STOP_PROTOCOL_HEADERS.ANALYZE_AI_ASISTAN_STOP,
        targets: /** @type {any[]} */ connected,
      };
    }
  }

  if (room === "server" && scenario === "takecontrol") {
    return {
      message: "Kontrol Devredildi",
      protocolKey: "takecontrol",
      targets: /** @type {any[]} */ connected,
    };
  }
  return null;
}

const protocolHandler = {
  buildPayload: buildProtocolPayload,
};

export { protocolHandler, protocolHandler as ProtocolHandler };
