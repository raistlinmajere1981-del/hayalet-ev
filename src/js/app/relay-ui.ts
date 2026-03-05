/**
 * Relay UI
 *
 * Top bar'daki relay butonları, relay göstergeleri ve
 * flow line animasyonlarını yönetir.
 */

import { getErrorMessage } from "@shared/index.js";
import { Logger, LogCategory } from "../modules/logger/index.js";
import { SettingsManager } from "../modules/settings-manager.js";
import { SlotController } from "../modules/slot-controller.js";
import { RelayManager } from "../modules/relay-manager.js";
import { TrafficManager } from "../modules/traffic-manager.js";
import { CoreEngine } from "../modules/core-engine.js";

/**
 * Relay göstergesini güncelle - Flow line animasyonları
 * AI-AI: Alt çizgi sarı/turuncu, AI1-Asistan: Sol çizgi yeşil, AI2-Asistan: Sağ çizgi mavi
 * Akış yönü düşünen AI'dan diğerine doğru olacak
 */
export function updateRelayIndicator(): void {
  const flowAi1Ai0 = document.getElementById("relay-flow-ai1-ai0");
  const flowAi0Ai2 = document.getElementById("relay-flow-ai0-ai2");
  const flowAi1Ai2 = document.getElementById("relay-flow-ai1-ai2");

  if (!flowAi1Ai0 || !flowAi0Ai2 || !flowAi1Ai2) return;

  flowAi1Ai0.classList.remove("is-active", "flow-rtl");
  flowAi0Ai2.classList.remove("is-active", "flow-rtl");
  flowAi1Ai2.classList.remove("is-active", "flow-rtl");

  const isAIAIActive = RelayManager.isAIAIActive();
  const isAIAsistanActive = RelayManager.isAIAsistanActive();
  const asistanSourceSlot = RelayManager.getAIAsistanSourceSlot();

  const getThinking = (slot: string): boolean =>
    TrafficManager.state[slot]?.status.thinking === "busy";

  if (isAIAIActive) {
    flowAi1Ai2.classList.add("is-active");
    if (getThinking("ai2")) {
      flowAi1Ai2.classList.add("flow-rtl");
      flowAi1Ai2.title = "AI2 → AI1 Relay Aktif";
    } else {
      flowAi1Ai2.title = "AI1 → AI2 Relay Aktif";
    }
  } else if (isAIAsistanActive && asistanSourceSlot === "ai1") {
    flowAi1Ai0.classList.add("is-active");
    if (getThinking("ai0")) {
      flowAi1Ai0.classList.add("flow-rtl");
      flowAi1Ai0.title = "Asistan → AI1 Relay Aktif";
    } else {
      flowAi1Ai0.title = "AI1 → Asistan Relay Aktif";
    }
  } else if (isAIAsistanActive && asistanSourceSlot === "ai2") {
    flowAi0Ai2.classList.add("is-active");
    if (getThinking("ai2")) {
      flowAi0Ai2.classList.add("flow-rtl");
      flowAi0Ai2.title = "AI2 → Asistan Relay Aktif";
    } else {
      flowAi0Ai2.title = "Asistan → AI2 Relay Aktif";
    }
  } else {
    flowAi1Ai0.title = "";
    flowAi0Ai2.title = "";
    flowAi1Ai2.title = "";
  }
}

async function persistLastActiveRelay(relayName: string): Promise<void> {
  try {
    await SettingsManager.set("assistants.lastActiveRelay", relayName);
  } catch (err) {
    Logger.warn(LogCategory.RELAY, `Son aktif relay ayari kaydedilemedi: ${getErrorMessage(err)}`);
  }
}

