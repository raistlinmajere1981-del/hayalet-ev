import { AppI18n } from "../../modules/i18n/index.js";
import { RoomProtocolRegistry } from "../../modules/rooms/room-protocol-registry.js";

function archivesProtocolT(key: string, params?: Record<string, string | number>): string {
  return AppI18n.t(`app.archives.protocol.${key}`, params);
}

export async function loadProtocolsFromApi(
  electronApi: (typeof window.electronAPI) | undefined
): Promise<Record<string, string>> {
  if (electronApi === undefined) {
    return RoomProtocolRegistry.mergeProtocolMap({});
  }

  const result = await electronApi.loadProtocols();
  if (result.success === true && result.protocols !== undefined) {
    return RoomProtocolRegistry.mergeProtocolMap(result.protocols);
  }
  return RoomProtocolRegistry.mergeProtocolMap({});
}

export function renderProtocolListView(args: {
  protocolListEl: HTMLElement | null;
  protocols: Record<string, string>;
  selectedProtocolKey: string | null;
  onSelect: (key: string) => void;
}): void {
  const { protocolListEl, protocols, selectedProtocolKey, onSelect } = args;
  if (!protocolListEl) return;

  const keys = Object.keys(protocols);
  if (keys.length === 0) {
    protocolListEl.innerHTML = `<div class="empty">${archivesProtocolT("empty")}</div>`;
    return;
  }

  protocolListEl.innerHTML = "";
  keys.forEach((key) => {
    const item = document.createElement("div");
    item.className = "protocol-item";
    if (key === selectedProtocolKey) {
      item.classList.add("active");
    }

    const icon = document.createElement("span");
    icon.className = "protocol-item-icon";
    icon.textContent = "📄";

    const name = document.createElement("span");
    name.className = "protocol-item-name";
    name.textContent = key;

    item.appendChild(icon);
    item.appendChild(name);

    item.addEventListener("click", () => {
      onSelect(key);
    });

    protocolListEl.appendChild(item);
  });
}

export function applyProtocolSelectionView(args: {
  key: string;
  protocols: Record<string, string>;
  protocolEditorTitleEl: HTMLElement | null;
  protocolTextareaEl: HTMLTextAreaElement | null;
  protocolEmptyEl: HTMLElement | null;
  protocolSaveBtn: HTMLElement | null;
  protocolTagButtonsEl: HTMLElement | null;
  setStatus: (text: string, type?: string) => void;
}): void {
  const {
    key,
    protocols,
    protocolEditorTitleEl,
    protocolTextareaEl,
    protocolEmptyEl,
    protocolSaveBtn,
    protocolTagButtonsEl,
    setStatus,
  } = args;

  if (protocolEditorTitleEl) {
    protocolEditorTitleEl.textContent = key;
  }

  if (protocolTextareaEl) {
    protocolTextareaEl.value = protocols[key] ?? "";
    protocolTextareaEl.classList.remove("hidden");
  }

  protocolEmptyEl?.classList.add("hidden");
  protocolSaveBtn?.classList.remove("hidden");
  protocolTagButtonsEl?.classList.remove("hidden");
  setStatus("");
}

export async function saveProtocolContent(args: {
  electronApi: (typeof window.electronAPI) | undefined;
  selectedProtocolKey: string;
  content: string;
}): Promise<{ success: boolean; message?: string }> {
  const { electronApi, selectedProtocolKey, content } = args;

  if (electronApi === undefined) {
    return { success: false, message: archivesProtocolT("electronApiUnavailable") };
  }

  const result = await electronApi.saveProtocol(selectedProtocolKey, content);
  if (typeof result.message === "string" && result.message !== "") {
    return {
      success: result.success === true,
      message: result.message,
    };
  }
  return {
    success: result.success === true,
  };
}

export function insertTagAtCursor(textarea: HTMLTextAreaElement, tag: string): void {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  textarea.value = value.slice(0, start) + tag + value.slice(end);
  const newPos = start + tag.length;
  textarea.selectionStart = newPos;
  textarea.selectionEnd = newPos;
  textarea.focus();
}

export function setProtocolStatusView(
  protocolStatusEl: HTMLElement | null,
  text: string,
  type: string = "info"
): void {
  if (!protocolStatusEl) return;
  protocolStatusEl.textContent = text;
  protocolStatusEl.className = `form-hint ${type}`;
}
