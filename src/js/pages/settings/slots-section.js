
export class SlotsSection {
  constructor(settingsManager) {
    this.settingsManager = settingsManager;
  }

  init() {
    this.setupListeners();
    this.render();
  }

  setupListeners() {
    ["ai1", "ai2"].forEach((slot) => {
      const accountSelect = /** @type {HTMLSelectElement|null} */ (
        document.getElementById(`settings-${slot}-account`)
      );
      if (accountSelect) {
        accountSelect.addEventListener("change", (e) => {
          const target = /** @type {HTMLSelectElement} */ (e.target);
          const accountId = target.value || null;
          this.assignAccountToSlot(slot, accountId);
        });
      }

      const msgMethodSelect = /** @type {HTMLSelectElement|null} */ (
        document.getElementById(`settings-${slot}-message-method`)
      );
      if (msgMethodSelect) {
        msgMethodSelect.addEventListener("change", (e) => {
          const target = /** @type {HTMLSelectElement} */ (e.target);
          this.updateSlotMethod(slot, "messageMethod", target.value);
        });
      }

      const fileMethodSelect = /** @type {HTMLSelectElement|null} */ (
        document.getElementById(`settings-${slot}-file-method`)
      );
      if (fileMethodSelect) {
        fileMethodSelect.addEventListener("change", (e) => {
          const target = /** @type {HTMLSelectElement} */ (e.target);
          this.updateSlotMethod(slot, "fileMethod", target.value);
        });
      }

      const catchToggle = /** @type {HTMLInputElement|null} */ (
        document.getElementById(`settings-${slot}-catch`)
      );
      if (catchToggle) {
        catchToggle.addEventListener("change", (e) => {
          const target = /** @type {HTMLInputElement} */ (e.target);
          this.updateSlotCatch(slot, target.checked);
        });
      }
    });
  }

  async render() {
    await this.renderAccountDropdowns();
    await this.renderSlotSettings();
  }

  async renderAccountDropdowns() {
    const ai1Select = /** @type {HTMLSelectElement|null} */ (
      document.getElementById("settings-ai1-account")
    );
    const ai2Select = /** @type {HTMLSelectElement|null} */ (
      document.getElementById("settings-ai2-account")
    );
    if (!ai1Select || !ai2Select) return;

    const settings = this.settingsManager.getSnapshot();
    const accounts = settings?.accounts || [];
    const slots = settings?.slots || {};

    const ai1Provider =
      accounts.find((a) => a.id === slots.ai1?.accountId)?.provider || "";
    const ai2Provider =
      accounts.find((a) => a.id === slots.ai2?.accountId)?.provider || "";

    const ai1Accounts = ai1Provider
      ? accounts.filter((a) => a.provider === ai1Provider)
      : accounts;
    const ai2Accounts = ai2Provider
      ? accounts.filter((a) => a.provider === ai2Provider)
      : accounts;

    const generateOptions = (accs) =>
      '<option value="">-- Hesap seç --</option>' +
      accs
        .map(
          (acc) =>
            `<option value="${this.escapeHtml(acc.id)}">${this.escapeHtml(acc.nickname || acc.email)} (${this.escapeHtml(acc.provider)})</option>`,
        )
        .join("");

    ai1Select.innerHTML = generateOptions(ai1Accounts);
    ai2Select.innerHTML = generateOptions(ai2Accounts);

    if (ai1Select && slots.ai1?.accountId)
      ai1Select.value = slots.ai1.accountId;
    if (ai2Select && slots.ai2?.accountId)
      ai2Select.value = slots.ai2.accountId;
  }

  async renderSlotSettings() {
    const settings = this.settingsManager.getSnapshot();
    const slots = settings?.slots || {};

    ["ai1", "ai2"].forEach((slot) => {
      const slotSettings = slots[slot] || {};

      const msgMethodSelect = /** @type {HTMLSelectElement|null} */ (
        document.getElementById(`settings-${slot}-message-method`)
      );
      if (msgMethodSelect) {
        msgMethodSelect.value = slotSettings.messageMethod || "injection";
      }

      const fileMethodSelect = /** @type {HTMLSelectElement|null} */ (
        document.getElementById(`settings-${slot}-file-method`)
      );
      if (fileMethodSelect) {
        fileMethodSelect.value = slotSettings.fileMethod || "dragdrop";
      }

      const catchToggle = /** @type {HTMLInputElement|null} */ (
        document.getElementById(`settings-${slot}-catch`)
      );
      if (catchToggle) {
        catchToggle.checked = slotSettings.catchCommands ?? true;
      }
    });
  }

  async assignAccountToSlot(slot, accountId) {
    try {
      const settings = this.settingsManager.getSnapshot();
      const slots = settings?.slots || {};

      const updated = {
        ...settings,
        slots: {
          ...slots,
          [slot]: {
            ...slots[slot],
            accountId: accountId || null,
          },
        },
      };

      await this.settingsManager.save(updated);
      await this.render();

      const message = accountId
        ? `${slot.toUpperCase()} slotuna hesap atandı (bağlı değil)`
        : `${slot.toUpperCase()} slotu boşaltıldı`;
      this.showFeedback(message, "success");
    } catch (err) {
      console.error("Assign account to slot error:", err);
      this.showFeedback(`Slot atama hatası: ${err.message}`, "error");
    }
  }

  async updateSlotMethod(slot, methodType, value) {
    try {
      const settings = this.settingsManager.getSnapshot();
      const slots = settings?.slots || {};

      const updated = {
        ...settings,
        slots: {
          ...slots,
          [slot]: {
            ...slots[slot],
            [methodType]: value,
          },
        },
      };

      await this.settingsManager.save(updated);

      const label =
        methodType === "messageMethod" ? "Mesaj metodu" : "Dosya metodu";
      this.showFeedback(
        `${slot.toUpperCase()} ${label} güncellendi`,
        "success",
      );
    } catch (err) {
      console.error("Update slot method error:", err);
      this.showFeedback(`Method güncelleme hatası: ${err.message}`, "error");
    }
  }

  async updateSlotCatch(slot, enabled) {
    try {
      const settings = this.settingsManager.getSnapshot();
      const slots = settings?.slots || {};

      const updated = {
        ...settings,
        slots: {
          ...slots,
          [slot]: {
            ...slots[slot],
            catchCommands: enabled,
          },
        },
      };

      await this.settingsManager.save(updated);

      this.showFeedback(
        `${slot.toUpperCase()} catch ${enabled ? "aktif" : "pasif"}`,
        "success",
      );
    } catch (err) {
      console.error("Update slot catch error:", err);
      this.showFeedback(`Catch güncelleme hatası: ${err.message}`, "error");
    }
  }

  escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  showFeedback(message, type = "info") {
    const statusEl = document.getElementById("settings-status");
    if (!statusEl) return;

    statusEl.textContent = message;
    statusEl.className = `form-hint ${type}`;

    setTimeout(() => {
      if (statusEl) {
        statusEl.textContent = "";
        statusEl.className = "form-hint";
      }
    }, 3000);
  }
}
