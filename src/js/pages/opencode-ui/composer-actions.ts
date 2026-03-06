import { apiCall } from "./api.js";
import { addMessage } from "./chat-utils.js";
import {
  buildOutgoingAttachmentPreview,
  buildDataUrl,
  createClipboardTextAttachment,
  dedupeComposerAttachments,
  extensionFromMime,
  fileToComposerAttachment,
  renderAttachmentTrayHtml,
} from "./attachments.js";
import { extractAssistantText } from "./message-content.js";
import type { ComposerAttachment, RuntimeState } from "./types.js";

type ByIdFn = <T extends HTMLElement>(
  id: string,
  guard?: (element: T) => boolean
) => T | null;

interface BuildMessageRequestInput {
  text: string;
  modelId: string | null;
  providerId: string | null;
  agentId?: string | null;
  reasoningEffort?: string | null;
  attachments?: ComposerAttachment[];
}

interface ComposerUiContext {
  runtime: RuntimeState;
  byId: ByIdFn;
  showToast: (message: string) => void;
  ensureActiveSession: () => Promise<string>;
  loadSessionListAndRender: (options?: {
    preserveActive?: boolean;
    syncSelectionToTab?: boolean;
  }) => Promise<void>;
  withHistorySyncFallback: (fallbackText: string) => Promise<void>;
  scrollChatToBottom: (force?: boolean) => void;
}

export function buildMessageRequestBody(input: BuildMessageRequestInput): Record<string, unknown> {
  const parts: Array<Record<string, unknown>> = [];
  const text = input.text.trim();
  if (text !== "") {
    parts.push({ type: "text", text });
  }

  const attachments = Array.isArray(input.attachments) ? input.attachments : [];
  for (const attachment of attachments) {
    if (attachment.base64 === "" || attachment.name === "") {
      continue;
    }

    parts.push({
      type: "file",
      filename: attachment.name,
      name: attachment.name,
      mime: attachment.mimeType,
      media_type: attachment.mimeType,
      url: buildDataUrl(attachment.mimeType, attachment.base64),
      data: attachment.base64,
      base64: attachment.base64,
    });
  }

  const body: Record<string, unknown> = { parts };

  if (
    input.modelId != null &&
    input.modelId !== "" &&
    input.providerId != null &&
    input.providerId !== ""
  ) {
    const modelPayload: Record<string, unknown> = {
      providerID: input.providerId,
      modelID: input.modelId,
    };

    if (input.reasoningEffort != null && input.reasoningEffort !== "") {
      modelPayload["options"] = {
        reasoningEffort: input.reasoningEffort,
      };
    }

    body["model"] = modelPayload;
  }

  if (input.agentId != null && input.agentId !== "") {
    body["agent"] = input.agentId;
  }

  return body;
}

export function setComposerSendButtonState(runtime: RuntimeState, byId: ByIdFn): void {
  const sendBtn = byId<HTMLButtonElement>("send-btn");
  const chatInput = byId<HTMLTextAreaElement>("chat-input");
  if (sendBtn == null || chatInput == null) {
    return;
  }

  if (runtime.isSubmitting) {
    sendBtn.disabled = false;
    sendBtn.textContent = "...";
    sendBtn.setAttribute("data-mode", "stop");
    return;
  }

  sendBtn.textContent = "↑";
  sendBtn.removeAttribute("data-mode");
  sendBtn.disabled = chatInput.value.trim() === "" && runtime.stagedAttachments.length === 0;
}

export function renderComposerAttachmentTray(runtime: RuntimeState, byId: ByIdFn): void {
  const tray = byId<HTMLElement>("clipboard-preview-area");
  if (tray == null) {
    return;
  }

  if (runtime.stagedAttachments.length === 0) {
    tray.classList.add("is-hidden");
    tray.innerHTML = "";
    return;
  }

  tray.classList.remove("is-hidden");
  tray.innerHTML = renderAttachmentTrayHtml(runtime.stagedAttachments);
}

export function setComposerAttachments(
  runtime: RuntimeState,
  attachments: ComposerAttachment[],
  byId: ByIdFn
): void {
  runtime.stagedAttachments = attachments;
  renderComposerAttachmentTray(runtime, byId);
  setComposerSendButtonState(runtime, byId);
}

export function removeComposerAttachmentById(
  runtime: RuntimeState,
  attachmentId: string,
  byId: ByIdFn
): void {
  setComposerAttachments(
    runtime,
    runtime.stagedAttachments.filter((attachment) => attachment.id !== attachmentId),
    byId
  );
}

export function stageComposerAttachments(
  runtime: RuntimeState,
  attachments: ComposerAttachment[],
  context: Pick<ComposerUiContext, "byId" | "showToast">
): void {
  if (attachments.length === 0) {
    return;
  }

  const next = dedupeComposerAttachments(runtime.stagedAttachments, attachments);
  const addedCount = next.length - runtime.stagedAttachments.length;
  setComposerAttachments(runtime, next, context.byId);

  if (addedCount > 0) {
    context.showToast(`${String(addedCount)} ek hazir`);
  } else {
    context.showToast("Ayni ek zaten hazir");
  }
}

