import { CoreEngine } from "../modules/core-engine.js";
import { SettingsManager } from "../modules/settings-manager.js";
import { getErrorMessage } from "@shared/index.js";
import { AppI18n } from "../modules/i18n/index.js";
import type { Account } from "@shared/settings.js";
import { resolveIntlLocale } from "../../../shared/i18n/locale.js";

interface WhisperRecord {
  id: string;
  accountId: string;
  text: string;
  when?: number;
  done?: boolean;
  doneAt?: number;
}

interface WhisperAccountBucket {
  accountId: string;
  pending: WhisperRecord[];
  done: WhisperRecord[];
}

function whisperT(key: string, params?: Record<string, string | number>): string {
  return AppI18n.t(`app.whisper.${key}`, params);
}

export class WhisperController {
  accountsContainer: HTMLElement | null = null;
  addAccountSelect: HTMLSelectElement | null = null;
  addTextInput: HTMLTextAreaElement | null = null;
  addWhenInput: HTMLInputElement | null = null;
  addButton: HTMLButtonElement | null = null;
  refreshButton: HTMLButtonElement | null = null;
  feedbackEl: HTMLElement | null = null;
  _unsubSettings: (() => void) | null = null;
  _unsubI18n: (() => void) | null = null;
  updateHandler: (() => void) | null = null;
  feedbackTimer: ReturnType<typeof setTimeout> | null = null;

  async init(): Promise<void> {
    await CoreEngine.init();

    this.accountsContainer = document.getElementById("whisper-accounts");
    this.addAccountSelect = document.getElementById(
      "whisper-add-account"
    ) as HTMLSelectElement | null;
    this.addTextInput = document.getElementById("whisper-add-text") as HTMLTextAreaElement | null;
    this.addWhenInput = document.getElementById("whisper-add-when") as HTMLInputElement | null;
    this.addButton = document.getElementById("whisper-add-btn") as HTMLButtonElement | null;
    this.refreshButton = document.getElementById("whisper-refresh-btn") as HTMLButtonElement | null;
    this.feedbackEl = document.getElementById("whisper-add-feedback");

    this.setupListeners();
    this.syncAccountOptions();

    this._unsubSettings = SettingsManager.subscribe(
      ({ changedPaths }: { changedPaths: string[] }) => {
        const accountsChanged =
          changedPaths.includes("*") || changedPaths.some((path) => path.startsWith("accounts"));

        if (!accountsChanged) {
          return;
        }

        this.syncAccountOptions();
        void this.render();
      }
    );

    this._unsubI18n = AppI18n.subscribe(() => {
      this.syncAccountOptions();
      void this.render();
    });

    this.updateHandler = (): void => {
      void this.render();
    };
    window.addEventListener("whisper-updated", this.updateHandler);

    await this.render();
  }

  setupListeners(): void {
    this.addButton?.addEventListener("click", () => {
      void this.handleAddWhisper();
    });

    this.refreshButton?.addEventListener("click", () => {
      void this.render();
    });
  }

  getAccounts(): Account[] {
    const settings = SettingsManager.getSnapshot();
    return Array.isArray(settings.accounts)
      ? settings.accounts.filter(
          (account): account is Account =>
            typeof account.id === "string" && account.id.trim() !== ""
        )
      : [];
  }

  getAccountLabel(account: Account): string {
    const title = account.nickname ?? account.name ?? account.email;
    return `${title} (${account.provider})`;
  }

  syncAccountOptions(): void {
    if (!this.addAccountSelect) {
      return;
    }

    const accounts = this.getAccounts();
    const previousValue = this.addAccountSelect.value;

    this.addAccountSelect.innerHTML = "";

    accounts.forEach((account) => {
      const option = document.createElement("option");
      option.value = account.id;
      option.textContent = this.getAccountLabel(account);
      this.addAccountSelect?.appendChild(option);
    });

    const hasPrevious = accounts.some((account) => account.id === previousValue);
    if (hasPrevious) {
      this.addAccountSelect.value = previousValue;
    }

    const disabled = accounts.length === 0;
    this.addAccountSelect.disabled = disabled;
    if (this.addButton) {
      this.addButton.disabled = disabled;
    }
  }

