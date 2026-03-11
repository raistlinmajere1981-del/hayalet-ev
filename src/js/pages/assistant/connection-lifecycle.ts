import { LogCategory, LogLevel } from "@shared/logging-core";
import type { TranslationParams } from "@shared/i18n.js";
import { ASSISTANT_TIMEOUTS } from "@timeouts";
import { ConnectButtonState } from "@shared/assistant.js";
import type { AssistantProviderAdapter, SlotStateInfo } from "@shared/assistant.js";

import { AppI18n } from "../../modules/i18n/index.js";
import { Logger } from "../../modules/logger/index.js";
import { resolveIpcErrorMessage } from "../../modules/ipc-errors.js";
import { SettingsManager } from "../../modules/settings-manager.js";
import { SlotController, SlotState } from "../../modules/slot-controller.js";
import type { OverlayStage } from "./overlay-stage.js";

function assistantT(key: string, params?: TranslationParams): string {
  return AppI18n.t(`shell.assistant.${key}`, params);
}

export interface AssistantConnectionLifecycleController {
  providerSelect: HTMLSelectElement | null;
  _activeAdapter: AssistantProviderAdapter | null;
  _connectFlowActive: boolean;
  _isServerRunning: boolean;
  _systemServerPort: number | null;
  _providerToolsReady: boolean;
  _setButtonState: (state: ConnectButtonState, errorMsg?: string) => void;
  _updateServerStatus: (status: { running: boolean; port?: number }) => void;
  _cancelConnectFlow: () => void;
  _finishConnectFlow: () => void;
  _updateConnectionUI: (skipSystemServerSync?: boolean) => void;
  _stopSystemActiveServers: () => Promise<void>;
  _beginConnectFlow: () => AbortSignal;
  _isConnectFlowCancelled: (signal: AbortSignal) => boolean;
  _setConnectOverlayStage: (stage: OverlayStage | null) => void;
  _resolveSystemServerStatus: () => Promise<{ running: boolean; port?: number }>;
  _resolveConnectUrl: (
    baseUrl: string,
    providerId: string,
    options: { forceResume?: boolean }
  ) => string;
}

