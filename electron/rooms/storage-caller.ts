import type { BrowserWindow, IpcMainInvokeEvent, Session, WebContents } from "electron";

export interface RoomStorageCaller {
  owner: object;
  parentWindow: BrowserWindow;
  url: string;
  assertCurrent(): void;
}

const documents = new WeakMap<WebContents, object>();

// The same document must still own the request when a native dialog or a writer lock returns.
export function roomStorageCaller(
  event: IpcMainInvokeEvent,
  getWindow: () => BrowserWindow | null,
  partition: Session
): RoomStorageCaller {
  const guest = event.sender;
  const frame = event.senderFrame;
  const parentWindow = getWindow();
  if (!parentWindow || !frame) throw new Error("Unauthorized room storage caller");
  const url = frame.url;
  const owner = documents.get(guest) ?? {};
  if (!documents.has(guest)) {
    documents.set(guest, owner);
    guest.on("did-navigate", () => documents.set(guest, {}));
    guest.on("did-start-navigation", (details) => {
      if (details.isMainFrame && !details.isSameDocument) documents.set(guest, {});
    });
  }
  const assertCurrent = (): void => {
    if (
      parentWindow.isDestroyed() ||
      getWindow() !== parentWindow ||
      documents.get(guest) !== owner ||
      guest.isDestroyed() ||
      frame.detached ||
      guest.getType() !== "webview" ||
      frame !== guest.mainFrame ||
      guest.hostWebContents !== parentWindow.webContents ||
      guest.session !== partition ||
      frame.url !== url
    )
      throw new Error("Unauthorized room storage caller");
  };
  assertCurrent();
  return { owner, parentWindow, url, assertCurrent };
}
