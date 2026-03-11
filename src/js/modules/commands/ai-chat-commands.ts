import type { TranslationParams } from "@shared/i18n.js";
import { LogCategory, LogLevel } from "@shared/logging-core";
import { Logger } from "../logger/index.js";

import { AppI18n } from "../i18n/index.js";
import { SlotController } from "../slot-controller.js";
import { RelayManager } from "../relay-manager.js";
import { SettingsManager } from "../settings-manager.js";
import type { CommandPayload } from "./utils.js";
import { logCommandResult } from "./utils.js";
import { getErrorMessage } from "@shared/index.js";

type CommandHandlerResult = { success: boolean; message?: string; [key: string]: unknown };

function aiChatT(key: string, params?: TranslationParams): string {
  return AppI18n.t(`app.commands.aiChat.${key}`, params);
}

function formatCommandTimestamp(): string {
  return new Date().toLocaleString(AppI18n.getLocale());
}

function resolveTargetFromRelayLabel(labelRaw: string): "ai1" | "ai2" | null {
  const label = labelRaw.trim().toLowerCase();
  if (label === "") return null;

  if (label === "ai1") return "ai1";
  if (label === "ai2") return "ai2";

  if (/^ai1\s*-\s*(?:assistant|asistan)$/.test(label)) return "ai1";
  if (/^(?:assistant|asistan)\s*-\s*ai2$/.test(label)) return "ai2";

  return null;
}

function resolveAssistantTarget(argsRaw: string, relayLabel: string): "ai1" | "ai2" | null {
  const args = argsRaw.trim().toLowerCase();
  if (args === "ai1" || args === "1") return "ai1";
  if (args === "ai2" || args === "2") return "ai2";
  return resolveTargetFromRelayLabel(relayLabel);
}

function stripInlineCommands(textRaw: string): string {
  return textRaw
    .replace(/\+\+cmd:[A-Za-z0-9_]+\(([^)]*)\)/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .trim();
}

export async function aiaiChatStartHandler(
  payload: CommandPayload = {}
): Promise<CommandHandlerResult> {
  const { CoreEngine: coreEngine } = await import("../core-engine.js");
  const providerRaw = payload.provider ?? "ai1";
  const provider = providerRaw === "ai1" || providerRaw === "ai2" ? providerRaw : "ai1";
  const argsLabel = payload.args ?? "";

  try {
    const ai1Conn = SlotController.isConnected("ai1");
    const ai2Conn = SlotController.isConnected("ai2");

    if (ai1Conn !== true || ai2Conn !== true) {
      throw new Error(aiChatT("aiaiStartRequiresConnections"));
    }

    try {
      const radio = document.querySelector<HTMLInputElement>(
        `input[name="relay-starter"][value="${provider}"]`
      );
      if (radio !== null && !radio.disabled) {
        radio.checked = true;
      }
    } catch {}

    Logger.panel(
      LogCategory.COMMAND,
      LogLevel.INFO,
      aiChatT("commandStarting", { command: "AIAIChatStart", provider })
    );

    const result = await coreEngine.sendProtocol({
      room: "analyze",
      scenario: "ai-ai",
      targets: ["ai1", "ai2"],
      mode: "aiRelaySequential",
      context: { starter: provider },
    });

    if (result.success === true) {
      Logger.panel(LogCategory.COMMAND, LogLevel.INFO, aiChatT("relaySendTriggered"), {
        eventType: "coreengine-ai-send",
        provider,
        triggerCommand: "AIAIChatStart",
        triggerSource: payload.source ?? "manual",
        detail: "ai1, ai2 protocol-start",
        timestamp: formatCommandTimestamp(),
      });
    }

    logCommandResult("AIAIChatStart", {
      providerRaw,
      sender: payload.sender ?? providerRaw,
      args: argsLabel,
      success: result.success,
      detail:
        result.message ?? (result.success ? aiChatT("statusStarted") : aiChatT("statusError")),
    });

    return result;
  } catch (err) {
    const errMsg = getErrorMessage(err);
    Logger.panel(
      LogCategory.COMMAND,
      LogLevel.ERROR,
      aiChatT("commandError", { command: "AIAIChatStart", message: errMsg })
    );
    return { success: false, message: errMsg };
  }
}