  async handleAddWhisper(): Promise<void> {
    const accountId = (this.addAccountSelect !== null ? this.addAccountSelect.value : "").trim();
    const text = (this.addTextInput !== null ? this.addTextInput.value : "").trim();
    const when = (this.addWhenInput !== null ? this.addWhenInput.value : "").trim();

    if (accountId === "") {
      this.showFeedback(whisperT("feedback.accountRequired"), "error");
      return;
    }

    if (text === "") {
      this.showFeedback(whisperT("feedback.messageRequired"), "error");
      return;
    }

    try {
      await CoreEngine.whisper("add", {
        accountId,
        text,
        when: when === "" ? Date.now() : when,
      });

      if (this.addTextInput) {
        this.addTextInput.value = "";
      }

      this.showFeedback(whisperT("feedback.addSuccess"), "success");
      await this.render();
    } catch (err) {
      this.showFeedback(whisperT("feedback.addFailed", { message: getErrorMessage(err) }), "error");
    }
  }

  showFeedback(message: string, type: "success" | "error"): void {
    if (!this.feedbackEl) {
      return;
    }

    this.feedbackEl.textContent = message;
    this.feedbackEl.classList.remove("success", "error");
    this.feedbackEl.classList.add(type);

    if (this.feedbackTimer) {
      clearTimeout(this.feedbackTimer);
    }

    this.feedbackTimer = setTimeout(() => {
      if (!this.feedbackEl) {
        return;
      }
      this.feedbackEl.textContent = "";
      this.feedbackEl.classList.remove("success", "error");
      this.feedbackTimer = null;
    }, 3500);
  }

  async render(): Promise<void> {
    if (!this.accountsContainer) {
      return;
    }

    const accounts = this.getAccounts();
    this.accountsContainer.innerHTML = "";

    if (accounts.length === 0) {
      const empty = document.createElement("div");
      empty.className = "whisper-global-empty";
      empty.textContent = whisperT("state.noAccounts");
      this.accountsContainer.appendChild(empty);
      return;
    }

    const bucketsRaw = await CoreEngine.whisper("accounts");
    const buckets = Array.isArray(bucketsRaw)
      ? (bucketsRaw as WhisperAccountBucket[])
      : ([] as WhisperAccountBucket[]);
    const bucketMap = new Map(buckets.map((bucket) => [bucket.accountId, bucket]));

    accounts.forEach((account) => {
      const bucket = bucketMap.get(account.id) ?? { accountId: account.id, pending: [], done: [] };
      this.accountsContainer?.appendChild(this.renderAccountCard(account, bucket));
    });
  }

  renderAccountCard(account: Account, bucket: WhisperAccountBucket): HTMLElement {
    const card = document.createElement("section");
    card.className =
      "panel glass-panel ds-surface-card ds-surface-card--stack whisper-account-card";

    const header = document.createElement("div");
    header.className = "whisper-account-header";

    const title = document.createElement("h3");
    title.className = "whisper-account-title";
    title.textContent = this.getAccountLabel(account);

    const subtitle = document.createElement("div");
    subtitle.className = "whisper-account-subtitle";
    subtitle.textContent = account.email;

    header.appendChild(title);
    header.appendChild(subtitle);

    const pendingSection = this.renderSection(
      whisperT("sections.pendingTitle"),
      bucket.pending,
      account.id,
      true,
      whisperT("sections.emptyPending")
    );

    const doneSection = this.renderSection(
      whisperT("sections.doneTitle"),
      bucket.done,
      account.id,
      false,
      whisperT("sections.emptyDone")
    );

    card.appendChild(header);
    card.appendChild(pendingSection);
    card.appendChild(doneSection);

    return card;
  }

