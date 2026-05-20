import type {
  PatternRoomLocalGuards,
  PatternRoomLocalOverlay,
} from "../state/pattern-room-local-state.js";
import type { PatternViewId } from "./pattern-room.js";

export const PATTERN_ROOM_SNAPSHOT_VERSION = 1 as const;

export interface PatternRoomSessionSnapshot {
  snapshotId: string;
  roomId: "pattern-room";
  topicId: string;
  schemaVersion: typeof PATTERN_ROOM_SNAPSHOT_VERSION;
  createdAt: string;
  updatedAt: string;
  overlay: PatternRoomLocalOverlay;
  activeView: PatternViewId;
  guards: PatternRoomLocalGuards;
}
