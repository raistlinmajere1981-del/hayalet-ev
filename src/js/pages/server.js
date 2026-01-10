// Sunucu odası controller'ı - kontrol devri, log tabanlı paneller
import { LogManager } from "../modules/log-manager.js";
import { CoreEngine } from "../modules/core-engine.js";
import { SettingsManager } from "../modules/settings-manager.js";
import { AppState } from "../modules/app-state.js";
// FIX: Import SlotEvent for proper state change subscription
import { SlotController, SlotEvent } from "../modules/slot-controller.js";
import { TrafficManager } from "../modules/traffic-manager.js";
import { ServerCommands } from "../modules/server-commands.js";

export class ServerController {
  constructor() {
    this.isDelegated = false;
    this.availableControllers = [];
    this.unsubscribeTraffic = null;
    this.logUnsubscribe = null;
  }

  getProviderLabel(provider) {
    if (!provider) return "AI";
    if (provider === "ai1" || provider === "ai2" || provider === "user") {
      return AppState.getNickname(provider);
    }
    return provider;
  }

  async init() {
    await SettingsManager.load();

    // Realtime settings sync
    if (!this._unsubSettings) {
      this._unsubSettings = SettingsManager.subscribe(() => {
        // Settings updated
      });
    }
    this.controllerSelect = document.getElementById("server-controller-select");
    this.coreLog = document.getElementById("server-core-log");
    this.aiLog = document.getElementById("server-ai-log");
    this.delegateBtn = document.getElementById("server-delegate-btn");
    this.reclaimBtn = document.getElementById("server-reclaim-btn");
    this.commandSelect = document.getElementById("server-command-select");
    this.commandText = document.getElementById("server-command-text");

    this.delegateBtn?.addEventListener("click", () => this.assignControl());
    this.reclaimBtn?.addEventListener("click", () => this.reclaimControl());
    this.controllerSelect?.addEventListener("change", () => {
      this.updateControlButtons();
    });
    document
      .getElementById("server-command-add")
      ?.addEventListener("click", () => this.addCommandToTextarea());
    document
      .getElementById("server-command-send")
      ?.addEventListener("click", () => this.handleManualSend());

    this.renderControllerOptions();
    this.populateCommandDropdown();
    this.updateControlButtons();

    AppState.subscribe(() => {
      this.renderControllerOptions();
      this.updateControlButtons();
    });

    // FIX: SlotController state değişikliklerini dinle (bağlantı durumu için)
    if (!this._unsubSlotController) {
      this._unsubSlotController = SlotController.on(SlotEvent.STATE_CHANGED, () => {
        this.renderControllerOptions();
        this.updateControlButtons();
      });
    }

    this.unsubscribeTraffic = TrafficManager.onUpdate((snapshot) => {
      if (!snapshot) return;
      this.updateControlButtons();
    });

    this.logUnsubscribe = LogManager.onUpdate((entry) => {
      this.handleLogEntry(entry);
    });

    this.renderLogs();
  }

