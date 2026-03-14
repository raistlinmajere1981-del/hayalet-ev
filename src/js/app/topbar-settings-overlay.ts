const SETTINGS_PANELS = ["theme", "accounts", "backup", "rooms", "live-log"] as const;

type SettingsPanelId = (typeof SETTINGS_PANELS)[number];

interface SettingsHubState {
  open: boolean;
  activePanel: SettingsPanelId | null;
}

function isSettingsPanelId(value: string): value is SettingsPanelId {
  return SETTINGS_PANELS.includes(value as SettingsPanelId);
}

function dispatchSettingsHubState(state: SettingsHubState): void {
  document.dispatchEvent(
    new CustomEvent<SettingsHubState>("settings-hub:state-change", {
      detail: state,
    })
  );
}

export function setupSettingsHub(): void {
  const overlay = document.getElementById("settings-hub-overlay");
  const backdrop = document.getElementById("settings-hub-backdrop");
  const openButton = document.getElementById("topbar-settings-open");
  const closeButton = document.getElementById("settings-hub-close");
  const tabButtons = Array.from(document.querySelectorAll<HTMLButtonElement>(".settings-hub-tab"));
  const panels = Array.from(document.querySelectorAll<HTMLElement>(".settings-hub-panel"));

  if (
    overlay == null ||
    backdrop == null ||
    openButton == null ||
    closeButton == null ||
    tabButtons.length === 0 ||
    panels.length === 0
  ) {
    return;
  }

  let isOpen = false;
  let activePanel: SettingsPanelId = "theme";

  const syncActivePanelUi = (): void => {
    tabButtons.forEach((button) => {
      const panelId = button.dataset["settingsPanel"] ?? "";
      const isActive = panelId === activePanel;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", String(isActive));
      button.tabIndex = isActive ? 0 : -1;
    });

    panels.forEach((panel) => {
      const panelId = panel.dataset["settingsPanel"] ?? "";
      const isActive = panelId === activePanel;
      panel.classList.toggle("is-active", isActive);
      panel.classList.toggle("is-hidden", !isActive);
      panel.setAttribute("aria-hidden", String(!isActive));
      panel.toggleAttribute("hidden", !isActive);
    });
  };

  const open = (panelId: SettingsPanelId = activePanel): void => {
    activePanel = panelId;
    isOpen = true;
    overlay.classList.remove("is-hidden");
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("is-scroll-locked");
    syncActivePanelUi();
    dispatchSettingsHubState({ open: true, activePanel });
  };

  const close = (): void => {
    if (!isOpen) {
      return;
    }

    isOpen = false;
    overlay.classList.add("is-hidden");
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("is-scroll-locked");
    dispatchSettingsHubState({ open: false, activePanel: null });
  };

  const selectPanel = (panelId: SettingsPanelId): void => {
    activePanel = panelId;
    syncActivePanelUi();

    if (isOpen) {
      dispatchSettingsHubState({ open: true, activePanel });
    }
  };

  openButton.addEventListener("click", () => {
    open(activePanel);
  });

  closeButton.addEventListener("click", close);
  backdrop.addEventListener("click", close);

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const panelId = button.dataset["settingsPanel"] ?? "";
      if (!isSettingsPanelId(panelId)) {
        return;
      }

      if (!isOpen) {
        open(panelId);
        return;
      }

      selectPanel(panelId);
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isOpen) {
      close();
    }
  });

  document.addEventListener("settings-hub:open", ((event: CustomEvent<{ panel?: string }>) => {
    const requestedPanel = event.detail.panel ?? "";
    open(isSettingsPanelId(requestedPanel) ? requestedPanel : activePanel);
  }) as EventListener);

  document.addEventListener("settings-hub:close", () => {
    close();
  });

  syncActivePanelUi();
}
