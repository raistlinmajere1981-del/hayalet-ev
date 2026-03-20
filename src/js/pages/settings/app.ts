import { bootstrapExternalToolPage } from "../shared/bootstrap-external-tool-page.js";
import { resolveExternalPanel } from "../shared/external-page.js";
import { applySettingsPanelStaticTranslations } from "./panel-i18n.js";
import { SettingsPageController, resolveSettingsPanelId } from "./controller.js";
import { setupSettingsAccountsPanel } from "./panels/accounts.js";
import { setupSettingsBackupPanel } from "./panels/backup.js";
import { setupSettingsLiveLogPanel } from "./panels/live-log.js";
import { setupSettingsRoomsPanel } from "./panels/rooms.js";
import { setupSettingsThemePanel } from "./panels/theme.js";

async function bootstrapSettingsPage(): Promise<void> {
  await bootstrapExternalToolPage({
    applyStaticTranslations: () => {
      applySettingsPanelStaticTranslations();
    },
    initializeRooms: true,
    initializeTraffic: true,
  });

  setupSettingsAccountsPanel();
  setupSettingsBackupPanel();
  setupSettingsRoomsPanel();
  setupSettingsLiveLogPanel();
  setupSettingsThemePanel();

  const controller = new SettingsPageController();
  controller.init();
  controller.show(resolveSettingsPanelId(resolveExternalPanel()) ?? "theme");
}

void bootstrapSettingsPage();
