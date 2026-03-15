import { LogCategory } from "@shared/logging-core";
import { getErrorMessage } from "@shared/index.js";
import type { TranslationParams } from "@shared/i18n.js";
import { SettingsManager } from "../modules/settings-manager.js";
import { TrafficManager } from "../modules/traffic-manager.js";
import { CoreEngine } from "../modules/core-engine.js";
import { Logger } from "../modules/logger/index.js";
import { AppState } from "../modules/app-state.js";
import { AppI18n } from "../modules/i18n/index.js";
import { ConversationListManager } from "../modules/conversation-list-manager.js";
import { getMimeTypeFromPath } from "../constants/index.js";
import { SlotController, SlotEvent } from "../modules/slot-controller.js";
import { ButtonStates } from "../ui/button-states.js";
import { isAssistantAccountsSettingsPath, isAssistantSlotSettingsPath } from "@shared/settings.js";
import type { Us1RoomPackageCandidate } from "@shared/us1-mail.js";

import { renderMessages, resetMessageRenderState } from "./analyze/message-renderer.js";
import type { RenderCallbacks } from "./analyze/message-renderer.js";
import { createMessageBubble } from "./analyze/message-renderer-bubble.js";
import {
  isAttachmentData,
  isDbAttachmentsResult,
  isDbMessagesResult,
  isMessageItem,
  type AttachmentData,
  type MessageItem,
} from "./analyze/message-renderer-types.js";
import { renderUploadList, addUploadFiles, removeUploadFile } from "./analyze/upload-handler.js";
import type { StagedFile } from "./analyze/upload-handler.js";
import { applyMessageAction, initReadModal } from "./analyze/context-menu.js";
import { initDraft, loadDraft, persistDraft } from "./analyze/draft-manager.js";

interface ConversationSelectedDetail {
  provider?: "ai1" | "ai2" | "us1";
  isNew?: boolean;
  localSessionId?: string | null;
}

interface DraftState {
  message: string;
  files: StagedFile[];
}

type AnalyzeParticipant = "ai1" | "ai2" | "us1";

function analyzeT(key: string, params?: TranslationParams): string {
  return AppI18n.t(`app.analyze.${key}`, params);
}

function isConversationSelectedDetail(value: unknown): value is ConversationSelectedDetail {
  if (value === null || value === undefined || typeof value !== "object") {
    return false;
  }

  const maybe = value as Record<string, unknown>;
  const provider = maybe["provider"];
  const isNew = maybe["isNew"];

  const providerValid =
    provider === undefined || provider === "ai1" || provider === "ai2" || provider === "us1";
  const isNewValid = isNew === undefined || typeof isNew === "boolean";
  const localSessionIdValid =
    maybe["localSessionId"] === undefined ||
    maybe["localSessionId"] === null ||
    typeof maybe["localSessionId"] === "string";

  return providerValid && isNewValid && localSessionIdValid;
}

function isDraftState(value: unknown): value is DraftState {
  if (value === null || value === undefined || typeof value !== "object") {
    return false;
  }

  const maybe = value as Record<string, unknown>;
  return typeof maybe["message"] === "string" && Array.isArray(maybe["files"]);
}

export class AnalyzeController {
  stagedFiles: StagedFile[];
  lastMessages: Record<AnalyzeParticipant, string>;
  us1SessionId: string | null;
  us1SessionIdentityId: string | null;
  _slotActiveStates: Record<AnalyzeParticipant, boolean>;
  beforeUnloadHandler: (() => void) | null;
  _unsubSettings: (() => void) | null;
  _unsubSlotController: (() => void) | null;
  _unsubAppState: (() => void) | null;
  _unsubI18n: (() => void) | null;
  _boundActions: boolean;
  _us1PollTimer: number | null;
  _us1SyncInFlight: boolean;
  _us1LoadingBusy: boolean;
  _us1SendBusy: boolean;
  _us1AwaitingReply: boolean;
  _syncingUs1Indicators: boolean;

  constructor() {
    this.stagedFiles = [];
    this.lastMessages = { ai1: "", ai2: "", us1: "" };
    this.us1SessionId = null;
    this.us1SessionIdentityId = null;
    this._slotActiveStates = { ai1: false, ai2: false, us1: false };
    this.beforeUnloadHandler = null;
    this._unsubSettings = null;
    this._unsubSlotController = null;
    this._unsubAppState = null;
    this._unsubI18n = null;
    this._boundActions = false;
    this._us1PollTimer = null;
    this._us1SyncInFlight = false;
    this._us1LoadingBusy = false;
    this._us1SendBusy = false;
    this._us1AwaitingReply = false;
    this._syncingUs1Indicators = false;
  }

