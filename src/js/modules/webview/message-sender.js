/**
 * MessageSender - Webview mesaj gönderim yönetimi
 * 
 * Bu modül AI webview'larına mesaj ve dosya gönderimini yönetir:
 * - Mesaj injection/xdotools metodları
 * - Dosya yükleme (dragdrop, injection, link-based)
 * - Send button tetikleme
 */

import { LogManager } from "../log-manager.js";
import { TrafficManager } from "../traffic-manager.js";
import { FileManager } from "../file-manager.js";
import { AppState } from "../app-state.js";
import { ProviderRegistry } from "./provider-registry.js";
import { getProvider } from "./provider-factory.js";
import { waitForDomReady } from "../../app.js";
import { isUrlExcluded as checkUrlExcluded } from "./methods/shared/url-utils.js";

class MessageSenderClass {
  constructor() {
    this._settings = null;
  }

  /**
   * Ayarları güncelle
   * @param {Object} settings - Uygulama ayarları
   */
  setSettings(settings) {
    this._settings = settings;
  }

  /**
   * Slot için provider modülünü getir
   * @param {string} providerSlot - Slot ID
   * @returns {Object|null}
   */
  getProviderModule(providerSlot) {
    const providerId = AppState.getProviderIdForSlot(providerSlot);
    return providerId ? getProvider(providerId) : null;
  }

  /**
   * URL excluded mı kontrol et
   * @param {string} providerSlot - Slot ID
   * @param {string} url - Kontrol edilecek URL
   * @returns {boolean}
   */
  isUrlExcluded(providerSlot, url) {
    const providerId = AppState.getProviderIdForSlot(providerSlot);
    if (!providerId || !url) return false;

    const cfg = ProviderRegistry.get(providerId);
    if (!cfg?.excludedUrls?.length) return false;

    return checkUrlExcluded(url, cfg.excludedUrls);
  }