export function setupTopBarRelayButtons(): void {
  try {
    Logger.info(LogCategory.RELAY, "Setting up topbar relay buttons");

    const btnAi1Ai0 = document.getElementById("relay-btn-ai1-ai0") as HTMLButtonElement | null;
    Logger.debug(
      LogCategory.RELAY,
      `AI1→Asistan button found: ${String(!!btnAi1Ai0)}, disabled: ${String(btnAi1Ai0?.disabled ?? false)}`
    );
    if (btnAi1Ai0) {
      btnAi1Ai0.addEventListener("click", (): void => {
        void (async (): Promise<void> => {
          Logger.info(LogCategory.RELAY, "AI1→Asistan button clicked");
          try {
            if (
              RelayManager.isAIAsistanActive() &&
              RelayManager.getAIAsistanSourceSlot() === "ai1"
            ) {
              await CoreEngine.sendProtocol({
                room: "analyze",
                scenario: "ai-asistan-stop",
                targets: ["ai1"],
              });
              Logger.info(LogCategory.RELAY, "AI1 ↔ Asistan relay durduruldu (topbar)");
            } else {
              if (SlotController.isConnected("ai1") !== true) {
                Logger.warn(LogCategory.RELAY, "AI1 bağlı değil, relay başlatılamadı");
                return;
              }
              if (SlotController.isConnected("ai0") !== true) {
                Logger.warn(LogCategory.RELAY, "Asistan bağlı değil, relay başlatılamadı");
                return;
              }
              await RelayManager.startAIAsistanSession("ai1");
              Logger.info(LogCategory.RELAY, "AI1 ↔ Asistan relay başlatıldı (topbar)");
              await persistLastActiveRelay("AI1 - Asistan");
            }
            updateRelayButtonStates();
            updateRelayIndicator();
          } catch (err) {
            Logger.error(LogCategory.RELAY, `AI1-Asistan relay hatası: ${getErrorMessage(err)}`);
          }
        })();
      });
    }

    const btnAi0Ai2 = document.getElementById("relay-btn-ai0-ai2") as HTMLButtonElement | null;
    if (btnAi0Ai2) {
      btnAi0Ai2.addEventListener("click", (): void => {
        void (async (): Promise<void> => {
          try {
            if (
              RelayManager.isAIAsistanActive() &&
              RelayManager.getAIAsistanSourceSlot() === "ai2"
            ) {
              await CoreEngine.sendProtocol({
                room: "analyze",
                scenario: "ai-asistan-stop",
                targets: ["ai2"],
              });
              Logger.info(LogCategory.RELAY, "AI2 ↔ Asistan relay durduruldu (topbar)");
            } else {
              if (SlotController.isConnected("ai2") !== true) {
                Logger.warn(LogCategory.RELAY, "AI2 bağlı değil, relay başlatılamadı");
                return;
              }
              if (SlotController.isConnected("ai0") !== true) {
                Logger.warn(LogCategory.RELAY, "Asistan bağlı değil, relay başlatılamadı");
                return;
              }
              await RelayManager.startAIAsistanSession("ai2");
              Logger.info(LogCategory.RELAY, "AI2 ↔ Asistan relay başlatıldı (topbar)");
              await persistLastActiveRelay("Asistan - AI2");
            }
            updateRelayButtonStates();
            updateRelayIndicator();
          } catch (err) {
            Logger.error(LogCategory.RELAY, `AI2-Asistan relay hatası: ${getErrorMessage(err)}`);
          }
        })();
      });
    }

    const btnAi1Ai2Left = document.getElementById(
      "relay-btn-ai1-ai2-left"
    ) as HTMLButtonElement | null;
    Logger.debug(
      LogCategory.RELAY,
      `AI1→AI2 button found: ${String(!!btnAi1Ai2Left)}, disabled: ${String(btnAi1Ai2Left?.disabled ?? false)}`
    );
    if (btnAi1Ai2Left) {
      btnAi1Ai2Left.addEventListener("click", (): void => {
        void (async (): Promise<void> => {
          Logger.info(LogCategory.RELAY, "AI1→AI2 button clicked");
          try {
            if (RelayManager.isAIAIActive()) {
              await CoreEngine.sendProtocol({
                room: "analyze",
                scenario: "ai-ai-stop",
                targets: ["ai1", "ai2"],
              });
              Logger.info(LogCategory.RELAY, "AI1 ↔ AI2 relay durduruldu (topbar)");
            } else {
              if (
                SlotController.isConnected("ai1") !== true ||
                SlotController.isConnected("ai2") !== true
              ) {
                Logger.warn(LogCategory.RELAY, "AI1 veya AI2 bağlı değil, relay başlatılamadı");
                return;
              }
              await CoreEngine.sendProtocol({
                room: "analyze",
                scenario: "ai-ai",
                targets: ["ai1", "ai2"],
                mode: "aiRelaySequential",
                context: { starter: "ai1" },
              });
              Logger.info(LogCategory.RELAY, "AI1 → AI2 relay başlatıldı (topbar)");
            }
            updateRelayButtonStates();
            updateRelayIndicator();
          } catch (err) {
            Logger.error(LogCategory.RELAY, `AI1-AI2 relay hatası: ${getErrorMessage(err)}`);
          }
        })();
      });
    }

    const btnAi1Ai2Right = document.getElementById(
      "relay-btn-ai1-ai2-right"
    ) as HTMLButtonElement | null;
    if (btnAi1Ai2Right) {
      btnAi1Ai2Right.addEventListener("click", (): void => {
        void (async (): Promise<void> => {
          try {
            if (RelayManager.isAIAIActive()) {
              await CoreEngine.sendProtocol({
                room: "analyze",
                scenario: "ai-ai-stop",
                targets: ["ai1", "ai2"],
              });
              Logger.info(LogCategory.RELAY, "AI2 ↔ AI1 relay durduruldu (topbar)");
            } else {
              if (
                SlotController.isConnected("ai1") !== true ||
                SlotController.isConnected("ai2") !== true
              ) {
                Logger.warn(LogCategory.RELAY, "AI1 veya AI2 bağlı değil, relay başlatılamadı");
                return;
              }
              await CoreEngine.sendProtocol({
                room: "analyze",
                scenario: "ai-ai",
                targets: ["ai1", "ai2"],
                mode: "aiRelaySequential",
                context: { starter: "ai2" },
              });
              Logger.info(LogCategory.RELAY, "AI2 → AI1 relay başlatıldı (topbar)");
            }
            updateRelayButtonStates();
            updateRelayIndicator();
          } catch (err) {
            Logger.error(LogCategory.RELAY, `AI2-AI1 relay hatası: ${getErrorMessage(err)}`);
          }
        })();
      });
    }

    updateRelayButtonStates();

    window.addEventListener("slot-state-changed", () => {
      updateRelayButtonStates();
    });

    window.addEventListener("relay-changed", () => {
      updateRelayButtonStates();
      updateRelayIndicator();
    });

    TrafficManager.onUpdate(() => {
      if (RelayManager.isAIAIActive() || RelayManager.isAIAsistanActive()) {
        updateRelayIndicator();
      }
    });
  } catch (error) {
    Logger.debug(LogCategory.SYSTEM, `Relay button setup error: ${getErrorMessage(error)}`, {
      error: error instanceof Error ? error : new Error(String(error)),
    });
  }
}