export async function aiaiChatStopHandler(
  payload: CommandPayload = {}
): Promise<CommandHandlerResult> {
  const { CoreEngine: coreEngine } = await import("../core-engine.js");
  const providerRaw = payload.provider ?? "AI";

  try {
    Logger.panel(
      LogCategory.COMMAND,
      LogLevel.INFO,
      aiChatT("commandRequested", { command: "AIAIChatStop" })
    );

    if (RelayManager.isAIAIActive() !== true) {
      const message = aiChatT("aiaiRelayInactive");
      logCommandResult("AIAIChatStop", {
        providerRaw,
        sender: payload.sender ?? providerRaw,
        args: "",
        success: false,
        detail: message,
      });
      return { success: false, message };
    }

    const result = await coreEngine.sendProtocol({
      room: "analyze",
      scenario: "ai-ai-stop",
      targets: ["ai1", "ai2"],
    });

    if (result.success === true) {
      Logger.panel(LogCategory.COMMAND, LogLevel.INFO, aiChatT("relayStopTriggered"), {
        eventType: "coreengine-ai-send",
        provider: providerRaw,
        triggerCommand: "AIAIChatStop",
        triggerSource: payload.source ?? "manual",
        detail: "ai1, ai2 protocol-stop",
        timestamp: formatCommandTimestamp(),
      });
    }

    logCommandResult("AIAIChatStop", {
      providerRaw,
      sender: payload.sender ?? providerRaw,
      args: "",
      success: result.success === true,
      detail:
        result.success === true
          ? aiChatT("stopSignalSent")
          : (result.message ?? aiChatT("stopSignalFailed")),
    });

    return result;
  } catch (err) {
    const errMsg = getErrorMessage(err);
    Logger.panel(
      LogCategory.COMMAND,
      LogLevel.ERROR,
      aiChatT("commandError", { command: "AIAIChatStop", message: errMsg })
    );
    return { success: false, message: errMsg };
  }
}

export async function aiAssistantChatStartHandler(
  payload: CommandPayload = {}
): Promise<CommandHandlerResult> {
  const providerRaw = payload.provider ?? "ai1";
  const provider = providerRaw === "ai1" || providerRaw === "ai2" ? providerRaw : "ai1";

  try {
    const sourceConn = SlotController.isConnected(provider);
    const assistantConn = SlotController.isConnected("ai0");

    if (sourceConn !== true) {
      throw new Error(aiChatT("aiAssistantSourceDisconnected", { provider }));
    }

    if (assistantConn !== true) {
      throw new Error(aiChatT("aiAssistantDisconnected"));
    }

    Logger.panel(
      LogCategory.COMMAND,
      LogLevel.INFO,
      aiChatT("commandStarting", { command: "AIAssistantChatStart", provider: `${provider} ↔ ai0` })
    );

    await RelayManager.startAIAssistantSession(provider);

    logCommandResult("AIAssistantChatStart", {
      providerRaw,
      sender: payload.sender ?? providerRaw,
      args: "",
      success: true,
      detail: aiChatT("aiAssistantRelayStarted", { provider }),
    });

    return { success: true, message: aiChatT("aiAssistantRelayStarted", { provider }) };
  } catch (err) {
    const errMsg = getErrorMessage(err);
    Logger.panel(
      LogCategory.COMMAND,
      LogLevel.ERROR,
      aiChatT("commandError", { command: "AIAssistantChatStart", message: errMsg })
    );
    return { success: false, message: errMsg };
  }
}

