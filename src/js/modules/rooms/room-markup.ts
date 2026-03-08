import type { InstalledRoomRecord } from "@shared/index.js";

export function getRoomPageName(roomId: string): string {
  return `room-${roomId}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildRoomIcon(room: InstalledRoomRecord): string {
  const trimmed = room.name.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 2).toUpperCase() : "OD";
}

export function buildRoomNavMarkup(room: InstalledRoomRecord): string {
  const pageName = getRoomPageName(room.id);
  const icon = buildRoomIcon(room);
  return `
    <button class="side-nav-btn" data-page="${escapeHtml(pageName)}" data-room-nav="true" data-room-id="${escapeHtml(room.id)}" title="${escapeHtml(room.name)}">
      <span class="side-nav-icon room-nav-icon">${escapeHtml(icon)}</span>
      <span class="side-nav-label">${escapeHtml(room.name)}</span>
    </button>
  `;
}

export function buildRoomPageMarkup(room: InstalledRoomRecord): string {
  const pageName = getRoomPageName(room.id);
  return `<div class="page hidden room-page" id="page-${escapeHtml(pageName)}" data-room-page="true" data-room-id="${escapeHtml(room.id)}"></div>`;
}
