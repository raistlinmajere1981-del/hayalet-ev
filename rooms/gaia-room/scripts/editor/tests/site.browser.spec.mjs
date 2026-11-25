import process from "node:process";
import { expect, test } from "@playwright/test";

test.use({ launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } });

test("overview selects in 2D when WebGL is unavailable and suspends the active UI", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = globalThis.HTMLCanvasElement.prototype.getContext;
    globalThis.HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type.startsWith("webgl") ? null : original.call(this, type, ...args);
    };
    const world = {
      schemaVersion: 1,
      id: "demo",
      revision: 7,
      devices: {},
      assets: {},
      references: {},
      nodes: {
        site: {
          kind: "site",
          name: "Example site",
          parent: null,
          p: [0, 0, 0],
          yaw: 0,
          geometry: {
            kind: "footprint",
            ring: [
              [0, 0],
              [40, 0],
              [40, 60],
              [0, 60],
            ],
          },
        },
        house: {
          kind: "building",
          name: "House",
          parent: "site",
          p: [12, 14, 0],
          yaw: 31,
          geometry: { kind: "box", size: [10, 8, 4] },
        },
        shed: {
          kind: "building",
          name: "Shed",
          parent: "site",
          p: [26, 36, 0],
          yaw: 0,
          geometry: { kind: "box", size: [8, 6, 3] },
        },
      },
    };
    globalThis.window.contextListeners = 0;
    globalThis.window.roomAPI = {
      ready() {},
      onVisibilityChange(callback) {
        globalThis.window.setRoomVisibility = callback;
        callback(true);
        return () => {
          delete globalThis.window.setRoomVisibility;
        };
      },
      onHostMessage(callback) {
        globalThis.window.contextListeners += 1;
        callback({ type: "host-context", locale: "en" });
        return () => {
          globalThis.window.contextListeners -= 1;
        };
      },
      async requestStorageCommand(name) {
        return {
          success: true,
          data:
            name === "GaiaProjects"
              ? { projects: ["demo"] }
              : { world, building: null, session: globalThis.crypto.randomUUID(), missing: [] },
        };
      },
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Open project" }).click();
  await expect(page.locator("svg g[data-gaia-id=shed]")).toBeVisible();
  assertNotLoaded(
    await page.evaluate(() =>
      globalThis.performance.getEntriesByType("resource").map((r) => r.name)
    )
  );
  await page.getByRole("button", { name: "3D orbit" }).click();
  await expect(page.getByRole("status")).toContainText("The 2D plan is active");
  await page.locator("svg g[data-gaia-id=shed] polygon").click();
  await expect(page.locator("[data-selected-id=shed]")).toBeVisible();
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => globalThis.window.setRoomVisibility(false));
    await expect(page.locator(".map-viewport svg")).toHaveCount(0);
    expect(await page.evaluate(() => globalThis.window.contextListeners)).toBe(0);
    await page.evaluate(() => globalThis.window.setRoomVisibility(true));
    await expect(page.locator(".map-viewport svg")).toBeVisible();
    expect(await page.evaluate(() => globalThis.window.contextListeners)).toBe(1);
  }
  await expect(page.locator("[data-selected-id=shed]")).toBeVisible();
});

function assertNotLoaded(resources) {
  expect(resources.some((url) => /\/assets\/(Workshop|orbit)-[^/]+\.min\.js$/.test(url))).toBe(
    false
  );
}