export async function aiAssistantChatStopHandler(
  payload: CommandPayload = {}
): Promise<CommandHandlerResult> {
  const { CoreEngine: coreEngine } = await import("../core-engine.js");
  const providerRaw = payload.provider ?? "AI";

  try {
    Logger.panel(
      LogCategory.COMMAND,
      LogLevel.INFO,
      aiChatT("commandRequested", { command: "AIAssistantChatStop" })
    );

    if (RelayManager.isAIAssistantActive() !== true) {
      const message = aiChatT("aiAssistantRelayInactive");
      logCommandResult("AIAssistantChatStop", {
        providerRaw,
        sender: payload.sender ?? providerRaw,
        args: "",
        success: false,
        detail: message,
      });
      return { success: false, message };
    }

    const sourceSlot = RelayManager.getAIAssistantSourceSlot();
    if (sourceSlot !== "ai1" && sourceSlot !== "ai2") {
      const message = aiChatT("aiAssistantSourceUnknown");
      logCommandResult("AIAssistantChatStop", {
        providerRaw,
        sender: payload.sender ?? providerRaw,
        args: "",
        success: false,
        detail: message,
      });
      return { success: false, message };
    }

    const result = await coreEngine.sendProtocol({
      room: "analyze",
      scenario: "ai-assistant-stop",
      targets: [sourceSlot],
    });

    if (result.success !== true) {
      return result;
    }

    logCommandResult("AIAssistantChatStop", {
      providerRaw,
      sender: payload.sender ?? providerRaw,
      args: "",
      success: true,
      detail: aiChatT("aiAssistantRelayStopped"),
    });

    return { success: true, message: aiChatT("aiAssistantRelayStopped") };
  } catch (err) {
    const errMsg = getErrorMessage(err);
    Logger.panel(
      LogCategory.COMMAND,
      LogLevel.ERROR,
      aiChatT("commandError", { command: "AIAssistantChatStop", message: errMsg })
    );
    return { success: false, message: errMsg };
  }
}

export async function aiAssistantSendHandler(
  payload: CommandPayload = {}
): Promise<CommandHandlerResult> {
  const { CoreEngine: coreEngine } = await import("../core-engine.js");
  const providerRaw = payload.provider ?? "";
  const argsLabel = typeof payload.args === "string" ? payload.args : "";
  const rawText = typeof payload["text"] === "string" ? payload["text"] : "";
  const isTestMode = payload.testMode === true;

  try {
    const sourceProvider = argsLabel.trim() !== "" ? argsLabel.trim().toLowerCase() : providerRaw;
    if (sourceProvider !== "ai1" && sourceProvider !== "ai2") {
      const message = aiChatT("invalidProvider");
      Logger.error(LogCategory.COMMAND, message, {
        eventType: "ai-asistan-send-invalid-provider",
        provider: providerRaw,
        args: argsLabel,
      });
      return { success: false, message };
    }

    const cleanText = stripInlineCommands(rawText);
    if (cleanText === "") {
      const message = aiChatT("messageMissing");
      Logger.error(LogCategory.COMMAND, message, {
        eventType: "ai-asistan-send-empty-text",
        provider: sourceProvider,
      });
      return { success: false, message };
    }

    if (isTestMode) {
      const message = aiChatT("aiAssistantSendTestMode", { sourceProvider });
      Logger.toast(LogCategory.COMMAND, LogLevel.INFO, message, {
        eventType: "command-test-mode",
        command: "AIAssistantSend",
        provider: sourceProvider,
      });
      logCommandResult("AIAssistantSend", {
        providerRaw: sourceProvider,
        sender: payload.sender ?? sourceProvider,
        args: argsLabel,
        success: true,
        detail: message,
      });
      return { success: true, message };
    }

    if (SlotController.isConnected("ai0") !== true) {
      const connectResult = await SlotController.connect("ai0");
      if (connectResult.success !== true) {
        const message = aiChatT("assistantConnectFailed");
        Logger.error(LogCategory.COMMAND, message, {
          eventType: "ai-asistan-send-connect-failed",
          provider: sourceProvider,
        });
        return { success: false, message };
      }
    }

    // NOTE: The hev-sender tag preserves the originating AI nickname so ai0 sync can restore the author.
    // NOTE: Keep the tag for future ai0 DB support even though the sync path does not consume it today.
    const senderNick = payload.sender ?? sourceProvider;
    const taggedText = `${cleanText}\n<!-- hev-sender:${senderNick} -->`;

    const sendResult = await coreEngine.sendMessage({
      provider: "ai0",
      text: taggedText,
      page: "ai-asistan-command",
    });

    if (sendResult.success !== true) {
      throw new Error(sendResult.message ?? aiChatT("messageSendFailed"));
    }

    logCommandResult("AIAssistantSend", {
      providerRaw: sourceProvider,
      sender: payload.sender ?? sourceProvider,
      args: argsLabel,
      success: true,
      detail: aiChatT("messageSentToAssistant"),
    });

    return { success: true, message: aiChatT("messageSentToAssistant") };
  } catch (err) {
    const errMsg = getErrorMessage(err);
    Logger.panel(
      LogCategory.COMMAND,
      LogLevel.ERROR,
      aiChatT("commandError", { command: "AIAssistantSend", message: errMsg })
    );
    return { success: false, message: errMsg };
  }
}

