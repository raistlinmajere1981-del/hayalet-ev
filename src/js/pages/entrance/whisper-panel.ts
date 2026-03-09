import { SettingsManager } from "../../modules/settings-manager.js";
import type { Account } from "@shared/settings.js";
import { formatTime, t as entranceT } from "./i18n.js";

interface WhisperRecord {
  id?: string;
  accountId: string;
  text: string;
  when?: number;
  done?: boolean;
}

interface WhisperAccountBucket {
  accountId: string;
  pending: WhisperRecord[];
  done: WhisperRecord[];
}

export class WhisperPanel {
  listEl: HTMLElement | null;
  overdueWhispers: WhisperRecord[];

  constructor() {
    this.listEl = null;
    this.overdueWhispers = [];
  }

  init(): void {
    this.listEl = document.getElementById("whisper-pending-list");
    this.setupListeners();
    void this.render();
  }

  setupListeners(): void {
    this.listEl?.addEventListener("click", (ev) => {
      this.handleListClick(ev);
    });
    document.getElementById("whisper-clear-btn")?.addEventListener("click", () => {
      void this.clearAll();
    });
  }

  getAccountMap(): Map<string, Account> {
    const settings = SettingsManager.getSnapshot();
    const accounts = Array.isArray(settings.accounts) ? settings.accounts : [];
    return new Map(
      accounts
        .filter(
          (account): account is Account => typeof account.id === "string" && account.id !== ""
        )
        .map((account) => [account.id, account])
    );
  }

  getAccountLabel(accountId: string, accountMap: Map<string, Account>): string {
    const account = accountMap.get(accountId);
    if (!account) {
      return accountId;
    }
    const title = account.nickname ?? account.name ?? account.email;
    return `${title}`;
  }

  async render(): Promise<void> {
    if (!this.listEl) {
      return;
    }

    const { CoreEngine: coreEngine } = await import("../../modules/core-engine.js");

    const now = Date.now();
    const bucketsRaw: unknown = await coreEngine.whisper("accounts");
    const buckets = Array.isArray(bucketsRaw)
      ? (bucketsRaw as WhisperAccountBucket[])
      : ([] as WhisperAccountBucket[]);

    const records = buckets
      .flatMap((bucket) =>
        (Array.isArray(bucket.pending) ? bucket.pending : []).map((record) => ({
          ...record,
          accountId: bucket.accountId,
        }))
      )
      .filter((record) => record.done !== true && (record.when ?? 0) <= now);

    this.overdueWhispers = records.sort((a, b) => (a.when ?? 0) - (b.when ?? 0));

    this.listEl.innerHTML = "";

    if (this.overdueWhispers.length === 0) {
      this.listEl.innerHTML = `<div class="empty-message">${entranceT("whisper.empty")}</div>`;
      return;
    }

    const accountMap = this.getAccountMap();

    this.overdueWhispers.forEach((record) => {
      const row = document.createElement("div");
      row.className = "entrance-whisper-item";

      const when =
        record.when !== undefined && record.when !== 0
          ? formatTime(record.when)
          : "-";

      const accountLabel = this.getAccountLabel(record.accountId, accountMap);

      row.innerHTML = `
                <div class="whisper-content">
                    <div class="whisper-meta">
                        <span class="badge">${this.escapeHtml(accountLabel)}</span>
                        <span>${when}</span>
                    </div>
                    <div class="whisper-text" title="${this.escapeHtml(record.text)}">${this.escapeHtml(record.text)}</div>
                </div>
                <button class="icon-btn delete-btn" title="${this.escapeHtml(entranceT("whisper.deleteTitle"))}">×</button>
            `;

      row.querySelector(".delete-btn")?.addEventListener("click", (e) => {
        e.stopPropagation();
        void (async (): Promise<void> => {
          await coreEngine.whisper("remove", {
            accountId: record.accountId,
            ...(record.id !== undefined && record.id !== "" ? { id: record.id } : {}),
          });
          void this.render();
        })();
      });

      this.listEl?.appendChild(row);
    });
  }

  async clearAll(): Promise<void> {
    const { CoreEngine: coreEngine } = await import("../../modules/core-engine.js");
    await this.overdueWhispers.reduce(async (prev, record) => {
      await prev;
      await coreEngine.whisper("remove", {
        accountId: record.accountId,
        ...(record.id !== undefined && record.id !== "" ? { id: record.id } : {}),
      });
    }, Promise.resolve());
    this.overdueWhispers = [];
    void this.render();
  }

  handleListClick(_ev: Event): void {}

  escapeHtml(text: string): string {
    if (text === "") return "";
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}
