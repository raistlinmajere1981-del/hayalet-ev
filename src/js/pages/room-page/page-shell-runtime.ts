import type { InstalledRoomRecord } from "@shared/index.js";
import {
  ensureRoomPageShell,
  renderRoomFeatureButtons,
  shouldShowRoomFeatureStrip,
} from "./shell-layout.js";
import { type RoomRuntimeState, updateRoomRuntimeStatus } from "./runtime-events.js";

interface EnsureRoomPageFeatureShellParams {
  closeLabel: string;
  immersive: boolean;
  onCloseRoom: () => void;
  onSelectFeature: (featureId: string) => void;
  page: HTMLElement;
  room: InstalledRoomRecord;
}

interface RenderRoomPageFeatureStripParams {
  activeFeatureId: string | null;
  page: HTMLElement;
  room: InstalledRoomRecord;
  showFeatureStrip: boolean;
}

interface UpdateRoomPageRuntimeStatusParams {
  lastRuntimeEvent: string;
  page: HTMLElement;
  runtimeState: RoomRuntimeState;
  translate: (key: string) => string;
}

export function shouldShowRoomPageFeatureStripForRoom(
  immersive: boolean,
  room: InstalledRoomRecord
): boolean {
  if (room.workbench?.experienceId !== undefined) {
    return false;
  }
  return shouldShowRoomFeatureStrip(immersive, room.features.length);
}

export function ensureRoomPageFeatureShell({
  closeLabel,
  immersive,
  onCloseRoom,
  onSelectFeature,
  page,
  room,
}: EnsureRoomPageFeatureShellParams): void {
  ensureRoomPageShell(page, {
    closeLabel,
    immersive,
    onCloseRoom,
    onSelectFeature,
    showFeatureStrip: shouldShowRoomPageFeatureStripForRoom(immersive, room),
  });
}

export function renderRoomPageFeatureStrip({
  activeFeatureId,
  page,
  room,
  showFeatureStrip,
}: RenderRoomPageFeatureStripParams): void {
  renderRoomFeatureButtons({
    activeFeatureId,
    page,
    room,
    showFeatureStrip,
  });
}

export function updateRoomPageStatusPanel({
  lastRuntimeEvent,
  page,
  runtimeState,
  translate,
}: UpdateRoomPageRuntimeStatusParams): void {
  updateRoomRuntimeStatus({
    lastRuntimeEvent,
    page,
    runtimeState,
    translate,
  });
}
