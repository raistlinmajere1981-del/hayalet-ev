/**
 * MessageSender - Webview mesaj gönderim yönetimi
 *
 * Bu modül AI webview'larına mesaj ve dosya gönderimini yönetir:
 * - Mesaj injection/xdotools metodları
 * - Dosya yükleme (dragdrop, injection, link-based)
 * - Send button tetikleme
 */

import { Logger } from "../logger/index.js";
import { LogCategory } from "@shared/logging-core";
import { TrafficManager } from "../traffic-manager.js";
import { FileManager } from "../file-manager.js";
import { AppState } from "../app-state.js";
import { ProviderRegistry } from "./provider-registry.js";
import { getProvider } from "./provider-factory.js";
import type { ProviderModule } from "./provider-factory.js";
import { waitForDomReady } from "./methods/shared/file-utils.js";
import { isSlotUrlExcluded, isDefaultPage } from "./methods/shared/url-utils.js";
import type { AppSettings } from "@shared/settings.js";

export interface MessageSenderWebview {
  getURL?: () => string;
  executeJavaScript: (script: string) => Promise<unknown>;
  focus?: () => void;
  isLoading?: () => boolean;
  addEventListener?: (
    event: string,
    cb: (...args: unknown[]) => void,
    options?: { once?: boolean }
  ) => void;
}

interface FileEntry {
  name?: string;
  path?: string;
}

interface UploadedLink {
  name: string;
  url: string;
}

interface FileResult {
  success: boolean;
  message?: string;
  uploadedLinks?: UploadedLink[];
}

interface SendOptions {
  provider: string;
  text?: string;
  attachments?: FileEntry[];
  webview: MessageSenderWebview;
}

interface SendResult {
  success: boolean;
  message: string;
  files: FileResult | null;
}

type FileFn = (
  webview: MessageSenderWebview,
  opts: { files: unknown[]; provider: string }
) => Promise<FileResult>;

class MessageSenderClass {
  _settings: AppSettings | null;

  constructor() {
    this._settings = null;
  }

