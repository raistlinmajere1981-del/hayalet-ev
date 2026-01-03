// @ts-nocheck
import { LogManager } from "./log-manager.js";
import { TrafficManager } from "./traffic-manager.js";
import { FileManager } from "./file-manager.js";
import { CatchManager } from "./catch-manager.js";
import { AppState } from "./app-state.js";
import { ProviderRegistry } from "./webview/provider-registry.js";
import { getProvider } from "./webview/provider-factory.js";
import { waitForDomReady, normalizeUrl } from "../app.js";

class WebviewManagerClass {
  constructor() {
    this.settings = null;
    this.webviews = {};
    this._detachTimers = {};
    this._syncInProgress = {};
  }

  setSettings(settings) {
    this.settings = settings;
  }

  register(provider, webview) {
    if (!provider || !webview) return;
    this.webviews[provider] = webview;
  }

  getProviderModule(providerSlot) {
    const providerId = this.settings?.[providerSlot]?.providerId;
    return providerId ? getProvider(providerId) : null;
  }

  isUrlExcluded(providerSlot, url) {
    const providerId = this.settings?.[providerSlot]?.providerId;
    if (!providerId || !url) return false;

    const cfg = ProviderRegistry.get(providerId);
    if (!cfg?.excludedUrls?.length) return false;

    const normalizedUrl = url.split("?")[0].split("#")[0].replace(/\/+$/, "");

    for (const excluded of cfg.excludedUrls) {
      const normalizedExcluded = excluded
        .split("?")[0]
        .split("#")[0]
        .replace(/\/+$/, "");

      if (excluded.includes("*")) {
        const pattern = normalizedExcluded.replace(/\*/g, ".*");
        const regex = new RegExp(`^${pattern}$`);
        if (regex.test(normalizedUrl)) return true;
      } else {
        if (normalizedUrl === normalizedExcluded) return true;
      }
    }

    return false;
  }

  getAccountForSlot(slot) {
    const activeAccountId = this.settings?.[slot]?.activeAccountId;
    if (!activeAccountId || !Array.isArray(this.settings?.accounts)) {
      return null;
    }
    return this.settings.accounts.find((acc) => acc.id === activeAccountId);
  }

  attach(provider, webview, _opts = {}) {
    if (!provider || !webview) return;
    try {
      if (this._detachTimers[provider]) {
        clearTimeout(this._detachTimers[provider]);
        delete this._detachTimers[provider];
      }
    } catch (e) {
      /* noop */
    }

    this.register(provider, webview);
    try {
      if (webview.getAttribute?.("data-detached")) {
        const providerId = this.settings?.[provider]?.providerId;
        if (providerId) {
          const cfg = ProviderRegistry.get(providerId);
          const defaultPage = cfg?.baseUrl || "";

          webview.removeAttribute("data-detached");
          if (webview.style) webview.style.display = "";
          if (defaultPage) webview.setAttribute("src", defaultPage);
        }
      }
      TrafficManager.attachWebview(provider, webview);
      LogManager.addEvent(
        `webview-${provider}`,
        "info",
        "attach: webview attached",
      );
    } catch (err) {
      LogManager.addEvent(
        `webview-${provider}`,
        "error",
        `attach error: ${err.message || err}`,
      );
    }
  }

  detach(provider, { force = false, cleanupDom = true, graceMs = 0 } = {}) {
    if (!provider) return;
    const doDetach = () => {
      const w = this.webviews[provider];
      try {
        TrafficManager.stop(provider, { force: true });
        TrafficManager.detachWebview(provider);
        if (w && cleanupDom) {
          w.setAttribute("data-detached", "1");
          if (w.style) w.style.display = "none";
          w.removeAttribute("src");
        }
      } catch (err) {
        /* noop */
      } finally {
        delete this.webviews[provider];
        LogManager.addEvent(
          `webview-${provider}`,
          "info",
          `detached (cleanup=${!!cleanupDom})`,
        );
      }
    };

    if (force || !graceMs) {
      doDetach();
    } else {
      this._detachTimers[provider] = setTimeout(() => {
        delete this._detachTimers[provider];
        doDetach();
      }, graceMs);
      LogManager.addEvent(
        `webview-${provider}`,
        "info",
        `scheduled detach in ${graceMs}ms`,
      );
    }
  }

