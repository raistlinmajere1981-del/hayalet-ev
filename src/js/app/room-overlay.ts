import type { InstalledRoomRecord, RoomWorkspaceEntry } from "@shared/index.js";
import type { PageController } from "./types.js";
import { showPage } from "./navigation.js";
import { syncInstalledRoomChrome } from "./room-ui.js";
import { Toast } from "../ui/toast-manager.js";
import { AppI18n } from "../modules/i18n/index.js";
import { RoomRegistry } from "../modules/rooms/room-registry.js";
import { getRoomPageName } from "../modules/rooms/room-markup.js";
import {
  buildInstalledRoomListMarkup,
  buildRoomOverlaySummary,
  buildWorkspaceRoomListMarkup,
} from "../modules/rooms/room-overlay-markup.js";
import { shellT } from "./shell-i18n.js";

interface RoomOverlayRefs {
  openButton: HTMLButtonElement | null;
  closeButton: HTMLButtonElement | null;
  importButton: HTMLButtonElement | null;
  refreshButton: HTMLButtonElement | null;
  overlay: HTMLElement | null;
  summary: HTMLElement | null;
  workspaceList: HTMLElement | null;
  installedList: HTMLElement | null;
}

interface RoomOverlayState {
  workspaceRooms: RoomWorkspaceEntry[];
  installedRooms: InstalledRoomRecord[];
  isOpen: boolean;
}

function roomText(key: string): string {
  return shellT(`rooms.${key}`);
}

function getRefs(): RoomOverlayRefs {
  return {
    openButton: document.getElementById("rooms-overlay-open") as HTMLButtonElement | null,
    closeButton: document.getElementById("rooms-overlay-close") as HTMLButtonElement | null,
    importButton: document.getElementById("rooms-overlay-import") as HTMLButtonElement | null,
    refreshButton: document.getElementById("rooms-overlay-refresh") as HTMLButtonElement | null,
    overlay: document.getElementById("rooms-overlay"),
    summary: document.getElementById("rooms-overlay-summary"),
    workspaceList: document.getElementById("rooms-workspace-list"),
    installedList: document.getElementById("rooms-installed-list"),
  };
}

function render(refs: RoomOverlayRefs, state: RoomOverlayState): void {
  refs.summary?.replaceChildren();
  if (refs.summary !== null) {
    refs.summary.innerHTML = buildRoomOverlaySummary(state.workspaceRooms, state.installedRooms);
  }

  if (refs.workspaceList !== null) {
    refs.workspaceList.innerHTML = buildWorkspaceRoomListMarkup(
      state.workspaceRooms,
      state.installedRooms
    );
  }

  if (refs.installedList !== null) {
    refs.installedList.innerHTML = buildInstalledRoomListMarkup(
      state.installedRooms,
      state.workspaceRooms
    );
  }
}