  renderControllerOptions() {
    if (!this.controllerSelect) return;
    const providers = [
      { key: "ai1", fallback: "AI1" },
      { key: "ai2", fallback: "AI2" },
    ];

    const available = providers.filter((p) => {
      return SlotController.isConnected(p.key);
    });
    this.availableControllers = available;
    this.controllerSelect.innerHTML = "";
    if (!available.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "Bağlı AI yok";
      this.controllerSelect.appendChild(opt);
    } else {
      available.forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.key;
        opt.textContent = AppState.getNickname(p.key);
        this.controllerSelect.appendChild(opt);
      });
    }
  }

  updateControlButtons() {
    const hasConnectedAI =
      this.availableControllers && this.availableControllers.length > 0;
    const delegateBtn = document.getElementById("server-delegate-btn");
    const reclaimBtn = document.getElementById("server-reclaim-btn");

    if (delegateBtn) {
      delegateBtn.disabled = !hasConnectedAI;
    }
    if (reclaimBtn) {
      reclaimBtn.disabled = !hasConnectedAI;
    }
  }

  populateCommandDropdown() {
    if (!this.commandSelect) return;
    const all = Array.isArray(ServerCommands.list())
      ? ServerCommands.list()
      : [];
    this.commandSelect.innerHTML = "";
    all.forEach((cmd) => {
      const opt = document.createElement("option");
      opt.value = cmd;
      opt.textContent = cmd;
      this.commandSelect.appendChild(opt);
    });
  }

  addCommandToTextarea() {
    if (!this.commandSelect || !this.commandText) return;
    const selected = this.commandSelect.value || "";
    if (!selected) return;
    const current = this.commandText.value || "";
    const insertion = `++cmd:${selected}()`;
    this.commandText.value = current ? `${current}\n${insertion}` : insertion;
  }

  async assignControl() {
    const controller = this.controllerSelect?.value || "ai1";
    if (!controller) return;
    await CoreEngine.sendProtocol({
      room: "server",
      scenario: "takecontrol",
      targets: [controller],
    });
    this.isDelegated = true;
    this.updateControlButtons();
  }

  async reclaimControl() {
    const controller = this.controllerSelect?.value || "ai1";
    LogManager.addEvent("server", "info", "Kontrol devralındı (insan)");
    LogManager.addEvent("server", "info", "Kontrol insana devralındı");
    this.isDelegated = false;
    this.updateControlButtons();
    await CoreEngine.sendBatch({
      targets: [controller],
      text: "Kontrol Devralındı",
      page: "server",
    });
  }

  async handleManualSend() {
    const text = (this.commandText?.value || "").trim();
    if (!text) return;
    const provider = this.controllerSelect?.value || "ai1";
    const regex = /\+\+cmd:([A-Za-z0-9_]+)\((.*?)\)/g;
    const matches = [];
    let m;
    while ((m = regex.exec(text)) !== null) {
      matches.push({ name: m[1], args: (m[2] || "").trim() });
    }
    if (!matches.length) {
      LogManager.addEvent("server", "warning", "Komut bulunamadı");
      return;
    }
    matches.forEach(async (cmd) => {
      await CoreEngine.handleCaughtCommand(cmd.name, {
        provider,
        args: cmd.args,
        source: "manual",
      });
    });
  }

  onShow() {
    this.renderControllerOptions();
    this.updateControlButtons();
    this.renderLogs();
  }

  onHide() {
    try {
      this._unsubSettings?.();
      this._unsubSettings = null;
    } catch (_) {
      void 0;
    }
  }

  handleLogEntry(entry) {
    if (!entry) return;
    this.renderLogs();
  }

  renderLogs() {
    const recent = LogManager.getRecent ? LogManager.getRecent(200) : [];
    const aiList = [];
    const coreList = [];
    recent.forEach((entry) => {
      if (!entry) return;
      const src = entry.source || "";
      if (src === "command-catch") {
        const provider = entry.meta?.provider || "";
        const sender = entry.meta?.sender || this.getProviderLabel(provider);
        const cmd = entry.meta?.command || entry.message || "";
        const args = entry.meta?.args ? ` (${entry.meta.args})` : "";
        const stamp = entry.meta?.timestamp || entry.timestamp || "";
        aiList.push(`${sender} - ${cmd}${args ? ` ${args}` : ""} - ${stamp}`);
        return;
      }
      if (src === "command-result") {
        const provider = entry.meta?.provider || "";
        const sender = entry.meta?.sender || this.getProviderLabel(provider);
        const cmd = entry.meta?.command || "";
        const args = entry.meta?.args ? ` (${entry.meta.args})` : "";
        const stamp = entry.meta?.timestamp || entry.timestamp || "";
        const detail = entry.meta?.detail || entry.message || "";
        coreList.push(`${sender} - ${cmd}${args} - ${stamp} - ${detail}`);
      }
    });
    this.renderLogColumn(this.aiLog, aiList);
    this.renderLogColumn(this.coreLog, coreList);
  }

  renderLogColumn(el, list = []) {
    if (!el) return;
    el.innerHTML = "";
    [...list]
      .reverse()
      .slice(0, 100)
      .forEach((msg) => {
        const div = document.createElement("div");
        div.className = "log-entry";
        div.textContent = msg;
        el.appendChild(div);
      });
  }
}