export async function toggleAssistantConnection(
  controller: AssistantConnectionLifecycleController,
  options: { forceResume?: boolean } = {}
): Promise<void> {
  const slotState = SlotController.getState("ai0") as SlotStateInfo | null;
  const adapter = controller._activeAdapter;
  const systemServerStatus = await controller._resolveSystemServerStatus();
  controller._isServerRunning = systemServerStatus.running;
  controller._systemServerPort =
    typeof systemServerStatus.port === "number" ? systemServerStatus.port : null;

  if (adapter == null) {
    Logger.error(LogCategory.ASSISTANT_CORE, assistantT("logs.noActiveAdapter"));
    controller._setButtonState(ConnectButtonState.ERROR, assistantT("errors.adapterMissing"));
    return;
  }

  const isConnecting = slotState?.state === SlotState.CONNECTING || controller._connectFlowActive;
  if (isConnecting) {
    controller._setButtonState(ConnectButtonState.STOPPING);
    controller._cancelConnectFlow();

    try {
      Logger.info(LogCategory.ASSISTANT_CORE, assistantT("logs.connectionRequestCancelled"), {
        slotState: slotState?.state,
      });

      if (slotState?.state === SlotState.CONNECTING) {
        await SlotController.disconnect("ai0");
      }

      await controller._stopSystemActiveServers();
      controller._setButtonState(ConnectButtonState.SUCCESS_STOP);
    } catch (err) {
      const error = err as Error;
      controller._setButtonState(ConnectButtonState.ERROR, error.message);
    } finally {
      controller._finishConnectFlow();
      await new Promise((resolve) =>
        setTimeout(resolve, ASSISTANT_TIMEOUTS.STAGE_TRANSITION_SHORT)
      );
      controller._updateConnectionUI();
    }
    return;
  }

  if (slotState?.state === SlotState.CONNECTED) {
    controller._setButtonState(ConnectButtonState.STOPPING);

    try {
      Logger.debug(LogCategory.ASSISTANT_CORE, assistantT("logs.disconnectStarting"), {
        slotState: slotState.state,
      });

      await SlotController.disconnect("ai0");

      Logger.debug(LogCategory.ASSISTANT_CORE, assistantT("logs.systemServersStopping"));
      await controller._stopSystemActiveServers();

      controller._providerToolsReady = true;

      controller._setButtonState(ConnectButtonState.SUCCESS_STOP);
      Logger.panel(LogCategory.ASSISTANT_CORE, LogLevel.INFO, assistantT("logs.disconnected"));

      await new Promise((resolve) => setTimeout(resolve, ASSISTANT_TIMEOUTS.STAGE_TRANSITION_MID));
      controller._updateConnectionUI();
    } catch (err) {
      const error = err as Error;
      Logger.error(LogCategory.ASSISTANT_CORE, assistantT("logs.disconnectError"), {
        error: error.message,
      });

      controller._isServerRunning = false;
      controller._providerToolsReady = true;
      controller._updateServerStatus({ running: false });

      controller._setButtonState(ConnectButtonState.ERROR, error.message);
      await new Promise((resolve) => setTimeout(resolve, ASSISTANT_TIMEOUTS.STAGE_TRANSITION_MID));
      controller._updateConnectionUI();
    }
    return;
  }

  if (slotState?.state === SlotState.ASSIGNED || slotState?.state === SlotState.EMPTY) {
    const connectSignal = controller._beginConnectFlow();
    const providerId = controller.providerSelect?.value ?? adapter.id;
    controller._providerToolsReady = providerId === "opencode-ui" ? false : true;

    controller._setConnectOverlayStage(null);
    controller._setButtonState(ConnectButtonState.CANCEL_CONNECTING);
    controller._updateConnectionUI();

    try {
      const result = await adapter.startServer("auto");

      if (controller._isConnectFlowCancelled(connectSignal)) {
        return;
      }

      if (result.success === true && result.url !== undefined && result.url !== "") {
        controller._isServerRunning = true;

        const targetUrl = controller._resolveConnectUrl(result.url, providerId, options);

        const serverReady =
          result.alreadyRunning === true
            ? true
            : await adapter.waitForReady(result.url, 90000, connectSignal);

        if (controller._isConnectFlowCancelled(connectSignal)) {
          return;
        }

        if (!serverReady) {
          await controller._stopSystemActiveServers();

          Logger.error(
            LogCategory.ASSISTANT_CORE,
            assistantT("logs.providerServerTimeout", { name: adapter.name }),
            {
              url: result.url,
            }
          );

          return;
        }

        const serverStatus = adapter.getServerStatus();
        controller._updateServerStatus({
          running: true,
          ...(typeof serverStatus.port === "number" ? { port: serverStatus.port } : {}),
        });
        controller._systemServerPort =
          typeof serverStatus.port === "number" ? serverStatus.port : null;

        await SettingsManager.set("assistants.lastConnected", providerId);

        if (targetUrl !== "") {
          await SlotController.connect("ai0", { url: targetUrl });
        } else {
          await SlotController.connect("ai0", {});
        }

        if (controller._isConnectFlowCancelled(connectSignal)) {
          return;
        }

        Logger.success(LogCategory.ASSISTANT_CORE, assistantT("logs.connectionStarted"), {
          url: targetUrl,
        });
      } else {
        const resolvedErrorMessage = resolveIpcErrorMessage(result) ?? result.error;
        const errorMessage =
          typeof resolvedErrorMessage === "string" && resolvedErrorMessage !== ""
            ? resolvedErrorMessage
            : assistantT("errors.providerServeStartFailed", { name: adapter.name });
        Logger.error(
          LogCategory.ASSISTANT_CORE,
          assistantT("logs.providerServerStartFailed", { name: adapter.name }),
          {
            error: errorMessage,
          }
        );
      }
    } finally {
      controller._finishConnectFlow();
      controller._updateConnectionUI();
    }
  }
}