export function setupRoomOverlay(controllers: Record<string, PageController>): void {
  const refs = getRefs();
  const state: RoomOverlayState = {
    workspaceRooms: [],
    installedRooms: RoomRegistry.getInstalledRooms(),
    isOpen: false,
  };

  if (
    refs.openButton === null ||
    refs.closeButton === null ||
    refs.importButton === null ||
    refs.refreshButton === null ||
    refs.overlay === null ||
    refs.summary === null ||
    refs.workspaceList === null ||
    refs.installedList === null
  ) {
    return;
  }

  const close = (): void => {
    refs.overlay?.classList.add("hidden");
    state.isOpen = false;
    document.body.style.removeProperty("overflow");
  };

  const refresh = async (): Promise<void> => {
    state.installedRooms = await RoomRegistry.refreshInstalledRooms();
    state.workspaceRooms = await RoomRegistry.listWorkspaceRooms();
    syncInstalledRoomChrome(controllers);
    render(refs, state);
  };

  const open = async (): Promise<void> => {
    state.isOpen = true;
    refs.overlay?.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    await refresh();
  };

  RoomRegistry.subscribe((rooms) => {
    state.installedRooms = rooms;
    syncInstalledRoomChrome(controllers);
    if (state.isOpen === true) {
      render(refs, state);
    }
  });

  AppI18n.subscribe(() => {
    if (state.isOpen === true) {
      render(refs, state);
    }
  });

  refs.openButton.addEventListener("click", () => {
    void open();
  });

  refs.closeButton.addEventListener("click", close);
  refs.importButton.addEventListener("click", () => {
    void (async (): Promise<void> => {
      const api = window.electronAPI;
      if (api === undefined || typeof api.showOpenDialog !== "function") {
        Toast.error(roomText("toasts.filePickerUnavailable"));
        return;
      }

      const selection = await api.showOpenDialog({
        title: roomText("dialog.bundleTitle"),
        buttonLabel: roomText("dialog.bundleButton"),
        filters: [{ name: roomText("dialog.bundleFilterName"), extensions: ["json"] }],
        properties: ["openFile"],
      });

      if (selection.canceled === true || selection.filePaths.length === 0) {
        return;
      }

      const selectedPath = String(selection.filePaths[0] ?? "").trim();
      if (selectedPath === "") {
        return;
      }

      if (selectedPath.toLowerCase().endsWith(".hevroom.json") === false) {
        Toast.error(roomText("toasts.invalidBundleExtension"));
        return;
      }

      const result = await RoomRegistry.importBundle(selectedPath);
      state.workspaceRooms = await RoomRegistry.listWorkspaceRooms();
      render(refs, state);
      if (result.success === true) {
        Toast.success(roomText("toasts.importSuccess"), result.room?.id ?? result.path ?? selectedPath);
      } else {
        Toast.error(roomText("toasts.importError"), result.error ?? selectedPath);
      }
    })();
  });
  refs.refreshButton.addEventListener("click", () => {
    void refresh();
  });

  refs.overlay.addEventListener("click", (event) => {
    if (event.target === refs.overlay) {
      close();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.isOpen === true) {
      close();
    }
  });

  refs.workspaceList.addEventListener("click", (event) => {
    const target = event.target as Element | null;
    const button = target?.closest("[data-room-action]");
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    const action = button.dataset["roomAction"] ?? "";
    const roomId = button.dataset["roomId"] ?? "";
    if (roomId === "") {
      return;
    }

    if (action === "install") {
      void (async (): Promise<void> => {
        const ok = await RoomRegistry.installFromWorkspace(roomId);
        state.workspaceRooms = await RoomRegistry.listWorkspaceRooms();
        render(refs, state);
        if (ok) {
          Toast.success(roomText("toasts.installSuccess"), roomId);
        } else {
          Toast.error(roomText("toasts.installError"), roomId);
        }
      })();
      return;
    }

    if (action === "package") {
      void (async (): Promise<void> => {
        const api = window.electronAPI;
        if (api === undefined || typeof api.roomsPackageFromWorkspace !== "function") {
          Toast.error(roomText("toasts.packageUnavailable"));
          return;
        }

        const result = await api.roomsPackageFromWorkspace({ roomId });
        if (result.success === true) {
          Toast.success(roomText("toasts.packageSuccess"), result.path ?? roomId);
        } else {
          Toast.error(roomText("toasts.packageError"), result.error ?? roomId);
        }
      })();
    }
  });

  refs.installedList.addEventListener("click", (event) => {
    const target = event.target as Element | null;
    const button = target?.closest("[data-room-action]");
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    const action = button.dataset["roomAction"] ?? "";
    const roomId = button.dataset["roomId"] ?? "";
    if (roomId === "") {
      return;
    }

    if (action === "open") {
      close();
      showPage(getRoomPageName(roomId));
      return;
    }

    if (action === "export") {
      void (async (): Promise<void> => {
        const api = window.electronAPI;
        if (api === undefined || typeof api.roomsExportToWorkspace !== "function") {
          Toast.error(roomText("toasts.exportUnavailable"));
          return;
        }

        const result = await api.roomsExportToWorkspace({
          roomId,
          overwrite: true,
        });
        state.workspaceRooms = await RoomRegistry.listWorkspaceRooms();
        render(refs, state);
        if (result.success === true) {
          Toast.success(roomText("toasts.exportSuccess"), result.path ?? roomId);
        } else {
          Toast.error(roomText("toasts.exportError"), result.error ?? roomId);
        }
      })();
      return;
    }

    if (action === "remove") {
      void (async (): Promise<void> => {
        const api = window.electronAPI;
        if (api === undefined || typeof api.roomsRemoveInstalled !== "function") {
          Toast.error(roomText("toasts.removeUnavailable"));
          return;
        }

        const result = await api.roomsRemoveInstalled(roomId);
        await RoomRegistry.refreshInstalledRooms();
        render(refs, state);
        if (result.success === true) {
          Toast.success(roomText("toasts.removeSuccess"), roomId);
        } else {
          Toast.error(roomText("toasts.removeError"), result.error ?? roomId);
        }
      })();
    }
  });

  render(refs, state);
}
