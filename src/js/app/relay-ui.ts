/**
 * Relay UI
 *
 * Manages top bar relay buttons, relay indicators,
 * and flow line animations.
 */

import { getErrorMessage } from "@shared/index.js";
import { Logger, LogCategory } from "../modules/logger/index.js";
import { AppI18n } from "../modules/i18n/index.js";
import { SettingsManager } from "../modules/settings-manager.js";
import { SlotController } from "../modules/slot-controller.js";
import { RelayManager } from "../modules/relay-manager.js";
import { TrafficManager } from "../modules/traffic-manager.js";
import { CoreEngine } from "../modules/core-engine.js";
import { shellT } from "./shell-i18n.js";

type RelayRoute = "ai1Assistant" | "assistantAi2" | "ai1Ai2" | "ai2Ai1";

let relayI18nBound = false;

function getRelayLabel(route: RelayRoute): string {
  switch (route) {
    case "ai1Assistant":
      return shellT("relay.label.ai1Assistant");
    case "assistantAi2":
      return shellT("relay.label.assistantAi2");
    case "ai1Ai2":
      return shellT("relay.label.ai1Ai2");
    case "ai2Ai1":
      return shellT("relay.label.ai2Ai1");
  }
}

function getSlotLabel(slot: "ai0" | "ai1" | "ai2"): string {
  switch (slot) {
    case "ai0":
      return shellT("relay.participants.assistant");
    case "ai1":
      return shellT("relay.participants.ai1");
    case "ai2":
      return shellT("relay.participants.ai2");
  }
}

function applyDefaultRelayTitles(): void {
  const flowAi1Ai0 = document.getElementById("relay-flow-ai1-ai0");
  const flowAi0Ai2 = document.getElementById("relay-flow-ai0-ai2");
  const flowAi1Ai2 = document.getElementById("relay-flow-ai1-ai2");

  if (flowAi1Ai0 !== null) {
    flowAi1Ai0.title = shellT("relay.flow.ai1Assistant");
  }
  if (flowAi0Ai2 !== null) {
    flowAi0Ai2.title = shellT("relay.flow.assistantAi2");
  }
  if (flowAi1Ai2 !== null) {
    flowAi1Ai2.title = shellT("relay.flow.ai1Ai2");
  }
}

function bindRelayI18n(): void {
  if (relayI18nBound) {
    return;
  }

  AppI18n.subscribe(() => {
    applyDefaultRelayTitles();
    updateRelayIndicator();
    updateRelayButtonStates();
  });
  relayI18nBound = true;
}

/**
 * Updates the relay indicator flow line animations.
 * AI-AI uses the bottom line, AI1-Assistant uses the left line,
 * and Assistant-AI2 uses the right line.
 */
export function updateRelayIndicator(): void {
  const flowAi1Ai0 = document.getElementById("relay-flow-ai1-ai0");
  const flowAi0Ai2 = document.getElementById("relay-flow-ai0-ai2");
  const flowAi1Ai2 = document.getElementById("relay-flow-ai1-ai2");

  if (!flowAi1Ai0 || !flowAi0Ai2 || !flowAi1Ai2) return;

  flowAi1Ai0.classList.remove("is-active", "flow-rtl");
  flowAi0Ai2.classList.remove("is-active", "flow-rtl");
  flowAi1Ai2.classList.remove("is-active", "flow-rtl");
  applyDefaultRelayTitles();

  const isAIAIActive = RelayManager.isAIAIActive();
  const isAssistantRelayActive = RelayManager.isAIAssistantActive();
  const assistantSourceSlot = RelayManager.getAIAssistantSourceSlot();

  const getThinking = (slot: string): boolean =>
    TrafficManager.state[slot]?.status.thinking === "busy";

  if (isAIAIActive) {
    flowAi1Ai2.classList.add("is-active");
    if (getThinking("ai2")) {
      flowAi1Ai2.classList.add("flow-rtl");
      flowAi1Ai2.title = shellT("relay.active.ai2ToAi1");
    } else {
      flowAi1Ai2.title = shellT("relay.active.ai1ToAi2");
    }
  } else if (isAssistantRelayActive && assistantSourceSlot === "ai1") {
    flowAi1Ai0.classList.add("is-active");
    if (getThinking("ai0")) {
      flowAi1Ai0.classList.add("flow-rtl");
      flowAi1Ai0.title = shellT("relay.active.assistantToAi1");
    } else {
      flowAi1Ai0.title = shellT("relay.active.ai1ToAssistant");
    }
  } else if (isAssistantRelayActive && assistantSourceSlot === "ai2") {
    flowAi0Ai2.classList.add("is-active");
    if (getThinking("ai2")) {
      flowAi0Ai2.classList.add("flow-rtl");
      flowAi0Ai2.title = shellT("relay.active.ai2ToAssistant");
    } else {
      flowAi0Ai2.title = shellT("relay.active.assistantToAi2");
    }
  }
}

