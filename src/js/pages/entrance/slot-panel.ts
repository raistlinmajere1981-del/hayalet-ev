export class SlotPanel {
  slotId: string;
  settingsManager: any;

  constructor(slotId: string, settingsManager: any) {
    this.slotId = slotId; // "ai1" or "ai2"
    this.settingsManager = settingsManager;
  }

  init() {
    this.setupListeners();
    this.render();
  }

  setupListeners() {
    // No more toggles - Settings are always visible

    // Diğer slot'ta hesap değiştiğinde bu slot'un listesini güncelle
    window.addEventListener("slot-account-changed", ((e: CustomEvent) => {
      if (e.detail.slot !== this.slotId) {
        this.render(); // Diğer slot değiştiyse bu slot'u güncelle
      }
    }) as EventListener);

    // Account Select
    const accSelect = document.getElementById(`${this.slotId}-account-select`) as HTMLSelectElement | null;
    accSelect?.addEventListener("change", (e) => {
      this.updateSetting("accountId", (e.target as HTMLSelectElement).value || null);
    });

    // Methods
    const msgSelect = document.getElementById(`${this.slotId}-msg-method`) as HTMLSelectElement | null;
    msgSelect?.addEventListener("change", (e) => {
      this.updateSetting("messageMethod", (e.target as HTMLSelectElement).value);
    });

    const fileSelect = document.getElementById(`${this.slotId}-file-method`) as HTMLSelectElement | null;
    fileSelect?.addEventListener("change", (e) => {
      this.updateSetting("fileMethod", (e.target as HTMLSelectElement).value);
    });

    const catchCheck = document.getElementById(`${this.slotId}-catch-check`) as HTMLInputElement | null;
    catchCheck?.addEventListener("change", (e) => {
      this.updateSetting("catchCommands", (e.target as HTMLInputElement).checked);
    });
  }

  async render() {
    const settings = this.settingsManager.getSnapshot();
    const slotSettings = settings.slots?.[this.slotId] || {};
    const accounts = settings.accounts || [];

    // Filter accounts (don't show account used by OTHER slot)
    const otherSlot = this.slotId === "ai1" ? "ai2" : "ai1";
    const otherAccountId = settings.slots?.[otherSlot]?.accountId;
    
    const availableAccounts = accounts.filter((a: { id: string }) => {
        if (a.id === slotSettings.accountId) return true; // Show self
        if (a.id === otherAccountId) return false; // Hide other
        return true;
    });

    // Render Account Select
    const accSelect = document.getElementById(`${this.slotId}-account-select`) as HTMLSelectElement | null;
    if (accSelect) {
      const currentVal = slotSettings.accountId || "";
      accSelect.innerHTML = '<option value="">-- Hesap Seç --</option>' + 
        availableAccounts.map((a: any) => 
            `<option value="${a.id}">${a.nickname || a.email} (${a.provider})</option>`
        ).join("");
      accSelect.value = currentVal;
    }

    // Render Settings
    const msgSelect = document.getElementById(`${this.slotId}-msg-method`) as HTMLSelectElement | null;
    if (msgSelect) msgSelect.value = slotSettings.messageMethod || "injection";

    const fileSelect = document.getElementById(`${this.slotId}-file-method`) as HTMLSelectElement | null;
    if (fileSelect) fileSelect.value = slotSettings.fileMethod || "dragdrop";

    const catchCheck = document.getElementById(`${this.slotId}-catch-check`) as HTMLInputElement | null;
    if (catchCheck) catchCheck.checked = slotSettings.catchCommands ?? true;
  }

  async updateSetting(key: string, value: unknown) {
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
    
    // Hesap değiştiğinde her iki slot'un listesini güncelle
    if (key === "accountId") {
      window.dispatchEvent(new CustomEvent("slot-account-changed", { 
        detail: { slot: this.slotId, accountId: value } 
      }));
    }
    
    this.render(); 
  }
}