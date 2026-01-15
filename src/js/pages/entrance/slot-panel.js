export class SlotPanel {
  constructor(slotId, settingsManager) {
    this.slotId = slotId; // "ai1" or "ai2"
    this.settingsManager = settingsManager;
  }

  init() {
    this.setupListeners();
    this.render();
  }

  setupListeners() {
    // No more toggles - Settings are always visible

    // Account Select
    const accSelect = document.getElementById(`${this.slotId}-account-select`);
    accSelect?.addEventListener("change", (e) => {
      this.updateSetting("accountId", e.target.value || null);
    });

    // Methods
    const msgSelect = document.getElementById(`${this.slotId}-msg-method`);
    msgSelect?.addEventListener("change", (e) => {
      this.updateSetting("messageMethod", e.target.value);
    });

    const fileSelect = document.getElementById(`${this.slotId}-file-method`);
    fileSelect?.addEventListener("change", (e) => {
      this.updateSetting("fileMethod", e.target.value);
    });

    const catchCheck = document.getElementById(`${this.slotId}-catch-check`);
    catchCheck?.addEventListener("change", (e) => {
      this.updateSetting("catchCommands", e.target.checked);
    });
  }

  async render() {
    const settings = this.settingsManager.getSnapshot();
    const slotSettings = settings.slots?.[this.slotId] || {};
    const accounts = settings.accounts || [];

    // Filter accounts (don't show account used by OTHER slot)
    const otherSlot = this.slotId === "ai1" ? "ai2" : "ai1";
    const otherAccountId = settings.slots?.[otherSlot]?.accountId;
    
    const availableAccounts = accounts.filter(a => {
        if (a.id === slotSettings.accountId) return true; // Show self
        if (a.id === otherAccountId) return false; // Hide other
        return true;
    });

    // Render Account Select
    const accSelect = document.getElementById(`${this.slotId}-account-select`);
    if (accSelect) {
      const currentVal = slotSettings.accountId || "";
      accSelect.innerHTML = '<option value="">-- Hesap Seç --</option>' + 
        availableAccounts.map(a => 
            `<option value="${a.id}">${a.nickname || a.email} (${a.provider})</option>`
        ).join("");
      accSelect.value = currentVal;
    }

    // Render Settings
    const msgSelect = document.getElementById(`${this.slotId}-msg-method`);
    if (msgSelect) msgSelect.value = slotSettings.messageMethod || "injection";

    const fileSelect = document.getElementById(`${this.slotId}-file-method`);
    if (fileSelect) fileSelect.value = slotSettings.fileMethod || "dragdrop";

    const catchCheck = document.getElementById(`${this.slotId}-catch-check`);
    if (catchCheck) catchCheck.checked = slotSettings.catchCommands ?? true;
  }

  async updateSetting(key, value) {
    const settings = this.settingsManager.getSnapshot();
    const slots = settings.slots || {};
    
    const updated = {
        ...settings,
        slots: {
            ...slots,
            [this.slotId]: {
                ...slots[this.slotId],
                [key]: value
            }
        }
    };
    
    await this.settingsManager.save(updated);
    this.render(); 
  }
}