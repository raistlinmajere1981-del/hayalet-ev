import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("room tool run request supports companion executable selection", () => {
  const typeSource = readFileSync("src/types/room-tools.ts", "utf8");
  const serviceSource = readFileSync("electron/room-tool-service.ts", "utf8");

  assert.match(typeSource, /export interface RoomToolRunRequest[\s\S]*executableName\?: string;/);
  assert.match(serviceSource, /const requestedExecutableName = asNonEmptyString\(request\.executableName\);/);
  assert.match(serviceSource, /const allowedExecutableNames = \[/);
  assert.match(serviceSource, /does not expose companion executable/);
});

test("room tool service stays generic and avoids laboratory-specific branching", () => {
  const serviceSource = readFileSync("electron/room-tool-service.ts", "utf8");
  const handlerSource = readFileSync("electron/handlers/ipc-room-tools.ts", "utf8");

  assert.match(handlerSource, /registerHandler\("room-tools-call"/);
  assert.match(handlerSource, /registerHandler\("room-tools-cancel"/);
  assert.match(serviceSource, /case "ensure-dir":/);
  assert.match(serviceSource, /private async ensureDirPath\(/);
  assert.match(serviceSource, /ensuredPath: targetPath,/);
  assert.match(serviceSource, /private async downloadToPath\(/);
  assert.match(serviceSource, /return await this\.downloadToPath\(event, request, \{ enforceRoomManagedPath: true \}\);/);
  assert.match(serviceSource, /\{ enforceRoomManagedPath: false \}/);
  assert.doesNotMatch(serviceSource, /ROOM_ID\s*=\s*"laboratory"/);
  assert.doesNotMatch(serviceSource, /yt-dlp command/i);
});

test("room tool preload and global typings expose the generic room-tools seam", () => {
  const preloadSource = readFileSync("electron/preload.cjs", "utf8");
  const globalTypes = readFileSync("src/js/global.d.ts", "utf8");

  assert.match(preloadSource, /roomToolsCall: \(request\) => ipcRenderer\.invoke\("room-tools-call", request\)/);
  assert.match(preloadSource, /roomToolsCancel: \(request\) => ipcRenderer\.invoke\("room-tools-cancel", request\)/);
  assert.match(preloadSource, /onRoomToolsProgress: \(callback\)/);
  assert.match(globalTypes, /roomToolsCall: \(request: RoomToolCallRequest\) => Promise<RoomToolCallResult>;/);
  assert.match(globalTypes, /roomToolsCancel: \(request: RoomToolCancelRequest\) => Promise<RoomToolCancelResult>;/);
});