  async init(): Promise<void> {
    await this.loadSettings();
    this.applyAvatars();
    this.applyNames();

    this._unsubSettings ??= SettingsManager.subscribe(
      ({ changedPaths }: { changedPaths: string[] }) => {
        const shouldRefreshAnalyzeHeader =
          changedPaths.includes("*") ||
          changedPaths.some(
            (path) =>
              path.startsWith("user") ||
              path.startsWith("accounts") ||
              path.startsWith("remoteUsers") ||
              isAssistantAccountsSettingsPath(path) ||
              path.startsWith("slots") ||
              path.startsWith("us1Slot") ||
              isAssistantSlotSettingsPath(path)
          );

        if (!shouldRefreshAnalyzeHeader) {
          return;
        }

        this.applyAvatars();
        this.applyNames();
        this.updateConnectionStates();
      }
    );

    this.bindActions();
    TrafficManager.onUpdate(() => {
      this.updateSendButtonState();
    });

    this._unsubSlotController ??= SlotController.on(SlotEvent.STATE_CHANGED, () => {
      this.applyNames();
      this.updateConnectionStates();
    });

    this._unsubAppState ??= AppState.subscribe(() => {
      this.applyNames();
    });

    this._unsubI18n ??= AppI18n.subscribe(() => {
      this.applyNames();
      this.updateConnectionStates();
      this.refreshUploads();
      void this._renderMessages("ai1");
      void this._renderMessages("ai2");
      void this._renderUs1Messages();
    });

    this.updateConnectionStates();
    this.refreshUploads();

    initReadModal();
    void this._initDraftSystem();

    window.addEventListener("conversation-selected", (e) => {
      const rawDetail: unknown = (e as CustomEvent<unknown>).detail;
      const detail = isConversationSelectedDetail(rawDetail) ? rawDetail : {};
      Logger.debug(LogCategory.ANALYZE, analyzeT("logs.conversationSelectedReceived"), { detail });
      if (detail.provider !== undefined) {
        if (detail.isNew === true) {
          Logger.debug(
            LogCategory.ANALYZE,
            analyzeT("logs.newConversationSelected", { provider: detail.provider })
          );
          this._clearSlotMessages(detail.provider);
        } else if (detail.provider === "us1") {
          this.us1SessionId =
            typeof detail.localSessionId === "string" && detail.localSessionId.trim() !== ""
              ? detail.localSessionId.trim()
              : null;
          void this._renderUs1Messages();
        } else {
          Logger.debug(
            LogCategory.ANALYZE,
            analyzeT("logs.renderMessagesForProvider", { provider: detail.provider })
          );
          void this._renderMessages(detail.provider);
        }
      } else {
        Logger.warn(LogCategory.ANALYZE, analyzeT("logs.conversationSelectedMissingProvider"), {
          detail,
        });
      }
    });
  }

  async loadSettings(): Promise<void> {
    await SettingsManager.load();
  }

  applyAvatars(): void {
    const avatarTargets: Array<{
      provider: "user" | "ai1" | "ai2" | "us1";
      elementId: string;
      fallbackText?: string;
    }> = [
      { provider: "ai1", elementId: "avatar-ai1" },
      { provider: "ai2", elementId: "avatar-ai2" },
      { provider: "us1", elementId: "avatar-us1", fallbackText: "US" },
      { provider: "user", elementId: "avatar-user-compose", fallbackText: "U" },
    ];

    avatarTargets.forEach(({ provider, elementId, fallbackText = "" }) => {
      const configuredPath = AppState.getAvatar(provider).trim();
      const isUser = provider === "user";
      const isUs1 = provider === "us1";
      const slotAssigned = isUser
        ? true
        : isUs1
          ? AppState.hasUs1Identity()
          : AppState.getAccountForSlot(provider) !== null;

      const el = document.getElementById(elementId);
      if (!el) return;

      if (!slotAssigned) {
        el.textContent = "";
        el.innerHTML = "";
        return;
      }

      const electronApi = window.electronAPI;
      if (electronApi === undefined) {
        el.textContent = fallbackText;
        return;
      }

      const fallbackCandidates: string[] = [];
      if (isUser) {
        fallbackCandidates.push("src/assets/user.png", "src/assets/default.png");
      } else {
        const providerId = isUs1 ? "" : AppState.getProviderIdForSlot(provider) ?? "";
        if (providerId !== "") {
          fallbackCandidates.push(`src/assets/${providerId}.png`);
        }
        fallbackCandidates.push("src/assets/default.png");
      }

      const candidates = [configuredPath, ...fallbackCandidates];
      const filteredCandidates = candidates.filter(
        (candidate, index, arr) => candidate !== "" && arr.indexOf(candidate) === index
      );


      const tryLoad = (index: number): void => {
        const candidate = filteredCandidates[index];
        if (candidate === undefined) {
          el.textContent = fallbackText;
          return;
        }

        electronApi
          .readFile(candidate)
          .then((data) => {
            const base64 = String(data ?? "");
            if (base64 === "") {
              tryLoad(index + 1);
              return;
            }

            const mime = getMimeTypeFromPath(candidate);
            el.innerHTML = `<img src="data:${mime};base64,${base64}" alt="${provider} avatar" class="img-cover" />`;
          })
          .catch(() => {
            tryLoad(index + 1);
          });
      };

      tryLoad(0);
    });
  }

