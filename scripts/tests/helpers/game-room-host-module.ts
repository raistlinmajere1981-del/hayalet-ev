import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export async function loadGameRoomHostModule() {
  const moduleUrl = pathToFileURL(resolve("rooms/game-room/host/index.js"));
  moduleUrl.searchParams.set("ts", `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  return await import(moduleUrl.toString());
}
