import { apiCall } from "./api.js";

export type ToolSnapshotStatus = "loaded" | "empty" | "error";

export interface ToolSnapshotResult {
  status: ToolSnapshotStatus;
  toolIds: string[];
}

interface OpenCodeToolResult {
  status: ToolSnapshotStatus;
  toolIds: string[];
}

interface HevToolsResponse {
  success?: boolean;
  toolNames?: string[];
}

type ToolFetcher = (path: string) => Promise<unknown>;
type QuickPromptAction = "apply" | "delete";

interface QuickPromptRecord {
  id: string;
  name: string;
  content: string;
  createdAt: number;
}

interface QuickPromptPanelOptions {
  showToast: (message: string) => void;
}

const QUICK_PROMPTS_STORAGE_KEY = "hayalet-ev:opencode-ui:quick-prompts";
let quickPromptCache: QuickPromptRecord[] = [];

interface QuickPromptStoreResponse {
  success?: boolean;
  prompts?: QuickPromptRecord[];
  path?: string;
  error?: string;
}

function isQuickPromptRecord(value: unknown): value is QuickPromptRecord {
  if (value == null || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record["id"] === "string" &&
    record["id"] !== "" &&
    typeof record["name"] === "string" &&
    typeof record["content"] === "string" &&
    typeof record["createdAt"] === "number" &&
    Number.isFinite(record["createdAt"])
  );
}

