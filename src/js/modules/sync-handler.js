// @ts-nocheck
import { LogManager } from "./log-manager.js";
import { TrafficManager } from "./traffic-manager.js";
import { WebviewManager } from "./webview-manager.js";
import { AppState } from "./app-state.js";
import { FileManager } from "./file-manager.js";
import { ConversationListManager } from "./conversation-list-manager.js";

class SyncHandlerClass {
  constructor() {
    this.coreEngine = null;
    this._lastThinkingState = { ai1: "idle", ai2: "idle" };
    this._lastLoadingEnded = { ai1: 0, ai2: 0 };
    this._syncRetryTimers = {};
    this._syncRetryCounts = {};
    this.syncRetryLimit = 2;
    this._stableListeners = {};
    this._lastSyncResult = {};
    this._pendingArchives = {};
  }

  /**
   * @param {any} coreEngineInstance
   */
  init(coreEngineInstance) {
    this.coreEngine = coreEngineInstance;

    TrafficManager.onUpdate(async (snapshot) => {
      try {
        const provider = snapshot?.provider;
        const state = snapshot?.state || {};
        if (!provider) return;

        const currentThinking = state.thinkingState || "idle";
        const prevThinking = this._lastThinkingState[provider] || "idle";
        this._lastThinkingState[provider] = currentThinking;

        if (prevThinking !== "idle" && currentThinking === "idle") {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          await this.syncProvider(provider, { from: "auto" });
        }

        if (
          state.loadingJustEnded &&
          state.loadingEndedAt > this._lastLoadingEnded[provider]
        ) {
          this._lastLoadingEnded[provider] = state.loadingEndedAt;
          await new Promise((resolve) => setTimeout(resolve, 2000));
          await this.syncProvider(provider, { from: "auto" });
        }
      } catch (err) {
        console.warn("SyncHandler onUpdate error:", err);
      }
    });
  }

  async syncProvider(provider, opts = {}) {
    if (!provider) return { success: false, message: "no-provider" };

    if (opts?.from === "manual") {
      if (this._syncRetryTimers[provider]) {
        clearTimeout(this._syncRetryTimers[provider]);
      }
      this._syncRetryCounts[provider] = 0;
    }

    try {
      WebviewManager.setSettings(this.coreEngine.settings);
      LogManager.addEvent(
        "core",
        "info",
        `syncProvider called for ${provider} (source=${opts.from || "manual"})`,
      );

      const res = await WebviewManager.syncConversation(provider);
      this._lastSyncResult[provider] = res;
      const lastAfter = res.messages?.[res.messages.length - 1];
      const stableAfter =
        lastAfter && lastAfter.role && lastAfter.role !== "user";
      if (stableAfter) {
        this._notifyStable(provider, res);
      }
      if (!res) return { success: false, message: "no-result" };

      if (res.count === 0) {
        return res;
      }

      const last = res.messages?.[res.messages.length - 1];
      if (last?.role === "user") {
        const tried = this._syncRetryCounts[provider] || 0;
        if (tried < this.syncRetryLimit) {
          LogManager.addEvent(
            "core",
            "info",
            `SyncProvider: last message is user for ${provider}, scheduling retry...`,
          );
          this._syncRetryCounts[provider] = tried + 1;
          this._syncRetryTimers[provider] = setTimeout(() => {
            if (AppState.getConnection(provider)) {
              this.syncProvider(provider, { from: "retry" });
            }
          }, 3000);
        }
      } else {
        if (this._syncRetryTimers[provider])
          clearTimeout(this._syncRetryTimers[provider]);
        this._syncRetryCounts[provider] = 0;
      }

      if (res.success) {
        await ConversationListManager.refresh({
          silent: true,
          forceSelectId: res.meta?.id,
        });
      }

      if (res.commands?.length > 0) {
        for (const cmd of res.commands) {
          await this.coreEngine.handleCaughtCommand(cmd.command, {
            ...cmd,
            source: opts.from || "auto",
          });
        }
      }

      return res;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      LogManager.addEvent(
        "core",
        "error",
        `syncProvider error for ${provider}: ${message}`,
      );
      return { success: false, message };
    }
  }

  _notifyStable(provider, res) {
    try {
      const list = this._stableListeners[provider] || [];
      delete this._stableListeners[provider];
      for (const cb of list) {
        try {
          cb(null, res);
        } catch (e) {
          /* noop */
        }
      }
      try {
        this._processPendingArchives(provider, res);
      } catch (e) {
        /* noop */
      }
    } catch (e) {
      /* noop */
    }
  }

  _processPendingArchives(provider, res) {
    try {
      const list = this._pendingArchives[provider] || [];
      if (!list.length) return;
      delete this._pendingArchives[provider];
      const history = res?.messages || [];
      const lastUserIdx = [...history]
        .reverse()
        .findIndex((m) => m.role === "user");
      const messageIndex =
        lastUserIdx === -1 ? history.length : history.length - 1 - lastUserIdx;
      for (const entry of list) {
        try {
          const targetDir = `${entry.folder}/msg-${Math.max(0, messageIndex)}`;
          LogManager.addEvent(
            "archive",
            "info",
            "Processing pending archive copy",
            {
              jobId: entry.jobId,
              provider,
              targetDir,
            },
          );
          Promise.resolve(
            FileManager.commandArchiveCopy(entry.jobId, targetDir),
          )
            .then((r) => {
              if (r?.success) {
                LogManager.addEvent(
                  "command",
                  "info",
                  `Arşiv kopyalandı (${targetDir})`,
                  {
                    jobId: entry.jobId,
                  },
                );
                try {
                  FileManager.commandCleanup(entry.jobId, entry.temp || []);
                } catch (e) {
                  LogManager.addEvent(
                    "command",
                    "warning",
                    `Arşiv sonrası temizlik hatası: ${e?.message || String(e)}`,
                    { jobId: entry.jobId },
                  );
                }
              } else {
                LogManager.addEvent(
                  "command",
                  "warning",
                  `Arşiv kopyalanamadı (pending): ${r?.message || "bilinmiyor"}`,
                  { jobId: entry.jobId, targetDir },
                );
              }
            })
            .catch((err) => {
              LogManager.addEvent(
                "command",
                "warning",
                `Arşiv kopyalama hatası (pending): ${err?.message || String(err)}`,
                { jobId: entry.jobId },
              );
            });
        } catch (e) {
          LogManager.addEvent(
            "archive",
            "warning",
            `Pending archive processing error: ${e?.message || String(e)}`,
            { jobId: entry.jobId },
          );
        }
      }
    } catch (e) {
      /* noop */
    }
  }

  addPendingArchive(provider, entry) {
    if (!provider || !entry) return;
    this._pendingArchives[provider] = this._pendingArchives[provider] || [];
    this._pendingArchives[provider].push(entry);
    LogManager.addEvent("archive", "debug", "Pending archive registered", {
      jobId: entry.jobId,
      provider,
      folder: entry.folder,
    });
  }
}

export const SyncHandler = new SyncHandlerClass();