async function persistLastActiveRelay(relayName: string): Promise<void> {
  try {
    await SettingsManager.set("assistants.lastActiveRelay", relayName);
  } catch (err) {
    Logger.warn(
      LogCategory.RELAY,
      shellT("logs.relayLastActiveSaveFailed", { message: getErrorMessage(err) })
    );
  }
}

export function setupTopBarRelayButtons(): void {
  try {
    bindRelayI18n();
    Logger.info(LogCategory.RELAY, shellT("logs.relaySetupStarted"));

    const btnAi1Ai0 = document.getElementById("relay-btn-ai1-ai0") as HTMLButtonElement | null;
    Logger.debug(
      LogCategory.RELAY,
      shellT("logs.relayButtonFound", {
        relay: getRelayLabel("ai1Assistant"),
        found: String(!!btnAi1Ai0),
        disabled: String(btnAi1Ai0?.disabled ?? false),
      })
    );
    if (btnAi1Ai0) {
      btnAi1Ai0.addEventListener("click", (): void => {
        void (async (): Promise<void> => {
          Logger.info(
            LogCategory.RELAY,
            shellT("logs.relayButtonClicked", { relay: getRelayLabel("ai1Assistant") })
          );
          try {
            if (
              RelayManager.isAIAssistantActive() &&
              RelayManager.getAIAssistantSourceSlot() === "ai1"
            ) {
              await CoreEngine.sendProtocol({
                room: "analyze",
                scenario: "ai-assistant-stop",
                targets: ["ai1"],
              });
              Logger.info(
                LogCategory.RELAY,
                shellT("logs.relayStopped", { relay: getRelayLabel("ai1Assistant") })
              );
            } else {
              if (SlotController.isConnected("ai1") !== true) {
                Logger.warn(
                  LogCategory.RELAY,
                  shellT("logs.relayStartBlocked", { slot: getSlotLabel("ai1") })
                );
                return;
              }
              if (SlotController.isConnected("ai0") !== true) {
                Logger.warn(
                  LogCategory.RELAY,
                  shellT("logs.relayStartBlocked", { slot: getSlotLabel("ai0") })
                );
                return;
              }
              await RelayManager.startAIAssistantSession("ai1");
              Logger.info(
                LogCategory.RELAY,
                shellT("logs.relayStarted", { relay: getRelayLabel("ai1Assistant") })
              );
              await persistLastActiveRelay("ai1-assistant");
            }
            updateRelayButtonStates();
            updateRelayIndicator();
          } catch (err) {
            Logger.error(
              LogCategory.RELAY,
              shellT("logs.relayError", {
                relay: getRelayLabel("ai1Assistant"),
                message: getErrorMessage(err),
              })
            );
          }
        })();
      });
    }

    const btnAi0Ai2 = document.getElementById("relay-btn-ai0-ai2") as HTMLButtonElement | null;
    Logger.debug(
      LogCategory.RELAY,
      shellT("logs.relayButtonFound", {
        relay: getRelayLabel("assistantAi2"),
        found: String(!!btnAi0Ai2),
        disabled: String(btnAi0Ai2?.disabled ?? false),
      })
    );
    if (btnAi0Ai2) {
      btnAi0Ai2.addEventListener("click", (): void => {
        void (async (): Promise<void> => {
          Logger.info(
            LogCategory.RELAY,
            shellT("logs.relayButtonClicked", { relay: getRelayLabel("assistantAi2") })
          );
          try {
            if (
              RelayManager.isAIAssistantActive() &&
              RelayManager.getAIAssistantSourceSlot() === "ai2"
            ) {
              await CoreEngine.sendProtocol({
                room: "analyze",
                scenario: "ai-assistant-stop",
                targets: ["ai2"],
              });
              Logger.info(
                LogCategory.RELAY,
                shellT("logs.relayStopped", { relay: getRelayLabel("assistantAi2") })
              );
            } else {
              if (SlotController.isConnected("ai2") !== true) {
                Logger.warn(
                  LogCategory.RELAY,
                  shellT("logs.relayStartBlocked", { slot: getSlotLabel("ai2") })
                );
                return;
              }
              if (SlotController.isConnected("ai0") !== true) {
                Logger.warn(
                  LogCategory.RELAY,
                  shellT("logs.relayStartBlocked", { slot: getSlotLabel("ai0") })
                );
                return;
              }
              await RelayManager.startAIAssistantSession("ai2");
              Logger.info(
                LogCategory.RELAY,
                shellT("logs.relayStarted", { relay: getRelayLabel("assistantAi2") })
              );
              await persistLastActiveRelay("assistant-ai2");
            }
            updateRelayButtonStates();
            updateRelayIndicator();
          } catch (err) {
            Logger.error(
              LogCategory.RELAY,
              shellT("logs.relayError", {
                relay: getRelayLabel("assistantAi2"),
                message: getErrorMessage(err),
              })
            );
          }
        })();
      });
    }

    const btnAi1Ai2Left = document.getElementById(
      "relay-btn-ai1-ai2-left"
    ) as HTMLButtonElement | null;
    Logger.debug(
      LogCategory.RELAY,
      shellT("logs.relayButtonFound", {
        relay: getRelayLabel("ai1Ai2"),
        found: String(!!btnAi1Ai2Left),
        disabled: String(btnAi1Ai2Left?.disabled ?? false),
      })
    );
    if (btnAi1Ai2Left) {
      btnAi1Ai2Left.addEventListener("click", (): void => {
        void (async (): Promise<void> => {
          Logger.info(
            LogCategory.RELAY,
            shellT("logs.relayButtonClicked", { relay: getRelayLabel("ai1Ai2") })
          );
          try {
            if (RelayManager.isAIAIActive()) {
              await CoreEngine.sendProtocol({
                room: "analyze",
                scenario: "ai-ai-stop",
                targets: ["ai1", "ai2"],
              });
              Logger.info(
                LogCategory.RELAY,
                shellT("logs.relayStopped", { relay: getRelayLabel("ai1Ai2") })
              );
            } else {
              if (
                SlotController.isConnected("ai1") !== true ||
                SlotController.isConnected("ai2") !== true
              ) {
                Logger.warn(
                  LogCategory.RELAY,
                  shellT("logs.relayStartBlockedMultiple", {
                    slots: `${getSlotLabel("ai1")} / ${getSlotLabel("ai2")}`,
                  })
                );
                return;
              }
              await CoreEngine.sendProtocol({
                room: "analyze",
                scenario: "ai-ai",
                targets: ["ai1", "ai2"],
                mode: "aiRelaySequential",
                context: { starter: "ai1" },
              });
              Logger.info(
                LogCategory.RELAY,
                shellT("logs.relayStarted", { relay: getRelayLabel("ai1Ai2") })
              );
            }
            updateRelayButtonStates();
            updateRelayIndicator();
          } catch (err) {
            Logger.error(
              LogCategory.RELAY,
              shellT("logs.relayError", {
                relay: getRelayLabel("ai1Ai2"),
                message: getErrorMessage(err),
              })
            );
          }
        })();
      });
    }

    const btnAi1Ai2Right = document.getElementById(
      "relay-btn-ai1-ai2-right"
    ) as HTMLButtonElement | null;
    Logger.debug(
      LogCategory.RELAY,
      shellT("logs.relayButtonFound", {
        relay: getRelayLabel("ai2Ai1"),
        found: String(!!btnAi1Ai2Right),
        disabled: String(btnAi1Ai2Right?.disabled ?? false),
      })
    );
    if (btnAi1Ai2Right) {
      btnAi1Ai2Right.addEventListener("click", (): void => {
        void (async (): Promise<void> => {
          Logger.info(
            LogCategory.RELAY,
            shellT("logs.relayButtonClicked", { relay: getRelayLabel("ai2Ai1") })
          );
          try {
            if (RelayManager.isAIAIActive()) {
              await CoreEngine.sendProtocol({
                room: "analyze",
                scenario: "ai-ai-stop",
                targets: ["ai1", "ai2"],
              });
              Logger.info(
                LogCategory.RELAY,
                shellT("logs.relayStopped", { relay: getRelayLabel("ai2Ai1") })
              );
            } else {
              if (
                SlotController.isConnected("ai1") !== true ||
                SlotController.isConnected("ai2") !== true
              ) {
                Logger.warn(
                  LogCategory.RELAY,
                  shellT("logs.relayStartBlockedMultiple", {
                    slots: `${getSlotLabel("ai1")} / ${getSlotLabel("ai2")}`,
                  })
                );
                return;
              }
              await CoreEngine.sendProtocol({
                room: "analyze",
                scenario: "ai-ai",
                targets: ["ai1", "ai2"],
                mode: "aiRelaySequential",
                context: { starter: "ai2" },
              });
              Logger.info(
                LogCategory.RELAY,
                shellT("logs.relayStarted", { relay: getRelayLabel("ai2Ai1") })
              );
            }
            updateRelayButtonStates();
            updateRelayIndicator();
          } catch (err) {
            Logger.error(
              LogCategory.RELAY,
              shellT("logs.relayError", {
                relay: getRelayLabel("ai2Ai1"),
                message: getErrorMessage(err),
              })
            );
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
      if (RelayManager.isAIAIActive() || RelayManager.isAIAssistantActive()) {
        updateRelayIndicator();
      }
    });
  } catch (error) {
    Logger.debug(
      LogCategory.SYSTEM,
      shellT("logs.relayButtonSetupError", { message: getErrorMessage(error) }),
      {
        error: error instanceof Error ? error : new Error(String(error)),
      }
    );
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
      shellT("logs.relayButtonStates", {
        ai1: String(ai1Connected),
        ai2: String(ai2Connected),
        ai0: String(ai0Connected),
      })
    );

    const isAIAIActive = RelayManager.isAIAIActive() === true;
    const isAssistantRelayActive = RelayManager.isAIAssistantActive() === true;
    const assistantSourceSlot = RelayManager.getAIAssistantSourceSlot();
    const anyRelayActive = isAIAIActive || isAssistantRelayActive;

    if (btnAi1Ai0) {
      const isThisActive = isAssistantRelayActive && assistantSourceSlot === "ai1";
      const canEnable = ai1Connected && ai0Connected && (!anyRelayActive || isThisActive);
      btnAi1Ai0.disabled = !canEnable;
      btnAi1Ai0.classList.toggle("is-active", isThisActive);
    }

    if (btnAi0Ai2) {
      const isThisActive = isAssistantRelayActive && assistantSourceSlot === "ai2";
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
    Logger.debug(
      LogCategory.SYSTEM,
      shellT("logs.relayButtonStateUpdateError", { message: getErrorMessage(error) }),
      {
        error: error instanceof Error ? error : new Error(String(error)),
      }
    );
  }
}
