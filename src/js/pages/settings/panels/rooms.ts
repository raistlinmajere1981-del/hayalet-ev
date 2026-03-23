import type { InstalledRoomRecord, RoomWorkspaceEntry } from "@shared/index.js";
import { Toast } from "../../../ui/toast-manager.js";
import { AppI18n } from "../../../modules/i18n/index.js";
import { RoomRegistry } from "../../../modules/rooms/room-registry.js";
import { resolveIpcErrorMessage } from "../../../modules/ipc-errors.js";
import {
  buildInstalledRoomListMarkup,
  buildRoomOverlaySummary,
  buildWorkspaceRoomListMarkup,
} from "../../../modules/rooms/room-overlay-markup.js";
import { shellT } from "../../../app/shell-i18n.js";
import { Modal } from "../../../ui/modal-manager.js";
import { registerSettingsPanelLifecycle } from "../controller.js";

interface RoomOverlayRefs {
  importButton: HTMLButtonElement | null;
  refreshButton: HTMLButtonElement | null;
  summary: HTMLElement | null;
  workspaceList: HTMLElement | null;
  installedList: HTMLElement | null;
}

interface RoomOverlayState {
  workspaceRooms: RoomWorkspaceEntry[];
  installedRooms: InstalledRoomRecord[];
  isOpen: boolean;
}

interface RoomDeleteConfirmResult {
  confirmed: boolean;
  deleteData: boolean;
}

function roomText(key: string, params?: Parameters<typeof shellT>[1]): string {
  return shellT(`rooms.${key}`, params);
}

function buildRoomLabel(name: string, roomId: string): string {
  const trimmedName = name.trim();
  return trimmedName === "" || trimmedName === roomId ? roomId : `${trimmedName} (${roomId})`;
}

function getWorkspaceRoomLabel(state: RoomOverlayState, roomId: string): string {
  const room = state.workspaceRooms.find(
    (entry) => (entry.manifest?.id ?? entry.dirName) === roomId
  );
  return buildRoomLabel(room?.manifest?.name ?? room?.dirName ?? roomId, roomId);
}

function getInstalledRoomLabel(state: RoomOverlayState, roomId: string): string {
  const room = state.installedRooms.find((entry) => entry.id === roomId);
  return buildRoomLabel(room?.name ?? roomId, roomId);
}

function buildRoomPackageOutputPath(directoryPath: string, roomId: string): string {
  const normalizedDir = directoryPath.trim().replace(/[\\/]+$/, "");
  return `${normalizedDir}/${roomId}.hevroom.json`;
}

async function confirmRoomDeletion(options: {
  title: string;
  message: string;
}): Promise<RoomDeleteConfirmResult> {
  return await new Promise((resolve) => {
    const content = document.createElement("div");
    content.className = "modal-confirm room-manager-delete-confirm";

    const messageEl = document.createElement("div");
    messageEl.className = "modal-confirm-message room-manager-delete-confirm__message";
    messageEl.textContent = options.message;
    content.appendChild(messageEl);

    const checkboxLabel = document.createElement("label");
    checkboxLabel.className = "room-manager-delete-confirm__checkbox";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkboxLabel.appendChild(checkbox);

    const checkboxCopy = document.createElement("span");
    checkboxCopy.className = "room-manager-delete-confirm__checkbox-copy";

    const checkboxTitle = document.createElement("span");
    checkboxTitle.className = "room-manager-delete-confirm__checkbox-label";
    checkboxTitle.textContent = roomText("confirm.deleteDataLabel");
    checkboxCopy.appendChild(checkboxTitle);

    const checkboxHint = document.createElement("span");
    checkboxHint.className = "room-manager-delete-confirm__hint";
    checkboxHint.textContent = roomText("confirm.deleteDataHint");
    checkboxCopy.appendChild(checkboxHint);

    checkboxLabel.appendChild(checkboxCopy);
    content.appendChild(checkboxLabel);

    Modal.open({
      title: options.title,
      content,
      size: "sm",
      closable: false,
      closeOnOverlay: false,
      buttons: [
        {
          label: shellT("common.cancel"),
          variant: "secondary",
          onClick: (): void => {
            resolve({ confirmed: false, deleteData: checkbox.checked });
          },
        },
        {
          label: roomText("confirm.deleteAction"),
          variant: "danger",
          onClick: (): void => {
            resolve({ confirmed: true, deleteData: checkbox.checked });
          },
        },
      ],
    });
  });
}