  renderSection(
    title: string,
    records: WhisperRecord[],
    accountId: string,
    isPending: boolean,
    emptyText: string
  ): HTMLElement {
    const section = document.createElement("div");
    section.className = "whisper-section";

    const heading = document.createElement("h4");
    heading.className = "whisper-section-title";
    heading.textContent = title;

    const list = document.createElement("div");
    list.className = "whisper-list";

    if (!Array.isArray(records) || records.length === 0) {
      const empty = document.createElement("div");
      empty.className = "whisper-empty";
      empty.textContent = emptyText;
      list.appendChild(empty);
    } else {
      records
        .slice()
        .sort((left, right) => (left.when ?? left.doneAt ?? 0) - (right.when ?? right.doneAt ?? 0))
        .forEach((record) => {
          list.appendChild(this.renderRecordRow(accountId, record, isPending));
        });
    }

    section.appendChild(heading);
    section.appendChild(list);
    return section;
  }

  renderRecordRow(accountId: string, record: WhisperRecord, isPending: boolean): HTMLElement {
    const row = document.createElement("div");
    row.className = "whisper-row";

    const meta = document.createElement("div");
    meta.className = "whisper-row-meta";
    meta.textContent = this.formatDate(isPending ? record.when : (record.doneAt ?? record.when));

    const text = document.createElement("div");
    text.className = "whisper-row-text";
    text.textContent = record.text;

    const actions = document.createElement("div");
    actions.className = "whisper-row-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "whisper-action-btn btn btn-xs btn-secondary";
    editBtn.textContent = whisperT("actions.edit");
    editBtn.addEventListener("click", () => {
      void this.handleUpdate(accountId, record, isPending);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "whisper-action-btn danger btn btn-xs btn-danger";
    deleteBtn.textContent = whisperT("actions.delete");
    deleteBtn.addEventListener("click", () => {
      void this.handleDelete(accountId, record.id);
    });

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    row.appendChild(meta);
    row.appendChild(text);
    row.appendChild(actions);

    return row;
  }

  async handleDelete(accountId: string, whisperId: string): Promise<void> {
    try {
      await CoreEngine.whisper("remove", { accountId, id: whisperId });
      this.showFeedback(whisperT("feedback.deleteSuccess"), "success");
      await this.render();
    } catch (err) {
      this.showFeedback(
        whisperT("feedback.deleteFailed", { message: getErrorMessage(err) }),
        "error"
      );
    }
  }

  async handleUpdate(accountId: string, record: WhisperRecord, isPending: boolean): Promise<void> {
    const nextTextRaw = window.prompt(whisperT("prompts.updateMessage"), record.text);
    if (nextTextRaw === null) {
      return;
    }

    const nextText = nextTextRaw.trim();
    if (nextText === "") {
      this.showFeedback(whisperT("feedback.messageRequired"), "error");
      return;
    }

    const currentWhen = isPending ? this.toDateTimeInputValue(record.when) : "";
    const nextWhenRaw = window.prompt(whisperT("prompts.updateTime"), currentWhen);
    if (nextWhenRaw === null) {
      return;
    }

    const patch: { text?: string; when?: unknown } = {};
    if (nextText !== record.text) {
      patch.text = nextText;
    }

    const nextWhen = nextWhenRaw.trim();
    if (nextWhen !== "" && nextWhen !== currentWhen) {
      patch.when = nextWhen;
    }

    if (patch.text === undefined && patch.when === undefined) {
      return;
    }

    try {
      await CoreEngine.whisper("update", {
        accountId,
        id: record.id,
        patch,
      });
      this.showFeedback(whisperT("feedback.updateSuccess"), "success");
      await this.render();
    } catch (err) {
      this.showFeedback(
        whisperT("feedback.updateFailed", { message: getErrorMessage(err) }),
        "error"
      );
    }
  }

  onShow(): void {
    void this.render();
  }

  onHide(): void {}

  formatDate(ts: number | undefined): string {
    if (ts == null || ts === 0 || Number.isNaN(ts)) {
      return "-";
    }

    const date = new Date(ts);
    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleString(resolveIntlLocale(AppI18n.getLocale()));
  }

  toDateTimeInputValue(ts: number | undefined): string {
    if (ts == null || ts === 0 || Number.isNaN(ts)) {
      return "";
    }

    const date = new Date(ts);
    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }
}
