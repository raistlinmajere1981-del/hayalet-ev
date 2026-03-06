import { LogCategory } from "@shared/logging-core";
import { AppState } from "../../modules/app-state.js";
import { ConversationListManager } from "../../modules/conversation-list-manager.js";
import { Logger } from "../../modules/logger/index.js";
import { ButtonStates } from "../../ui/button-states.js";
import { mapFileResult, mapMessageResult, toRecord, toRecordArray, unwrapIpcData } from "./ipc-mappers.js";
import type { ArchiveEntry, FileResult, MessageResult } from "./types.js";

export interface ArchivesActionsContext {
  selectedId: string | null;
  entries: ArchiveEntry[];
  activeProvider: string;
  searchQuery: string;
  searchScope: string;
  searchResults: { messages: MessageResult[]; attachments: FileResult[] };
  listEl: HTMLElement | null;
  titleEl: HTMLInputElement | null;
  summaryEl: HTMLTextAreaElement | null;
  setStatus: (text: string, type?: string) => void;
  fillForm: (entry: ArchiveEntry | null) => void;
  loadIndex: () => Promise<void>;
  renderList: () => void;
  renderSearchResults: () => void;
  clearSearchResults: () => void;
}

export async function deleteArchiveEntry(
  ctx: ArchivesActionsContext,
  entry: ArchiveEntry | null
): Promise<void> {
  if (!entry) return;
  if (!confirm(`'${entry.title ?? entry.id}' kaydını kalıcı olarak silmek istediğinize emin misiniz?`)) {
    return;
  }

  const deleteBtn = document.getElementById("btn-delete") as HTMLButtonElement | null;

  try {
    if (deleteBtn) {
      ButtonStates.setLoading(deleteBtn, "Siliniyor...");
    }

    const accountInfo = AppState.getAccountForSlot(entry.provider ?? "");
    if (accountInfo?.id === undefined || accountInfo.id === "") {
      if (deleteBtn) {
        ButtonStates.setError(deleteBtn, "Hata!", 1500);
      }
      ctx.setStatus("Hesap bilgisi bulunamadı", "error");
      return;
    }

    const electronApi = window.electronAPI;
    if (electronApi === undefined) {
      if (deleteBtn) {
        ButtonStates.setError(deleteBtn, "Hata!", 1500);
      }
      ctx.setStatus("Uygulama API bulunamadı", "error");
      return;
    }

    const resultRaw: unknown = await electronApi.dbDeleteConversation({
      accountId: accountInfo.id,
      conversationId: entry.id,
    });
    const result = resultRaw as { success?: boolean; error?: string } | undefined;

    if (result?.success !== true) {
      if (deleteBtn) {
        ButtonStates.setError(deleteBtn, "Hata!", 1500);
      }
      ctx.setStatus(result?.error ?? "Sohbet silinemedi", "error");
      return;
    }

    if (deleteBtn) {
      ButtonStates.setSuccess(deleteBtn, "Silindi!", 1500);
    }

    Logger.info(LogCategory.ARCHIVES, `Sohbet silindi: ${entry.id}`);

    const isActive = ctx.selectedId === entry.id;
    if (isActive) {
      ctx.selectedId = null;
    }

    await ctx.loadIndex();
    await ConversationListManager.refresh({ silent: true });

    if (isActive) {
      ctx.fillForm(null);
    }
    ctx.setStatus("Sohbet silindi", "success");
  } catch (error) {
    const err = error as Error;
    if (deleteBtn) {
      ButtonStates.setError(deleteBtn, "Hata!", 1500);
    }
    Logger.error(LogCategory.ARCHIVES, `Silme hatası: ${err.message}`);
    ctx.setStatus("Sohbet silinirken hata oluştu", "error");
  }
}

export async function performArchiveSearch(ctx: ArchivesActionsContext): Promise<void> {
  if (ctx.searchQuery === "" || ctx.searchQuery.length < 2) {
    ctx.clearSearchResults();
    return;
  }

  try {
    let messages: MessageResult[] = [];
    let attachments: FileResult[] = [];

    if (ctx.searchScope === "all") {
      const resultsRaw = await window.electronAPI?.["dbSearchAllAccounts"]?.({
        query: ctx.searchQuery,
        limit: 50,
      });

      const allData = toRecord(unwrapIpcData(resultsRaw));
      const messageRows = toRecordArray(allData?.["messages"]);
      const attachmentRows = toRecordArray(allData?.["attachments"]);

      messages = messageRows.map((row) => mapMessageResult(row));
      attachments = attachmentRows.map((row) => mapFileResult(row));
    } else {
      const accountInfo = AppState.getAccountForSlot(ctx.activeProvider);
      if (accountInfo?.id === undefined || accountInfo.id === "") {
        ctx.searchResults = { messages: [], attachments: [] };
        ctx.renderSearchResults();
        return;
      }

      const dbSearchMessages = window.electronAPI?.dbSearchMessages;
      const dbSearchAttachments = window.electronAPI?.["dbSearchAttachments"];
      let messagesRaw: unknown;
      let attachmentsRaw: unknown;
      if (typeof dbSearchMessages === "function") {
        messagesRaw = await dbSearchMessages({
          accountId: accountInfo.id,
          query: ctx.searchQuery,
          limit: 50,
        });
      }
      if (typeof dbSearchAttachments === "function") {
        attachmentsRaw = await dbSearchAttachments({
          accountId: accountInfo.id,
          query: ctx.searchQuery,
          limit: 50,
        });
      }

      const messageRows = toRecordArray(unwrapIpcData(messagesRaw));
      const attachmentRows = toRecordArray(unwrapIpcData(attachmentsRaw));

      messages = messageRows.map((row) => {
        const mapped = mapMessageResult(row);
        return {
          ...mapped,
          accountId: mapped.accountId ?? accountInfo.id,
        };
      });
      attachments = attachmentRows.map((row) => {
        const mapped = mapFileResult(row);
        return {
          ...mapped,
          accountId: mapped.accountId ?? accountInfo.id,
        };
      });
    }

    ctx.searchResults = { messages, attachments };
    ctx.renderSearchResults();
  } catch (error) {
    const err = error as Error;
    Logger.error(LogCategory.ARCHIVES, `Arama hatası: ${err.message}`);
    ctx.searchResults = { messages: [], attachments: [] };
    ctx.renderSearchResults();
  }
}

