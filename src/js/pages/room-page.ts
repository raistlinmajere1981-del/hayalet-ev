import type { InstalledRoomRecord } from "@shared/index.js";
import type { PageController } from "../app/types.js";
import { AppI18n } from "../modules/i18n/index.js";
import { RoomHostRuntime } from "../modules/rooms/room-host-runtime.js";
import { toRoomRuntimeFileUrl } from "../modules/rooms/room-runtime-url.js";

type RoomRuntimeState = "idle" | "loading" | "ready" | "error";

type RoomWebviewElement = HTMLElement & {
  src: string;
  getURL?: () => string;
  send?: (channel: string, ...args: unknown[]) => void;
};

type RoomIpcMessageEvent = Event & {
  channel?: string;
  args?: unknown[];
};

type RoomLoadErrorEvent = Event & {
  errorCode?: number;
  errorDescription?: string;
};

export class RoomPageController implements PageController {
  private room: InstalledRoomRecord;
  private readonly pageName: string;
  private runtimeState: RoomRuntimeState = "idle";
  private lastRuntimeEvent = roomPageT("status.handshakeWaiting");
  private preloadUrlPromise: Promise<string> | null = null;
  private unsubscribeI18n: (() => void) | null = null;

  constructor(room: InstalledRoomRecord, pageName: string) {
    this.room = { ...room };
    this.pageName = pageName;
  }

  updateRoom(room: InstalledRoomRecord): void {
    this.room = { ...room };
    this.render();
  }

  async init(): Promise<void> {
    this.unsubscribeI18n ??= AppI18n.subscribe(() => {
      this.render();
    });
    this.render();
    await this.ensureRuntimeHost();
  }

  onShow(): void {
    this.render();
    void this.ensureRuntimeHost();
  }

  render(): void {
    const page = this.getPage();
    if (page === null) {
      return;
    }

    this.ensureShell(page);
    this.syncShell(page);
    void this.ensureRuntimeHost(page);
  }

  dispose(): void {
    this.unsubscribeI18n?.();
    this.unsubscribeI18n = null;
    void RoomHostRuntime.disposeRoom(this.room.id);
    const mount = this.getPage()?.querySelector<HTMLElement>("[data-room-role='runtime-mount']");
    mount?.replaceChildren();
  }

  private getPage(): HTMLElement | null {
    return document.getElementById(`page-${this.pageName}`);
  }

  private ensureShell(page: HTMLElement): void {
    if (page.dataset["roomShellReady"] === "true") {
      return;
    }

    page.innerHTML = `
      <div class="room-shell">
        <div class="room-shell-hero">
          <div class="room-shell-badge">${roomPageT("page.badge")}</div>
          <h1 class="room-shell-title" data-room-role="title"></h1>
          <p class="room-shell-subtitle" data-room-role="subtitle"></p>
        </div>
        <div class="room-shell-grid">
          <section class="glass-panel room-shell-panel room-shell-panel--runtime">
            <div class="panel-title">${roomPageT("page.runtimeTitle")}</div>
            <div class="room-runtime-status" data-room-role="runtime-status" data-state="idle">
              ${roomPageT("status.preparing")}
            </div>
            <div class="room-runtime-event" data-room-role="runtime-event">
              ${roomPageT("status.handshakeWaiting")}
            </div>
            <div class="room-runtime-mount" data-room-role="runtime-mount"></div>
          </section>
          <section class="glass-panel room-shell-panel">
            <div class="panel-title">${roomPageT("page.entryPointsTitle")}</div>
            <div class="room-meta-list">
              <div class="room-meta-row">
                <span class="room-meta-label">${roomPageT("page.labels.id")}</span>
                <span class="room-meta-value" data-room-role="id"></span>
              </div>
              <div class="room-meta-row">
                <span class="room-meta-label">${roomPageT("page.labels.version")}</span>
                <span class="room-meta-value" data-room-role="version"></span>
              </div>
              <div class="room-meta-row">
                <span class="room-meta-label">${roomPageT("page.labels.installed")}</span>
                <span class="room-meta-value" data-room-role="installed"></span>
              </div>
              <div class="room-meta-row">
                <span class="room-meta-label">${roomPageT("page.labels.runtime")}</span>
                <span class="room-meta-value" data-room-role="runtime-path"></span>
              </div>
              <div class="room-meta-row">
                <span class="room-meta-label">${roomPageT("page.labels.host")}</span>
                <span class="room-meta-value" data-room-role="host-path"></span>
              </div>
              <div class="room-meta-row">
                <span class="room-meta-label">${roomPageT("page.labels.source")}</span>
                <span class="room-meta-value" data-room-role="source-path"></span>
              </div>
            </div>
          </section>
        </div>
      </div>
    `;

    page.dataset["roomShellReady"] = "true";
  }

