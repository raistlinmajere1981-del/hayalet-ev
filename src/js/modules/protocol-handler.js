// @ts-nocheck
import { AppState } from "./app-state.js";

function buildProtocolPayload({
  room = "",
  scenario = "",
  targets = [],
  context = {},
}) {
  const connected = (targets || []).filter((t) => AppState.getConnection(t));

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