function createQuickPromptId(): string {
  return `prompt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadLegacyQuickPrompts(): QuickPromptRecord[] {
  if (typeof window === "undefined" || window.localStorage == null) {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(QUICK_PROMPTS_STORAGE_KEY);
    if (rawValue == null || rawValue.trim() === "") {
      return [];
    }

    const parsed = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is QuickPromptRecord => isQuickPromptRecord(item))
      .map((item) => ({
        id: item.id,
        name: item.name.trim(),
        content: item.content,
        createdAt: item.createdAt,
      }))
      .filter((item) => item.name !== "" && item.content.trim() !== "")
      .sort((left, right) => right.createdAt - left.createdAt);
  } catch (_error) {
    return [];
  }
}

function clearLegacyQuickPrompts(): void {
  if (typeof window === "undefined" || window.localStorage == null) {
    return;
  }

  window.localStorage.removeItem(QUICK_PROMPTS_STORAGE_KEY);
}

async function readQuickPromptsFromStore(): Promise<QuickPromptRecord[]> {
  const api = window.electronAPI;
  if (api == null || typeof api.opencodeUiQuickPromptsRead !== "function") {
    return loadLegacyQuickPrompts();
  }

  try {
    const result = (await api.opencodeUiQuickPromptsRead()) as QuickPromptStoreResponse;
    const prompts = Array.isArray(result.prompts) ? result.prompts : [];
    const legacyPrompts = loadLegacyQuickPrompts();

    if (result.success !== true) {
      if (legacyPrompts.length > 0) {
        return legacyPrompts;
      }

      throw new Error(result.error ?? "Promptlar okunamadi.");
    }

    if (prompts.length > 0) {
      return normalizeQuickPromptRecords(prompts);
    }

    if (legacyPrompts.length > 0) {
      await writeQuickPromptsToStore(legacyPrompts);
      clearLegacyQuickPrompts();
      return legacyPrompts;
    }

    return [];
  } catch (error) {
    const legacyPrompts = loadLegacyQuickPrompts();
    if (legacyPrompts.length > 0) {
      return legacyPrompts;
    }

    throw error;
  }
}

async function writeQuickPromptsToStore(prompts: QuickPromptRecord[]): Promise<QuickPromptRecord[]> {
  const normalizedPrompts = normalizeQuickPromptRecords(prompts);
  const api = window.electronAPI;
  if (api == null || typeof api.opencodeUiQuickPromptsWrite !== "function") {
    if (typeof window !== "undefined" && window.localStorage != null) {
      window.localStorage.setItem(QUICK_PROMPTS_STORAGE_KEY, JSON.stringify(normalizedPrompts));
    }
    return normalizedPrompts;
  }

  const result = (await api.opencodeUiQuickPromptsWrite(normalizedPrompts)) as QuickPromptStoreResponse;
  if (result.success !== true) {
    throw new Error(result.error ?? "Promptlar kaydedilemedi.");
  }

  clearLegacyQuickPrompts();
  return normalizeQuickPromptRecords(Array.isArray(result.prompts) ? result.prompts : normalizedPrompts);
}

function updateQuickPromptCount(count: number): void {
  const promptCountEl = document.getElementById("prompt-count");
  if (promptCountEl != null) {
    promptCountEl.textContent = String(count);
  }
}

function closePromptModal(): void {
  const modal = document.getElementById("prompt-modal");
  if (modal != null) {
    modal.classList.remove("is-active");
  }
}

function openPromptModal(): void {
  const modal = document.getElementById("prompt-modal");
  const modalTitle = document.getElementById("prompt-modal-title");
  const modalName = document.getElementById("prompt-modal-name") as HTMLInputElement | null;
  const modalContent = document.getElementById("prompt-modal-content") as HTMLTextAreaElement | null;

  if (modal == null || modalTitle == null || modalName == null || modalContent == null) {
    return;
  }

  modalTitle.textContent = "Yeni Prompt";
  modalName.value = "";
  modalContent.value = "";
  modal.classList.add("is-active");
  requestAnimationFrame(() => {
    modalName.focus();
    modalName.select();
  });
}

function applyQuickPrompt(prompt: QuickPromptRecord, options: QuickPromptPanelOptions): void {
  const chatInput = document.getElementById("chat-input") as HTMLTextAreaElement | null;
  if (chatInput == null) {
    options.showToast("Mesaj alani bulunamadi.");
    return;
  }

  const existingValue = chatInput.value.trim();
  const nextValue =
    existingValue === "" ? prompt.content : `${chatInput.value.replace(/\s+$/, "")}\n\n${prompt.content}`;

  chatInput.value = nextValue;
  chatInput.dispatchEvent(new Event("input", { bubbles: true }));
  chatInput.focus();
  chatInput.setSelectionRange(chatInput.value.length, chatInput.value.length);
  options.showToast(`Prompt eklendi: ${prompt.name}`);
}

function buildPromptCard(prompt: QuickPromptRecord): HTMLElement {
  const card = document.createElement("div");
  card.className = "ds-prompt-card";
  card.setAttribute("role", "button");
  card.setAttribute("tabindex", "0");
  card.setAttribute("data-prompt-action", "apply");
  card.setAttribute("data-prompt-id", prompt.id);
  card.setAttribute("title", "Promptu compose alanina ekle");

  const header = document.createElement("div");
  header.className = "ds-prompt-card__header";

  const name = document.createElement("div");
  name.className = "ds-prompt-card__name";
  name.textContent = prompt.name;

  const actions = document.createElement("div");
  actions.className = "ds-prompt-card__actions";

  const applyButton = document.createElement("button");
  applyButton.type = "button";
  applyButton.className = "ds-prompt-card__btn";
  applyButton.textContent = "Kullan";
  applyButton.setAttribute("title", "Promptu compose alanina ekle");
  applyButton.setAttribute("data-prompt-action", "apply");
  applyButton.setAttribute("data-prompt-id", prompt.id);

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "ds-prompt-card__btn ds-prompt-card__btn--danger";
  deleteButton.textContent = "Sil";
  deleteButton.setAttribute("title", "Promptu sil");
  deleteButton.setAttribute("data-prompt-action", "delete");
  deleteButton.setAttribute("data-prompt-id", prompt.id);

  const content = document.createElement("div");
  content.className = "ds-prompt-card__content";
  content.textContent = prompt.content.replace(/\s+/g, " ").trim();

  actions.appendChild(applyButton);
  actions.appendChild(deleteButton);
  header.appendChild(name);
  header.appendChild(actions);
  card.appendChild(header);
  card.appendChild(content);
  return card;
}

function normalizeQuickPromptRecords(prompts: QuickPromptRecord[]): QuickPromptRecord[] {
  return prompts
    .map((prompt) => ({
      id: prompt.id,
      name: prompt.name.trim(),
      content: prompt.content,
      createdAt: prompt.createdAt,
    }))
    .filter((prompt) => prompt.id !== "" && prompt.name !== "" && prompt.content.trim() !== "")
    .sort((left, right) => right.createdAt - left.createdAt);
}

function renderQuickPromptList(prompts: QuickPromptRecord[]): void {
  const promptsListEl = document.getElementById("prompts-list");
  if (promptsListEl == null) {
    return;
  }

  quickPromptCache = normalizeQuickPromptRecords(prompts);
  updateQuickPromptCount(quickPromptCache.length);
  promptsListEl.replaceChildren();

  if (quickPromptCache.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.textContent = "Henuz hizli prompt yok";
    promptsListEl.appendChild(emptyState);
    return;
  }

  quickPromptCache.forEach((prompt) => {
    promptsListEl.appendChild(buildPromptCard(prompt));
  });
}

async function refreshQuickPromptList(options?: QuickPromptPanelOptions): Promise<QuickPromptRecord[]> {
  try {
    const prompts = await readQuickPromptsFromStore();
    renderQuickPromptList(prompts);
    return quickPromptCache;
  } catch (error) {
    renderQuickPromptList([]);
    options?.showToast(
      error instanceof Error && error.message !== "" ? error.message : "Promptlar okunamadi."
    );
    return [];
  }
}

function resolvePromptActionTarget(target: EventTarget | null): HTMLElement | null {
  return target instanceof HTMLElement ? target.closest<HTMLElement>("[data-prompt-action]") : null;
}

async function handleQuickPromptAction(
  action: QuickPromptAction,
  promptId: string,
  options: QuickPromptPanelOptions
): Promise<void> {
  const prompt = quickPromptCache.find((item) => item.id === promptId);
  if (prompt == null) {
    return;
  }

  if (action === "apply") {
    applyQuickPrompt(prompt, options);
    return;
  }

  const nextPrompts = quickPromptCache.filter((item) => item.id !== promptId);
  await writeQuickPromptsToStore(nextPrompts);
  await refreshQuickPromptList();
  options.showToast(`Prompt silindi: ${prompt.name}`);
}

export function initQuickPromptPanel(options: QuickPromptPanelOptions): void {
  if (typeof document === "undefined") {
    return;
  }

  const addButton = document.getElementById("add-prompt-btn") as HTMLButtonElement | null;
  const promptsListEl = document.getElementById("prompts-list");
  const modal = document.getElementById("prompt-modal");
  const modalOverlay = document.getElementById("prompt-modal-overlay");
  const modalCancel = document.getElementById("prompt-modal-cancel") as HTMLButtonElement | null;
  const modalSave = document.getElementById("prompt-modal-save") as HTMLButtonElement | null;
  const modalName = document.getElementById("prompt-modal-name") as HTMLInputElement | null;
  const modalContent = document.getElementById("prompt-modal-content") as HTMLTextAreaElement | null;

  void refreshQuickPromptList(options);

  addButton?.addEventListener("click", () => {
    openPromptModal();
  });

  modalOverlay?.addEventListener("click", () => {
    closePromptModal();
  });

  modalCancel?.addEventListener("click", () => {
    closePromptModal();
  });

  modal?.addEventListener("click", (event) => {
    if (event.target === modal) {
      closePromptModal();
    }
  });

  modal?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closePromptModal();
    }
  });

  modalContent?.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      modalSave?.click();
    }
  });

  modalSave?.addEventListener("click", () => {
    void (async (): Promise<void> => {
      const name = modalName?.value.trim() ?? "";
      const content = modalContent?.value.trim() ?? "";

      if (name === "" || content === "") {
        options.showToast("Prompt ismi ve icerigi zorunlu.");
        if (name === "") {
          modalName?.focus();
        } else {
          modalContent?.focus();
        }
        return;
      }

      const nextPrompts = [
        {
          id: createQuickPromptId(),
          name,
          content,
          createdAt: Date.now(),
        },
        ...quickPromptCache,
      ];

      try {
        await writeQuickPromptsToStore(nextPrompts);
        await refreshQuickPromptList();
        closePromptModal();
        options.showToast(`Prompt kaydedildi: ${name}`);
      } catch (error) {
        options.showToast(
          error instanceof Error && error.message !== "" ? error.message : "Prompt kaydedilemedi."
        );
      }
    })();
  });

  promptsListEl?.addEventListener("click", (event) => {
    const actionTarget = resolvePromptActionTarget(event.target);
    if (actionTarget == null) {
      return;
    }

    const action = actionTarget.getAttribute("data-prompt-action");
    const promptId = actionTarget.getAttribute("data-prompt-id");
    if ((action !== "apply" && action !== "delete") || promptId == null || promptId === "") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    void handleQuickPromptAction(action, promptId, options);
  });

  promptsListEl?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    const actionTarget = resolvePromptActionTarget(event.target);
    if (actionTarget == null) {
      return;
    }

    const action = actionTarget.getAttribute("data-prompt-action");
    const promptId = actionTarget.getAttribute("data-prompt-id");
    if ((action !== "apply" && action !== "delete") || promptId == null || promptId === "") {
      return;
    }

    event.preventDefault();
    void handleQuickPromptAction(action, promptId, options);
  });
}

function normalizeToolIds(data: unknown): string[] {
  if (Array.isArray(data)) {
    return data.filter((item): item is string => typeof item === "string" && item !== "");
  }

  if (data === null || data === undefined || typeof data !== "object") {
    return [];
  }

  const record = data as Record<string, unknown>;

  if (record["error"] !== undefined || record["errors"] !== undefined) {
    return [];
  }

  const directIds = record["ids"];
  if (Array.isArray(directIds)) {
    return directIds.filter((item): item is string => typeof item === "string" && item !== "");
  }

  const nestedToolIds = record["toolIds"];
  if (Array.isArray(nestedToolIds)) {
    return nestedToolIds.filter((item): item is string => typeof item === "string" && item !== "");
  }

  const tools = record["tools"];
  if (Array.isArray(tools)) {
    return tools
      .map((item) => {
        if (item !== null && item !== undefined && typeof item === "object") {
          const id = (item as { id?: unknown; name?: unknown }).id;
          if (typeof id === "string" && id !== "") {
            return id;
          }

          const name = (item as { id?: unknown; name?: unknown }).name;
          if (typeof name === "string" && name !== "") {
            return name;
          }
        }

        return "";
      })
      .filter((item) => item !== "");
  }

  return [];
}

function renderToolSnapshot(opencodeToolIds: string[], hevToolIds: string[]): void {
  if (typeof document === "undefined") {
    return;
  }

  const allToolIds = [...opencodeToolIds, ...hevToolIds];

  const toolCountEl = document.getElementById("tool-count");
  if (toolCountEl != null) {
    toolCountEl.textContent = String(allToolIds.length);
  }

  const toolsListEl = document.getElementById("tools-list");
  if (toolsListEl == null) {
    return;
  }

  if (allToolIds.length === 0) {
    toolsListEl.innerHTML = '<div class="empty-state">Tool bulunamadi</div>';
    return;
  }

  const sections: string[] = [];

  if (opencodeToolIds.length > 0) {
    sections.push(
      '<div class="ds-tools-group__header">OpenCode Built-in (' +
        String(opencodeToolIds.length) +
        ")</div>" +
        opencodeToolIds
          .map((toolId) => `<div class="ds-panel__item"><strong>${toolId}</strong></div>`)
          .join("")
    );
  }

  if (hevToolIds.length > 0) {
    sections.push(
      '<div class="ds-tools-group__header">Hayalet-ev MCP (' +
        String(hevToolIds.length) +
        ")</div>" +
        hevToolIds
          .map((toolId) => `<div class="ds-panel__item"><strong>${toolId}</strong></div>`)
          .join("")
    );
  }

  toolsListEl.innerHTML = sections.join("");
}

async function loadOpenCodeToolIds(get: ToolFetcher): Promise<OpenCodeToolResult> {
  try {
    const idsResponse = await get("/experimental/tool/ids");
    const toolIds = normalizeToolIds(idsResponse);
    return {
      status: toolIds.length > 0 ? "loaded" : "empty",
      toolIds,
    };
  } catch (_error) {
    try {
      const toolsResponse = await get("/experimental/tool");
      const toolIds = normalizeToolIds(toolsResponse);
      return {
        status: toolIds.length > 0 ? "loaded" : "empty",
        toolIds,
      };
    } catch (_nestedError) {
      return {
        status: "error",
        toolIds: [],
      };
    }
  }
}

async function loadHevToolIds(): Promise<string[]> {
  if (
    window.electronAPI == null ||
    typeof window.electronAPI["opencodeUiHevTools"] !== "function"
  ) {
    return [];
  }

  try {
    const result = (await window.electronAPI["opencodeUiHevTools"]()) as HevToolsResponse;
    if (result.success !== true || !Array.isArray(result.toolNames)) {
      return [];
    }

    return result.toolNames.filter(
      (toolName): toolName is string => typeof toolName === "string" && toolName !== ""
    );
  } catch (_error) {
    return [];
  }
}

export async function loadToolsFinalSnapshot(fetcher?: ToolFetcher): Promise<ToolSnapshotResult> {
  const get: ToolFetcher =
    fetcher ??
    (async (path: string): Promise<unknown> => {
      return await apiCall<unknown>("GET", path);
    });

  const [openCodeResult, hevToolIds] = await Promise.all([
    loadOpenCodeToolIds(get),
    loadHevToolIds(),
  ]);
  const combinedToolIds = [...openCodeResult.toolIds, ...hevToolIds];

  renderToolSnapshot(openCodeResult.toolIds, hevToolIds);

  if (combinedToolIds.length > 0) {
    return {
      status: "loaded",
      toolIds: combinedToolIds,
    };
  }

  if (openCodeResult.status === "error") {
    return {
      status: "error",
      toolIds: [],
    };
  }

  return {
    status: "empty",
    toolIds: [],
  };
}
