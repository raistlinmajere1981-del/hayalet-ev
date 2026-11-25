import process from "node:process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { projectCommand } from "../../storage/provider.ts";

test.use({ launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } });

async function evidence(page, file) {
  if (process.env.GAIA_DEVICE_EVIDENCE) {
    await page.mouse.move(10, 10);
    await page.screenshot({ path: join(process.env.GAIA_DEVICE_EVIDENCE, file) });
  }
}

async function harness(page, locale = "en") {
  const storageRoot = await mkdtemp(join(tmpdir(), "gaia-device-browser-"));
  const context = { storageRoot, owner: {} };
  const requests = [];
  const call = (name, args) => projectCommand(context, name, args);
  await page.exposeFunction("deviceCommand", async (name, args) => {
    requests.push(name);
    try {
      return { success: true, data: await call(name, args) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });
  await page.addInitScript((lang) => {
    globalThis.hostListeners = 0;
    globalThis.roomAPI = {
      ready() {},
      close() {
        globalThis.gaiaClosed = true;
      },
      onVisibilityChange(callback) {
        globalThis.showGaia = callback;
        callback(true);
        return () => {
          delete globalThis.showGaia;
        };
      },
      onHostMessage(callback) {
        globalThis.hostListeners++;
        callback({ type: "host-context", locale: lang });
        return () => {
          globalThis.hostListeners--;
        };
      },
      requestStorageCommand: (...args) => globalThis.deviceCommand(...args),
    };
  }, locale);
  return {
    call,
    requests,
    readWorld: (name) => readFile(join(storageRoot, "projects", name, "world.json"), "utf8"),
    cleanup: () => rm(storageRoot, { force: true, recursive: true }),
  };
}

test("creates an unplaced multi-role device in an empty project and saves its identity", async ({
  page,
}) => {
  const store = await harness(page, "tr");
  try {
    await page.goto("/");
    await page.locator(".projects input").fill("empty");
    await page.locator(".projects button").first().click();
    await page.getByRole("button", { name: "Cihaz ekle" }).click();
    await page.getByLabel("Cihaz adı").fill("Bahçe izleyicisi");
    await page.getByLabel("Cihaz kaynağı").selectOption("physical");
    await page.getByLabel("Client", { exact: true }).check();
    await page.getByLabel("Sıcaklık", { exact: true }).check();
    await page.getByLabel("Nem", { exact: true }).check();
    await page.getByLabel("Marka").fill("Gaia örneği");
    await page.getByRole("button", { name: "Cihaz oluştur", exact: true }).click();
    const panel = page.locator(".properties-panel");
    await expect(panel.getByRole("heading", { name: "Bahçe izleyicisi" })).toBeVisible();
    await expect(panel.getByText("Yerleşmemiş", { exact: true })).toBeVisible();
    await expect(panel.getByText("Sanal durum girişi")).toHaveCount(0);
    await expect(panel.getByText("Eşlenmemiş", { exact: true })).toBeVisible();
    const id = await panel.locator(".object-heading").getAttribute("data-selected-id");
    const stored = JSON.parse(await store.readWorld("empty"));
    expect(stored.world.nodes).toEqual({});
    expect(stored.world.devices[id]).toMatchObject({
      name: "Bahçe izleyicisi",
      source: "physical",
      roles: expect.arrayContaining(["client", "sensor"]),
      capabilities: ["temperature.read.v1", "humidity.read.v1"],
      manufacturer: "Gaia örneği",
    });
    await page.getByRole("button", { name: "Cihazı düzenle" }).click();
    await page.getByLabel("Model", { exact: true }).fill("V2");
    await page.getByRole("button", { name: "Cihazı kaydet", exact: true }).click();
    await expect(panel.getByRole("heading", { name: "Bahçe izleyicisi" })).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "Projeyi aç" }).click();
    await page.locator(`[data-device="${id}"]`).click();
    await panel
      .locator("details summary")
      .filter({ hasText: /^Cihaz$/ })
      .click();
    await expect(panel.getByText("V2", { exact: true })).toBeVisible();
    await expect(panel.locator(".device-id")).toHaveText(id);
    expect(await panel.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await evidence(page, "browser-empty-inventory.png");
  } finally {
    await store.cleanup();
  }
});

test("places and moves a device, shares 2D/3D selection and updates latest simulated observations", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const store = await harness(page);
  try {
    await store.call("GaiaCreate", {
      project: "site",
      fixture: true,
      locale: "en",
      layout: "site",
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Open project" }).click();
    const panel = page.locator(".properties-panel");
    const plan = page.getByRole("application", { name: "2D plan" });
    const tree = page.locator(".layer-panel");
    await expect(panel.locator('[data-count="total"]')).toHaveText("7");
    await expect(panel.locator('[data-count="placed"]')).toHaveText("7");
    await page.getByRole("button", { name: "Collapse Sera", exact: true }).click();
    await expect(tree.locator('[data-node="ground"]')).toHaveCount(0);
    await page.getByRole("button", { name: "Expand Sera", exact: true }).click();
    await tree.locator('[data-node="glass"]').click();
    await expect(panel.locator('[data-count="total"]')).toHaveText("4");
    await tree.locator('[data-node="bed"]').click();
    await expect(panel.locator(".scope-devices .device-link")).toHaveCount(1);
    await tree.locator('[data-node="pipe"]').click();
    await expect(panel.getByText("Water", { exact: true })).toBeVisible();
    await expect(panel.getByText("-2 m → 1 m", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Add device" }).click();
    await page.getByLabel("Device name").fill("Yard monitor");
    await page.getByLabel("Temperature", { exact: true }).check();
    await page.getByLabel("Humidity", { exact: true }).check();
    await page.getByLabel("Camera", { exact: true }).check();
    await page.getByRole("button", { name: "Create device", exact: true }).click();
    await expect(panel.getByRole("heading", { name: "Yard monitor" })).toBeVisible();
    const id = await panel.locator(".object-heading").getAttribute("data-selected-id");
    await tree.locator('[data-node="plot"]').click();
    await expect(panel.locator('[data-count="total"]')).toHaveText("8");
    await expect(panel.locator('[data-count="placed"]')).toHaveText("7");
    await tree.locator(`[data-device="${id}"]`).click();
    await panel.getByRole("button", { name: "Change placement" }).click();
    await panel.getByLabel("Mounting point").selectOption("mc2");
    await panel.getByRole("button", { name: "Change placement" }).last().click();
    const marker = plan.locator(`[data-gaia-id="${id}"]`);
    await expect(marker).toBeVisible();
    await expect(plan.locator('[data-gaia-id="c2"]')).toBeVisible();
    await panel.getByRole("button", { name: "Change placement" }).click();
    await panel.getByLabel("Mounting point").selectOption("mc5");
    await panel.getByRole("button", { name: "Change placement" }).last().click();
    await expect(panel.getByText(/Kümes içi/)).toBeVisible();
    const moved = JSON.parse(await store.readWorld("site"));
    expect(moved.world.devices[id]).toMatchObject({
      mount: "mc5",
      capabilities: ["camera.view.v1", "temperature.read.v1", "humidity.read.v1"],
    });
    await tree.locator('[data-node="coop"]').click();
    await expect(panel.locator('[data-count="total"]')).toHaveText("3");
    await tree.locator('[data-node="plot"]').click();
    await expect(panel.locator('[data-count="total"]')).toHaveText("8");
    await evidence(page, "browser-site-summary.png");
    await marker.locator("circle").click();
    await expect(panel.locator(".object-heading")).toHaveAttribute("data-selected-id", id);

    await page.getByText("Visibility", { exact: true }).click();
    await page.locator(".visibility-menu").getByLabel("Devices", { exact: true }).uncheck();
    await expect(marker).toHaveCount(0);
    await page.getByText("Visibility", { exact: true }).click();
    await panel.getByRole("button", { name: "Show and focus" }).click();
    await expect(marker).toBeVisible();

    await page.getByRole("button", { name: "3D orbit" }).click();
    const badge = page.locator(`[data-gaia-device="${id}"]`);
    await expect(badge).toBeVisible();
    await expect(badge).toHaveAttribute("aria-pressed", "true");
    await tree.locator('[data-node="coop"]').click();
    await badge.click();
    await expect(panel.locator(".object-heading")).toHaveAttribute("data-selected-id", id);
    const geometry = await page.locator(".map-viewport").getAttribute("data-geometry");
    const originalCanvas = await page.locator(".orbit canvas").elementHandle();
    const beforeStatus = await store.readWorld("site");
    await panel.getByText("Simulated input").click();
    await expect(panel.getByText("Awaiting data", { exact: true })).toHaveCount(2);
    await panel.getByRole("button", { name: "Update connection" }).click();
    await expect(badge).toHaveAttribute("data-device-health", "noData");
    await expect(panel.getByLabel("Capabilities").locator("option")).toHaveCount(2);
    await panel.getByLabel("Reading (°C)").fill("22.75");
    await panel.getByRole("button", { name: "Update sample" }).click();
    await expect(panel.locator('li[data-freshness="fresh"]')).toContainText("22.75 °C");
    await panel.getByLabel("Sample state").selectOption("stale");
    await panel.getByRole("button", { name: "Update sample" }).click();
    await expect(badge).toHaveAttribute("data-device-health", "stale");
    await panel.getByLabel("Sample state").selectOption("fresh");
    await panel.getByRole("button", { name: "Update sample" }).click();
    await expect(panel.locator('li[data-freshness="fresh"]')).toContainText("22.75 °C");
    await panel.getByRole("combobox", { name: "Connection", exact: true }).selectOption("offline");
    await panel.getByRole("button", { name: "Update connection" }).click();
    await expect(badge).toHaveAttribute("data-device-health", "offline");
    await expect(panel.locator('li[data-freshness="stale"]')).toContainText("Last known");
    await panel.getByLabel("Sample state").selectOption("invalid");
    await panel.getByRole("button", { name: "Update sample" }).click();
    await expect(panel.locator('li[data-quality="invalid"]')).toContainText("Invalid reading");
    await expect(panel.locator('li[data-quality="invalid"] .reading')).toHaveCount(0);
    expect(await store.readWorld("site")).toBe(beforeStatus);
    expect(await page.locator(".map-viewport").getAttribute("data-geometry")).toBe(geometry);
    expect(
      await originalCanvas.evaluate(
        (canvas) => canvas === globalThis.document.querySelector(".orbit canvas")
      )
    ).toBe(true);
    await panel.getByText("Simulated input").click();
    await evidence(page, "browser-orbit-status.png");

    for (let cycle = 0; cycle < 2; cycle++) {
      const previous = store.requests.filter((name) => name === "GaiaStatus").length;
      await page.evaluate(() => globalThis.showGaia(false));
      await expect(page.locator(".orbit canvas")).toBeHidden();
      expect(await page.evaluate(() => globalThis.hostListeners)).toBe(0);
      expect(store.requests.filter((name) => name === "GaiaStatus")).toHaveLength(previous);
      await page.evaluate(() => globalThis.showGaia(true));
      await expect(badge).toBeVisible();
      await expect
        .poll(() => store.requests.filter((name) => name === "GaiaStatus").length)
        .toBe(previous + 1);
      expect(await page.evaluate(() => globalThis.hostListeners)).toBe(1);
    }
    await page.getByRole("button", { name: "2D plan" }).click();
    await expect(marker).toHaveAttribute("data-device-health", "offline");
    await expect(panel.locator(".object-heading")).toHaveAttribute("data-selected-id", id);
    await panel.getByRole("button", { name: "Change placement" }).click();
    await panel.getByRole("button", { name: "Place on plan" }).click();
    await page.getByLabel("Placement area").selectOption("cellar");
    await page.getByRole("button", { name: "Fit all" }).click();
    const centered = await plan.evaluate(
      (svg, coordinates) => {
        const p = new globalThis.DOMPoint(...coordinates).matrixTransform(svg.getScreenCTM());
        return [p.x, p.y];
      },
      [12, -14]
    );
    await page.mouse.click(...centered);
    await expect(panel.locator("dd").filter({ hasText: /bodrum.*Device point/i })).toBeVisible();
    const placed = JSON.parse(await store.readWorld("site"));
    const mount = placed.world.devices[id].mount;
    expect(placed.world.nodes[mount].parent).toBe("cellar");
    await expect(marker).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "Open project" }).click();
    await tree.locator(`[data-device="${id}"]`).click();
    await expect(panel.locator('li[data-quality="invalid"]')).toBeVisible();
    await panel.getByRole("button", { name: "Change placement" }).click();
    await panel.getByRole("button", { name: "Unplace device" }).click();
    await expect(panel.getByText("Unplaced", { exact: true })).toBeVisible();
    await expect(tree.locator(`[data-device="${id}"]`)).toHaveCount(1);
    await panel.getByRole("button", { name: "Change placement" }).click();
    await panel.getByLabel("Mounting point").selectOption(mount);
    await panel.getByRole("button", { name: "Change placement" }).last().click();
    await expect(panel.locator("dd").filter({ hasText: /bodrum.*Device point/i })).toBeVisible();
    await panel.getByRole("button", { name: "Delete device" }).click();
    const dialog = page.getByRole("dialog", { name: "Delete this device?" });
    await expect(dialog).toContainText("latest status");
    await expect(dialog).toContainText("The mounting point stays in the model.");
    await dialog.getByRole("button", { name: "Delete device" }).click();
    await expect(tree.locator(`[data-device="${id}"]`)).toHaveCount(0);
    expect(JSON.parse(await store.readWorld("site")).world.nodes[mount]).toBeDefined();
    await page.getByRole("button", { name: "Close room" }).click();
    await expect(page.locator(".gaia-workspace")).toHaveCount(0);
    expect(await page.evaluate(() => globalThis.gaiaClosed)).toBe(true);
    expect(await page.evaluate(() => globalThis.hostListeners)).toBe(0);
  } finally {
    await store.cleanup();
  }
});
