import { createHash } from "node:crypto";
import { createServer } from "node:net";
import process from "node:process";

// The restore planner also locks a not-yet-created center. Callers supply its canonical path.
export async function acquireGaiaStorageLock(canonicalPath, owner = false) {
  const key =
    (owner ? "hev-gaia-owner-" : "hev-gaia-") +
    createHash("sha256").update(canonicalPath).digest("hex").slice(0, 40);
  const address = process.platform === "win32" ? "\\\\.\\pipe\\" + key : "\0" + key;
  const lock = createServer((socket) => socket.destroy());
  await new Promise((resolve, reject) => {
    lock.once("error", reject);
    lock.listen(address, resolve);
  });
  lock.unref();
  return () =>
    new Promise((resolve, reject) => lock.close((error) => (error ? reject(error) : resolve())));
}