export async function navigateArchiveResult(
  ctx: ArchivesActionsContext,
  result: MessageResult | FileResult,
  type: string
): Promise<void> {
  if (type === "file") {
    const fileResult = result as FileResult;
    if (fileResult.storedPath !== undefined && fileResult.storedPath !== "") {
      try {
        const electronApi = window.electronAPI;
        if (electronApi === undefined) {
          ctx.setStatus("Uygulama API bulunamadı", "error");
          return;
        }
        await electronApi.openPath(fileResult.storedPath);
      } catch {
        ctx.setStatus("Dosya açılamadı", "error");
      }
    }
    return;
  }

  const { accountId, conversationId } = result;
  if (
    accountId === undefined ||
    accountId === "" ||
    conversationId === undefined ||
    conversationId === ""
  ) {
    return;
  }

  const ai1Account = AppState.getAccountForSlot("ai1");
  const ai2Account = AppState.getAccountForSlot("ai2");

  let targetProvider: string | null = null;
  if (ai1Account?.id === accountId) {
    targetProvider = "ai1";
  } else if (ai2Account?.id === accountId) {
    targetProvider = "ai2";
  }

  if (targetProvider === null) {
    ctx.setStatus("Hesap bulunamadı", "error");
    return;
  }

  if (ctx.activeProvider !== targetProvider) {
    ctx.activeProvider = targetProvider;
    const radio = document.querySelector<HTMLInputElement>(
      `input[name="archives-provider"][value="${targetProvider}"]`
    );
    if (radio !== null) radio.checked = true;
    await ctx.loadIndex();
  }

  ctx.selectedId = conversationId;
  ctx.renderList();

  const entry = ctx.entries.find((item) => item.id === conversationId);
  if (entry) {
    ctx.fillForm(entry);

    const item = ctx.listEl?.querySelector(`.archive-item.selected`);
    item?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

export async function saveArchiveSelection(ctx: ArchivesActionsContext): Promise<void> {
  const saveBtn = document.getElementById("archive-save") as HTMLButtonElement | null;

  if (ctx.selectedId === null || ctx.selectedId === "") {
    ctx.setStatus("Sohbet seçilmedi", "warning");
    return;
  }
  const entry = ctx.entries.find((item) => item.id === ctx.selectedId);
  if (entry === undefined) {
    ctx.setStatus("Kayıt bulunamadı", "error");
    return;
  }

  const accountInfo = AppState.getAccountForSlot(entry.provider ?? "");
  if (accountInfo?.id === undefined || accountInfo.id === "") {
    ctx.setStatus("Hesap bilgisi bulunamadı", "error");
    return;
  }

  const electronApi = window.electronAPI;
  if (electronApi === undefined) {
    ctx.setStatus("Uygulama API bulunamadı", "error");
    return;
  }

  if (saveBtn) {
    ButtonStates.setLoading(saveBtn, "Kaydediliyor...");
  }

  const newTitle = ctx.titleEl?.value ?? entry.title;
  const newSummary = ctx.summaryEl?.value ?? entry.summary;

  try {
    const resultRaw: unknown = await electronApi.dbUpdateConversation({
      accountId: accountInfo.id,
      conversationId: entry.id,
      title: newTitle,
      summary: newSummary,
    });
    const result = resultRaw as { success?: boolean; error?: string } | undefined;

    if (result?.success === true) {
      if (saveBtn) {
        ButtonStates.setSuccess(saveBtn, "Kaydedildi!", 1500);
      }
      ctx.setStatus("Kaydedildi", "success");
      Logger.info(LogCategory.ARCHIVES, "Arşiv güncellendi");
      await ConversationListManager.refresh({ silent: true });
      await ctx.loadIndex();
    } else {
      if (saveBtn) {
        ButtonStates.setError(saveBtn, "Hata!", 1500);
      }
      ctx.setStatus((result as { error?: string }).error ?? "Kaydedilemedi", "error");
    }
  } catch (error) {
    const err = error as Error;
    if (saveBtn) {
      ButtonStates.setError(saveBtn, "Hata!", 1500);
    }
    Logger.error(LogCategory.ARCHIVES, `Kaydetme hatası: ${err.message}`);
    ctx.setStatus("Kaydedilemedi", "error");
  }
}
