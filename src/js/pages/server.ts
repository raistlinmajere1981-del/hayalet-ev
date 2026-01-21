import { LogManager } from "../modules/log-manager.js";
import { CoreEngine } from "../modules/core-engine.js";
import { SettingsManager } from "../modules/settings-manager.js";
import { AppState } from "../modules/app-state.js";
import { SlotController, SlotEvent } from "../modules/slot-controller.js";
import { TrafficManager } from "../modules/traffic-manager.js";
import { ServerCommands } from "../modules/server-commands.js";
import { ButtonStates } from "../ui/button-states.js";

export class ServerController {
  // State
  isDelegated: boolean;
  availableControllers: { key: string; fallback: string }[];
  unsubscribeTraffic: (() => void) | null;
  logUnsubscribe: (() => void) | null;
  _unsubSettings: (() => void) | null;
  _unsubSlotController: (() => void) | null;

  // DOM Elements
  controllerSelect: HTMLSelectElement | null;
  coreLog: HTMLElement | null;
  aiLog: HTMLElement | null;
  delegateBtn: HTMLButtonElement | null;
  reclaimBtn: HTMLButtonElement | null;
  commandSelect: HTMLSelectElement | null;
  commandText: HTMLTextAreaElement | null;
  commandGuide: HTMLElement | null;

  constructor() {
    this.isDelegated = false;
    this.availableControllers = [];
    this.unsubscribeTraffic = null;
    this.logUnsubscribe = null;
    this._unsubSettings = null;
    this._unsubSlotController = null;

    // DOM Elements init
    this.controllerSelect = null;
    this.coreLog = null;
    this.aiLog = null;
    this.delegateBtn = null;
    this.reclaimBtn = null;
    this.commandSelect = null;
    this.commandText = null;
    this.commandGuide = null;
  }

  getProviderLabel(provider: string | null) {
    if (!provider) return "AI";
    if (provider === "ai1" || provider === "ai2" || provider === "user") {
      return AppState.getNickname(provider);
    }
    return provider;
  }

