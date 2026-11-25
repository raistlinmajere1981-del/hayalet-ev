import type { World } from "../spatial/world.ts";
import type { EditBatch } from "./session.ts";

export interface Opened {
  world: World;
  building: string | null;
  session: string;
  missing: string[];
  damaged?: string[];
}
export type InteriorOpened = Opened & { building: string };

export interface Saved {
  world: World;
  missing: string[];
  damaged?: string[];
}
export interface WorkshopStorage {
  save(batch: EditBatch, retry: boolean): Promise<Saved>;
  reopen(): Promise<InteriorOpened>;
}
interface RoomBridge {
  ready(): void;
  close(): void;
  onVisibilityChange?(callback: (visible: boolean) => void): () => void;
  onHostMessage(
    handler: (message: {
      type: string;
      locale?: string;
      translations?: { workshop?: Record<string, string>; site?: Record<string, string> };
      payload?: Record<string, string>;
    }) => void,
    replayContext?: boolean
  ): () => void;
  requestStorageCommand(
    command: string,
    request: unknown
  ): Promise<{ success: boolean; error?: string; data: unknown }>;
}
export function roomBridge(): RoomBridge | undefined {
  return (window as unknown as { roomAPI?: RoomBridge }).roomAPI;
}
export class UnconfirmedCommand extends Error {}

export async function command<T>(name: string, request: unknown): Promise<T> {
  const bridge = roomBridge();
  if (!bridge) throw new Error("Room storage unavailable");
  let reply;
  try {
    reply = await bridge.requestStorageCommand(name, request);
  } catch (error) {
    throw new UnconfirmedCommand(String(error));
  }
  if (!reply.success) throw new Error(reply.error ?? "Room storage unavailable");
  return reply.data as T;
}
