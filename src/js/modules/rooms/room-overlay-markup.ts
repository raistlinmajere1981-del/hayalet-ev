import type { InstalledRoomRecord, RoomWorkspaceEntry } from "@shared/index.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildWorkspaceStateLabel(room: RoomWorkspaceEntry, installedIds: Set<string>): string {
  if (room.valid !== true) {
    return "Gecersiz";
  }
  return installedIds.has(room.manifest?.id ?? "") ? "Yuklu" : "Hazir";
}

function buildInstalledStateLabel(roomId: string, workspaceIds: Set<string>): string {
  return workspaceIds.has(roomId) ? "Workspace bagli" : "Yalnizca install";
}

export function buildRoomOverlaySummary(
  workspaceRooms: RoomWorkspaceEntry[],
  installedRooms: InstalledRoomRecord[]
): string {
  const validWorkspaceCount = workspaceRooms.filter((room) => room.valid === true).length;

  return [
    `<div class="room-manager-chip">Workspace: <strong>${String(workspaceRooms.length)}</strong></div>`,
    `<div class="room-manager-chip">Hazir: <strong>${String(validWorkspaceCount)}</strong></div>`,
    `<div class="room-manager-chip">Yuklu: <strong>${String(installedRooms.length)}</strong></div>`,
  ].join("");
}

export function buildWorkspaceRoomListMarkup(
  workspaceRooms: RoomWorkspaceEntry[],
  installedRooms: InstalledRoomRecord[]
): string {
  if (workspaceRooms.length === 0) {
    return '<div class="room-manager-empty">Workspace oda bulunamadi.</div>';
  }

  const installedIds = new Set(installedRooms.map((room) => room.id));

  return workspaceRooms
    .map((room) => {
      const roomId = room.manifest?.id ?? room.dirName;
      const roomName = room.manifest?.name ?? room.dirName;
      const roomVersion = room.manifest?.version ?? "-";
      const stateLabel = buildWorkspaceStateLabel(room, installedIds);
      const actionLabel = installedIds.has(roomId) ? "Guncelle" : "Yukle";
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
        )}" ${room.valid === true ? "" : "disabled"}>Paketle</button>`,
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
  if (installedRooms.length === 0) {
    return '<div class="room-manager-empty">Yuklu oda bulunamadi.</div>';
  }

  const workspaceIds = new Set(
    workspaceRooms
      .filter((room) => room.valid === true && room.manifest !== undefined)
      .map((room) => room.manifest?.id ?? room.dirName)
  );

  return installedRooms
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
        `    <button class="btn btn-primary btn-sm" data-room-action="open" data-room-id="${escapeHtml(
          room.id
        )}">Ac</button>`,
        `    <button class="btn btn-ghost btn-sm" data-room-action="export" data-room-id="${escapeHtml(
          room.id
        )}">Workspace'e Aktar</button>`,
        `    <button class="btn btn-danger btn-sm" data-room-action="remove" data-room-id="${escapeHtml(
          room.id
        )}">Kaldir</button>`,
        "  </div>",
        "</article>",
      ].join("");
    })
    .join("");
}
