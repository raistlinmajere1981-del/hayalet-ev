/**
 * Page Initialization
 *
 * HTML template injection, controller oluşturma ve
 * webview kayıt işlemlerini yönetir.
 */

import type { WebviewTag } from "electron";
import { SlotController } from "../modules/slot-controller.js";
import { ConversationListManager } from "../modules/conversation-list-manager.js";

import { EntranceHallController } from "../pages/entrance.js";
import { AnalyzeController } from "../pages/analyze.js";
import { WhisperController } from "../pages/whisper.js";
import { ServerController } from "../pages/server.js";
import { ArchivesController } from "../pages/archives.js";
import { AsistanController } from "../pages/asistan/index.js";

import entranceTemplate from "../../pages/entrance.html?raw";
import analyzeTemplate from "../../pages/analyze.html?raw";
import whisperTemplate from "../../pages/whisper.html?raw";
import serverTemplate from "../../pages/server.html?raw";
import archivesTemplate from "../../pages/archives.html?raw";
import asistanTemplate from "../../pages/asistan.html?raw";

import type { PageController } from "./types.js";
import { SLOTS, ASISTAN_SLOT } from "@slots";
import { syncInstalledRoomChrome } from "./room-ui.js";

export function injectPageTemplates(): void {
  const container = document.getElementById("pages-container");
  if (container) {
    container.innerHTML = `${entranceTemplate}${analyzeTemplate}${whisperTemplate}${serverTemplate}${asistanTemplate}${archivesTemplate}`;
    syncInstalledRoomChrome();
  }
}

export function setupUILogListener(): void {
  if (!window.electronAPI?.ipcRenderer) {
    return;
  }

  window.electronAPI.ipcRenderer.on("log:ui-notify", () => {});
}

/**
 * Controller'ları oluştur ve init et
 */
export async function initControllers(controllers: Record<string, PageController>): Promise<void> {
  controllers["entrance"] = new EntranceHallController();
  controllers["analyze"] = new AnalyzeController();
  controllers["whisper"] = new WhisperController();
  controllers["server"] = new ServerController();
  controllers["archives"] = new ArchivesController();
  controllers["asistan"] = new AsistanController();
  syncInstalledRoomChrome(controllers);
  await controllers["entrance"].init?.();
  await controllers["analyze"].init?.();
  await controllers["whisper"].init?.();
  await controllers["server"].init?.();
  await controllers["archives"].init?.();
  await controllers["asistan"].init?.();
  const roomPageNames = Object.keys(controllers).filter((pageName) => pageName.startsWith("room-"));
  await roomPageNames.reduce<Promise<void>>(async (previous, pageName) => {
    await previous;
    await controllers[pageName]?.init?.();
  }, Promise.resolve());
  await ConversationListManager.init();
}

/**
 * Webview'ları SlotController'a kaydet
 */
export function registerWebviews(): void {
  const ai0Webview = document.getElementById("ai0-webview") as WebviewTag | null;
  const ai1Webview = document.getElementById("ai1-webview") as WebviewTag | null;
  const ai2Webview = document.getElementById("ai2-webview") as WebviewTag | null;
  if (ai0Webview) {
    SlotController.registerWebview(ASISTAN_SLOT, ai0Webview);
  }
  if (ai1Webview) {
    SlotController.registerWebview(SLOTS.AI1, ai1Webview);
  }
  if (ai2Webview) {
    SlotController.registerWebview(SLOTS.AI2, ai2Webview);
  }
}