export function updateRelayButtonStates(): void {
  try {
    const btnAi1Ai0 = document.getElementById("relay-btn-ai1-ai0") as HTMLButtonElement | null;
    const btnAi0Ai2 = document.getElementById("relay-btn-ai0-ai2") as HTMLButtonElement | null;
    const btnAi1Ai2Left = document.getElementById(
      "relay-btn-ai1-ai2-left"
    ) as HTMLButtonElement | null;
    const btnAi1Ai2Right = document.getElementById(
      "relay-btn-ai1-ai2-right"
    ) as HTMLButtonElement | null;

    const ai1Connected = SlotController.isConnected("ai1") === true;
    const ai2Connected = SlotController.isConnected("ai2") === true;
    const ai0Connected = SlotController.isConnected("ai0") === true;

    Logger.debug(
      LogCategory.RELAY,
      `Button states - ai1:${String(ai1Connected)}, ai2:${String(ai2Connected)}, ai0:${String(ai0Connected)}`
    );

    const isAIAIActive = RelayManager.isAIAIActive() === true;
    const isAIAsistanActive = RelayManager.isAIAsistanActive() === true;
    const asistanSourceSlot = RelayManager.getAIAsistanSourceSlot();
    const anyRelayActive = isAIAIActive || isAIAsistanActive;

    if (btnAi1Ai0) {
      const isThisActive = isAIAsistanActive && asistanSourceSlot === "ai1";
      const canEnable = ai1Connected && ai0Connected && (!anyRelayActive || isThisActive);
      btnAi1Ai0.disabled = !canEnable;
      btnAi1Ai0.classList.toggle("is-active", isThisActive);
    }

    if (btnAi0Ai2) {
      const isThisActive = isAIAsistanActive && asistanSourceSlot === "ai2";
      const canEnable = ai2Connected && ai0Connected && (!anyRelayActive || isThisActive);
      btnAi0Ai2.disabled = !canEnable;
      btnAi0Ai2.classList.toggle("is-active", isThisActive);
    }

    if (btnAi1Ai2Left) {
      const isThisActive = isAIAIActive;
      const canEnable = ai1Connected && ai2Connected && (!anyRelayActive || isThisActive);
      btnAi1Ai2Left.disabled = !canEnable;
      btnAi1Ai2Left.classList.toggle("is-active", isThisActive);
    }

    if (btnAi1Ai2Right) {
      const isThisActive = isAIAIActive;
      const canEnable = ai1Connected && ai2Connected && (!anyRelayActive || isThisActive);
      btnAi1Ai2Right.disabled = !canEnable;
      btnAi1Ai2Right.classList.toggle("is-active", isThisActive);
    }
  } catch (error) {
    Logger.debug(LogCategory.SYSTEM, `Relay button state update error: ${getErrorMessage(error)}`, {
      error: error instanceof Error ? error : new Error(String(error)),
    });
  }
}
