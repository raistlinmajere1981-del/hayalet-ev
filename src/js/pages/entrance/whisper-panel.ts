import { SettingsManager } from "../../modules/settings-manager.js";
import { getAiProviderAccounts } from "@shared/settings.js";
import type { Account } from "@shared/settings.js";
import { CoreEngine } from "../../modules/core-engine.js";
import { AppI18n } from "../../modules/i18n/index.js";
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
  overlayEl: HTMLElement | null;
  overlayBackdropEl: HTMLElement | null;
  overlayCloseBtn: HTMLButtonElement | null;
  overdueWhispers: WhisperRecord[];
  autoOpenPending: boolean;
  isOverlayOpen: boolean;

  constructor() {
    this.listEl = null;
    this.overlayEl = null;
    this.overlayBackdropEl = null;
    this.overlayCloseBtn = null;
    this.overdueWhispers = [];
    this.autoOpenPending = true;
    this.isOverlayOpen = false;
  }

  init(): void {
    this.listEl = document.getElementById("whisper-pending-list");
    this.overlayEl = document.getElementById("whisper-overlay");
    this.overlayBackdropEl = document.getElementById("whisper-overlay-backdrop");
    this.overlayCloseBtn = document.getElementById(
      "whisper-overlay-close"
    ) as HTMLButtonElement | null;
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
    this.overlayBackdropEl?.addEventListener("click", () => {
      this.hideOverlay();
    });
    this.overlayCloseBtn?.addEventListener("click", () => {
      this.hideOverlay();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && this.isOverlayOpen) {
        this.hideOverlay();
      }
    });
  }

  applyOverlayTranslations(): void {
    const label = AppI18n.t("app.common.close");
    if (this.overlayCloseBtn) {
      this.overlayCloseBtn.textContent = label;
      this.overlayCloseBtn.setAttribute("aria-label", label);
      this.overlayCloseBtn.setAttribute("title", label);
    }
  }

  showOverlay(): void {
    if (!this.overlayEl) {
      return;
    }
    this.overlayEl.classList.remove("is-hidden");
    this.overlayEl.setAttribute("aria-hidden", "false");
    this.isOverlayOpen = true;
  }

  hideOverlay(): void {
    if (this.overlayEl) {
      this.overlayEl.classList.add("is-hidden");
      this.overlayEl.setAttribute("aria-hidden", "true");
    }
    this.isOverlayOpen = false;
  }

  getAccountMap(): Map<string, Account> {
    const settings = SettingsManager.getSnapshot();
    const accounts = getAiProviderAccounts(settings.accounts);
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

    this.applyOverlayTranslations();

    const now = Date.now();
    const bucketsRaw: unknown = await CoreEngine.whisper("accounts");
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

    const shouldAutoOpen = this.autoOpenPending && this.overdueWhispers.length > 0;
    this.autoOpenPending = false;

    this.listEl.innerHTML = "";

    if (this.overdueWhispers.length === 0) {
      this.listEl.innerHTML = `<div class="empty-message">${entranceT("whisper.empty")}</div>`;
      this.hideOverlay();
      return;
    }

    if (shouldAutoOpen) {
      this.showOverlay();
    }

    const accountMap = this.getAccountMap();

    this.overdueWhispers.forEach((record) => {
      const row = document.createElement("div");
      row.className = "entrance-whisper-item";

      const when = record.when !== undefined && record.when !== 0 ? formatTime(record.when) : "-";

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
          await CoreEngine.whisper("remove", {
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
    await this.overdueWhispers.reduce(async (prev, record) => {
      await prev;
      await CoreEngine.whisper("remove", {
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