export async function stageComposerFileList(
  runtime: RuntimeState,
  files: FileList | File[],
  source: ComposerAttachment["source"],
  context: Pick<ComposerUiContext, "byId" | "showToast">
): Promise<void> {
  const entries = Array.from(files);
  if (entries.length === 0) {
    return;
  }

  const attachments = await Promise.all(
    entries.map(async (file) => await fileToComposerAttachment(file, source))
  );
  stageComposerAttachments(runtime, attachments, context);
}

export async function readClipboardAttachmentsFromEvent(
  event: ClipboardEvent,
  runtime: RuntimeState,
  context: Pick<ComposerUiContext, "byId" | "showToast">
): Promise<boolean> {
  const clipboardData = event.clipboardData;
  if (clipboardData == null) {
    return false;
  }

  const directFiles = Array.from(clipboardData.files);
  const itemFiles = Array.from(clipboardData.items)
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => file != null);
  const files = [...directFiles, ...itemFiles];
  if (files.length > 0) {
    event.preventDefault();
    await stageComposerFileList(runtime, files, "clipboard", context);
    return true;
  }

  return false;
}

export async function readClipboardAttachmentsFromSystem(): Promise<ComposerAttachment[]> {
  const clipboardApi = navigator.clipboard as Clipboard & {
    read?: () => Promise<ClipboardItem[]>;
  };

  if (typeof clipboardApi.read === "function") {
    const items = await clipboardApi.read();
    const attachmentGroups = await Promise.all(
      items.map(async (item) => {
        const imageTypes = item.types.filter((type) => type.startsWith("image/"));
        return await Promise.all(
          imageTypes.map(async (type) => {
            const blob = await item.getType(type);
            const extension = extensionFromMime(type);
            const file = new File([blob], `clipboard-${Date.now()}.${extension}`, { type });
            return await fileToComposerAttachment(file, "clipboard");
          })
        );
      })
    );
    const attachments = attachmentGroups.flat();

    if (attachments.length > 0) {
      return attachments;
    }
  }

  if (typeof navigator.clipboard.readText === "function") {
    const text = await navigator.clipboard.readText();
    const textAttachment = createClipboardTextAttachment(text);
    if (textAttachment != null) {
      return [textAttachment];
    }
  }

  return [];
}

export async function sendComposerMessage(context: ComposerUiContext): Promise<void> {
  const chatInput = context.byId<HTMLTextAreaElement>("chat-input");
  if (chatInput == null) {
    return;
  }

  if (context.runtime.isSubmitting) {
    return;
  }

  const text = chatInput.value.trim();
  const stagedAttachments = [...context.runtime.stagedAttachments];
  if (text === "" && stagedAttachments.length === 0) {
    setComposerSendButtonState(context.runtime, context.byId);
    return;
  }

  context.runtime.isSubmitting = true;
  setComposerSendButtonState(context.runtime, context.byId);

  const sessionId = await context.ensureActiveSession();
  context.runtime.submittingSessionId = sessionId;
  await context.loadSessionListAndRender({ preserveActive: true });

  const previousText = chatInput.value;
  chatInput.value = "";
  chatInput.style.height = "";
  addMessage("user", text, undefined, buildOutgoingAttachmentPreview(stagedAttachments));
  context.scrollChatToBottom(true);

  try {
    const modelMeta =
      context.runtime.activeModelId != null
        ? context.runtime.modelMetaById[context.runtime.activeModelId]
        : undefined;
    const body = buildMessageRequestBody({
      text,
      modelId: context.runtime.activeModelId,
      providerId: modelMeta?.providerId ?? null,
      agentId: context.runtime.activeAgentId,
      reasoningEffort: context.runtime.activeReasoningEffort,
      attachments: stagedAttachments,
    });

    const response = await apiCall<unknown>(
      "POST",
      `/session/${encodeURIComponent(sessionId)}/message`,
      body
    );
    const fallbackText = extractAssistantText(response);

    await context.withHistorySyncFallback(fallbackText);
    await context.loadSessionListAndRender({ preserveActive: true });
    setComposerAttachments(context.runtime, [], context.byId);
  } catch (error) {
    chatInput.value = previousText;
    setComposerAttachments(context.runtime, stagedAttachments, context.byId);
    addMessage(
      "assistant",
      "Mesaj gonderilemedi: " +
        (error instanceof Error && error.message !== "" ? error.message : String(error))
    );
    context.scrollChatToBottom(true);
  } finally {
    context.runtime.isSubmitting = false;
    context.runtime.submittingSessionId = null;
    setComposerSendButtonState(context.runtime, context.byId);
    await context.loadSessionListAndRender({ preserveActive: true });
  }
}
