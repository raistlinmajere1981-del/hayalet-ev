import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { RoomPackageManager } from "../../electron/room-package-manager.ts";
import {
  electron,
  expect,
} from "../../rooms/gaia-room/scripts/editor/desktop-test-dependencies.mjs";
import { buildRoomBundle } from "../rooms/build-room-bundle.mjs";
import { syntheticFieldCenter } from "../../rooms/gaia-room/scripts/tests/support/field-center.ts";
import { usbClient } from "../../rooms/gaia-room/scripts/tests/support/usb-client.ts";

const require = createRequire(import.meta.url);
const root = await mkdtemp(join(tmpdir(), "gaia-b81-ipc-"));
let app;
try {
  const storage = join(root, "data/room-storage/gaia-room");
  const media = join(root, "media");
  const bin = join(root, "bin");
  await mkdir(storage, { recursive: true, mode: 0o700 });
  await mkdir(media, { mode: 0o700 });
  await mkdir(bin);
  await mkdir(join(root, "config"));
  await writeFile(join(root, "AGENTS.md"), "");
  await writeFile(
    join(root, "config/settings.json"),
    JSON.stringify({ assistants: { keepServersOnAppClose: true } })
  );
  await cp("package.json", join(root, "package.json"));
  await symlink(resolve("node_modules"), join(root, "node_modules"), "dir");
  await symlink(resolve("src"), join(root, "src"), "dir");
  await cp("dist/electron", join(root, "dist/electron"), { recursive: true });
  await cp("dist/renderer", join(root, "dist/renderer"), { recursive: true });
  const bundle = await buildRoomBundle("gaia-room", { outputFile: join(root, "gaia.hevroom") });
  const manager = new RoomPackageManager({
    workspaceRoot: join(root, "rooms"),
    registryPath: join(root, "config/rooms.json"),
    dataRoot: join(root, "data"),
  });
  const installed = await manager.importBundleFile(bundle.outputFile);
  assert.ok(installed.success, installed.error);
  const { usb } = await usbClient();
  const center = await syntheticFieldCenter(storage, media, usb);
  app = await electron.launch({
    executablePath: require("electron"),
    args: [
      "--no-sandbox",
      "--ozone-platform=x11",
      "--disable-webgl",
      "--user-data-dir=" + join(root, "profile"),
      join(root, "dist/electron/main.js"),
      "--ui-mode=classic",
    ],
    cwd: root,
    env: {
      ...process.env,
      PATH: bin,
      HAYALET_ADB_PATH: "",
      ADB_PATH: "",
      NODE_ENV: "production",
      CDP_PORT: "0",
      XDG_CONFIG_HOME: join(root, "xdg-config"),
      XDG_CACHE_HOME: join(root, "xdg-cache"),
      HEV_GAIA_FIELD_ADDRESS: "",
      HEV_GAIA_FIELD_PORT: "",
      HEV_GAIA_FIELD_ORIGIN: "",
    },
  });
  // The actual installed guest, preload, host dispatch and IPC authorization run.
  // Only operator input is deterministic: replace the native dialog at the main
  // boundary. This does not claim an interactive native-dialog acceptance.
  await app.evaluate(({ dialog }) => {
    globalThis.gaiaFieldPrompts = [];
    globalThis.gaiaFieldApprove = false;
    dialog.showMessageBox = async (_parent, options) => {
      globalThis.gaiaFieldPrompts.push({ message: options.message, detail: options.detail });
      return { response: globalThis.gaiaFieldApprove ? 1 : 0, checkboxChecked: false };
    };
  });
  const page = await app.firstWindow();
  await page.locator("#splash-screen").waitFor({ state: "detached" });
  await page
    .locator('button[data-room-nav][data-room-id="gaia-room"]')
    .dispatchEvent("click", { timeout: 30000 });
  const guest = page.locator("#room-webview-gaia-room");
  await guest.waitFor({ state: "attached", timeout: 20000 });
  const js = (code) => guest.evaluate((el, source) => el.executeJavaScript(source), code);
  await expect
    .poll(() => js("!!document.querySelector('.projects input')").catch(() => false), {
      timeout: 20000,
    })
    .toBe(true);
  const call = (command, body) =>
    js(
      "window.roomAPI.requestStorageCommand(" +
        JSON.stringify(command) +
        "," +
        JSON.stringify(body) +
        ")"
    );
  const opened = await call("GaiaOpen", { project: "demo" });
  assert.equal(opened.success, true, JSON.stringify(opened));
  const scope = { project: "demo", session: opened.data.session };
  const field = async (operation, binding = scope) => {
    const reply = await call("GaiaField", { ...binding, operation });
    assert.equal(reply.success, true, JSON.stringify(reply));
    return reply.data;
  };
  const state = await field({ action: "state", origin: center.endpoint.origin });
  assert.ok(state.ok, JSON.stringify(state));
  assert.equal(state.data.ca, "ready");
  assert.equal(state.data.serverFingerprint.length, 64);
  assert.equal(state.data.listening, false);
  assert.deepEqual(
    await field({ action: "provision", origin: center.endpoint.origin, passphrase: "renderer" }),
    { ok: false, code: "invalid_request" }
  );
  assert.deepEqual(
    await field({ action: "rotateServer", origin: center.endpoint.origin, media: "/tmp" }),
    { ok: false, code: "invalid_request" }
  );
  assert.deepEqual(await field({ action: "start", endpoint: center.endpoint, approved: true }), {
    ok: false,
    code: "invalid_request",
  });
  assert.equal(await app.evaluate(() => globalThis.gaiaFieldPrompts.length), 0);
  assert.deepEqual(await field({ action: "start", endpoint: center.endpoint }), {
    ok: false,
    code: "cancelled",
  });
  assert.equal(await app.evaluate(() => globalThis.gaiaFieldPrompts.length), 1);
  await app.evaluate(() => {
    globalThis.gaiaFieldApprove = true;
  });
  assert.deepEqual(await field({ action: "start", endpoint: center.endpoint }), {
    ok: true,
    data: { listening: true },
  });
  const status = await call("GaiaStatus", scope);
  assert.equal(status.success, true, JSON.stringify(status));
  assert.deepEqual(status.data.physical, {});
  assert.deepEqual(await field({ action: "stop" }), { ok: true, data: { listening: false } });
  assert.equal(await app.evaluate(() => globalThis.gaiaFieldPrompts.length), 3);
  const reopened = await call("GaiaOpen", { project: "demo" });
  assert.notEqual(reopened.data.session, scope.session);
  assert.deepEqual(await field({ action: "state" }), { ok: false, code: "scope_changed" });
  console.info(
    "B8 installed room IPC: state, renderer secret/path rejection, forged approval, native cancellation/approval, start/stop, status and stale session passed"
  );
} finally {
  if (app) {
    const child = app.process();
    if (child.exitCode === null && child.signalCode === null) {
      const exited = new Promise((resolveExit) => child.once("exit", resolveExit));
      const timer = setTimeout(() => child.kill("SIGKILL"), 10000);
      try {
        await app.evaluate(({ app: main }) => setTimeout(() => main.quit(), 50));
        await exited;
      } finally {
        clearTimeout(timer);
      }
    }
  }
  await rm(root, { recursive: true, force: true });
}
process.exit();