  async init() {
    await SettingsManager.load();

    if (!this._unsubSettings) {
      this._unsubSettings = SettingsManager.subscribe(() => {
      });
    }
    this.controllerSelect = document.getElementById("server-controller-select") as HTMLSelectElement | null;
    this.coreLog = document.getElementById("server-core-log");
    this.aiLog = document.getElementById("server-ai-log");
    this.delegateBtn = document.getElementById("server-delegate-btn") as HTMLButtonElement | null;
    this.reclaimBtn = document.getElementById("server-reclaim-btn") as HTMLButtonElement | null;
    this.commandSelect = document.getElementById("server-command-select") as HTMLSelectElement | null;
    this.commandText = document.getElementById("server-command-text") as HTMLTextAreaElement | null;
    this.commandGuide = document.getElementById("server-command-guide");

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
    
    // Komut seçildiğinde kılavuzu göster
    this.commandSelect?.addEventListener("change", () => this.updateCommandGuide());

    this.renderControllerOptions();
    this.populateCommandDropdown();
    this.updateControlButtons();
    this.updateCommandGuide();

    AppState.subscribe(() => {
      this.renderControllerOptions();
      this.updateControlButtons();
    });

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
        this.controllerSelect?.appendChild(opt);
      });
    }
  }

  updateControlButtons() {
    const hasConnectedAI =
      this.availableControllers && this.availableControllers.length > 0;
    const delegateBtn = document.getElementById("server-delegate-btn") as HTMLButtonElement | null;
    const reclaimBtn = document.getElementById("server-reclaim-btn") as HTMLButtonElement | null;

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
      this.commandSelect?.appendChild(opt);
    });
  }

  updateCommandGuide() {
    if (!this.commandGuide || !this.commandSelect) return;
    const selected = this.commandSelect.value;
    // Command guide kaldırıldı - komut adı göster
    (this.commandGuide as HTMLTextAreaElement).value = selected ? `Komut: ${selected}` : "";
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
    
    // Loading state
    if (this.delegateBtn) {
      ButtonStates.setLoading(this.delegateBtn, "Devrediliyor...");
    }
    
    try {
      await CoreEngine.sendProtocol({
        room: "server",
        scenario: "takecontrol",
        targets: [controller],
      });
      this.isDelegated = true;
      
      if (this.delegateBtn) {
        ButtonStates.setSuccess(this.delegateBtn, "Devredildi!", 1500);
      }
      LogManager.addEvent("server", "success", `Kontrol ${AppState.getNickname(controller)}'e devredildi`);
    } catch (e) {
      if (this.delegateBtn) {
        ButtonStates.setError(this.delegateBtn, "Hata!", 1500);
      }
      LogManager.addEvent("server", "error", "Kontrol devretme hatası");
    }
    
    setTimeout(() => this.updateControlButtons(), 1600);
  }

  async reclaimControl() {
    const controller = this.controllerSelect?.value || "ai1";
    
    // Loading state
    if (this.reclaimBtn) {
      ButtonStates.setLoading(this.reclaimBtn, "Devralınıyor...");
    }
    
    try {
      await CoreEngine.sendBatch({
        targets: [controller],
        text: "Kontrol Devralındı",
        page: "server",
      });
      
      this.isDelegated = false;
      
      if (this.reclaimBtn) {
        ButtonStates.setSuccess(this.reclaimBtn, "Devralındı!", 1500);
      }
      LogManager.addEvent("server", "success", "Kontrol insana devralındı", { visibility: 1 });
    } catch (e) {
      if (this.reclaimBtn) {
        ButtonStates.setError(this.reclaimBtn, "Hata!", 1500);
      }
      LogManager.addEvent("server", "error", "Kontrol devralma hatası", { visibility: 1 });
    }
    
    setTimeout(() => this.updateControlButtons(), 1600);
  }

  async handleManualSend() {
    const text = (this.commandText?.value || "").trim();
    if (!text) return;
    
    const sendBtn = document.getElementById("server-command-send") as HTMLButtonElement | null;
    const provider = this.controllerSelect?.value || "ai1";
    const regex = /\+\+cmd:([A-Za-z0-9_]+)\((.*?)\)/g;
    const matches = [];
    let m;
    while ((m = regex.exec(text)) !== null) {
      matches.push({ name: m[1], args: (m[2] || "").trim() });
    }
    if (!matches.length) {
      if (sendBtn) {
        ButtonStates.setError(sendBtn, "Komut Yok!", 1500);
      }
      LogManager.addEvent("server", "warning", "Komut bulunamadı");
      return;
    }
    
    // Loading state
    if (sendBtn) {
      ButtonStates.setLoading(sendBtn, "Gönderiliyor...");
    }
    
    try {
      for (const cmd of matches) {
        await CoreEngine.handleCaughtCommand(cmd.name, {
          provider,
          args: cmd.args,
          source: "manual",
        });
      }
      
      if (sendBtn) {
        ButtonStates.setSuccess(sendBtn, "Gönderildi!", 1500);
      }
      LogManager.addEvent("server", "success", `${matches.length} komut gönderildi`, { showToast: false });
    } catch (e) {
      if (sendBtn) {
        ButtonStates.setError(sendBtn, "Hata!", 1500);
      }
      LogManager.addEvent("server", "error", "Komut gönderme hatası");
    }
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

  handleLogEntry(entry: any) {
    if (!entry) return;
    this.renderLogs();
  }

  renderLogs() {
    const recent = LogManager.getRecent ? LogManager.getRecent(200) : [];
    const aiList: string[] = [];
    const coreList: string[] = [];
    recent.forEach((entry: any) => {
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

  renderLogColumn(el: HTMLElement | null, list: string[] = []) {
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