  /**
   * Mesaj ve dosya gönder
   * @param {Object} opts - { provider, text, attachments, webview }
   * @returns {Promise<Object>}
   */
  async send({ provider, text, attachments = [], webview }) {
    if (!webview) {
      throw new Error(`Webview for provider "${provider}" not found.`);
    }

    const currentUrl = webview.getURL?.() || "";
    if (this.isUrlExcluded(provider, currentUrl)) {
      LogManager.addEvent(
        `webview-${provider}`,
        "warning",
        `URL excluded: ${currentUrl}, send operation disabled`,
      );
      throw new Error(`URL excluded from operations: ${currentUrl}`);
    }

    const providerId = AppState.getProviderIdForSlot(provider);
    if (!providerId) {
      throw new Error(
        `Provider for slot "${provider}" not configured (no account/provider).`,
      );
    }

    const providerModule = this.getProviderModule(provider);
    if (!providerModule) {
      throw new Error(
        `Provider module for "${provider}" (${providerId}) not found.`,
      );
    }

    LogManager.addEvent(
      `webview-${provider}`,
      "debug",
      `Using provider: ${providerId} for slot: ${provider}`,
    );

    await waitForDomReady(webview);

    // Provider config'i webview'e inject et (her send öncesi)
    const providerConfig = ProviderRegistry.get(providerId);
    if (providerConfig) {
      try {
        const configScript = `
          (function() {
            window.__hayalet_slot = ${JSON.stringify(provider)};
            window.__hayalet_provider_config = ${JSON.stringify(providerConfig)};
            return true;
          })();
        `;
        await webview.executeJavaScript(configScript);
      } catch (err) {
        LogManager.addEvent(
          `webview-${provider}`,
          "warning",
          `Config injection failed: ${err.message}`,
        );
      }
    }

    // ai0 (asistan) için asistanSlot'tan, diğerleri için slots'tan al
    const slotConfig = provider === "ai0" 
      ? this._settings?.asistanSlot 
      : this._settings?.slots?.[provider];
    
    const messageMethodName = slotConfig?.messageMethod;
    if (!messageMethodName) {
      throw new Error(`messageMethod is not configured for slot "${provider}"`);
    }
    
    const fileMethodName = slotConfig?.fileMethod;
    if (!fileMethodName) {
      throw new Error(`fileMethod is not configured for slot "${provider}"`);
    }

    const messageFn = messageMethodName === "xdotools"
      ? providerModule.sendMessage_xdotools
      : providerModule.sendMessage;
    
    const fileFn = attachments?.length
      ? providerModule[`attachFiles_${fileMethodName}`]
      : null;

    if (!messageFn) {
      throw new Error(
        `Message function "${messageMethodName}" not found in provider module for "${provider}"`,
      );
    }
    
    if (attachments?.length && !fileFn) {
      throw new Error(
        `File function "attachFiles_${fileMethodName}" not found in provider module for "${provider}"`,
      );
    }

    LogManager.addEvent(
      `webview-${provider}`,
      "debug",
      `Methods: messageMethod=${messageMethodName}, fileMethod=${fileMethodName}`,
    );

    try {
      webview.focus?.();
    } catch (_e) {
    }

    const isLinkBased = ["tmpfile", "catbox", "uguu", "googledrive"].includes(fileMethodName);

    let finalMessage = text || "";
    let fileResult = null;

    if (attachments?.length > 0 && isLinkBased) {
      fileResult = await this._handleLinkBasedUpload(
        webview, provider, attachments, fileFn, fileMethodName
      );
      
      if (fileResult?.uploadedLinks?.length) {
        const linkText = fileResult.uploadedLinks
          .map((l) => `[${l.name}](${l.url})`)
          .join("\n");
        finalMessage = finalMessage.trim()
          ? `${finalMessage}\n${linkText}`
          : linkText;
      }
    }

    if (attachments?.length > 0 && !isLinkBased) {
      fileResult = await this._handleDirectUpload(
        webview, provider, attachments, fileFn, fileMethodName
      );
    }

    if (finalMessage.trim().length > 0) {
      LogManager.addEvent(
        `webview-${provider}`,
        "info",
        `Adding message to input field using ${messageMethodName}`,
      );
      const sendResult = await messageFn(webview, { message: finalMessage });
      if (!sendResult?.success) {
        throw new Error(sendResult?.message || "Mesaj metin alanına yazılamadı.");
      }
    }

    LogManager.addEvent(
      `webview-${provider}`,
      "info",
      "Waiting for send button to be enabled...",
    );
    await TrafficManager.waitForSendEnabled(provider, 20000);

    LogManager.addEvent(
      `webview-${provider}`,
      "info",
      "Triggering send button...",
    );
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
  async _handleLinkBasedUpload(webview, provider, attachments, fileFn, fileMethodName) {
    const files = await FileManager.readUploadFiles(attachments);
    if (files.length === 0) return null;

    LogManager.addEvent(
      `webview-${provider}`,
      "info",
      `Uploading ${files.length} files using ${fileMethodName}`,
    );

    const fileResult = await fileFn(webview, { files, provider });

    if (!fileResult?.success) {
      LogManager.addEvent(
        `webview-${provider}`,
        "error",
        `File upload failed (${fileMethodName}): ${fileResult?.message || "unknown error"}`,
      );
      throw new Error(fileResult?.message || `${fileMethodName} upload failed`);
    }

    if (!fileResult?.uploadedLinks?.length) {
      LogManager.addEvent(
        `webview-${provider}`,
        "error",
        `File upload returned no links (${fileMethodName}). Raw result: ${JSON.stringify(fileResult)}`,
      );
      throw new Error(
        `${fileMethodName} upload returned no links. Check Google Drive auth and IPC response.`,
      );
    }

    return fileResult;
  }

  /**
   * Direct dosya yükleme (injection, dragdrop, xdotools)
   * @private
   */
  async _handleDirectUpload(webview, provider, attachments, fileFn, fileMethodName) {
    const files = await FileManager.readUploadFiles(attachments);
    if (files.length === 0) return null;

    LogManager.addEvent(
      `webview-${provider}`,
      "info",
      `Attaching ${files.length} files using ${fileMethodName}`,
    );

    const fileResult = await fileFn(webview, { files, provider });

    if (!fileResult?.success) {
      LogManager.addEvent(
        `webview-${provider}`,
        "warning",
        `File attachment failed: ${fileResult?.message}`,
      );
    }

    return fileResult;
  }

  /**
   * Send button'a tıkla
   * @private
   */
  async _triggerSendButton(webview, provider, providerId) {
    const providerConfig = ProviderRegistry.get(providerId);

    if (!providerConfig?.selectors?.sendButton) {
      throw new Error(`Provider config bulunamadı: providerId="${providerId}", provider="${provider}", hasConfig=${!!providerConfig}, hasSelectors=${!!providerConfig?.selectors}`);
    }

    const sendSel = JSON.stringify(providerConfig.selectors.sendButton);
    
    // Retry logic - dosya yüklemesi sonrası buton gecikmeli aktif olabilir
    const maxRetries = 10;
    const retryInterval = 500;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const script = `(function() {
        const sendButton = document.querySelector(${sendSel});
        if (!sendButton) {
          return { success: false, message: 'send button not found', retry: true };
        }
        
        // Kapsamlı disabled kontrolü
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

      const res = await webview.executeJavaScript(script);
      
      if (res?.success) {
        return; // Başarılı
      }
      
      if (!res?.retry || attempt >= maxRetries - 1) {
        LogManager.addEvent(
          `webview-${provider}`,
          "warning",
          `Send button trigger failed: ${res?.message}, debug: ${JSON.stringify(res?.debug || {})}`,
        );
        throw new Error("Send butonu tetiklenemedi");
      }
      
      // Retry için bekle
      await new Promise(resolve => setTimeout(resolve, retryInterval));
    }
    
    throw new Error("Send butonu tetiklenemedi (max retries)");
  }

}

export const MessageSender = new MessageSenderClass();