async function restartAfterRoomMutation(): Promise<boolean> {
  const api = window.electronAPI;
  if (api === undefined || typeof api.appRestart !== "function") {
    return false;
  }

  const result = await api.appRestart({ forceFullRestart: true });
  return result.success === true;
}

function getRefs(): RoomOverlayRefs {
  return {
    importButton: document.getElementById("rooms-overlay-import") as HTMLButtonElement | null,
    refreshButton: document.getElementById("rooms-overlay-refresh") as HTMLButtonElement | null,
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

export function setupSettingsRoomsPanel(): void {
  const refs = getRefs();
  const state: RoomOverlayState = {
    workspaceRooms: [],
    installedRooms: RoomRegistry.getInstalledRooms(),
    isOpen: false,
  };

  if (
    refs.importButton === null ||
    refs.refreshButton === null ||
    refs.summary === null ||
    refs.workspaceList === null ||
    refs.installedList === null
  ) {
    return;
  }

  const refresh = async (): Promise<void> => {
    state.installedRooms = RoomRegistry.getInstalledRooms();
    state.workspaceRooms = await RoomRegistry.listWorkspaceRooms();
    render(refs, state);
  };

  const activate = async (): Promise<void> => {
    state.isOpen = true;
    await refresh();
  };

  const deactivate = (): void => {
    state.isOpen = false;
  };

  RoomRegistry.subscribe((rooms) => {
    state.installedRooms = rooms;
    if (state.isOpen === true) {
      render(refs, state);
    }
  });

  AppI18n.subscribe(() => {
    if (state.isOpen === true) {
      render(refs, state);
    }
  });

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
        if (result.restartRequired === true) {
          const restarted = await restartAfterRoomMutation();
          if (restarted !== true) {
            Toast.info(roomText("toasts.importSuccess"), roomText("toasts.restartRequired"));
          }
          return;
        }

        Toast.success(
          roomText("toasts.importSuccess"),
          result.room?.id ?? result.path ?? selectedPath
        );
      } else {
        Toast.error(roomText("toasts.importError"), resolveIpcErrorMessage(result) ?? selectedPath);
      }
    })();
  });
  refs.refreshButton.addEventListener("click", () => {
    void refresh();
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
        const isUpdate = state.installedRooms.some((room) => room.id === roomId);
        const confirmed = await Modal.confirm({
          title: roomText(isUpdate ? "confirm.updateTitle" : "confirm.installTitle"),
          message: roomText(isUpdate ? "confirm.updateMessage" : "confirm.installMessage", {
            room: getWorkspaceRoomLabel(state, roomId),
          }),
          confirmVariant: "primary",
        });
        if (!confirmed) {
          return;
        }

        const result = await RoomRegistry.installFromWorkspace(roomId);
        state.workspaceRooms = await RoomRegistry.listWorkspaceRooms();
        render(refs, state);
        if (result.success === true) {
          if (result.restartRequired === true) {
            const restarted = await restartAfterRoomMutation();
            if (restarted !== true) {
              Toast.info(roomText("toasts.installSuccess"), roomText("toasts.restartRequired"));
            }
            return;
          }

          Toast.success(roomText("toasts.installSuccess"), roomId);
        } else {
          Toast.error(roomText("toasts.installError"), resolveIpcErrorMessage(result) ?? roomId);
        }
      })();
      return;
    }

    if (action === "package") {
      void (async (): Promise<void> => {
        const api = window.electronAPI;
        if (
          api === undefined ||
          typeof api.roomsPackageFromWorkspace !== "function" ||
          typeof api.showOpenDialog !== "function"
        ) {
          Toast.error(roomText("toasts.packageUnavailable"));
          return;
        }

        const selection = await api.showOpenDialog({
          title: roomText("dialog.packageTitle"),
          buttonLabel: roomText("dialog.packageButton"),
          properties: ["openDirectory", "createDirectory"],
        });
        if (selection.canceled === true || selection.filePaths.length === 0) {
          return;
        }

        const selectedDir = String(selection.filePaths[0] ?? "").trim();
        if (selectedDir === "") {
          return;
        }

        const result = await api.roomsPackageFromWorkspace({
          roomId,
          outputFile: buildRoomPackageOutputPath(selectedDir, roomId),
        });
        if (result.success === true) {
          Toast.success(roomText("toasts.packageSuccess"), result.path ?? roomId);
        } else {
          Toast.error(roomText("toasts.packageError"), resolveIpcErrorMessage(result) ?? roomId);
        }
      })();
      return;
    }

    if (action === "delete") {
      void (async (): Promise<void> => {
        const confirmation = await confirmRoomDeletion({
          title: roomText("confirm.deleteTitle"),
          message: roomText("confirm.deleteMessage", {
            room: getWorkspaceRoomLabel(state, roomId),
          }),
        });
        if (confirmation.confirmed !== true) {
          return;
        }

        const result = await RoomRegistry.deleteWorkspace({
          roomId,
          deleteData: confirmation.deleteData,
        });
        state.workspaceRooms = await RoomRegistry.listWorkspaceRooms();
        if (result.success === true && confirmation.deleteData === true) {
          state.installedRooms = state.installedRooms.filter((room) => room.id !== roomId);
        }
        render(refs, state);
        if (result.success === true) {
          if (result.restartRequired === true) {
            const restarted = await restartAfterRoomMutation();
            if (restarted !== true) {
              Toast.info(roomText("toasts.deleteSuccess"), roomText("toasts.restartRequired"));
            }
            return;
          }

          Toast.success(roomText("toasts.deleteSuccess"), result.path ?? roomId);
        } else {
          Toast.error(roomText("toasts.deleteError"), resolveIpcErrorMessage(result) ?? roomId);
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
          Toast.error(roomText("toasts.exportError"), resolveIpcErrorMessage(result) ?? roomId);
        }
      })();
      return;
    }

    if (action === "remove") {
      void (async (): Promise<void> => {
        const confirmation = await confirmRoomDeletion({
          title: roomText("confirm.removeTitle"),
          message: roomText("confirm.removeMessage", {
            room: getInstalledRoomLabel(state, roomId),
          }),
        });
        if (confirmation.confirmed !== true) {
          return;
        }

        const result = await RoomRegistry.removeInstalledWithOptions({
          roomId,
          deleteData: confirmation.deleteData,
        });
        if (result.success === true) {
          state.installedRooms = state.installedRooms.filter((room) => room.id !== roomId);
        }
        state.workspaceRooms = await RoomRegistry.listWorkspaceRooms();
        render(refs, state);
        if (result.success === true) {
          if (result.restartRequired === true) {
            const restarted = await restartAfterRoomMutation();
            if (restarted !== true) {
              Toast.info(roomText("toasts.removeSuccess"), roomText("toasts.restartRequired"));
            }
            return;
          }

          Toast.success(roomText("toasts.removeSuccess"), roomId);
        } else {
          Toast.error(roomText("toasts.removeError"), resolveIpcErrorMessage(result) ?? roomId);
        }
      })();
    }
  });

  render(refs, state);

  registerSettingsPanelLifecycle("rooms", {
    onEnter: () => {
      void activate();
    },
    onActivate: () => {
      void activate();
    },
    onDeactivate: () => {
      deactivate();
    },
    onExit: () => {
      deactivate();
    },
  });
}