  applyNames(): void {
    const nickUser = AppState.getNickname("user");
    const nickAi1 = AppState.getNickname("ai1");
    const nickAi2 = AppState.getNickname("ai2");
    const nickUs1 = AppState.getNickname("us1");

    const nameAi1 = document.getElementById("name-ai1");
    const nameAi2 = document.getElementById("name-ai2");
    const nameUs1 = document.getElementById("name-us1");
    if (nameAi1) nameAi1.textContent = nickAi1;
    if (nameAi2) nameAi2.textContent = nickAi2;
    if (nameUs1) nameUs1.textContent = nickUs1;

    const sendLabelAi1 = document.getElementById("send-ai1-label");
    const sendLabelAi2 = document.getElementById("send-ai2-label");
    const sendLabelUs1 = document.getElementById("send-us1-label");
    const nameUserCompose = document.getElementById("name-user-compose");
    if (sendLabelAi1) sendLabelAi1.textContent = nickAi1;
    if (sendLabelAi2) sendLabelAi2.textContent = nickAi2;
    if (sendLabelUs1) sendLabelUs1.textContent = nickUs1;
    if (nameUserCompose) nameUserCompose.textContent = nickUser;
  }

  _syncUs1IdentityContext(): void {
    const identityId = AppState.getUs1ArchiveAccountId();
    if (identityId === this.us1SessionIdentityId) {
      return;
    }

    this.us1SessionIdentityId = identityId;
    this.us1SessionId = null;
    this.lastMessages.us1 = "";
    AppState.setActiveConversation("us1", null);
  }

  _createUs1LocalSessionId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  _ensureUs1LocalSessionId(): string | null {
    this._syncUs1IdentityContext();
    if (this.us1SessionIdentityId === null) {
      return null;
    }

    if (this.us1SessionId === null || this.us1SessionId === "") {
      this.us1SessionId = this._createUs1LocalSessionId();
    }

    return this.us1SessionId;
  }

  updateConnectionStates(): void {
    this._syncUs1IdentityContext();

    const composeInput = document.getElementById("compose-input") as HTMLTextAreaElement | null;
    const uploadBtn = document.getElementById("upload-add-btn") as HTMLButtonElement | null;
    const sendBtn = document.getElementById("compose-send-btn") as HTMLButtonElement | null;
    if (composeInput) composeInput.disabled = false;
    if (uploadBtn) uploadBtn.disabled = false;
    if (sendBtn) sendBtn.disabled = false;

    const ai1Connected = SlotController.isConnected("ai1");
    const ai2Connected = SlotController.isConnected("ai2");
    const ai1HasAccount = !!AppState.getAccountForSlot("ai1");
    const ai2HasAccount = !!AppState.getAccountForSlot("ai2");
    const us1Connected = AppState.isUs1Connected();
    const us1HasIdentity = AppState.hasUs1Identity();
    if (us1Connected === false) {
      this._us1AwaitingReply = false;
    }

    (["ai1", "ai2", "us1"] as const).forEach((slot) => {
      const hasAccount =
        slot === "ai1" ? ai1HasAccount : slot === "ai2" ? ai2HasAccount : us1HasIdentity;
      const connected =
        slot === "ai1" ? ai1Connected : slot === "ai2" ? ai2Connected : us1Connected;
      const isActive = hasAccount && connected;
      const wasActive = this._slotActiveStates[slot];

      this._updateSlotUI(slot, hasAccount, connected);

      if (wasActive && !isActive) {
        this._clearSlotMessages(slot);
      }

      this._slotActiveStates[slot] = isActive;
    });

    this._applyUs1Indicators(us1Connected);

    this._updateGridLayout({
      ai1: ai1HasAccount,
      ai2: ai2HasAccount,
      us1: us1HasIdentity,
    });
    void this._renderUs1Messages();

    this._updateAIAIControls();
  }

  _updateSlotUI(slot: string, hasAccount: boolean, connected: boolean): void {
    const card = document.getElementById(`card-${slot}`);
    const status = document.getElementById(`status-${slot}`);
    const sendToggle = document.getElementById(`send-${slot}`);

    if (status) {
      if (!hasAccount) status.textContent = analyzeT("page.slotEmptyStatus");
      else if (connected) status.textContent = analyzeT("page.connectedStatus");
      else status.textContent = analyzeT("page.disconnectedStatus");
    }

    if (card) {
      card.classList.toggle("slot-empty", !hasAccount);
      card.classList.toggle("slot-disconnected", hasAccount && !connected);
      card.classList.toggle("slot-connected", hasAccount && connected);
    }

    if (sendToggle) {
      (sendToggle as HTMLInputElement).disabled = !hasAccount || !connected;
      if (!hasAccount || !connected) (sendToggle as HTMLInputElement).checked = false;
    }
  }