  resolveWebview(provider) {
    if (this.webviews[provider]) return this.webviews[provider];
    const fallbackId = provider === "ai2" ? "ai2-webview" : "ai1-webview";
    const found = document.getElementById(fallbackId);
    if (found) this.webviews[provider] = found;
    return found;
  }

  async send({ provider, text, attachments = [] }) {
    const webview = this.resolveWebview(provider);
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

    const providerId = this.settings?.[provider]?.providerId;
    if (!providerId) {
      throw new Error(
        `Provider ID for "${provider}" not configured in settings.`,
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

    const messageMethodName = this.settings?.[provider]?.messageMethod;
    if (!messageMethodName) {
      throw new Error(
        `messageMethod is not configured for provider "${provider}"`,
      );
    }
    const fileMethodName = this.settings?.[provider]?.fileMethod;
    if (!fileMethodName) {
      throw new Error(
        `fileMethod is not configured for provider "${provider}"`,
      );
    }

    const messageFn =
      messageMethodName === "xdotools"
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
    } catch (e) {
      /* noop */
    }

    const isLinkBased = ["tmpfile", "catbox", "uguu", "googledrive"].includes(
      fileMethodName,
    );

    let finalMessage = text || "";
    let fileResult = null;
    let fileLinks = null;

    // STEP 1: If link-based and has attachments, upload files first to get links
    if (attachments?.length > 0 && isLinkBased) {
      const files = await FileManager.readUploadFiles(attachments);
      if (files.length > 0) {
        LogManager.addEvent(
          `webview-${provider}`,
          "info",
          `Uploading ${files.length} files using ${fileMethodName}`,
        );
        fileResult = await fileFn(webview, { files, provider });

        // Link-based uploads MUST return links. Otherwise we should not continue silently
        // (it may lead to sending an empty message).
        if (!fileResult?.success) {
          LogManager.addEvent(
            `webview-${provider}`,
            "error",
            `File upload failed (${fileMethodName}): ${fileResult?.message || "unknown error"}`,
          );
          throw new Error(
            fileResult?.message || `${fileMethodName} upload failed`,
          );
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

        fileLinks = fileResult.uploadedLinks;
        const linkText = fileLinks
          .map((l) => `[${l.name}](${l.url})`)
          .join("\n");
        finalMessage = finalMessage.trim()
          ? `${finalMessage}\n${linkText}`
          : linkText;
      }
    }

    // STEP 2: Attach files (non-link based: injection, xdotools, dragdrop)
    if (attachments?.length > 0 && !isLinkBased) {
      const files = await FileManager.readUploadFiles(attachments);
      if (files.length > 0) {
        LogManager.addEvent(
          `webview-${provider}`,
          "info",
          `Attaching ${files.length} files using ${fileMethodName}`,
        );
        fileResult = await fileFn(webview, { files, provider });

        if (!fileResult?.success) {
          LogManager.addEvent(
            `webview-${provider}`,
            "warning",
            `File attachment failed: ${fileResult?.message}`,
          );
        }
      }
    }

    // STEP 3: Add message to input field (after files are attached)
    if (finalMessage.trim().length > 0) {
      LogManager.addEvent(
        `webview-${provider}`,
        "info",
        `Adding message to input field using ${messageMethodName}`,
      );
      const sendResult = await messageFn(webview, { message: finalMessage });
      if (!sendResult?.success) {
        throw new Error(
          sendResult?.message || "Mesaj metin alanına yazılamadı.",
        );
      }
    }

    // STEP 4: Wait for send button to be enabled (after all operations complete)
    LogManager.addEvent(
      `webview-${provider}`,
      "info",
      `Waiting for send button to be enabled...`,
    );
    await TrafficManager.waitForSendEnabled(provider, 20000);

    // STEP 5: Trigger send button click
    LogManager.addEvent(
      `webview-${provider}`,
      "info",
      `Triggering send button...`,
    );
    const providerConfig = ProviderRegistry.get(providerId);

    if (!providerConfig?.selectors?.sendButton) {
      throw new Error("Provider config veya sendButton selector bulunamadı");
    }

    const sendSel = JSON.stringify(providerConfig.selectors.sendButton);
    const script = `(function() {
      const sendButton = document.querySelector(${sendSel});
      if (sendButton && !sendButton.disabled) {
        sendButton.click();
        return { success: true, message: 'send clicked' };
      }
      return { success: false, message: 'send button not found or disabled' };
    })();`;

    const res = await webview.executeJavaScript(script);
    if (!res?.success) {
      throw new Error("Send butonu tetiklenemedi");
    }

    return {
      success: true,
      message: "Gönderim başarılı",
      files: fileResult,
    };
  }

  async syncConversation(provider, webview, options = {}) {
    const targetWebview = webview || this.resolveWebview(provider);
    if (!targetWebview) {
      LogManager.addEvent(`webview-${provider}`, "error", "Webview bulunamadı");
      return { success: false, message: "Webview bulunamadı" };
    }

    const currentUrl = targetWebview.getURL?.() || "";
    if (this.isUrlExcluded(provider, currentUrl)) {
      LogManager.addEvent(
        `webview-${provider}`,
        "warning",
        `URL excluded: ${currentUrl}, sync operation disabled`,
      );
      return { success: false, message: "URL excluded from operations" };
    }

    if (this._syncInProgress[provider]) {
      LogManager.addEvent(
        `webview-${provider}`,
        "info",
        "sync skipped: already in progress",
      );
      return { success: false, message: "sync-in-progress" };
    }
    this._syncInProgress[provider] = true;

    try {
      await waitForDomReady(targetWebview);

      const providerModule = this.getProviderModule(provider);
      if (
        !providerModule ||
        typeof providerModule.scrapeMessages !== "function"
      ) {
        throw new Error(
          `Provider module or scrapeMessages function for "${provider}" not found.`,
        );
      }

      const messages = await targetWebview.executeJavaScript(
        `(${providerModule.scrapeMessages.toString()})();`,
      );

      const rawUrl = targetWebview.getURL() || "";
      const webUrl = normalizeUrl(rawUrl);

      const { existing, prevCount, newEntry } = await this._getArchiveStatus(
        provider,
        webUrl,
      );

      if (!messages || messages.length === 0) {
        this._syncInProgress[provider] = false;
        return {
          success: true,
          count: 0,
          messages: [],
          commands: [],
          webUrl,
          newEntry: false,
        };
      }

      const authors = {
        user: AppState.getNickname("human"),
        ai: AppState.getNickname(provider),
      };

      const normalized = messages.map((m) => ({
        ...m,
        author: m.role === "assistant" ? authors.ai : authors.user,
        ts: Date.now(),
      }));

      const catchEnabled =
        options.catchEnabled ??
        this.settings?.[provider]?.catchCommands ??
        true;
      const commands = catchEnabled
        ? await CatchManager.catchCommands({
            provider,
            webUrl,
            messages: normalized,
            prevCount,
            hasExisting: !!existing,
          })
        : [];

      const accountInfo = this.getAccountForSlot?.(provider) || null;
      const archiveResult = await window.electronAPI.archiveSync({
        provider,
        webUrl,
        messages: normalized,
        authors,
        updateIndex: newEntry,
        accountInfo,
      });

      if (!archiveResult?.success) {
        throw new Error(archiveResult?.error || "Archive sync failed");
      }

      return {
        success: true,
        count: normalized.length,
        messages: normalized,
        commands,
        webUrl,
        newEntry,
        meta: archiveResult.meta,
      };
    } catch (error) {
      LogManager.addEvent(
        `webview-${provider}`,
        "error",
        `Sync failed: ${error.message}`,
      );
      return { success: false, message: error.message };
    } finally {
      this._syncInProgress[provider] = false;
    }
  }

  // normalizeUrl now provided by `src/js/app.js`

  async _getArchiveStatus(provider, webUrl) {
    try {
      const indexList = await window.electronAPI.readArchivesIndex();
      const existing =
        indexList.find(
          (item) =>
            item.provider === provider && normalizeUrl(item.webUrl) === webUrl,
        ) || null;
      return {
        existing,
        prevCount: existing?.messageCount || 0,
        newEntry: !existing,
      };
    } catch (error) {
      return { existing: null, prevCount: 0, newEntry: false };
    }
  }
}

export const WebviewManager = new WebviewManagerClass();
