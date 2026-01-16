function minimizeToTaskbar() {
  try {
    window.electronAPI?.windowMinimize?.();
  } catch (err) {
  }
}

function minimizeToTray() {
  try {
    window.electronAPI?.windowMinimizeToTray?.();
  } catch (err) {
  }
}

function toggleFullscreen() {
  try {
    window.electronAPI?.windowToggleFullscreen?.();
  } catch (err) {
  }
}

function closeApp() {
  try {
    window.electronAPI?.windowClose?.();
  } catch (err) {
  }
}

function setWindowState(state: string, _payload: any = {}) {
  const normalized = (state || "").toLowerCase();
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
  if (
    normalized === "hidemenu" ||
    normalized === "hidemen" ||
    normalized === "hide-menu"
  ) {
    document.body?.classList.add("menu-hidden");
    return true;
  }
  if (
    normalized === "showmenu" ||
    normalized === "show-men" ||
    normalized === "show-menu"
  ) {
    document.body?.classList.remove("menu-hidden");
    return true;
  }
  if (
    normalized === "togglemenu" ||
    normalized === "toggle-men" ||
    normalized === "toggle-menu"
  ) {
    document.body?.classList.toggle("menu-hidden");
    return true;
  }
  return minimizeToTaskbar();
}

export const WindowManager = {
  minimizeToTaskbar,
  minimizeToTray,
  toggleFullscreen,
  closeApp,
  setWindowState,
  apply(action, payload = {}) {
    switch (action) {
      case "minimize":
        minimizeToTaskbar();
        return true;
      case "fullscreen":
        toggleFullscreen();
        return true;
      case "hideMenu":
        document.body?.classList.add("menu-hidden");
        return true;
      case "showMenu":
        document.body?.classList.remove("menu-hidden");
        return true;
      case "toggleMenu":
        document.body?.classList.toggle("menu-hidden");
        return true;
      case "alwaysOnTop":
        window.electronAPI?.windowToggleFullscreen?.();
        return true;
      default:
        return setWindowState(action, payload);
    }
  },
};
