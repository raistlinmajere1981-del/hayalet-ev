/**
 * Message Store - Permission Queue Management
 * 
 * Permission request queue: upsert, remove, get active, clear
 */

import type { PermissionEntry, PermissionRequest, PermissionState } from './types.ts';

export function upsertPermission(
  state: PermissionState,
  entry: {
    id?: string;
    messageId?: string;
    partId?: string;
    permission: PermissionRequest;
  }
): void {
  const existing = state.queue.find(
    (p) => p.permission.id === entry.permission.id
  );

  const permissionEntry: PermissionEntry = {
    ...entry,
    createdAt: existing?.createdAt || Date.now(),
  };

  if (existing) {
    Object.assign(existing, permissionEntry);
  } else {
    state.queue.push(permissionEntry);
  }

  // Update byMessage index
  if (entry.messageId) {
    if (!state.byMessage[entry.messageId]) {
      state.byMessage[entry.messageId] = {};
    }
    state.byMessage[entry.messageId][entry.partId || '_default'] = permissionEntry;
  }

  // Auto-activate first in queue
  if (!state.active && state.queue.length > 0) {
    state.active = state.queue[0];
  }
}

export function removePermission(state: PermissionState, permissionId: string): void {
  const index = state.queue.findIndex((p) => p.permission.id === permissionId);

  if (index === -1) return;

  const removed = state.queue.splice(index, 1)[0];

  // Clean up byMessage index
  if (removed.messageId && state.byMessage[removed.messageId]) {
    delete state.byMessage[removed.messageId][removed.partId || '_default'];
  }

  // Update active if removed was active
  if (state.active?.permission.id === permissionId) {
    state.active = state.queue[0] || null;
  }
}

export function getActivePermission(state: PermissionState): PermissionEntry | null {
  return state.active;
}

export function getPermissionQueue(state: PermissionState): PermissionEntry[] {
  return [...state.queue];
}

export function getPermissionForPart(
  state: PermissionState,
  messageId: string,
  partId = '_default'
): PermissionEntry | undefined {
  return state.byMessage[messageId]?.[partId];
}

export function clearPermissions(state: PermissionState): void {
  state.queue = [];
  state.active = null;
  state.byMessage = {};
}