  private syncShell(page: HTMLElement): void {
    const description =
      this.room.name !== this.room.id
        ? roomPageT("page.subtitleNamed", { name: this.room.name })
        : roomPageT("page.subtitleDefault");

    this.updateText(page, "title", this.room.name);
    this.updateText(page, "subtitle", description);
    this.updateText(page, "id", this.room.id);
    this.updateText(page, "version", this.room.version);
    this.updateText(page, "installed", this.room.installedAt);
    this.updateText(page, "runtime-path", this.room.runtimeEntryPath);
    this.updateText(page, "host-path", this.room.hostEntryPath);
    this.updateText(page, "source-path", this.room.sourceDir);
    this.updateRuntimeStatus(page);
  }

  private updateText(page: HTMLElement, role: string, value: string): void {
    const target = page.querySelector<HTMLElement>(`[data-room-role='${role}']`);
    if (target !== null) {
      target.textContent = value;
    }
  }

  private updateRuntimeStatus(page: HTMLElement): void {
    const statusEl = page.querySelector<HTMLElement>("[data-room-role='runtime-status']");
    const eventEl = page.querySelector<HTMLElement>("[data-room-role='runtime-event']");
    if (statusEl !== null) {
      statusEl.dataset["state"] = this.runtimeState;
      statusEl.textContent =
        this.runtimeState === "error"
          ? roomPageT("status.loadFailed")
          : this.runtimeState === "ready"
            ? roomPageT("status.ready")
            : this.runtimeState === "loading"
              ? roomPageT("status.loading")
              : roomPageT("status.preparing");
    }
    if (eventEl !== null) {
      eventEl.textContent = this.lastRuntimeEvent;
    }
  }

  private async ensureRuntimeHost(page: HTMLElement | null = this.getPage()): Promise<void> {
    if (page === null) {
      return;
    }

    const mount = page.querySelector<HTMLElement>("[data-room-role='runtime-mount']");
    if (mount === null) {
      return;
    }

    const runtimeUrl = toRoomRuntimeFileUrl(this.room.runtimeEntryPath);
    const preloadUrl = await this.getRoomPreloadUrl();
    if (page.isConnected === false) {
      return;
    }

    let webview = mount.querySelector<RoomWebviewElement>("webview[data-room-runtime='true']");
    if (webview === null) {
      webview = document.createElement("webview") as RoomWebviewElement;
      webview.className = "room-runtime-webview";
      webview.id = `room-webview-${this.room.id}`;
      webview.setAttribute("data-room-runtime", "true");
      webview.setAttribute("allowpopups", "false");
      webview.setAttribute("partition", `persist:room-${this.room.id}`);
      if (preloadUrl !== "") {
        webview.setAttribute("preload", preloadUrl);
      }
      this.bindRuntimeEvents(webview);
      mount.replaceChildren(webview);
    }

    await RoomHostRuntime.ensureRoomHost(this.room, {
      sendToRoom: (payload) => {
        webview.send?.("room-host-message", payload);
      },
    });

    const currentSrc = webview.getAttribute("src") ?? "";
    if (currentSrc !== runtimeUrl) {
      this.runtimeState = "loading";
      this.lastRuntimeEvent = runtimeUrl;
      this.updateRuntimeStatus(page);
      webview.setAttribute("src", runtimeUrl);
      webview.src = runtimeUrl;
    }
  }

