import { SettingsManager } from "../modules/settings-manager.js";
import { FileManager } from "../modules/file-manager.js";
import { UserSection } from "./settings/user-section.js";
import { GoogleDriveSection } from "./settings/googledrive-section.js";
import { AccountsSection } from "./settings/accounts-section.js";
import { SlotsSection } from "./settings/slots-section.js";

export class SettingsController {
  constructor() {
    this.settingsManager = SettingsManager;
    this.sections = {
      user: null,
      googledrive: null,
      accounts: null,
      slots: null,
    };
    this._unsubscribe = null;
  }

  async init() {
    await this.settingsManager.load();

    this.sections.user = new UserSection(this.settingsManager, FileManager);
    this.sections.googledrive = new GoogleDriveSection(this.settingsManager);
    this.sections.accounts = new AccountsSection(this.settingsManager);
    this.sections.slots = new SlotsSection(this.settingsManager);

    this.sections.user.init();
    this.sections.googledrive.init();
    this.sections.accounts.init();
    this.sections.slots.init();

    this._unsubscribe = this.settingsManager.subscribe((payload) => {
      const { changedPaths } = payload;
      if (
        changedPaths.includes("*") ||
        changedPaths.some((p) => p.startsWith("user"))
      ) {
        this.sections.user?.render();
      }
      if (
        changedPaths.includes("*") ||
        changedPaths.some((p) => p.startsWith("integrations.googledrive"))
      ) {
        this.sections.googledrive?.render();
      }
      if (
        changedPaths.includes("*") ||
        changedPaths.some((p) => p.startsWith("accounts"))
      ) {
        this.sections.accounts?.render();
        this.sections.slots?.render();
      }
      if (
        changedPaths.includes("*") ||
        changedPaths.some((p) => p.startsWith("slots"))
      ) {
        this.sections.slots?.render();
      }
    });
  }

  destroy() {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
  }
}