  _updateGridLayout(participants: Record<AnalyzeParticipant, boolean>): void {
    const grid = document.querySelector(".conversation-grid");
    const cardAi1 = document.getElementById("card-ai1");
    const cardAi2 = document.getElementById("card-ai2");
    const cardUs1 = document.getElementById("card-us1");

    if (!grid) return;

    const configuredParticipants = (
      Object.entries(participants) as Array<[AnalyzeParticipant, boolean]>
    )
      .filter(([, visible]) => visible)
      .map(([slot]) => slot);
    const fallbackParticipants: AnalyzeParticipant[] = ["ai1", "ai2"];
    const visibleParticipants =
      configuredParticipants.length > 0 ? configuredParticipants : fallbackParticipants;
    const participantCount = Math.min(3, Math.max(1, visibleParticipants.length));

    grid.classList.remove("participant-count-1", "participant-count-2", "participant-count-3");
    grid.classList.add(`participant-count-${participantCount}`);

    if (cardAi1) cardAi1.classList.toggle("is-hidden", !visibleParticipants.includes("ai1"));
    if (cardAi2) cardAi2.classList.toggle("is-hidden", !visibleParticipants.includes("ai2"));
    if (cardUs1) cardUs1.classList.toggle("is-hidden", !visibleParticipants.includes("us1"));
  }

  _updateAIAIControls(): void {
    const ai1Assigned = !!AppState.getAccountForSlot("ai1");
    const ai2Assigned = !!AppState.getAccountForSlot("ai2");
    const ai1Connected = SlotController.isConnected("ai1") === true;
    const ai2Connected = SlotController.isConnected("ai2") === true;
    const bothAIsConnected = ai1Connected && ai2Connected;
    const aiChatEnabled = ai1Assigned && ai2Assigned && bothAIsConnected;

    const analyzeBtn = document.getElementById("compose-start-btn") as HTMLButtonElement | null;
    if (analyzeBtn) analyzeBtn.disabled = !aiChatEnabled;

    const analyzeStopBtn = document.getElementById("compose-stop-btn") as HTMLButtonElement | null;
    if (analyzeStopBtn) analyzeStopBtn.disabled = !aiChatEnabled;

    this._updateCrossCheckboxState();
  }

