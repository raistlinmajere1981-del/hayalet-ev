import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { RoomPackageManager } from "../../electron/room-package-manager.ts";
import {
  electron,
  expect,
  PerspectiveCamera,
  Vector3,
} from "../../rooms/gaia-room/scripts/editor/desktop-test-dependencies.mjs";
import {
  projectReference,
  referencePoint,
} from "../../rooms/gaia-room/scripts/spatial/reference.ts";
import { buildRoomBundle } from "../rooms/build-room-bundle.mjs";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const standalone = process.argv.includes("--standalone");
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
      ...(standalone
        ? ["--disable-webgl"]
        : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]),
      join(root, "dist/electron/main.js"),
      "--ui-mode=classic",
    ],
    cwd: root,
    env: { ...process.env, NODE_ENV: "production", CDP_PORT: "0" },
  });
  try {
    await app.evaluate(({ session }) => {
      globalThis.gaiaSmokeBlockedRequests = [];
      session
        .fromPartition("persist:room-gaia-room")
        .webRequest.onBeforeRequest(
          { urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] },
          ({ url }, done) => {
            globalThis.gaiaSmokeBlockedRequests.push(url);
            done({ cancel: true });
          }
        );
    });
    const page = await app.firstWindow();
    await page.locator("button[data-room-nav]").first().waitFor({ state: "attached" });
    await page.locator("#splash-screen").waitFor({ state: "detached" });
    await app.evaluate(({ BrowserWindow, screen }) => {
      const shell = BrowserWindow.getAllWindows().find(({ webContents }) =>
        webContents.getURL().endsWith("/dist/renderer/index.html")
      );
      const { width, height } = screen.getPrimaryDisplay().workAreaSize;
      shell.setSize(Math.min(width, 1600), Math.min(height, 1000));
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

async function assertTheme({ page, js }) {
  const palette = () =>
    js("getComputedStyle(document.documentElement).getPropertyValue('--gaia-bg-surface').trim()");
  await expect.poll(palette).not.toBe("");
  const original = await palette();
  const next = await page.evaluate(() => {
    globalThis.window.__ThemeManager.set("ivory-lab");
    return globalThis
      .getComputedStyle(globalThis.document.documentElement)
      .getPropertyValue("--bg-surface")
      .trim();
  });
  assert.notEqual(next, "");
  assert.notEqual(next, original);
  await expect.poll(palette).toBe(next);
}
const options = (en, tr = en) => JSON.stringify([en, tr]);
async function press(session, en, tr) {
  await expect
    .poll(
      () =>
        session.js(`(() => {
    const labels = ${options(en, tr)};
    const button = [...document.querySelectorAll("button")].find((b) =>
      !b.disabled && (labels.includes(b.textContent.trim()) || labels.includes(b.getAttribute("aria-label"))));
    if (!button) return false;
    button.click();
    return true;
  })()`),
      { message: `Missing enabled button: ${en}` }
    )
    .toBe(true);
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
  await session.js("document.querySelector('.map-toolbar > .check input[type=checkbox]').click()");
}
async function selectMode(session, overview) {
  if (overview) await press(session, "Overview", "Genel Görünüm");
  else await press(session, "Modeling Workshop", "Modelleme Atölyesi");
}

async function exerciseSite(session) {
  const { js } = session;
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
  if (standalone) {
    await expect
      .poll(() => js("document.querySelector('.map-status')?.textContent"))
      .toMatch(/2D plan is active|2B plan açık/);
    await selectMode(session, false);
    await editSite(session);
    return;
  }
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

  await exerciseRoomVisibility(session);
  await js(
    'window.gaiaClosedContext = document.querySelector(".orbit canvas").getContext("webgl2")'
  );
  await selectMode(session, false);
  await expect.poll(() => js("window.gaiaClosedContext.isContextLost()")).toBe(true);
  await editSite(session);
}

async function exerciseRoomVisibility(session) {
  const { page, js } = session;
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
}

async function editSite(session) {
  const { js } = session;
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
  assert.equal(await js("!!document.querySelector('.device-card li')"), true);
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
  console.info("Gaia site plan, 2D/3D selection and revision", saved.world.revision);
}

const deviceRun = process.argv.includes("--devices");
const deviceEvidence = join(
  repo,
  "rooms/.build/gaia-room/evidence/02-c",
  standalone ? "standalone" : ""
);

async function exerciseDeviceStatus(session) {
  const { js } = session;
  const before = await readFile(path);
  await selected(session, "plot");
  assert.equal(await js("document.querySelector('[data-count=total]').textContent"), "7");
  await capture(session, "electron-site-overview.png", deviceEvidence);
  await js("document.querySelector('[data-device=c2]').click()");
  await selected(session, "c2");
  await js("document.querySelector('.virtual-input summary').click()");
  await press(session, "Update connection", "Bağlantıyı güncelle");
  await expect
    .poll(() => js("document.querySelector('svg [data-gaia-id=c2]').dataset.deviceHealth"))
    .toBe("noData");
  await js(`(() => {
    const input = document.querySelector('.virtual-input input[name=sample]');
    input.value = "52";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  await press(session, "Update sample", "Ölçümü güncelle");
  await expect
    .poll(() => js("document.querySelector('li[data-freshness=fresh] .reading')?.textContent"))
    .toMatch(/52 %/);
  await js(`(() => {
    const select = document.querySelector('.virtual-input form select');
    select.value = "offline";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await press(session, "Update connection", "Bağlantıyı güncelle");
  await expect
    .poll(() => js("document.querySelector('svg [data-gaia-id=c2]').dataset.deviceHealth"))
    .toBe("offline");
  await expect
    .poll(() => js("document.querySelector('li[data-freshness=stale] .reading')?.textContent"))
    .toMatch(/52 %/);
  await js("document.querySelector('.virtual-input summary').click()");
  await capture(session, "electron-offline-device.png", deviceEvidence);

  if (!standalone) {
    await press(session, "3D orbit", "3B yörünge");
    await expect
      .poll(() =>
        js("document.querySelector('[data-gaia-device=c2]:not([hidden])')?.dataset.deviceHealth")
      )
      .toBe("offline");
    await pickLayer(session, "glass");
    await js("document.querySelector('[data-gaia-device=c2]').click()");
    await selected(session, "c2");
    await capture(session, "electron-orbit-device.png", deviceEvidence);
    await press(session, "2D plan", "2B plan");
    await selected(session, "c2");
    await js("new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
  }

  assert.deepEqual(await readFile(path), before);
  console.info(
    "Gaia 02-C installed room shows offline and last known data, with unchanged world bytes"
  );
}

async function toggleDeviceCheckbox(session, names) {
  const toggled = await session.js(`(() => {
    const names = ${JSON.stringify(names)};
    const label = [...document.querySelectorAll(".device-form label")].find((el) =>
      names.includes(el.textContent.trim())
    );
    const box = label?.querySelector("input[type=checkbox]");
    if (!box) return false;
    box.click();
    return true;
  })()`);
  assert.equal(toggled, true, `Missing device checkbox: ${names[0]}`);
}

async function exerciseDeviceLifecycle(session) {
  const { js } = session;
  const project = "device-audit";
  const projectDoc = async () =>
    JSON.parse(
      await readFile(
        join(root, "data/room-storage/gaia-room/projects", project, "world.json"),
        "utf8"
      )
    );
  await press(session, "Projects", "Projeler");
  await session.js(`(() => {
    const input = document.querySelector(".projects input");
    input.value = ${JSON.stringify(project)};
    input.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  await expect
    .poll(() => js("document.querySelector('.projects button:last-child').disabled"))
    .toBe(false);
  await js("document.querySelector('.projects button:last-child').click()");
  await expect
    .poll(() => js("document.querySelector('[data-count=total]')?.textContent"))
    .toBe("7");

  await press(session, "Add device", "Cihaz ekle");
  await session.js(`(() => {
    const input = document.querySelector(".device-form input");
    input.value = "Audit sensor";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  await toggleDeviceCheckbox(session, ["Temperature", "Sıcaklık"]);
  await toggleDeviceCheckbox(session, ["Humidity", "Nem"]);
  await press(session, "Create device", "Cihaz oluştur");
  await expect
    .poll(() =>
      js(
        "document.querySelector('.properties-panel .object-heading[data-selected-id]')?.dataset.selectedId"
      )
    )
    .toBeTruthy();
  const deviceId = await js(
    "document.querySelector('.properties-panel .object-heading[data-selected-id]')?.dataset.selectedId"
  );
  assert.ok(deviceId, "Expected created device selection");

  await press(session, "Change placement", "Yerleşimi değiştir");
  await press(session, "Place on plan", "Plana yerleştir");
  await expect.poll(() => js("!!document.querySelector('.map-viewport svg')")).toBe(true);
  await sendPointer(session, await planPoint(session, [16, 16]));
  await expect
    .poll(() => js(`!!document.querySelector('svg [data-gaia-id="${deviceId}"]')`))
    .toBe(true);

  await js("document.querySelector('.virtual-input summary').click()");
  await press(session, "Update connection", "Bağlantıyı güncelle");
  await expect
    .poll(() => js("document.querySelector('.properties-panel .object-heading')?.innerText"))
    .toMatch(/Online|Bağlı/);
  await js(`(() => {
    const input = document.querySelector('.virtual-input input[name=sample]');
    input.value = "23";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  await press(session, "Update sample", "Ölçümü güncelle");
  await expect
    .poll(() => js("document.querySelector('li[data-freshness=fresh] .reading')?.textContent"))
    .toMatch(/23 °C/);
  await js("document.querySelector('.virtual-input summary').click()");

  await press(session, "Edit device", "Cihazı düzenle");
  await toggleDeviceCheckbox(session, ["Temperature", "Sıcaklık"]);
  await press(session, "Save device", "Cihazı kaydet");
  await expect.poll(() => js("document.querySelectorAll('.observation-list li').length")).toBe(1);
  assert.equal(await js("document.body.innerText.includes('23 °C')"), false);
  const removedEpochDoc = await projectDoc();
  assert.equal(removedEpochDoc.statusEpoch, removedEpochDoc.world.revision);

  await press(session, "Edit device", "Cihazı düzenle");
  await toggleDeviceCheckbox(session, ["Temperature", "Sıcaklık"]);
  await press(session, "Save device", "Cihazı kaydet");
  await expect.poll(() => js("document.querySelectorAll('.observation-list li').length")).toBe(2);
  assert.equal(await js("document.body.innerText.includes('23 °C')"), false);
  console.info("Gaia Electron verified device creation, placement and capability removal/re-add");
  return { project, deviceId };
}

const referenceRun = process.argv.includes("--references");
const referenceProject = "survey-yard";
const referenceRoot = join(root, "data/room-storage/gaia-room/projects", referenceProject);
const referenceDoc = async () =>
  JSON.parse(await readFile(join(referenceRoot, "world.json"), "utf8"));
const evidence = join(repo, "rooms/.build/gaia-room/evidence/02-b1");

async function capture(session, filename, output = evidence) {
  await session.js(
    "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))"
  );
  await mkdir(output, { recursive: true });
  const id = await session.guest.evaluate((guest) => guest.getWebContentsId());
  const encoded = await session.app.evaluate(
    async ({ webContents }, guestId) =>
      (await webContents.fromId(guestId).capturePage()).toPNG().toString("base64"),
    id
  );
  await writeFile(join(output, filename), Buffer.from(encoded, "base64"));
}

async function selectProject(session, id) {
  await expect
    .poll(() => session.js(`!!document.querySelector('.projects option[value="${id}"]')`))
    .toBe(true);
  await session.js(`document.querySelector('.projects select').value = ${JSON.stringify(id)};
    document.querySelector('.projects select').dispatchEvent(new Event("change", {bubbles: true}));`);
  await press(session, "Open project", "Projeyi aç");
  await expect
    .poll(() => session.js("document.querySelector('.project-context strong')?.textContent"))
    .toBe(id);
}

async function fillReferenceField(session, name, value) {
  const changed = await session.js(`(() => {
    const label = [...document.querySelectorAll(".properties-panel label")].find((el) =>
      (el.firstElementChild?.textContent ?? el.textContent).trim() === ${JSON.stringify(name)});
    const field = label?.querySelector("input, select");
    if (!field || field.disabled) return false;
    field.value = ${JSON.stringify(String(value))};
    field.dispatchEvent(new Event(field instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
    return true;
  })()`);
  assert.equal(changed, true, name);
}

async function importFile(session, image, name, replace = false) {
  const index = replace ? 1 : 0;
  const imported = await session.js(`(() => {
    const input = document.querySelectorAll('input[type=file]')[${index}];
    if (!input || input.disabled) return false;
    const bytes = Uint8Array.fromBase64(${JSON.stringify(image.toString("base64"))});
    const files = new DataTransfer();
    files.items.add(new File([bytes], ${JSON.stringify(name)}, { type: "application/octet-stream" }));
    input.files = files.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`);
  assert.equal(imported, true);
}

async function pixelClick(session, x, y) {
  const point = await session.js(`(() => {
    const svg = document.querySelector('.calibration-image svg');
    const p = new DOMPoint(${x}, ${y}).matrixTransform(svg.getScreenCTM());
    return [p.x, p.y];
  })()`);
  await sendPointer(session, point);
}

async function revision(n) {
  await expect.poll(async () => (await referenceDoc()).world.revision).toBe(n);
}

async function drawWaypoints(session, points) {
  for (const point of points) await sendPointer(session, await planPoint(session, point));
}

async function selectedProperty(session, name) {
  return session.js(`(() => {
    const label = [...document.querySelectorAll(".properties-panel dt")].find((el) => el.textContent.trim() === ${JSON.stringify(name)});
    return label?.nextElementSibling?.textContent?.trim();
  })()`);
}

async function syntheticSurvey(session) {
  const image = await session.js(`(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 2400; canvas.height = 1800;
    const c = canvas.getContext("2d");
    c.scale(3, 3);
    c.fillStyle = "#d8ddc2"; c.fillRect(0, 0, 800, 600);
    c.fillStyle = "#bdcda9"; c.fillRect(34, 35, 734, 522);
    for (const [color, x, y, w, h] of [
      ["#9fac87", 110, 84, 279, 134], ["#b5be8a", 431, 95, 214, 130],
      ["#becb9e", 464, 325, 208, 145], ["#a9bd97", 110, 306, 226, 125],
      ["#f1e5c3", 26, 254, 750, 26], ["#f1e5c3", 390, 72, 27, 478],
      ["#788c80", 170, 145, 117, 70], ["#ddce9f", 527, 141, 68, 42]
    ]) { c.fillStyle = color; c.fillRect(x, y, w, h); }
    c.strokeStyle = "#657761"; c.lineWidth = 2; c.strokeRect(75, 68, 637, 480);
    for (let i = 0; i < 9; i++) {
      c.beginPath(); c.arc(511 + (i % 3) * 50, 348 + Math.floor(i / 3) * 47, 10, 0, 2 * Math.PI);
      c.fillStyle = "#758a65"; c.fill();
    }
    c.fillStyle = "#3d5246"; c.font = "bold 18px sans-serif";
    c.fillText("GAIA  •  SURVEY PLAN", 93, 103);
    c.font = "14px sans-serif"; c.fillText("Greenhouse", 175, 179); c.fillText("Shed", 536, 165);
    c.fillText("Orchard", 580, 462);
    c.lineWidth = 3; c.beginPath(); c.moveTo(100, 500); c.lineTo(300, 500); c.stroke();
    c.fillStyle = "#3d5246"; c.fillRect(97, 495, 6, 10); c.fillRect(297, 495, 6, 10);
    c.fillText("A", 94, 524); c.fillText("20 m", 185, 524); c.fillText("B", 296, 524);
    return canvas.toDataURL("image/png").split(",")[1];
  })()`);
  return Buffer.from(image, "base64");
}

async function exerciseReferences(session) {
  const png = await syntheticSurvey(session);
  const jpeg = await readFile(join(repo, "src/assets/logo.jpg"));
  await press(session, "Projects", "Projeler");
  await session.js(`(() => {
    const input = document.querySelector('.projects input');
    input.value = ${JSON.stringify(referenceProject)};
    input.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  await press(session, "Create project", "Proje oluştur");
  await expect
    .poll(() => session.js("document.querySelector('.project-context strong')?.textContent"))
    .toBe(referenceProject);
  await selectMode(session, false);
  await press(session, "References");
  await importFile(session, Buffer.from("not a raster"), "corrupt.png");
  await expect
    .poll(() => session.js("document.querySelector('.map-status [role=alert]')?.textContent"))
    .toMatch(/Invalid/);
  await importFile(session, png, "survey.png");
  await revision(1);
  await expect
    .poll(() =>
      session.js("document.querySelector('.properties-panel .object-heading')?.textContent")
    )
    .toMatch(/2400 × 1800 px/);
  let saved = await referenceDoc();
  const id = Object.keys(saved.world.references)[0];
  const asset = saved.world.references[id].asset;
  assert.equal(saved.world.references[id].frame, null);
  assert.deepEqual(await readFile(join(referenceRoot, "assets", asset)), png);
  await expect
    .poll(() =>
      session.js(
        "[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Calibrate' && !b.disabled)"
      )
    )
    .toBe(true);
  await capture(session, "00-import.png");
  await press(session, "Calibrate");
  await pixelClick(session, 300, 1500);
  await pixelClick(session, 300, 1500);
  await expect
    .poll(() => session.js("document.querySelector('.map-status [role=alert]')?.textContent"))
    .toMatch(/different points/);
  await pixelClick(session, 900, 1500);
  await fillReferenceField(session, "Distance from A to B (m)", -1);
  assert.equal(
    await session.js(
      "[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Preview on plan').disabled"
    ),
    true
  );
  await fillReferenceField(session, "Distance from A to B (m)", 20);
  await fillReferenceField(session, "X", 12);
  await fillReferenceField(session, "Y", 8);
  await fillReferenceField(session, "Bearing from A to B (°)", 15);
  await expect
    .poll(() => session.js("document.querySelector('.properties-panel output')?.textContent"))
    .toMatch(/m\/px/);
  await capture(session, "01-calibration.png");
  await press(session, "Preview on plan");
  const overlay = () =>
    session.js(`(() => {
    const image = document.querySelector('svg image[data-gaia-reference]');
    return [image.getAttribute("width"), image.getAttribute("height"), image.getAttribute("transform")];
  })()`);
  const before = await overlay();
  const view = () =>
    session.js("document.querySelector('.map-viewport svg').getAttribute('viewBox')");
  const camera = await view();
  await session.js(`(() => {
    const svg = document.querySelector('.map-viewport svg');
    const r = svg.getBoundingClientRect();
    svg.dispatchEvent(new WheelEvent("wheel",{deltaY: -250, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2}));
  })()`);
  await expect.poll(view).not.toBe(camera);
  const zoomed = await view();
  const center = await session.js(`(() => {
    const { x, y, width, height } = document.querySelector('.map-viewport svg').getBoundingClientRect();
    return [x + width / 2, y + height / 2];
  })()`);
  await sendPointer(session, center, [center[0] + 20, center[1] - 12]);
  await expect.poll(view).not.toBe(zoomed);
  assert.deepEqual(await overlay(), before);
  await revision(1);
  await press(session, "Confirm calibration");
  await revision(2);
  saved = await referenceDoc();
  const calibration = saved.world.references[id].calibration;
  assert.equal(calibration.distanceM, 20);
  assert.equal(calibration.bearingDeg, 15);
  assert.deepEqual(calibration.anchor, [12, 8, 0]);
  assert.ok(
    Math.abs(calibration.pixels[0][0] - 300) < 8 && Math.abs(calibration.pixels[1][0] - 900) < 8
  );
  const projection = projectReference(saved.world, saved.world.references[id]);
  const onImage = (xy) => referencePoint(projection, xy);
  await press(session, "Fit all");
  await press(session, "Draw boundary");
  await drawWaypoints(
    session,
    [
      [250, 250],
      [2050, 250],
      [2050, 1450],
      [250, 1450],
    ].map(onImage)
  );
  await press(session, "Finish drawing");
  const site = await session.js("document.querySelector('[data-selected-id]').dataset.selectedId");
  assert.match(await selectedProperty(session, "Horizontal area"), /m²/);
  await press(session, "Place building");
  await drawWaypoints(session, [onImage([700, 650])]);
  await editNumber(session, ["Direction (°)"], 35);
  const building = await session.js(
    "document.querySelector('[data-selected-id]').dataset.selectedId"
  );
  await press(session, "Add floor");
  await editNumber(session, ["Elevation (m)"], -3);
  const floor = await session.js("document.querySelector('[data-selected-id]').dataset.selectedId");
  await toggleUnderground(session);
  await press(session, "Place device");
  await drawWaypoints(session, [onImage([715, 680])]);
  await press(session, "Draw utility line");
  await editNumber(session, ["Elevation (m)"], -2, ".edit-toolbar");
  await drawWaypoints(session, [onImage([668, 600]), onImage([835, 600])]);
  await editNumber(session, ["Elevation (m)"], 1, ".edit-toolbar");
  await drawWaypoints(session, [onImage([835, 600])]);
  await press(session, "Finish drawing");
  assert.match(await selectedProperty(session, "3D route length"), /m/);
  await press(session, "Save to Gaia");
  await revision(3);

  await press(session, "Measure");
  await fillReferenceField(session, "World elevation of next point (m)", -2);
  await drawWaypoints(session, [onImage([1250, 780])]);
  await fillReferenceField(session, "World elevation of next point (m)", 1);
  await drawWaypoints(session, [onImage([1400, 975])]);
  const horizontal = parseFloat(await selectedProperty(session, "Horizontal distance"));
  const direct = parseFloat(await selectedProperty(session, "Direct 3D distance"));
  assert.ok(direct > horizontal && Math.abs(direct - Math.hypot(horizontal, 3)) < 0.01);
  await capture(session, "03-measurement.png");
  await fillReferenceField(session, "Measurement type", "route");
  await drawWaypoints(session, [onImage([1250, 780]), onImage([1400, 975]), onImage([1500, 950])]);
  assert.ok(parseFloat(await selectedProperty(session, "3D route length")) > horizontal);
  await revision(3);
  await press(session, "Measure");

  await press(session, "Overview");
  await expect
    .poll(() => session.js("!!document.querySelector('image[data-gaia-reference]')"))
    .toBe(true);
  await pickLayer(session, site);
  await capture(session, "02-site-plan.png");
  await selectMode(session, false);
  await pickLayer(session, floor);
  await press(session, "References");
  await importFile(session, jpeg, "floor-reference.jpg");
  await revision(4);
  const jpegDoc = await referenceDoc();
  const floorLayer = Object.keys(jpegDoc.world.references).find((key) => key !== id);
  const jpegId = jpegDoc.world.references[floorLayer].asset;
  assert.equal(jpegDoc.world.references[floorLayer].frame, floor);
  assert.equal(jpegDoc.world.assets[jpegId].mime, "image/jpeg");
  assert.deepEqual(await readFile(join(referenceRoot, "assets", jpegId)), jpeg);
  await expect
    .poll(() =>
      session.js(
        "[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Calibrate' && !b.disabled)"
      )
    )
    .toBe(true);
  await press(session, "Calibrate");
  await pixelClick(session, 120, 750);
  await pixelClick(session, 820, 750);
  await fillReferenceField(session, "Distance from A to B (m)", 7);
  await press(session, "Preview on plan");
  await press(session, "Confirm calibration");
  await revision(5);
  await pickLayer(session, building);
  await session.js(`(() => {
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    window.gaiaDrawnReferenceFormats = new Set();
    CanvasRenderingContext2D.prototype.drawImage = function(image, ...args) {
      if (image instanceof HTMLImageElement && image.src.startsWith("data:image/"))
        window.gaiaDrawnReferenceFormats.add(image.src.slice(5, image.src.indexOf(";")));
      return draw.call(this, image, ...args);
    };
  })()`);
  await press(session, "Edit interior");
  await expect
    .poll(() =>
      session.js(
        "[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Locked reference preview')"
      )
    )
    .toBe(true);
  await expect.poll(() => session.js("!!document.querySelector('canvas')")).toBe(true);
  const canvasHash = () => session.js("document.querySelector('canvas').toDataURL()");
  await press(session, "Locked reference preview");
  await session.js(
    "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))"
  );
  const behind = await canvasHash();
  await press(session, "Locked reference preview");
  await expect.poll(canvasHash).not.toBe(behind);
  await expect
    .poll(() => session.js("[...window.gaiaDrawnReferenceFormats].sort()"))
    .toEqual(["image/jpeg", "image/png"]);
  await capture(session, "04-locked-interior.png");
  await press(session, "Back to site plan");
  const result = await referenceDoc();
  assert.equal(result.world.nodes[building].yaw, 35);
  assert.equal(result.world.nodes[floor].p[2], -3);
  assert.equal(result.world.nodes[site].kind, "site");
  assert.ok(Object.values(result.world.nodes).some((node) => node.kind === "mount"));
  console.info(
    "Gaia 02-B/1 imported PNG and JPEG, calibrated original pixels, built from the reference, measured and previewed the negative floor"
  );
  return { id, asset, png, jpeg, floorLayer, jpegId, result };
}

async function reopenReferences(session, test) {
  await selectProject(session, referenceProject);
  await expect
    .poll(() => session.js("!!document.querySelector('image[data-gaia-reference]')"))
    .toBe(true);
  assert.deepEqual(await referenceDoc(), test.result);
  assert.deepEqual(await readFile(join(referenceRoot, "assets", test.asset)), test.png);
  assert.deepEqual(await readFile(join(referenceRoot, "assets", test.jpegId)), test.jpeg);
  await selectMode(session, false);
  await press(session, "survey.png");
  const toggle = (label) =>
    session.js(`[...document.querySelectorAll(".properties-panel label")]
    .find((el) => el.textContent.trim() === ${JSON.stringify(label)}).querySelector("input").click()`);
  const visible = () =>
    session.js(`!!document.querySelector('[data-gaia-reference="${test.id}"]')`);
  await toggle("Show on plan");
  await toggle("Lock placement");
  await press(session, "Apply settings");
  await revision(6);
  await expect.poll(visible).toBe(false);
  assert.equal((await referenceDoc()).world.references[test.id].locked, true);
  await expect
    .poll(() =>
      session.js(
        "document.querySelector('.properties-panel input[type=checkbox]:checked')?.parentElement.textContent"
      )
    )
    .toMatch(/Lock placement/);
  await toggle("Show on plan");
  await toggle("Lock placement");
  await session.js(`(() => {
    const slider = document.querySelector('.properties-panel input[type=range]');
    slider.value = "40";
    slider.dispatchEvent(new Event("input", {bubbles:true}));
  })()`);
  await press(session, "Apply settings");
  await revision(7);
  await expect.poll(visible).toBe(true);
  assert.equal((await referenceDoc()).world.references[test.id].opacity, 0.4);
  await importFile(session, test.jpeg, "replacement.jpg", true);
  await revision(8);
  const replaced = (await referenceDoc()).world;
  assert.equal(replaced.references[test.id].calibration, undefined);
  assert.deepEqual(replaced.nodes, test.result.world.nodes);
  assert.deepEqual(replaced.devices, test.result.world.devices);
  assert.deepEqual(
    await readFile(join(referenceRoot, "assets", replaced.references[test.id].asset)),
    test.jpeg
  );
  await rm(join(referenceRoot, "assets", test.jpegId));
  await writeFile(
    join(referenceRoot, "assets", replaced.references[test.id].asset),
    Buffer.from("damaged")
  );
  await press(session, "Projects", "Projeler");
  await selectProject(session, referenceProject);
  await press(session, "floor-reference.jpg");
  await expect
    .poll(() =>
      session.js("document.querySelector('.properties-panel [role=status]')?.textContent")
    )
    .toMatch(/missing/);
  await press(session, "replacement.jpg");
  await expect
    .poll(() =>
      session.js("document.querySelector('.properties-panel [role=status]')?.textContent")
    )
    .toMatch(/damaged/);
  assert.deepEqual((await referenceDoc()).world.nodes, test.result.world.nodes);
  console.info(
    "Gaia 02-B/1 restored bytes and raw calibration after app restart, kept geometry on replacement and recovered the view with missing and damaged assets"
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
  if (!standalone) {
    const forgeBundle = await buildRoomBundle("forge-room", {
      outputFile: join(root, "forge.hevroom"),
    });
    const forgeInstalled = await manager.importBundleFile(forgeBundle.outputFile);
    assert.ok(forgeInstalled.success, forgeInstalled.error);
  }
  console.info("Opening installed Gaia Room");
  running = await launch();
  if (standalone) {
    const nav = running.page.locator("button[data-room-nav][data-room-id]");
    await expect(nav).toHaveCount(1);
    await expect(nav).toHaveAttribute("data-room-id", "gaia-room");
    await expect.poll(() => running.js("document.documentElement.lang")).toBe("tr");
    await assertTheme(running);
  }
  const { js, guest } = running;
  await js(
    `const input=document.querySelector(".projects input");input.value="smoke";input.dispatchEvent(new Event("input",{bubbles:true}))`
  );
  await expect
    .poll(() => js("document.querySelector('.projects button:last-child').disabled"))
    .toBe(false);
  await js("document.querySelector('.projects button:last-child').click()");
  if (deviceRun) {
    await expect.poll(() => js("!!document.querySelector('[data-device=c2]')")).toBe(true);
    await exerciseDeviceStatus(running);
  }
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
  assert.deepEqual(await running.app.evaluate(() => globalThis.gaiaSmokeBlockedRequests), []);
  console.info("Committed revision", saved.world.revision);
  await closeApp(running.app);
  running = undefined;
  if (standalone || referenceRun) {
    const settingsPath = join(root, "config/settings.json");
    const settings = JSON.parse(await readFile(settingsPath, "utf8"));
    settings.general.language = "en";
    await writeFile(settingsPath, JSON.stringify(settings));
  }
  console.info("Opening installed Gaia Room");
  running = await launch();
  if (standalone || referenceRun) {
    await expect.poll(() => running.js("document.documentElement.lang")).toBe("en");
    await expect
      .poll(() => running.js("document.querySelector('.projects button')?.textContent"))
      .toBe("Open project");
  }
  await expect
    .poll(() => running.js("document.querySelector('.projects select')?.value"))
    .toBe("smoke");
  await running.js("document.querySelector('.projects button').click()");
  await expect
    .poll(() => running.js("document.querySelector('.workspace-header')?.innerText"))
    .toMatch(/smoke/);
  if (deviceRun) {
    await running.js("document.querySelector('[data-device=c2]').click()");
    await selected(running, "c2");
    await expect
      .poll(() =>
        running.js("document.querySelector('li[data-freshness=stale] .reading')?.textContent")
      )
      .toMatch(/52 %/);
    console.info("Gaia 02-C restored the latest device status after Electron restart");
  }
  const reopened = await running.js(
    'window.roomAPI.requestStorageCommand("GaiaOpen",{project:"smoke"})'
  );
  assert.equal(reopened.success, true);
  assert.deepEqual(reopened.data.world, saved.world);
  assert.deepEqual(await doc(), saved);
  if (!standalone) {
    await press(running, "3D orbit", "3B yörünge");
    await expect
      .poll(() => running.js("!!document.querySelector('.orbit canvas:not([hidden])')"), {
        timeout: 20000,
      })
      .toBe(true);
  }
  if (deviceRun) {
    const lifecycle = await exerciseDeviceLifecycle(running);
    await closeApp(running.app);
    running = await launch();
    await selectProject(running, lifecycle.project);
    await running.js(`document.querySelector('[data-device="${lifecycle.deviceId}"]').click()`);
    await selected(running, lifecycle.deviceId);
    await expect
      .poll(() => running.js("document.querySelectorAll('.observation-list li').length"))
      .toBe(2);
    assert.equal(await running.js("document.body.innerText.includes('23 °C')"), false);
  }
  if (referenceRun) {
    const referenceTest = await exerciseReferences(running);
    await closeApp(running.app);
    running = await launch();
    await reopenReferences(running, referenceTest);
  }
  await running.guest.evaluate((el) => {
    void el.executeJavaScript("document.querySelector('.close-room').click()").catch(() => {});
  });

  await running.guest.waitFor({ state: "detached" });
  assert.deepEqual(await running.app.evaluate(() => globalThis.gaiaSmokeBlockedRequests), []);
  console.info("Gaia installed room saved and reopened after Electron restart", ids[0]);
} finally {
  if (running) await closeApp(running.app);
  await rm(root, { recursive: true, force: true });
}

// Playwright's inspector transport can stay open after Electron exits in a network namespace.
process.exit();