  private bindRuntimeEvents(webview: RoomWebviewElement): void {
    if (webview.dataset["roomRuntimeBound"] === "true") {
      return;
    }

    webview.dataset["roomRuntimeBound"] = "true";

    webview.addEventListener("did-start-loading", () => {
      const page = this.getPage();
      this.runtimeState = "loading";
      this.lastRuntimeEvent =
        webview.getURL?.() ?? toRoomRuntimeFileUrl(this.room.runtimeEntryPath);
      if (page !== null) {
        this.updateRuntimeStatus(page);
      }
    });

    webview.addEventListener("did-stop-loading", () => {
      const page = this.getPage();
      this.runtimeState = "ready";
      this.lastRuntimeEvent =
        webview.getURL?.() ?? toRoomRuntimeFileUrl(this.room.runtimeEntryPath);
      if (page !== null) {
        this.updateRuntimeStatus(page);
      }
      this.sendHostContext(webview, "did-stop-loading");
    });

    webview.addEventListener("did-fail-load", (event) => {
      const page = this.getPage();
      const loadEvent = event as RoomLoadErrorEvent;
      if (loadEvent.errorCode === -3) {
        return;
      }
      this.runtimeState = "error";
      this.lastRuntimeEvent =
        loadEvent.errorDescription ?? `Runtime load error (${String(loadEvent.errorCode ?? 0)})`;
      if (page !== null) {
        this.updateRuntimeStatus(page);
      }
    });

    webview.addEventListener("ipc-message", (event) => {
      const ipcEvent = event as RoomIpcMessageEvent;
      if (ipcEvent.channel === "room-ready") {
        const payload = ipcEvent.args?.[0];
        this.runtimeState = "ready";
        this.lastRuntimeEvent = this.describePayload(payload, roomPageT("status.runtimeReady"));
        const page = this.getPage();
        if (page !== null) {
          this.updateRuntimeStatus(page);
        }
        this.sendHostContext(webview, "room-ready");
        void RoomHostRuntime.handleRuntimeMessage(this.room.id, "room-ready", payload);
      }

      if (ipcEvent.channel === "room-command") {
        const payload = ipcEvent.args?.[0];
        this.lastRuntimeEvent = this.describeRoomCommand(payload);
        const page = this.getPage();
        if (page !== null) {
          this.updateRuntimeStatus(page);
        }
        void RoomHostRuntime.handleRuntimeMessage(this.room.id, "room-command", payload);
      }

      if (ipcEvent.channel === "room-event") {
        const payload = ipcEvent.args?.[0];
        this.lastRuntimeEvent = this.describePayload(payload, roomPageT("status.roomEvent"));
        const page = this.getPage();
        if (page !== null) {
          this.updateRuntimeStatus(page);
        }
        void RoomHostRuntime.handleRuntimeMessage(this.room.id, "room-event", payload);
      }
    });
  }

  private sendHostContext(webview: RoomWebviewElement, reason: string): void {
    webview.send?.("room-host-message", {
      type: "host-context",
      reason,
      room: {
        id: this.room.id,
        name: this.room.name,
        version: this.room.version,
        runtimeEntryPath: this.room.runtimeEntryPath,
        hostEntryPath: this.room.hostEntryPath,
      },
    });
  }

  private describeRoomCommand(payload: unknown): string {
    if (payload !== null && typeof payload === "object") {
      const command = "command" in payload ? payload.command : undefined;
      if (typeof command === "string" && command.trim() !== "") {
        return `++cmd:${command.trim()}`;
      }
    }
    return roomPageT("status.commandSent");
  }

  private describePayload(payload: unknown, fallback: string): string {
    if (payload === null || payload === undefined) {
      return fallback;
    }

    if (typeof payload === "string" && payload.trim() !== "") {
      return payload.trim();
    }

    if (typeof payload === "object") {
      const stage = "stage" in payload ? payload.stage : undefined;
      const type = "type" in payload ? payload.type : undefined;
      if (typeof stage === "string" && stage.trim() !== "") {
        return stage.trim();
      }
      if (typeof type === "string" && type.trim() !== "") {
        return type.trim();
      }
      try {
        return JSON.stringify(payload);
      } catch {
        return fallback;
      }
    }

    return fallback;
  }

  private async getRoomPreloadUrl(): Promise<string> {
    if (this.preloadUrlPromise === null) {
      const electronApi = window.electronAPI;
      if (electronApi === undefined || typeof electronApi.getPreloadPath !== "function") {
        this.preloadUrlPromise = Promise.resolve("");
      } else {
        this.preloadUrlPromise = electronApi.getPreloadPath("room").catch(() => "");
      }
    }

    return await this.preloadUrlPromise;
  }
}

function roomPageT(key: string, params?: Record<string, string | number>): string {
  return AppI18n.t(`app.roomPage.${key}`, params);
}
