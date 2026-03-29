import type { InstalledRoomRecord, RoomWorkspaceEntry } from "@shared/index.js";
import { AppI18n } from "../i18n/index.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function roomOverlayText(key: string): string {
  return AppI18n.t(`shell.rooms.${key}`);
}

function getVisibleInstalledRooms(installedRooms: InstalledRoomRecord[]): InstalledRoomRecord[] {
  return installedRooms.filter((room) => room.isWorkspaceFallback !== true);
}

function buildWorkspaceStateLabel(room: RoomWorkspaceEntry, installedIds: Set<string>): string {
  if (room.valid !== true) {
    return roomOverlayText("states.invalid");
  }
  return installedIds.has(room.manifest?.id ?? "")
    ? roomOverlayText("states.installed")
    : roomOverlayText("states.ready");
}

function buildInstalledStateLabel(roomId: string, workspaceIds: Set<string>): string {
  return workspaceIds.has(roomId)
    ? roomOverlayText("states.workspaceLinked")
    : roomOverlayText("states.standalone");
}

export function buildRoomOverlaySummary(
  workspaceRooms: RoomWorkspaceEntry[],
  installedRooms: InstalledRoomRecord[]
): string {
  const visibleInstalledRooms = getVisibleInstalledRooms(installedRooms);
  const validWorkspaceCount = workspaceRooms.filter((room) => room.valid === true).length;

  return [
    `<div class="room-manager-chip">${escapeHtml(roomOverlayText("summary.workspace"))}: <strong>${String(
      workspaceRooms.length
    )}</strong></div>`,
    `<div class="room-manager-chip">${escapeHtml(roomOverlayText("summary.ready"))}: <strong>${String(
      validWorkspaceCount
    )}</strong></div>`,
    `<div class="room-manager-chip">${escapeHtml(roomOverlayText("summary.installed"))}: <strong>${String(
      visibleInstalledRooms.length
    )}</strong></div>`,
  ].join("");
}

export function buildWorkspaceRoomListMarkup(
  workspaceRooms: RoomWorkspaceEntry[],
  installedRooms: InstalledRoomRecord[]
): string {
  if (workspaceRooms.length === 0) {
    return `<div class="room-manager-empty">${escapeHtml(roomOverlayText("emptyWorkspace"))}</div>`;
  }

  const installedIds = new Set(getVisibleInstalledRooms(installedRooms).map((room) => room.id));

  return workspaceRooms
    .map((room) => {
      const roomId = room.manifest?.id ?? room.dirName;
      const roomName = room.manifest?.name ?? room.dirName;
      const roomVersion = room.manifest?.version ?? "-";
      const stateLabel = buildWorkspaceStateLabel(room, installedIds);
      const isLinked = installedIds.has(roomId);
      const isDeleteDisabled = isLinked || room.readOnly === true;
      const actionLabel = installedIds.has(roomId)
        ? roomOverlayText("actions.update")
        : roomOverlayText("actions.install");
      const errorsMarkup =
        room.valid === true || room.errors.length === 0
          ? ""
          : `<div class="room-manager-errors">${room.errors
              .map((error) => `<div>${escapeHtml(error)}</div>`)
              .join("")}</div>`;

      return [
        '<article class="room-manager-card">',
        '  <div class="room-manager-card-head">',
        `    <div class="room-manager-title-wrap"><div class="room-manager-title">${escapeHtml(
          roomName
        )}</div><div class="room-manager-subtitle">${escapeHtml(roomId)} • ${escapeHtml(
          roomVersion
        )}</div></div>`,
        `    <span class="room-manager-state-badge" data-state="${
          room.valid === true ? "ready" : "invalid"
        }">${escapeHtml(stateLabel)}</span>`,
        "  </div>",
        `  <div class="room-manager-path">${escapeHtml(room.dirPath)}</div>`,
        errorsMarkup,
        '  <div class="room-manager-actions">',
        `    <button class="btn btn-primary btn-sm" data-room-action="install" data-room-id="${escapeHtml(
          roomId
        )}" ${room.valid === true ? "" : "disabled"}>${escapeHtml(actionLabel)}</button>`,
        `    <button class="btn btn-ghost btn-sm" data-room-action="package" data-room-id="${escapeHtml(
          roomId
        )}" ${room.valid === true ? "" : "disabled"}>${escapeHtml(
          roomOverlayText("actions.package")
        )}</button>`,
        `    <button class="btn btn-danger btn-sm" data-room-action="delete" data-room-id="${escapeHtml(
          roomId
        )}" ${isDeleteDisabled ? "disabled" : ""}>${escapeHtml(roomOverlayText("actions.delete"))}</button>`,
        "  </div>",
        "</article>",
      ].join("");
    })
    .join("");
}

export function buildInstalledRoomListMarkup(
  installedRooms: InstalledRoomRecord[],
  workspaceRooms: RoomWorkspaceEntry[]
): string {
  const visibleInstalledRooms = getVisibleInstalledRooms(installedRooms);
  if (visibleInstalledRooms.length === 0) {
    return `<div class="room-manager-empty">${escapeHtml(roomOverlayText("emptyInstalled"))}</div>`;
  }

  const workspaceIds = new Set(
    workspaceRooms
      .filter((room) => room.valid === true && room.manifest !== undefined)
      .map((room) => room.manifest?.id ?? room.dirName)
  );

  return visibleInstalledRooms
    .map((room) => {
      const stateLabel = buildInstalledStateLabel(room.id, workspaceIds);
      const hasWorkspace = workspaceIds.has(room.id);

      return [
        '<article class="room-manager-card">',
        '  <div class="room-manager-card-head">',
        `    <div class="room-manager-title-wrap"><div class="room-manager-title">${escapeHtml(
          room.name
        )}</div><div class="room-manager-subtitle">${escapeHtml(room.id)} • ${escapeHtml(
          room.version
        )}</div></div>`,
        `    <span class="room-manager-state-badge" data-state="${
          hasWorkspace ? "linked" : "standalone"
        }">${escapeHtml(stateLabel)}</span>`,
        "  </div>",
        `  <div class="room-manager-path">${escapeHtml(room.installedDir)}</div>`,
        '  <div class="room-manager-actions">',
        `    <button class="btn btn-danger btn-sm" data-room-action="remove" data-room-id="${escapeHtml(
          room.id
        )}">${escapeHtml(roomOverlayText("actions.remove"))}</button>`,
        "  </div>",
        "</article>",
      ].join("");
    })
    .join("");
}