export async function assistantAISendHandler(
  payload: CommandPayload = {}
): Promise<CommandHandlerResult> {
  const { CoreEngine: coreEngine } = await import("../core-engine.js");
  const providerRaw = payload.provider ?? "ai0";
  const argsLabel = typeof payload.args === "string" ? payload.args : "";
  const rawText = typeof payload["text"] === "string" ? payload["text"] : "";
  const isTestMode = payload.testMode === true;

  try {
    const settings = SettingsManager.getSnapshot();
    const relayLabel =
      typeof settings.assistants?.lastActiveRelay === "string"
        ? settings.assistants.lastActiveRelay
        : "";

    const target = resolveAssistantTarget(argsLabel, relayLabel);
    if (target === null) {
      const message = aiChatT("targetMissing");
      Logger.error(LogCategory.COMMAND, message, {
        eventType: "assistant-ai-send-missing-target",
        provider: providerRaw,
        args: argsLabel,
        lastActiveRelay: relayLabel,
      });
      logCommandResult("AssistantAISend", {
        providerRaw,
        sender: payload.sender ?? providerRaw,
        args: argsLabel,
        success: false,
        detail: message,
      });
      return { success: false, message };
    }

    const cleanText = stripInlineCommands(rawText);
    if (cleanText === "") {
      const message = aiChatT("messageMissing");
      Logger.error(LogCategory.COMMAND, message, {
        eventType: "assistant-ai-send-empty-text",
        provider: providerRaw,
      });
      return { success: false, message };
    }

    if (isTestMode) {
      const message = aiChatT("assistantAiSendTestMode", { target });
      Logger.toast(LogCategory.COMMAND, LogLevel.INFO, message, {
        eventType: "command-test-mode",
        command: "AssistantAISend",
        provider: providerRaw,
        target,
      });
      logCommandResult("AssistantAISend", {
        providerRaw,
        sender: payload.sender ?? providerRaw,
        args: argsLabel,
        success: true,
        detail: message,
      });
      return { success: true, message };
    }

    if (SlotController.isConnected(target) !== true) {
      const message = aiChatT("targetOffline", { target: target.toUpperCase() });
      Logger.error(LogCategory.COMMAND, message, {
        eventType: "assistant-ai-send-target-offline",
        provider: providerRaw,
        target,
      });
      return { success: false, message };
    }

    // NOTE: The hev-sender tag marks Assistant (ai0) as the sender so sync can restore the author.
    const senderNick = payload.sender ?? AppI18n.t("shell.relay.participants.assistant");
    const taggedText = `${cleanText}\n<!-- hev-sender:${senderNick} -->`;

    const sendResult = await coreEngine.sendMessage({
      provider: target,
      text: taggedText,
      page: "assistant-ai-command",
    });

    if (sendResult.success !== true) {
      throw new Error(sendResult.message ?? aiChatT("messageSendFailed"));
    }

    if (RelayManager.isAIAssistantActive() === true) {
      const sourceSlot = RelayManager.getAIAssistantSourceSlot();
      if (sourceSlot === "ai1" || sourceSlot === "ai2") {
        await coreEngine.sendProtocol({
          room: "analyze",
          scenario: "ai-assistant-stop",
          targets: [sourceSlot],
        });
      } else {
        await RelayManager.stopAIAssistantSession();
      }
    }

    logCommandResult("AssistantAISend", {
      providerRaw,
      sender: payload.sender ?? providerRaw,
      args: argsLabel,
      success: true,
      detail: aiChatT("singleMessageSent", { target: target.toUpperCase() }),
    });

    return { success: true, message: aiChatT("sentToTarget", { target: target.toUpperCase() }) };
  } catch (err) {
    const errMsg = getErrorMessage(err);
    Logger.panel(
      LogCategory.COMMAND,
      LogLevel.ERROR,
      aiChatT("commandError", { command: "AssistantAISend", message: errMsg })
    );
    return { success: false, message: errMsg };
  }
}
