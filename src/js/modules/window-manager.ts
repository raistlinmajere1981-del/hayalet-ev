function minimizeToTaskbar(): void {
  try {
    window.electronAPI?.windowMinimize();
  } catch {}
}

function minimizeToTray(): void {
  try {
    window.electronAPI?.windowMinimizeToTray();
  } catch {}
}

function toggleFullscreen(): void {
  try {
    window.electronAPI?.windowToggleFullscreen();
  } catch {}
}

function closeApp(): void {
  try {
    window.electronAPI?.windowClose();
  } catch {}
}

function setWindowState(state: string, _payload: Record<string, unknown> = {}): boolean {
  const normalized = state.toLowerCase();
  if (normalized === "fullscreen" || normalized === "full") {
    toggleFullscreen();
    return true;
  }
  if (normalized === "close") {
    closeApp();
    return true;
  }
  if (normalized === "minimize") {
    minimizeToTaskbar();
    return true;
  }
  if (normalized === "hidemenu" || normalized === "hidemen" || normalized === "hide-menu") {
    document.body.classList.add("menu-hidden");
    return true;
  }
  if (normalized === "showmenu" || normalized === "show-men" || normalized === "show-menu") {
    document.body.classList.remove("menu-hidden");
    return true;
  }
  if (normalized === "togglemenu" || normalized === "toggle-men" || normalized === "toggle-menu") {
    document.body.classList.toggle("menu-hidden");
    return true;
  }
  return false;
}

const windowManager = {
  minimizeToTaskbar,
  minimizeToTray,
  toggleFullscreen,
  closeApp,
  setWindowState,
  apply(action: string, payload: Record<string, unknown> = {}): boolean {
    switch (action) {
      case "minimize":
        minimizeToTaskbar();
        return true;
      case "fullscreen":
        toggleFullscreen();
        return true;
      case "hideMenu":
        document.body.classList.add("menu-hidden");
        return true;
      case "showMenu":
        document.body.classList.remove("menu-hidden");
        return true;
      case "toggleMenu":
        document.body.classList.toggle("menu-hidden");
        return true;
      case "alwaysOnTop":
        window.electronAPI?.windowToggleFullscreen();
        return true;
      default:
        return setWindowState(action, payload);
    }
  },
};

export { windowManager as WindowManager };
