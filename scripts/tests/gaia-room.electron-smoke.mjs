import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { RoomPackageManager } from "../../electron/room-package-manager.ts";
import { buildRoomBundle } from "../rooms/build-room-bundle.mjs";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(join(repo, "rooms/gaia-room/scripts/editor/package.json"));
const { _electron: electron, expect } = require("@playwright/test");
const root = await mkdtemp(join(tmpdir(), "hev-gaia-smoke-"));
const path = join(root, "data/room-storage/gaia-room/projects/smoke/world.json");
const doc = async () => JSON.parse(await readFile(path, "utf8"));
async function closeApp(instance) {
  const child = instance.process();
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  await instance.evaluate(({ app }) => {
    setTimeout(() => app.quit(), 50);
  });
  await exited;
}
async function launch() {
  const app = await electron.launch({
    executablePath: require("electron"),
    args: ["--no-sandbox", join(root, "dist/electron/main.js"), "--ui-mode=classic"],
    cwd: root,
    env: { ...process.env, NODE_ENV: "production", CDP_PORT: "0" },
  });
  try {
    await app.evaluate(({ session }) => {
      session
        .fromPartition("persist:room-gaia-room")
        .webRequest.onBeforeRequest({ urls: ["http://*/*", "https://*/*"] }, (_request, done) =>
          done({ cancel: true })
        );
    });
    const page = await app.firstWindow();
    await page.locator("button[data-room-nav]").first().waitFor({ state: "attached" });
    await page.locator("#splash-screen").waitFor({ state: "detached" });
    await page
      .locator('button[data-room-nav][data-room-id="gaia-room"]')
      .dispatchEvent("click", { timeout: 30000 });
    const guest = page.locator("#room-webview-gaia-room");
    await guest.waitFor({ state: "attached", timeout: 20000 });
    const js = async (code) =>
      await guest.evaluate((el, source) => el.executeJavaScript(source), code);
    await expect
      .poll(
        async () => await js("!!document.querySelector('.projects input')").catch(() => false),
        { timeout: 20000 }
      )
      .toBe(true);
    return { app, page, js, guest };
  } catch (error) {
    await closeApp(app);
    throw error;
  }
}
let running;
try {
  await mkdir(join(root, "data"));
  await mkdir(join(root, "config"));
  await writeFile(join(root, "AGENTS.md"), "");
  await cp(join(repo, "package.json"), join(root, "package.json"));
  await symlink(join(repo, "node_modules"), join(root, "node_modules"), "junction");
  await symlink(join(repo, "src"), join(root, "src"), "junction");
  await cp(join(repo, "dist/electron"), join(root, "dist/electron"), { recursive: true });
  await cp(join(repo, "dist/renderer"), join(root, "dist/renderer"), { recursive: true });
  const bundle = await buildRoomBundle("gaia-room", { outputFile: join(root, "gaia.hevroom") });
  const manager = new RoomPackageManager({
    workspaceRoot: join(root, "rooms"),
    registryPath: join(root, "config/rooms.json"),
    dataRoot: join(root, "data"),
  });
  const installed = await manager.importBundleFile(bundle.outputFile);
  assert.ok(installed.success, installed.error);
  console.info("Opening installed Gaia Room");
  running = await launch();
  const { js, guest } = running;
  await js(
    `const input=document.querySelector(".projects input");input.value="smoke";input.dispatchEvent(new Event("input",{bubbles:true}))`
  );
  await expect
    .poll(() => js("document.querySelector('.projects button:last-child').disabled"))
    .toBe(false);
  await js("document.querySelector('.projects button:last-child').click()");
  await expect
    .poll(() => js("document.querySelector('footer')?.innerText ?? document.body.innerText"), {
      timeout: 20000,
    })
    .toMatch(/Edit a straight wall|Düz duvar veya masa/);
  const denied = await guest.evaluate(async (active) => {
    const other = active.ownerDocument.createElement("webview");
    other.setAttribute("partition", "persist:room-scope-test");
    other.setAttribute("preload", active.getAttribute("preload"));
    other.src = active.src;
    const loaded = new Promise((resolve) =>
      other.addEventListener("dom-ready", resolve, { once: true })
    );
    other.addEventListener("ipc-message", (event) => {
      if (event.channel === "room-command") {
        const { command, payload } = event.args[0];
        other.send("room-host-message", {
          type: "room-storage-dispatch",
          payload: { command, requestId: payload.requestId },
        });
      }
    });
    active.parentElement.append(other);
    try {
      await loaded;
      return await other.executeJavaScript(
        'window.roomAPI.requestStorageCommand("GaiaOpen",{project:"smoke"})'
      );
    } finally {
      other.remove();
    }
  });
  assert.equal(denied.success, false);
  assert.match(denied.error, /Unauthorized room storage caller/);
  const before = await doc();
  await js("document.querySelectorAll('[role=group] button')[2].click()");
  await guest.evaluate(async (el) => {
    const { x, y } = await el.executeJavaScript(
      "(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return {x:Math.round(r.left+r.width*0.65),y:Math.round(r.top+r.height*0.65)}})()"
    );
    el.sendInputEvent({ type: "mouseMove", x, y });
    el.sendInputEvent({ type: "mouseDown", button: "left", clickCount: 1, x, y });
    el.sendInputEvent({ type: "mouseUp", button: "left", clickCount: 1, x, y });
  });
  await js("document.querySelector('button.save').click()");
  await expect
    .poll(() => js("document.querySelector('[role=status]').innerText"), { timeout: 20000 })
    .toMatch(/revision 8|Revizyon 8/);
  const saved = await doc();
  const ids = Object.keys(saved.world.nodes).filter((id) => !Object.hasOwn(before.world.nodes, id));
  assert.equal(ids.length, 1);
  assert.equal(saved.world.nodes[ids[0]].parent, "ground");
  assert.deepEqual(saved.world.devices, before.world.devices);
  console.info("Committed revision", saved.world.revision);
  await closeApp(running.app);
  running = undefined;
  console.info("Opening installed Gaia Room");
  running = await launch();
  await expect
    .poll(() => running.js("document.querySelector('.projects select')?.value"))
    .toBe("smoke");
  await running.js("document.querySelector('.projects button').click()");
  await expect
    .poll(() => running.js("document.querySelector('header')?.innerText"))
    .toMatch(/Revision 8|Revizyon 8/);
  const reopened = await running.js(
    'window.roomAPI.requestStorageCommand("GaiaOpen",{project:"smoke"})'
  );
  assert.equal(reopened.success, true);
  assert.deepEqual(reopened.data.world, saved.world);
  assert.deepEqual(await doc(), saved);
  console.info("Gaia installed room saved and reopened after Electron restart", ids[0]);
} finally {
  if (running) await closeApp(running.app);
  await rm(root, { recursive: true, force: true });
}