test("draws an empty site's boundary, edits corners, places structures and discards a deletion", async ({
  page,
}) => {
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { projectCommand } = await import("../../storage/provider.ts");
  const storageRoot = await mkdtemp(join(tmpdir(), "gaia-site-ui-"));
  const context = { storageRoot, owner: {} };
  const command = (name, request) => projectCommand(context, name, request);
  try {
    await page.exposeFunction("deliverCommand", async (name, request) => ({
      success: true,
      data: await command(name, request),
    }));
    await page.addInitScript(() => {
      globalThis.window.roomAPI = {
        ready() {},
        onHostMessage: () => () => {},
        requestStorageCommand: (...args) => globalThis.window.deliverCommand(...args),
      };
    });
    await page.goto("/");
    await page.getByLabel("Project ID").fill("new-site");
    await page.getByRole("button", { name: "Create project", exact: true }).click();
    await expect(page.getByText("This project is empty.", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Modeling Workshop" }).click();
    const plan = page.getByRole("application", { name: "2D plan" });
    const position = async ([x, y]) =>
      plan.evaluate(
        (svg, point) => {
          const p = new globalThis.DOMPoint(point[0], -point[1]).matrixTransform(
            svg.getScreenCTM()
          );
          return [p.x, p.y];
        },
        [x, y]
      );
    await page.getByRole("button", { name: "Draw boundary" }).click();
    for (const point of [
      [-4, -4],
      [4, -4],
      [4, 4],
      [-4, 4],
    ])
      await page.mouse.click(...(await position(point)));
    await page.getByRole("button", { name: "Finish drawing" }).click();
    const handles = plan.locator("[data-corner]");
    await expect(handles).toHaveCount(4);
    const first = await handles.first().boundingBox();
    const [x, y] = [first.x + first.width / 2, first.y + first.height / 2];
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 20, y);
    await page.mouse.up();
    const vertex = page.locator(".vertex").first().getByRole("spinbutton", { name: "X" });
    expect(Number(await vertex.inputValue())).toBeLessThan(-4);
    await vertex.fill("-4.5");
    await vertex.press("Tab");
    await page.getByRole("button", { name: "Place building" }).click();
    await page.mouse.click(...(await position([0, 0])));
    const property = page.locator("[data-selected-id]");
    const id = await property.getAttribute("data-selected-id");
    await expect(property.getByRole("heading")).toHaveText("Building 1");
    await page.getByRole("button", { name: "Save to Gaia" }).click();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    const saved = await command("GaiaOpen", { project: "new-site" });
    expect(saved.world.nodes[id].kind).toBe("building");
    expect(saved.world.nodes[saved.world.nodes[id].parent].geometry.ring[0][0]).toBe(-4.5);

    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(plan.locator(`[data-gaia-id="${id}"]`)).toHaveCount(0);
    await page.getByRole("button", { name: "Overview" }).click();
    await page.getByRole("button", { name: "Discard changes" }).click();
    await expect(plan.locator(`g[data-gaia-id="${id}"]`)).toBeVisible();
    await page.getByRole("button", { name: "Hide Building 1" }).click();
    await expect(plan.locator(`g[data-gaia-id="${id}"]`)).toHaveCount(0);
    expect((await command("GaiaOpen", { project: "new-site" })).world).toEqual(saved.world);
  } finally {
    await rm(storageRoot, { recursive: true, force: true });
  }
});

test.describe("site fixture", () => {
  test("closing during the orbit download never creates a WebGL context", async ({ page }) => {
    const { createSiteFixture } = await import("../../spatial/fixture.ts");
    await page.addInitScript((world) => {
      globalThis.roomAPI = {
        ready() {},
        close() {},
        onHostMessage() {
          return () => {};
        },
        async requestStorageCommand(name) {
          return {
            success: true,
            data: name === "GaiaProjects" ? { projects: [world.id] } : { world, missing: [] },
          };
        },
      };
      globalThis.webglCreations = 0;
      const getContext = globalThis.HTMLCanvasElement.prototype.getContext;
      globalThis.HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        if (type === "webgl2") globalThis.webglCreations++;
        return getContext.call(this, type, ...args);
      };
    }, createSiteFixture());
    const orbit = /\/assets\/orbit-[^/]+\.min\.js$/;
    const download = Promise.withResolvers();
    const release = Promise.withResolvers();
    await page.route(orbit, async (route) => {
      download.resolve(route.request().url());
      await release.promise;
      await route.continue();
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Open project" }).click();
    try {
      await page.getByRole("button", { name: "3D orbit" }).click();
      await download.promise;
      await page.locator(".close-room").click();
      await expect(page.locator(".gaia-workspace")).toHaveCount(0);
    } finally {
      release.resolve();
    }
    // Reuse the same import promise so the abandoned view's continuation has run.
    const creations = await page.evaluate(
      async (url) => {
        await import(url);
        return globalThis.webglCreations;
      },
      await download.promise
    );
    expect(creations).toBe(0);
    await expect(page.locator(".orbit canvas")).toHaveCount(0);
  });

  test("renders the 40 by 60 metre fixture in both viewer modes and opens the interior", async ({
    page,
  }) => {
    const { createSiteFixture } = await import("../../spatial/fixture.ts");
    const { mkdir } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const world = createSiteFixture();
    const evidence = process.env.GAIA_EVIDENCE_DIR;
    if (evidence) await mkdir(evidence, { recursive: true });
    const screenshot = async (name) => {
      if (evidence) await page.screenshot({ path: join(evidence, name + ".png") });
    };
    await page.addInitScript((world) => {
      globalThis.roomAPI = {
        ready() {},
        onHostMessage(callback) {
          callback({ type: "host-context", locale: "tr" });
          return () => {};
        },
        async requestStorageCommand(name, request) {
          return {
            success: true,
            data:
              name === "GaiaProjects"
                ? { projects: [world.id] }
                : {
                    world,
                    building: request.building ?? "glass",
                    session: globalThis.crypto.randomUUID(),
                    missing: [],
                  },
          };
        },
      };
    }, world);
    await page.goto("/");
    await page.getByRole("button", { name: "Projeyi aç", exact: true }).click();
    await page.getByLabel("Yer altı", { exact: true }).check();
    await page.getByTitle("Kümes · Yapı").click();
    await expect(page.locator("svg g[data-gaia-id=tank]")).toBeVisible();
    await screenshot("gaia-overview-2d");
    await page.getByRole("button", { name: "3B yörünge" }).click();
    await expect(page.locator(".orbit canvas")).toBeVisible();
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(resolve))
        )
    );
    await screenshot("gaia-overview-3d");
    await page.getByRole("button", { name: "Modelleme Atölyesi" }).click();
    await page.getByTitle("Sera · Yapı").click();
    await expect(page.getByLabel("Yön (°)")).toHaveValue("90");
    await screenshot("gaia-site-workshop");
    await page.getByRole("button", { name: "İç planı düzenle" }).click();
    await expect(page.getByLabel("İç plan düzenleme tuvali")).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Kat", exact: true })).toHaveValue("f-ground");
    await screenshot("gaia-interior-workshop");
  });

  test("keeps compact calibration inside the inspector and navigates the layer tree", async ({
    page,
  }) => {
    const { createSiteFixture } = await import("../../spatial/fixture.ts");
    const world = createSiteFixture();
    world.id = "a-very-long-project-identifier-used-to-check-header-layout";
    world.nodes.plot.name = "Arazi — çok uzun bir arazi adı: kuzey bahçesi ve güney serası";
    world.assets.grid = { mime: "image/png", pixels: [400, 600] };
    world.references.survey = {
      frame: "plot",
      asset: "grid",
      opacity: 0.5,
      name: "survey-2026-11-25-kuzey-arazi-uydu-goruntusu-cok-uzun-dosya-adi.png",
      calibration: {
        pixels: [
          [10, 10],
          [110, 10],
        ],
        distanceM: 100,
        anchor: [0, 0, 0],
        bearingDeg: 0,
      },
    };
    await page.addInitScript((world) => {
      globalThis.roomAPI = {
        ready() {},
        onHostMessage(callback) {
          callback({ type: "host-context", locale: "tr" });
          return () => {};
        },
        async requestStorageCommand(name) {
          return {
            success: true,
            data:
              name === "GaiaProjects"
                ? { projects: [world.id] }
                : name === "GaiaStatus"
                  ? { statuses: {}, revision: world.revision }
                  : { world, session: "compact", missing: [], damaged: [], building: null },
          };
        },
      };
    }, world);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Gaia Odası" })).toBeVisible();
    await expect(page.getByPlaceholder("atolye-1")).toBeVisible();
    await page.getByRole("button", { name: "Projeyi aç", exact: true }).click();

    await page.setViewportSize({ width: 480, height: 850 });
    const project = page.locator(".project-id");
    await expect(project).toHaveAttribute("title", world.id);
    expect(await project.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
      true
    );
    expect(
      await page.evaluate(
        () =>
          globalThis.document.documentElement.scrollWidth <=
          globalThis.document.documentElement.clientWidth
      )
    ).toBe(true);

    const first = page.locator(".layer-tree button.layer-select[data-node]").first();
    await first.focus();
    await first.press("ArrowDown");
    expect(
      await page.evaluate(
        () => globalThis.document.activeElement?.getAttribute("data-node") !== "plot"
      )
    ).toBe(true);
    await page.locator('.layer-tree button.layer-select[data-node="plot"]').focus();
    await page.keyboard.press("ArrowLeft");
    await expect(
      page.locator(".layer-tree button.visibility[aria-expanded]").first()
    ).toHaveAttribute("aria-expanded", "false");
    await page.keyboard.press("ArrowRight");
    await expect(
      page.locator(".layer-tree button.visibility[aria-expanded]").first()
    ).toHaveAttribute("aria-expanded", "true");

    await page.getByRole("button", { name: "Modelleme Atölyesi" }).click();
    await page.locator(".reference-list button.layer-select").first().click();
    await page.getByRole("button", { name: "Kalibrasyonu düzenle" }).click();
    await page.getByText("Piksel koordinatı gir", { exact: true }).click();
    await expect(page.getByRole("spinbutton", { name: "Yatay piksel (U)" })).toBeVisible();
    await expect(page.getByRole("spinbutton", { name: "Dikey piksel (V)" })).toBeVisible();
    expect(
      await page
        .locator(".properties-panel")
        .evaluate((element) => element.scrollWidth <= element.clientWidth + 1)
    ).toBe(true);
  });

  test("discarding a newly placed node clears the dangling selection when returning to overview", async ({
    page,
  }) => {
    const { createSiteFixture } = await import("../../spatial/fixture.ts");
    const world = createSiteFixture();
    await page.addInitScript((world) => {
      globalThis.roomAPI = {
        ready() {},
        onHostMessage(callback) {
          callback({ type: "host-context", locale: "en" });
          return () => {};
        },
        async requestStorageCommand(name) {
          return {
            success: true,
            data:
              name === "GaiaProjects"
                ? { projects: [world.id] }
                : name === "GaiaStatus"
                  ? { statuses: {}, revision: world.revision }
                  : { world, building: null, session: "discard-selection", missing: [] },
          };
        },
      };
    }, world);
    await page.goto("/");
    await page.getByRole("button", { name: "Open project" }).click();
    await page.getByRole("button", { name: "Modeling Workshop" }).click();
    await page.getByRole("button", { name: "Place building" }).click();
    const plan = page.getByRole("application", { name: "2D plan" });
    const box = await plan.boundingBox();
    await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.6);
    const createdId = await page.locator("[data-selected-id]").getAttribute("data-selected-id");
    expect(createdId).toBeTruthy();

    await page.getByRole("button", { name: "Overview" }).click();
    await page.getByRole("button", { name: "Discard changes" }).click();
    await expect(page.locator(".object-heading")).not.toHaveAttribute(
      "data-selected-id",
      createdId
    );
    await expect(page.locator("[data-selected-id]")).toHaveCount(0);
    await expect(page.locator('[data-count="total"]')).toHaveText("7");
    await expect(
      page.locator(".properties-panel").getByRole("button", { name: "Focus" })
    ).toHaveCount(0);
  });
});
