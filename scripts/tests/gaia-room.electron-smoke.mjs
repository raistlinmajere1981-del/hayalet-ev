import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { RoomPackageManager } from "../../electron/room-package-manager.ts";
import { buildRoomBundle } from "../rooms/build-room-bundle.mjs";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(join(repo, "rooms/gaia-room/scripts/editor/package.json"));
const { PerspectiveCamera, Vector3 } = await import(
  new URL("./three.module.js", pathToFileURL(require.resolve("three"))).href
);
const { _electron: electron, expect } = require("@playwright/test");
const root = await mkdtemp(join(tmpdir(), "hev-gaia-smoke-"));
const path = join(root, "data/room-storage/gaia-room/projects/smoke/world.json");
const doc = async () => JSON.parse(await readFile(path, "utf8"));
async function closeApp(instance) {
  const child = instance.process();
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  const failsafe = setTimeout(() => child.kill("SIGKILL"), 5000);
  try {
    await instance.evaluate(({ app }) => {
      setTimeout(() => app.quit(), 50);
    });
    await exited;
  } finally {
    clearTimeout(failsafe);
  }
}
async function launch() {
  const app = await electron.launch({
    executablePath: require("electron"),
    args: [
      "--no-sandbox",
      "--ozone-platform=x11",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      join(root, "dist/electron/main.js"),
      "--ui-mode=classic",
    ],
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
    await app.evaluate(({ BrowserWindow }) => {
      const shell = BrowserWindow.getAllWindows().find(({ webContents }) =>
        webContents.getURL().endsWith("/dist/renderer/index.html")
      );
      shell.show();
      shell.focus();
    });
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
const options = (en, tr = en) => JSON.stringify([en, tr]);
async function press(session, en, tr) {
  const clicked = await session.js(`(() => {
    const labels = ${options(en, tr)};
    const button = [...document.querySelectorAll("button")].find((b) => labels.includes(b.textContent.trim()) && !b.disabled);
    if (!button) return false;
    button.click();
    return true;
  })()`);
  assert.ok(clicked, `Missing enabled button: ${en}`);
}
async function selected(session, id) {
  await expect
    .poll(() => session.js("document.querySelector('[data-selected-id]')?.dataset.selectedId"))
    .toBe(id);
}
async function pickLayer(session, id) {
  await session.js(`document.querySelector('[data-node="${id}"]').click()`);
  await selected(session, id);
}
async function editNumber(session, field, value, scope = ".properties-panel") {
  const changed = await session.js(`(() => {
    const labels = ${JSON.stringify(field)};
    const label = [...document.querySelectorAll(${JSON.stringify(scope + " label")})].find((el) => labels.includes(el.textContent.trim()));
    if (!label) return false;
    const control = label.querySelector("input");
    control.value = ${JSON.stringify(String(value))};
    control.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`);
  assert.ok(changed, `Missing numeric field: ${field[0]}`);
}
async function sendPointer(session, start, end) {
  await session.guest.evaluate(
    (guest, { start, end }) => {
      const move = ([x, y]) =>
        guest.sendInputEvent({ type: "mouseMove", x: Math.round(x), y: Math.round(y) });
      const button = (type, [x, y]) =>
        guest.sendInputEvent({
          type,
          x: Math.round(x),
          y: Math.round(y),
          button: "left",
          clickCount: 1,
        });
      move(start);
      button("mouseDown", start);
      if (end) move(end);
      button("mouseUp", end ?? start);
    },
    { start, end }
  );
}
async function planPoint(session, point) {
  return session.js(`(() => {
    const svg = document.querySelector(".map-viewport svg");
    const p = new DOMPoint(${point[0]}, ${-point[1]}).matrixTransform(svg.getScreenCTM());
    return [p.x, p.y];
  })()`);
}
async function toggleUnderground(session) {
  await session.js("document.querySelector('.map-toolbar input[type=checkbox]').click()");
}
async function selectMode(session, overview) {
  if (overview) await press(session, "Overview", "Genel Görünüm");
  else await press(session, "Modeling Workshop", "Modelleme Atölyesi");
}

async function exerciseSite(session) {
  const { js, page } = session;
  await expect.poll(() => js("!!document.querySelector('svg [data-gaia-id=coop]')")).toBe(true);
  assert.equal(await js("!!document.querySelector('svg [data-gaia-id=glass]')"), true);
  assert.equal(
    await js("performance.getEntriesByType('resource').some((r)=>/Workshop-|orbit-/.test(r.name))"),
    false
  );
  await sendPointer(session, await planPoint(session, [26, 37.1]));
  await selected(session, "coop");
  await toggleUnderground(session);
  assert.equal(await js("!!document.querySelector('svg [data-gaia-id=tank]')"), true);
  assert.equal(await js("!!document.querySelector('svg [data-gaia-id=cellar]')"), true);
  console.info("Gaia overview selected in 2D");
  await press(session, "3D orbit", "3B yörünge");
  await expect
    .poll(() => js("!!document.querySelector('.orbit canvas')"), { timeout: 20000 })
    .toBe(true);
  const [left, top, width, height] = await js(`(() => {
    const r = document.querySelector(".orbit canvas").getBoundingClientRect();
    return [r.left, r.top, r.width, r.height];
  })()`);
  const camera = new PerspectiveCamera(42, width / height, 0.04, 10000);
  const target = new Vector3(20, 30, 1.5);
  const radius = new Vector3(40, 60, 9).length() / 2;
  const distance = (radius / (Math.tan((Math.PI * 42) / 360) * Math.min(camera.aspect, 1))) * 1.14;
  camera.up.set(0, 0, 1);
  camera.position.copy(target).addScaledVector(new Vector3(1, -1.24, 1.1).normalize(), distance);
  camera.lookAt(target);
  camera.updateMatrixWorld();
  const hit = new Vector3(26, 37.1, 2.8).project(camera);
  await pickLayer(session, "plot");
  await sendPointer(session, [left + ((1 + hit.x) * width) / 2, top + ((1 - hit.y) * height) / 2]);
  await selected(session, "coop");

  const navigate = async (room) => {
    const nav = page.locator(`button[data-room-nav][data-room-id="${room}"]`);
    await nav.evaluate((button) => button.click());
    await expect(nav).toHaveClass(/is-active/, { timeout: 15000 });
  };
  await session.guest.evaluate((guest) => {
    guest.addEventListener("ipc-message", (event) => {
      const message = event.args?.[0];
      if (event.channel === "room-event" && message?.type === "gaia-smoke-visibility")
        guest.dataset.gaiaVisibility = JSON.stringify(message.payload);
    });
  });
  const resourceTracker = `(() => {
    window.gaiaStopVisibilityProbe?.();
    const gl = document.querySelector(".orbit canvas").getContext("webgl2");
    window.gaiaStopVisibilityProbe = window.roomAPI.onVisibilityChange((host) => {
      if (host) return;
      queueMicrotask(() => window.roomAPI.sendEvent("gaia-smoke-visibility", {
        visible: document.querySelector(".gaia-workspace").dataset.visible,
        paused: document.querySelector(".orbit canvas")?.hidden ?? false,
        contextLost: gl.isContextLost(),
      }));
    });
  })()`;
  for (let i = 0; i < 2; i++) {
    await session.guest.evaluate((guest) => delete guest.dataset.gaiaVisibility);
    await js(resourceTracker);
    await navigate("forge-room");
    await expect
      .poll(
        () => session.guest.evaluate((guest) => JSON.parse(guest.dataset.gaiaVisibility ?? "null")),
        { timeout: 15000 }
      )
      .toEqual({ visible: "false", paused: true, contextLost: false });
    await navigate("gaia-room");
    await expect
      .poll(() => js("document.querySelectorAll('.map-viewport canvas:not([hidden])').length"), {
        timeout: 15000,
      })
      .toBe(1);
  }
  await page.evaluate(() => {
    globalThis.document.querySelector('button[data-room-nav][data-room-id="forge-room"]').click();
    globalThis.document.querySelector('button[data-room-nav][data-room-id="gaia-room"]').click();
  });
  await expect
    .poll(() => js("document.querySelectorAll('.map-viewport canvas:not([hidden])').length"), {
      timeout: 15000,
    })
    .toBe(1);
  await js("window.gaiaStopVisibilityProbe?.()");
  console.info("Gaia suspended and resumed the viewer across room navigation");
  await js(
    'window.gaiaClosedContext = document.querySelector(".orbit canvas").getContext("webgl2")'
  );
  await selectMode(session, false);
  await expect.poll(() => js("window.gaiaClosedContext.isContextLost()")).toBe(true);
  await pickLayer(session, "glass");
  const start = await planPoint(session, [14.5, 13]);
  const end = await planPoint(session, [16.5, 14]);
  await sendPointer(session, start, end);
  await editNumber(session, ["Direction (°)", "Yön (°)"], 135);
  await editNumber(session, ["Width", "Genişlik"], 13);
  await pickLayer(session, "cellar");
  await editNumber(session, ["Elevation (m)", "Kot (m)"], -4);
  await pickLayer(session, "glass");
  await press(session, "Add floor", "Kat ekle");
  const floor = await js("document.querySelector('[data-selected-id]').dataset.selectedId");
  await editNumber(session, ["Elevation (m)", "Kot (m)"], 6.5);
  await press(session, "Place device", "Cihaz yerleştir");
  await sendPointer(session, await planPoint(session, [16, 16]));
  const mount = await js("document.querySelector('[data-selected-id]').dataset.selectedId");
  const beforeVirtual = await js("document.querySelector('.map-viewport').innerHTML");
  await press(session, "Update sample", "Ölçümü güncelle");
  assert.equal(await js("!!document.querySelector('.device-card .reading')"), true);
  const afterVirtual = await js("document.querySelector('.map-viewport').innerHTML");
  assert.equal(afterVirtual, beforeVirtual);
  await press(session, "Draw utility line", "Hat çiz");
  await editNumber(session, ["Elevation (m)", "Kot (m)"], -2.5, ".edit-toolbar");
  await sendPointer(session, await planPoint(session, [32, 15]));
  await editNumber(session, ["Elevation (m)", "Kot (m)"], 1.25, ".edit-toolbar");
  await sendPointer(session, await planPoint(session, [33, 24]));
  await press(session, "Finish drawing", "Çizimi bitir");
  const route = await js("document.querySelector('[data-selected-id]').dataset.selectedId");
  await pickLayer(session, "glass");
  await press(session, "Edit interior", "İç planı düzenle");
  await press(session, "Keep editing", "Düzenlemeye dön");
  assert.equal(await js("!!document.querySelector('.gaia-workspace[data-visible=true]')"), true);
  await press(session, "Edit interior", "İç planı düzenle");
  await js("document.querySelector('[role=dialog] button.primary').click()");
  await expect
    .poll(() => js("!!document.querySelector('button.save')"), { timeout: 20000 })
    .toBe(true);
  const saved = await doc();
  assert.equal(saved.world.revision, 8);
  assert.equal(saved.world.nodes.glass.yaw, 135);
  assert.equal(saved.world.nodes.glass.geometry.size[0], 13);
  assert.ok(
    saved.world.nodes.glass.p[0] > 13.5 && saved.world.nodes.glass.p[0] < 14.5,
    String(saved.world.nodes.glass.p)
  );
  assert.deepEqual(saved.world.nodes.pipe.geometry.vertices, [
    [10, 12, -2],
    [13, 16, -2],
    [13, 16, 1],
  ]);
  assert.equal(saved.world.nodes.cellar.p[2], -4);
  assert.equal(saved.world.nodes[floor].parent, "glass");
  assert.equal(saved.world.nodes[floor].p[2], 6.5);
  assert.equal(saved.world.nodes[mount].parent, floor);
  assert.ok(Object.values(saved.world.devices).some((device) => device.mount === mount));
  assert.equal(saved.world.nodes[route].parent, "plot");
  assert.deepEqual(
    saved.world.nodes[route].geometry.vertices.map((p) => p[2]),
    [-2.5, 1.25]
  );
  console.info(
    "Gaia site plan, 2D/3D selection, real room hide/show and revision",
    saved.world.revision
  );
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
  const forgeBundle = await buildRoomBundle("forge-room", {
    outputFile: join(root, "forge.hevroom"),
  });
  const forgeInstalled = await manager.importBundleFile(forgeBundle.outputFile);
  assert.ok(forgeInstalled.success, forgeInstalled.error);
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
  await exerciseSite(running);
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
    .toMatch(/revision 9|Revizyon 9/);
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
    .poll(() => running.js("document.querySelector('.workspace-header')?.innerText"))
    .toMatch(/smoke/);
  const reopened = await running.js(
    'window.roomAPI.requestStorageCommand("GaiaOpen",{project:"smoke"})'
  );
  assert.equal(reopened.success, true);
  assert.deepEqual(reopened.data.world, saved.world);
  assert.deepEqual(await doc(), saved);
  await press(running, "3D orbit", "3B yörünge");
  await expect
    .poll(() => running.js("!!document.querySelector('.orbit canvas:not([hidden])')"), {
      timeout: 20000,
    })
    .toBe(true);
  await running.guest.evaluate((el) => {
    void el.executeJavaScript("document.querySelector('.close-room').click()").catch(() => {});
  });

  await running.guest.waitFor({ state: "detached" });
  console.info("Gaia installed room saved and reopened after Electron restart", ids[0]);
} finally {
  if (running) await closeApp(running.app);
  await rm(root, { recursive: true, force: true });
}