  bindActions(): void {
    if (this._boundActions) return;
    this._boundActions = true;

    document.getElementById("compose-start-btn")?.addEventListener("click", () => {
      void this.handleAnalyzeStart();
    });

    document.getElementById("compose-stop-btn")?.addEventListener("click", () => {
      void this.handleAnalyzeStop();
    });

    // NOTE: Prevent duplicate sends while the button is already loading.
    const sendBtn = document.getElementById("compose-send-btn") as HTMLButtonElement | null;
    if (sendBtn) {
      sendBtn.addEventListener("click", () => {
        if (ButtonStates.isLoading(sendBtn)) {
          Logger.debug(LogCategory.ANALYZE, analyzeT("logs.sendIgnoredWhileLoading"));
          return;
        }
        this.handleSend();
      });
    }

    document.getElementById("upload-add-btn")?.addEventListener("click", () => {
      void this.handleUploadClick();
    });
    document.getElementById("compose-input")?.addEventListener("input", () => {
      this.updateSendButtonState();
    });

    // NOTE: Allow Ctrl+Enter sends while still preventing duplicate dispatches.
    document.getElementById("compose-input")?.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        const sendBtn = document.getElementById("compose-send-btn") as HTMLButtonElement | null;
        if (sendBtn && ButtonStates.isLoading(sendBtn)) {
          Logger.debug(LogCategory.ANALYZE, analyzeT("logs.sendShortcutIgnoredWhileLoading"));
          return;
        }
        this.handleSend();
      }
    });

    ["send-ai1", "send-ai2", "send-us1", "send-cross"].forEach((id) => {
      document.getElementById(id)?.addEventListener("change", () => {
        this.updateSendButtonState();
      });
    });
  }

  _clearSlotMessages(provider: string): void {
    if (provider === "ai1" || provider === "ai2") {
      resetMessageRenderState(provider);
    } else if (provider === "us1") {
      this.us1SessionId = null;
      AppState.setActiveConversation("us1", null);
      this._us1AwaitingReply = false;
      this._applyUs1Indicators(AppState.isUs1Connected());
    }
    const container = document.getElementById(`messages-${provider}`);
    if (container) {
      container.innerHTML = "";
    }
    if (provider === "ai1" || provider === "ai2" || provider === "us1") {
      this.lastMessages[provider] = "";
    }
    Logger.info(LogCategory.ANALYZE, analyzeT("logs.slotMessagesCleared", { provider }));
  }

  async _renderMessages(provider: "ai1" | "ai2"): Promise<void> {
    Logger.debug(LogCategory.ANALYZE, analyzeT("logs.renderMessagesStarted", { provider }));
    const callbacks: RenderCallbacks = {
      onMessageAction: (action, payload: { provider: string; text: string }) => {
        applyMessageAction(action, payload, () => {
          this.updateSendButtonState();
        });
      },
    };
    const result = await renderMessages(provider, callbacks);
    Logger.debug(LogCategory.ANALYZE, analyzeT("logs.renderMessagesCompleted", { provider }), {
      lastMessage: result.lastMessage.substring(0, 50),
    });
    this.lastMessages[provider] = result.lastMessage;
  }

  async _renderUs1Messages(): Promise<void> {
    const container = document.getElementById("messages-us1");
    if (!(container instanceof HTMLElement)) {
      return;
    }

    const electronApi = window.electronAPI;
    const accountId = AppState.getUs1ArchiveAccountId();
    const conversationId = AppState.getState().activeConversations["us1"] ?? null;
    if (
      electronApi === undefined ||
      typeof electronApi.dbGetMessages !== "function" ||
      typeof electronApi["dbGetAttachments"] !== "function" ||
      accountId === null ||
      conversationId === null
    ) {
      container.innerHTML = "";
      const placeholder = document.createElement("div");
      placeholder.className = "message-placeholder";
      placeholder.textContent = analyzeT("page.noMessages");
      container.appendChild(placeholder);
      this.lastMessages.us1 = "";
      this._us1AwaitingReply = false;
      this._applyUs1Indicators(AppState.isUs1Connected());
      return;
    }

    const rawMessages = await electronApi.dbGetMessages({ accountId, conversationId });
    const rawAttachments = await electronApi["dbGetAttachments"]({ accountId, conversationId });
    const messagesResult = isDbMessagesResult(rawMessages) ? rawMessages : {};
    const attachmentsResult = isDbAttachmentsResult(rawAttachments) ? rawAttachments : {};
    const rawMessageItems = Array.isArray(messagesResult.data)
      ? (messagesResult.data as unknown[])
      : [];
    const rawAttachmentItems = Array.isArray(attachmentsResult.data)
      ? (attachmentsResult.data as unknown[])
      : [];
    const messages = rawMessageItems.filter((message): message is MessageItem =>
      isMessageItem(message)
    );
    const attachments = rawAttachmentItems.filter((attachment): attachment is AttachmentData =>
      isAttachmentData(attachment)
    );

    container.innerHTML = "";

    if (messages.length === 0) {
      const placeholder = document.createElement("div");
      placeholder.className = "message-placeholder";
      placeholder.textContent = analyzeT("page.noMessages");
      container.appendChild(placeholder);
      this.lastMessages.us1 = "";
      this._us1AwaitingReply = false;
      this._applyUs1Indicators(AppState.isUs1Connected());
      return;
    }

    const attachmentsByMessage = attachments.reduce<Record<string, AttachmentData[]>>(
      (acc, attachment) => {
        acc[attachment.messageId] ??= [];
        acc[attachment.messageId]?.push(attachment);
        return acc;
      },
      {}
    );
    const callbacks: RenderCallbacks = {
      onMessageAction: (action, payload: { provider: string; text: string }) => {
        applyMessageAction(action, payload, () => {
          this.updateSendButtonState();
        });
      },
    };
    const attachmentsBasePath = `data/${accountId}/attachments/${conversationId}`;

    messages.forEach((message) => {
      container.appendChild(
        createMessageBubble(
          message,
          "us1",
          attachmentsBasePath,
          attachmentsByMessage[message.id] ?? [],
          callbacks
        )
      );
    });

    const lastAssistant = [...messages]
      .reverse()
      .find(
        (message) =>
          message.role === "assistant" && (message.content ?? message.text ?? "").trim() !== ""
      );
    const lastMeaningful = [...messages].reverse().find((message) => {
      const text = (message.content ?? message.text ?? "").trim();
      return text !== "" && (message.role === "assistant" || message.role === "user");
    });
    this.lastMessages.us1 = lastAssistant?.content ?? lastAssistant?.text ?? "";
    this._us1AwaitingReply = lastMeaningful?.role === "user";
    container.scrollTop = container.scrollHeight;
    this._applyUs1Indicators(AppState.isUs1Connected());
  }

  _applyUs1Indicators(connected: boolean): void {
    if (this._syncingUs1Indicators) {
      return;
    }

    this._syncingUs1Indicators = true;
    try {
      TrafficManager.setIndicator("us1", "loading", this._us1LoadingBusy ? "busy" : "idle");
      TrafficManager.setIndicator(
        "us1",
        "thinking",
        connected && this._us1AwaitingReply ? "busy" : "idle"
      );
      TrafficManager.setIndicator("us1", "send", this._isUs1SendReady(connected) ? "idle" : "busy");
    } finally {
      this._syncingUs1Indicators = false;
    }
  }

  _isUs1SendReady(connected: boolean): boolean {
    if (connected === false || this._us1SendBusy === true) {
      return false;
    }

    const analyzePage = document.getElementById("page-analyze");
    const analyzeVisible =
      analyzePage instanceof HTMLElement && !analyzePage.classList.contains("is-hidden");
    if (analyzeVisible === false) {
      return true;
    }

    const sendUs1 =
      (document.getElementById("send-us1") as HTMLInputElement | null)?.checked === true;
    const message = (
      (document.getElementById("compose-input") as HTMLTextAreaElement | null)?.value ?? ""
    ).trim();
    const hasContent = message !== "" || this.stagedFiles.length > 0;
    return sendUs1 && hasContent;
  }

  async _sendUs1Message(message: string, attachments: StagedFile[]): Promise<void> {
    const electronApi = window.electronAPI;
    if (electronApi === undefined || typeof electronApi.us1SendMessage !== "function") {
      throw new Error("US1 mail transport is unavailable.");
    }

    this._syncUs1IdentityContext();
    const localSessionId = this._ensureUs1LocalSessionId();
    if (localSessionId === null) {
      throw new Error("US1 session could not be resolved.");
    }

    this._us1SendBusy = true;
    this._us1AwaitingReply = true;
    this._applyUs1Indicators(AppState.isUs1Connected());

    try {
      const result = await electronApi.us1SendMessage({
        text: message,
        localSessionId,
        attachments: attachments.map((file) => ({
          path: file.path,
          name: file.originalName ?? file.name,
          mimeType: getMimeTypeFromPath(file.path),
        })),
      });

      if (result.success !== true) {
        throw new Error(result.error ?? "US1 outbound send failed.");
      }

      this.us1SessionId = result.localSessionId ?? localSessionId;
      AppState.setActiveConversation("us1", result.conversationId ?? null);
      await ConversationListManager.refresh({
        silent: true,
        provider: "us1",
        ...(typeof result.conversationId === "string" && result.conversationId !== ""
          ? { forceSelectId: result.conversationId }
          : {}),
        skipNotify: true,
      });
      await SettingsManager.reload();
      this.applyAvatars();
      this.applyNames();
      await this._renderUs1Messages();
      await this._syncUs1Messages({ showRoomPackages: true });
    } catch (error) {
      this._us1AwaitingReply = false;
      throw error;
    } finally {
      this._us1SendBusy = false;
      this._applyUs1Indicators(AppState.isUs1Connected());
    }
  }

  async _syncUs1Messages(options: { showRoomPackages?: boolean } = {}): Promise<void> {
    if (this._us1SyncInFlight === true) {
      return;
    }

    const electronApi = window.electronAPI;
    if (
      electronApi === undefined ||
      typeof electronApi.us1SyncMessages !== "function" ||
      AppState.isUs1Connected() !== true
    ) {
      return;
    }

    this._us1SyncInFlight = true;
    this._us1LoadingBusy = true;
    this._applyUs1Indicators(true);

    try {
      const result = await electronApi.us1SyncMessages({
        localSessionId: this.us1SessionId,
      });
      if (result.success !== true) {
        throw new Error(result.error ?? "US1 inbound sync failed.");
      }

      if ((result.fetchedCount ?? 0) > 0 || (result.processedCount ?? 0) > 0) {
        await SettingsManager.reload();
        this.applyAvatars();
        this.applyNames();
      }

      this.us1SessionId = result.localSessionId ?? this.us1SessionId;
      AppState.setActiveConversation("us1", result.conversationId ?? null);
      await ConversationListManager.refresh({
        silent: true,
        provider: "us1",
        ...(typeof result.conversationId === "string" && result.conversationId !== ""
          ? { forceSelectId: result.conversationId }
          : {}),
        skipNotify: true,
      });
      await this._renderUs1Messages();

      if (options.showRoomPackages === true) {
        await this._handleIncomingUs1RoomPackages(result.roomPackages ?? []);
      }
    } catch (error) {
      Logger.warn(LogCategory.ANALYZE, "US1 inbound sync failed", {
        error,
      });
    } finally {
      this._us1SyncInFlight = false;
      this._us1LoadingBusy = false;
      this._applyUs1Indicators(AppState.isUs1Connected());
    }
  }

  async _handleIncomingUs1RoomPackages(roomPackages: Us1RoomPackageCandidate[]): Promise<void> {
    const electronApi = window.electronAPI;
    if (
      electronApi === undefined ||
      typeof electronApi.showMessageBox !== "function" ||
      typeof electronApi.roomsImportBundle !== "function"
    ) {
      return;
    }

    for (const roomPackage of roomPackages) {
      if (roomPackage.storedPath.trim() === "") {
        Logger.warn(LogCategory.ANALYZE, "US1 room package missing attachment path", {
          roomPackage,
        });
        continue;
      }

      // eslint-disable-next-line no-await-in-loop -- NOTE: user confirmations must be sequential.
      const confirmation = await electronApi.showMessageBox({
        type: "question",
        title: "Import room package",
        message: `${roomPackage.originalName} was received from ${AppState.getNickname("us1")}. Import it now?`,
        buttons: ["Import", "Cancel"],
        defaultId: 0,
        cancelId: 1,
      });
      if (confirmation.response !== 0) {
        Logger.warn(LogCategory.ANALYZE, "US1 room package import rejected", {
          roomPackage,
        });
        continue;
      }

      // eslint-disable-next-line no-await-in-loop -- NOTE: keep import order aligned with confirmations.
      const importResult = await electronApi.roomsImportBundle({
        bundleFile: roomPackage.storedPath,
        overwriteWorkspace: true,
      });
      if (importResult.success !== true) {
        Logger.warn(LogCategory.ANALYZE, "US1 room package import failed", {
          roomPackage,
          error: importResult.error,
        });
      }
    }
  }

  _startUs1Polling(): void {
    if (this._us1PollTimer !== null || AppState.isUs1Connected() !== true) {
      return;
    }

    this._us1PollTimer = window.setInterval(() => {
      void this._syncUs1Messages({ showRoomPackages: true });
    }, 30000);
  }

  _stopUs1Polling(): void {
    if (this._us1PollTimer !== null) {
      window.clearInterval(this._us1PollTimer);
      this._us1PollTimer = null;
    }
  }

  refreshUploads(): void {
    this._renderUploadList();
  }

  async handleUploadClick(): Promise<void> {
    const btn = document.getElementById("upload-add-btn") as HTMLButtonElement | null;
    if (btn?.disabled === true) return;
    if (btn) btn.disabled = true;

    try {
      this.stagedFiles = await addUploadFiles(this.stagedFiles);
      this._renderUploadList();
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  _renderUploadList(): void {
    renderUploadList(this.stagedFiles, (name) => {
      this.stagedFiles = removeUploadFile(this.stagedFiles, name);
      this._renderUploadList();
    });
    this.updateSendButtonState();
  }

  async _initDraftSystem(): Promise<void> {
    initDraft();
    this.beforeUnloadHandler = (): void => {
      this._persistDraft();
    };
    window.addEventListener("beforeunload", this.beforeUnloadHandler);

    const draftResult = await loadDraft();
    const draft = isDraftState(draftResult) ? draftResult : { message: "", files: [] };

    const textarea = document.getElementById("compose-input") as HTMLTextAreaElement | null;
    if (textarea !== null && textarea.value.trim() === "") {
      textarea.value = draft.message;
    }
    if (this.stagedFiles.length === 0) {
      this.stagedFiles = draft.files;
    }
    this._renderUploadList();
  }

  _persistDraft(): void {
    const composeInput = document.getElementById("compose-input") as HTMLTextAreaElement | null;
    const message = composeInput ? composeInput.value : "";
    void persistDraft(message, this.stagedFiles);
  }

  handleSend(): void {
    const msg = (
      (document.getElementById("compose-input") as HTMLTextAreaElement | null)?.value ?? ""
    ).trim();
    const hasFiles = this.stagedFiles.length > 0;
    const sendAi1 = (document.getElementById("send-ai1") as HTMLInputElement | null)?.checked;
    const sendAi2 = (document.getElementById("send-ai2") as HTMLInputElement | null)?.checked;
    const sendUs1 = (document.getElementById("send-us1") as HTMLInputElement | null)?.checked;
    const cross = (document.getElementById("send-cross") as HTMLInputElement | null)?.checked;
    const sendBtn = document.getElementById("compose-send-btn") as HTMLButtonElement | null;

    const shouldSendAi1 = sendAi1 === true;
    const shouldSendAi2 = sendAi2 === true;
    const shouldSendUs1 = sendUs1 === true;
    const shouldCross = cross === true;

    if ((!shouldSendAi1 && !shouldSendAi2 && !shouldSendUs1) || (msg === "" && !hasFiles)) return;

    if (sendBtn) {
      ButtonStates.setLoading(sendBtn, analyzeT("page.buttons.sending"));
    }

    Logger.debug(LogCategory.ANALYZE, analyzeT("logs.sendStarting"));

    const targets: string[] = [];
    const textByProvider: Record<string, string> = {};
    const archiveFolders: Record<string, string> = {};

    if (shouldSendAi1) {
      let text = msg;
      if (shouldCross && shouldSendAi2) {
        const otherName = AppState.getNickname("ai2");
        const otherMsg = this.lastMessages.ai2.trim();
        text = otherMsg !== "" ? `${otherName} : ${otherMsg} | ${msg}` : msg;
      }
      textByProvider["ai1"] = text;
      targets.push("ai1");
      archiveFolders["ai1"] = this._getConversationFolder("ai1");
    }

    if (shouldSendAi2) {
      let text = msg;
      if (shouldCross && shouldSendAi1) {
        const otherName = AppState.getNickname("ai1");
        const otherMsg = this.lastMessages.ai1.trim();
        text = otherMsg !== "" ? `${otherName} : ${otherMsg} | ${msg}` : msg;
      }
      textByProvider["ai2"] = text;
      targets.push("ai2");
      archiveFolders["ai2"] = this._getConversationFolder("ai2");
    }

    const texts = targets.map((p) => textByProvider[p] ?? msg);
    const allSame = texts.every((t) => t === texts[0]);
    const attachList = [...this.stagedFiles];

    const sendFlow = async (): Promise<void> => {
      try {
        if (targets.length > 0 && allSame) {
          await CoreEngine.sendBatch({
            targets,
            text: texts[0] ?? "",
            attachments: attachList,
            page: "analyze",
            archiveFolders,
          });
        } else if (targets.length > 0) {
          await targets.reduce(async (prev, provider) => {
            await prev;
            await CoreEngine.sendBatch({
              targets: [provider],
              text: textByProvider[provider] ?? "",
              attachments: attachList,
              page: "analyze",
              archiveFolders,
            });
          }, Promise.resolve());
        }
        if (shouldSendUs1) {
          await this._sendUs1Message(msg, attachList);
        }
        if (sendBtn) {
          ButtonStates.setSuccess(sendBtn, analyzeT("page.buttons.sent"), 1500);
        }
        Logger.success(LogCategory.ANALYZE, analyzeT("logs.sendSuccess"));
      } catch (error) {
        if (sendBtn) {
          ButtonStates.setError(sendBtn, analyzeT("page.buttons.error"), 1500);
        }
        Logger.error(
          LogCategory.ANALYZE,
          analyzeT("logs.sendError", { message: getErrorMessage(error) })
        );
      }
    };

    void sendFlow().finally(() => {
      this.stagedFiles = [];
      this._renderUploadList();
      const composeInput = document.getElementById("compose-input") as HTMLTextAreaElement | null;
      if (composeInput) composeInput.value = "";

      setTimeout(() => {
        this.updateSendButtonState();
      }, 1600);
    });
  }

  async handleAnalyzeStart(): Promise<void> {
    const targets = this._getConnectedAIs();
    if (targets.length === 0) {
      Logger.warn(LogCategory.ANALYZE, analyzeT("logs.protocolSendSkippedNoConnectedAi"));
      return;
    }
    await CoreEngine.sendProtocol({
      room: "analyze",
      scenario: "user-ai-ai",
      targets,
      mode: targets.length >= 2 ? "aiRelay" : "normal",
    });
  }

  async handleAnalyzeStop(): Promise<void> {
    const targets = this._getConnectedAIs();
    if (targets.length === 0) {
      Logger.warn(LogCategory.ANALYZE, analyzeT("logs.protocolStopSkippedNoConnectedAi"));
      return;
    }

    await CoreEngine.sendProtocol({
      room: "analyze",
      scenario: "user-ai-ai-stop",
      targets,
    });
  }

  updateSendButtonState(): void {
    const btn = document.getElementById("compose-send-btn") as HTMLButtonElement | null;
    if (!btn) return;

    const sendAi1 = (document.getElementById("send-ai1") as HTMLInputElement | null)?.checked;
    const sendAi2 = (document.getElementById("send-ai2") as HTMLInputElement | null)?.checked;
    const sendUs1 = (document.getElementById("send-us1") as HTMLInputElement | null)?.checked;
    const hasTarget = sendAi1 === true || sendAi2 === true || sendUs1 === true;
    const message = (
      (document.getElementById("compose-input") as HTMLTextAreaElement | null)?.value ?? ""
    ).trim();
    const hasContent = message !== "" || this.stagedFiles.length > 0;

    btn.disabled = !hasTarget || !hasContent;
    this._updateCrossCheckboxState();
    this._applyUs1Indicators(AppState.isUs1Connected());
  }

  _resetSendTargetsOnShow(): void {
    const sendAi1 = document.getElementById("send-ai1") as HTMLInputElement | null;
    const sendAi2 = document.getElementById("send-ai2") as HTMLInputElement | null;
    const sendUs1 = document.getElementById("send-us1") as HTMLInputElement | null;
    const cross = document.getElementById("send-cross") as HTMLInputElement | null;

    const ai1CanSend =
      AppState.getAccountForSlot("ai1") !== null && SlotController.isConnected("ai1") === true;
    const ai2CanSend =
      AppState.getAccountForSlot("ai2") !== null && SlotController.isConnected("ai2") === true;
    const us1CanSend = AppState.hasUs1Identity() && AppState.isUs1Connected();

    if (sendAi1) {
      sendAi1.checked = ai1CanSend;
    }
    if (sendAi2) {
      sendAi2.checked = ai2CanSend;
    }
    if (sendUs1) {
      sendUs1.checked = !ai1CanSend && !ai2CanSend && us1CanSend;
    }
    if (cross) {
      cross.checked = false;
    }

    this._updateCrossCheckboxState();
  }

  _updateCrossCheckboxState(): void {
    const cross = document.getElementById("send-cross") as HTMLInputElement | null;
    const sendAi1 = document.getElementById("send-ai1") as HTMLInputElement | null;
    const sendAi2 = document.getElementById("send-ai2") as HTMLInputElement | null;

    if (cross && sendAi1 && sendAi2) {
      const bothChecked = sendAi1.checked && sendAi2.checked;
      cross.disabled = !bothChecked;
      if (!bothChecked) cross.checked = false;
    }
  }

  _getConnectedAIs(): string[] {
    const list: string[] = [];
    if (SlotController.isConnected("ai1") === true) list.push("ai1");
    if (SlotController.isConnected("ai2") === true) list.push("ai2");
    return list;
  }

  _getConversationFolder(provider: string): string {
    const select = document.getElementById(`conversation-${provider}`) as HTMLSelectElement | null;
    if (!select) {
      return "";
    }
    const opt = select.selectedOptions[0];
    if (!opt || opt.value === "new") {
      return "";
    }
    return opt.dataset["folder"] ?? "";
  }

  onShow(): void {
    this.refreshUploads();
    this.updateConnectionStates();
    this._resetSendTargetsOnShow();
    this.updateSendButtonState();
    void this._syncUs1Messages({ showRoomPackages: true });
    this._startUs1Polling();
  }

  onHide(): void {
    this._stopUs1Polling();

    try {
      this._persistDraft();
    } catch (_) {}

    if (this.beforeUnloadHandler) {
      window.removeEventListener("beforeunload", this.beforeUnloadHandler);
      this.beforeUnloadHandler = null;
    }
  }
}