  private _isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }

  private _getSendButtonSelector(config: unknown): string | string[] | null {
    if (!this._isRecord(config)) return null;
    const selectors = config["selectors"];
    if (!this._isRecord(selectors)) return null;
    const sendButton = selectors["sendButton"];
    if (typeof sendButton === "string") return sendButton;
    if (Array.isArray(sendButton)) return sendButton.filter((item) => typeof item === "string");
    return null;
  }

  setSettings(settings: AppSettings | null): void {
    this._settings = settings;
  }

  getProviderModule(providerSlot: string): ProviderModule | null {
    const providerId = AppState.getProviderIdForSlot(providerSlot);
    if (providerId === null || providerId === "") {
      return null;
    }
    return getProvider(providerId) ?? null;
  }

  /**
   * URL excluded mı kontrol et
   * @deprecated Use isSlotUrlExcluded from url-utils.ts directly
   */
  isUrlExcluded(providerSlot: string, url: string): boolean {
    return isSlotUrlExcluded(providerSlot, url);
  }

  async send({ provider, text, attachments = [], webview }: SendOptions): Promise<SendResult> {
    const currentUrl = webview.getURL?.() ?? "";
    if (this.isUrlExcluded(provider, currentUrl)) {
      Logger.debug(LogCategory.WEBVIEW, "URL excluded, send operation disabled", {
        provider,
        currentUrl,
      });
      throw new Error(`URL excluded from operations: ${currentUrl}`);
    }

    const providerId = AppState.getProviderIdForSlot(provider);
    if (providerId === null || providerId === "") {
      throw new Error(`Provider for slot "${provider}" not configured (no account/provider).`);
    }

    const providerModule = this.getProviderModule(provider);
    if (providerModule === null) {
      throw new Error(`Provider module for "${provider}" (${providerId}) not found.`);
    }

    // Provider selection debug removed

    await waitForDomReady(webview);

    // Provider config fallback - sadece config yoksa inject et
    const providerConfig = ProviderRegistry.get(providerId);
    try {
      const checkScript = `(function() { return !!window.__hayalet_provider_config; })();`;
      const hasConfig = await webview.executeJavaScript(checkScript);

      if (hasConfig !== true) {
        const configScript = `
          (function() {
            window.__hayalet_slot = ${JSON.stringify(provider)};
            window.__hayalet_provider_config = ${JSON.stringify(providerConfig)};
            return true;
          })();
        `;
        await webview.executeJavaScript(configScript);
      }
    } catch (err) {
      Logger.debug(LogCategory.WEBVIEW, "Provider config injection skipped", {
        provider,
        providerId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    const slots = this._settings?.slots as
      | Record<string, { messageMethod?: string; fileMethod?: string }>
      | undefined;
    const asistanSlot = this._settings?.asistanSlot as
      | { messageMethod?: string; fileMethod?: string }
      | undefined;
    const slotConfig = provider === "ai0" ? asistanSlot : slots?.[provider];

    const messageMethodName = slotConfig?.messageMethod;
    if (messageMethodName === undefined || messageMethodName === "") {
      throw new Error(`messageMethod is not configured for slot "${provider}"`);
    }

    const fileMethodName = slotConfig?.fileMethod;
    if (fileMethodName === undefined || fileMethodName === "") {
      throw new Error(`fileMethod is not configured for slot "${provider}"`);
    }

    const messageFn =
      messageMethodName === "xdotools"
        ? providerModule["sendMessage_xdotools"]
        : providerModule["sendMessage"];

    const fileFn = attachments.length > 0 ? providerModule[`attachFiles_${fileMethodName}`] : null;

    if (typeof messageFn !== "function") {
      throw new Error(
        `Message function "${messageMethodName}" not found in provider module for "${provider}"`
      );
    }

    if (attachments.length > 0 && typeof fileFn !== "function") {
      throw new Error(
        `File function "attachFiles_${fileMethodName}" not found in provider module for "${provider}"`
      );
    }

    // Method selection debug removed

    try {
      webview.focus?.();
    } catch (err) {
      Logger.debug(LogCategory.WEBVIEW, "Webview focus failed", {
        provider,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    const isLinkBased = ["tmpfile", "catbox", "uguu", "googledrive"].includes(fileMethodName);

    let finalMessage = text ?? "";
    let fileResult = null;

    if (attachments.length > 0 && isLinkBased) {
      fileResult = await this._handleLinkBasedUpload(
        webview,
        provider,
        attachments,
        fileFn as FileFn,
        fileMethodName
      );

      const uploadedLinks = fileResult?.uploadedLinks ?? [];
      if (uploadedLinks.length > 0) {
        const linkText = uploadedLinks.map((l) => `[${l.name}](${l.url})`).join("\n");
        finalMessage = finalMessage.trim() !== "" ? `${finalMessage}\n${linkText}` : linkText;
      }
    }

    if (attachments.length > 0 && !isLinkBased) {
      fileResult = await this._handleDirectUpload(
        webview,
        provider,
        attachments,
        fileFn as FileFn,
        fileMethodName
      );
    }

    if (finalMessage.trim().length > 0) {
      Logger.debug(LogCategory.WEBVIEW, "Adding message to input field", {
        provider,
        messageMethod: messageMethodName,
      });
      const sendResult = await (
        messageFn as (
          wv: MessageSenderWebview,
          opts: { message: string }
        ) => Promise<{ success?: boolean; message?: string }>
      )(webview, { message: finalMessage });
      if (sendResult.success !== true) {
        throw new Error(sendResult.message ?? "Mesaj metin alanına yazılamadı.");
      }
    }

    Logger.info(LogCategory.WEBVIEW, "Waiting for send button to be enabled", { provider });
    await TrafficManager.waitForSendEnabled(provider, 20000);

    Logger.info(LogCategory.WEBVIEW, "Triggering send button", { provider });

    const urlBeforeSend = webview.getURL?.() ?? "";
    if (isDefaultPage(urlBeforeSend, providerId)) {
      TrafficManager.skipNextLoadingFor(provider);
    }

    await this._triggerSendButton(webview, provider, providerId);

    return {
      success: true,
      message: "Gönderim başarılı",
      files: fileResult,
    };
  }

  /**
   * Link-based dosya yükleme (catbox, uguu, googledrive, tmpfile)
   * @private
   */
  async _handleLinkBasedUpload(
    webview: MessageSenderWebview,
    provider: string,
    attachments: FileEntry[],
    fileFn: FileFn,
    fileMethodName: string
  ): Promise<FileResult | null> {
    const files = await FileManager.readUploadFiles(attachments);
    if (files.length === 0) return null;

    Logger.debug(LogCategory.WEBVIEW, "Uploading files", {
      provider,
      fileCount: files.length,
      fileMethod: fileMethodName,
    });

    const fileResult = await fileFn(webview, { files, provider });

    if (fileResult.success !== true) {
      Logger.debug(LogCategory.WEBVIEW, "File upload failed", {
        provider,
        fileMethod: fileMethodName,
        error: fileResult.message ?? "unknown error",
      });
      throw new Error(fileResult.message ?? `${fileMethodName} upload failed`);
    }

    if ((fileResult.uploadedLinks?.length ?? 0) === 0) {
      Logger.debug(LogCategory.WEBVIEW, "File upload returned no links", {
        provider,
        fileMethod: fileMethodName,
        rawResult: fileResult,
      });
      throw new Error(
        `${fileMethodName} upload returned no links. Check Google Drive auth and IPC response.`
      );
    }

    return fileResult;
  }

  /**
   * Direct dosya yükleme (injection, dragdrop, xdotools)
   * @private
   */
  async _handleDirectUpload(
    webview: MessageSenderWebview,
    provider: string,
    attachments: FileEntry[],
    fileFn: FileFn,
    fileMethodName: string
  ): Promise<FileResult | null> {
    const files = await FileManager.readUploadFiles(attachments);
    if (files.length === 0) return null;

    Logger.info(LogCategory.WEBVIEW, "Attaching files", {
      provider,
      fileCount: files.length,
      fileMethod: fileMethodName,
    });

    const fileResult = await fileFn(webview, { files, provider });

    if (fileResult.success !== true) {
      Logger.warn(LogCategory.WEBVIEW, "File attachment failed", {
        provider,
        error: fileResult.message,
      });
    }

    return fileResult;
  }

  /**
   * Send button'a tıkla
   * @private
   */
  async _triggerSendButton(
    webview: MessageSenderWebview,
    provider: string,
    providerId: string
  ): Promise<void> {
    const providerConfig = ProviderRegistry.get(providerId);
    const sendButtonSelector = this._getSendButtonSelector(providerConfig);

    if (sendButtonSelector === null) {
      const hasConfig = providerConfig !== null;
      const hasSelectors =
        this._isRecord(providerConfig) && this._isRecord(providerConfig["selectors"]);
      throw new Error(
        `Provider config bulunamadı: providerId="${providerId}", provider="${provider}", hasConfig=${String(hasConfig)}, hasSelectors=${String(hasSelectors)}`
      );
    }

    const sendSel = JSON.stringify(sendButtonSelector);

    const maxRetries = 10;
    const retryInterval = 500;

    const trySend = async (attempt: number): Promise<void> => {
      const script = `(function() {
        const sendButton = document.querySelector(${sendSel});
        if (!sendButton) {
          return { success: false, message: 'send button not found', retry: true };
        }
        
        const disabledAttr = sendButton.disabled || sendButton.getAttribute('aria-disabled') === 'true';
        const disabledStyle = getComputedStyle(sendButton).pointerEvents === 'none';
        const disabledClass = /disabled|opacity-4|opacity-5|cursor-not-allowed/i.test(sendButton.className || '');
        const isDisabled = disabledAttr || disabledStyle || disabledClass;
        
        if (isDisabled) {
          return { success: false, message: 'send button disabled', retry: true, 
                   debug: { disabled: sendButton.disabled, ariaDisabled: sendButton.getAttribute('aria-disabled'), className: sendButton.className } };
        }
        
        sendButton.click();
        return { success: true, message: 'send clicked' };
      })();`;

      const res = (await webview.executeJavaScript(script)) as {
        success?: boolean;
        retry?: boolean;
        message?: string;
        debug?: Record<string, unknown>;
      } | null;

      if (res?.success === true) {
        return;
      }

      if (res?.retry !== true || attempt >= maxRetries - 1) {
        Logger.debug(LogCategory.WEBVIEW, "Send button trigger failed", {
          provider,
          message: res?.message ?? "unknown",
          debug: res?.debug ?? {},
        });
        throw new Error("Send butonu tetiklenemedi");
      }

      await new Promise((resolve) => setTimeout(resolve, retryInterval));
      await trySend(attempt + 1);
    };
    await trySend(0);
  }
}

const messageSender = new MessageSenderClass();
export { messageSender as MessageSender };
