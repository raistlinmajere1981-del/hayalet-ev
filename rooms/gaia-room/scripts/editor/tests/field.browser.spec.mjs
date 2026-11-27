import { Buffer } from "node:buffer";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { FieldReceiverControl } from "../../field/lifecycle.ts";
import { provisionAuthorizationStore } from "../../storage/enrollment-store.ts";
import { FieldManagement } from "../../storage/field-management.ts";
import { gaiaStorage } from "../../storage/provider.ts";
import { createSiteFixture } from "../../spatial/fixture.ts";
import { temporaryEndpoint } from "../../tests/support/field-center.ts";
import { usbClient } from "../../tests/support/usb-client.ts";

test.use({ launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } });

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

async function seedWorld(root, projectId, world) {
  const created = await gaiaStorage(() => {
    throw new Error("Unexpected raster");
  }).execute({ owner: {}, storageRoot: root, assertCurrent() {} }, "GaiaCreate", {
    project: projectId,
    fixture: false,
    locale: "en",
  });
  const docPath = join(root, "projects", projectId, "world.json");
  await writeFile(
    docPath,
    JSON.stringify({
      world: { ...created.world, ...world, id: projectId },
      statusEpoch: 0,
      lastOperation: null,
    })
  );
}

async function setupBridge(page, { locale = "en", interceptor } = {}) {
  const [root, media, usbDir] = await Promise.all([
    mkdtemp(join(tmpdir(), "gaia-field-ui-root-")),
    mkdtemp(join(tmpdir(), "gaia-field-ui-media-")),
    mkdtemp(join(tmpdir(), "gaia-field-ui-usb-")),
  ]);
  const control = new FieldReceiverControl(() => root);
  const dialogState = {
    csrPath: "",
    packagePath: "",
    cancelNextConfirm: false,
    cancelNextChoose: false,
    confirmations: [],
  };
  const dialogs = {
    async choose(kind) {
      if (dialogState.cancelNextChoose) {
        dialogState.cancelNextChoose = false;
        return undefined;
      }
      if (kind === "media") return media;
      if (kind === "destination") return usbDir;
      if (kind === "csr") return dialogState.csrPath;
      if (kind === "package") return dialogState.packagePath;
      return undefined;
    },
    async password() {
      return Buffer.from("synthetic-field-passphrase-16plus");
    },
    async confirm(action, details) {
      dialogState.confirmations.push({ action, details });
      if (dialogState.cancelNextConfirm) {
        dialogState.cancelNextConfirm = false;
        return false;
      }
      return true;
    },
  };
  const field = new FieldManagement(control, () => dialogs);
  const storage = gaiaStorage(() => {
    throw new Error("Unexpected raster");
  }, field);
  const caller = { owner: {}, storageRoot: root, assertCurrent() {} };
  const calls = [];

  await page.exposeFunction("gaiaTestCommand", async (name, args) => {
    calls.push({ name, args });
    try {
      if (interceptor) {
        const overridden = await interceptor(name, args, () => storage.execute(caller, name, args));
        if (overridden !== undefined) return { success: true, data: overridden };
      }
      return { success: true, data: await storage.execute(caller, name, args) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  await page.addInitScript((lang) => {
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
        callback({ type: "host-context", locale: lang });
        return () => {};
      },
      requestStorageCommand: (name, args) => globalThis.gaiaTestCommand(name, args),
    };
  }, locale);

  return {
    root,
    media,
    usbDir,
    control,
    caller,
    storage,
    calls,
    dialogState,
    readWorld: async (id) =>
      JSON.parse(await readFile(join(root, "projects", id, "world.json"), "utf8")),
    cleanup: async () => {
      await control.shutdown();
      await Promise.all([
        rm(root, { recursive: true, force: true }),
        rm(media, { recursive: true, force: true }),
        rm(usbDir, { recursive: true, force: true }),
      ]);
    },
  };
}

test("provisions CA, guards native cancellation, manages listener and server rotation, and reports unavailable trust", async ({
  page,
}) => {
  const bridge = await setupBridge(page, { locale: "en" });
  try {
    await seedWorld(bridge.root, "center-demo", createSiteFixture());
    const endpoint = await temporaryEndpoint();

    await page.goto("/");
    await page.getByRole("button", { name: "Open project" }).click();
    await page.getByRole("button", { name: "Field center" }).click();

    const panel = page.locator(".properties-panel");
    await expect(panel.locator("[data-ca-state]")).toHaveText("Not provisioned");
    await expect(panel.locator("[data-listening]")).toHaveText("Stopped");

    await panel.getByLabel("HTTPS origin").fill(endpoint.origin);
    bridge.dialogState.cancelNextConfirm = true;
    await panel.getByRole("button", { name: "Provision CA & server" }).click();
    await expect(panel.getByRole("status")).toContainText("Operation cancelled in native dialog.");
    await expect(panel.locator("[data-ca-state]")).toHaveText("Not provisioned");

    await panel.getByRole("button", { name: "Provision CA & server" }).click();
    await expect(panel.locator("[data-ca-state]")).toHaveText("Ready");
    const caFingerprint = await panel.locator("[data-ca-fingerprint]").innerText();
    const initialServerFp = await panel.locator("[data-server-fingerprint]").innerText();
    expect(caFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(initialServerFp).toMatch(/^[a-f0-9]{64}$/);

    await panel.getByLabel("Listen address (IP)").fill(endpoint.address);
    await panel.getByLabel("Port").fill(String(endpoint.port));
    await panel.getByLabel("HTTPS origin").fill(endpoint.origin);
    await panel.getByRole("button", { name: "Start listener" }).click();
    await expect(panel.locator("[data-listening]")).toHaveText("Listening");
    await expect(panel.getByRole("button", { name: "Rotate server certificate" })).toBeDisabled();

    await panel.getByRole("button", { name: "Stop listener" }).click();
    await expect(panel.locator("[data-listening]")).toHaveText("Stopped");

    await panel.getByRole("button", { name: "Rotate server certificate" }).click();
    await expect(panel.locator("[data-ca-fingerprint]")).toHaveText(caFingerprint);
    await expect(panel.locator("[data-server-fingerprint]")).not.toHaveText(initialServerFp);
  } finally {
    await bridge.cleanup();
  }
});

test("reports unavailable trust infrastructure without offering reset and blocks pairing", async ({
  page,
}) => {
  const broken = await setupBridge(page, { locale: "en" });
  try {
    await provisionAuthorizationStore(broken.root);
    const fixture = createSiteFixture();
    fixture.devices["phys-only"] = {
      name: "Roof Meter",
      role: "sensor",
      source: "physical",
      capabilities: ["battery.level.v1"],
    };
    await seedWorld(broken.root, "broken-demo", fixture);

    await page.goto("/");
    await page.getByRole("button", { name: "Open project" }).click();
    await page.getByRole("button", { name: "Field center" }).click();

    const panel = page.locator(".properties-panel");
    await expect(panel.locator("[data-ca-state]")).toHaveText("Unavailable or incomplete");
    await expect(panel.getByRole("alert")).toContainText("Automatic reset is disabled");
    await expect(panel.getByRole("button", { name: "Provision CA & server" })).toHaveCount(0);

    await panel.getByRole("button", { name: "Back to site plan" }).click();
    await page
      .locator(".layer-panel")
      .getByRole("button", { name: /Roof Meter/ })
      .click();
    await panel.locator("details summary", { hasText: "Pairing & authorization" }).click();
    await expect(panel.getByRole("alert")).toContainText(
      "Field trust infrastructure is unavailable"
    );
  } finally {
    await broken.cleanup();
  }
});

test("runs end-to-end physical pairing (begin, renew, rebindHardware, reassign, revoke) and respects workshop dirty leave overlay", async ({
  page,
}) => {
  const bridge = await setupBridge(page, { locale: "en" });
  try {
    const endpoint = await temporaryEndpoint();
    const alpha = createSiteFixture();
    alpha.devices["virt-1"] = {
      name: "Virtual Thermometer",
      role: "sensor",
      source: "virtual",
      capabilities: ["temperature.read.v1"],
    };
    alpha.devices["phys-a"] = {
      name: "Field Unit A",
      role: "client",
      source: "physical",
      capabilities: ["battery.level.v1", "signal.read.v1"],
    };
    const beta = createSiteFixture();
    beta.devices["phys-b"] = {
      name: "Field Unit B",
      role: "client",
      source: "physical",
      capabilities: ["battery.level.v1", "signal.read.v1"],
    };
    await seedWorld(bridge.root, "alpha", alpha);
    await seedWorld(bridge.root, "beta", beta);

    const csr1Path = join(bridge.usbDir, "csr-1.json");
    const usb1 = await usbClient();
    await writeFile(csr1Path, JSON.stringify(usb1.usb));

    const csr2Path = join(bridge.usbDir, "csr-2.json");
    const usb2 = await usbClient();
    await writeFile(
      csr2Path,
      JSON.stringify({ ...usb2.usb, installationId: usb1.usb.installationId })
    );

    const csr3Path = join(bridge.usbDir, "csr-3.json");
    const usb3 = await usbClient();
    await writeFile(csr3Path, JSON.stringify(usb3.usb));

    const csr4Path = join(bridge.usbDir, "csr-4.json");
    const usb4 = await usbClient();
    await writeFile(
      csr4Path,
      JSON.stringify({ ...usb4.usb, installationId: usb3.usb.installationId })
    );

    await page.goto("/");
    await page.locator(".projects select").selectOption("alpha");
    await page.getByRole("button", { name: "Open project" }).click();

    // Workshop dirty edit must prompt before entering Field Center
    await page.getByRole("button", { name: "Modeling Workshop" }).click();
    await page
      .locator(".layer-panel")
      .getByRole("button", { name: "Deney arazisi", exact: true })
      .click();
    await page.getByRole("button", { name: "Place building" }).click();
    const planBox = await page.getByRole("application", { name: "2D plan" }).boundingBox();
    await page.mouse.click(planBox.x + planBox.width * 0.65, planBox.y + planBox.height * 0.65);
    await page.getByRole("button", { name: "Field center" }).click();
    await expect(
      page.getByRole("dialog", { name: "Save the draft before leaving?" })
    ).toBeVisible();
    await page.getByRole("button", { name: "Discard changes" }).click();

    const panel = page.locator(".properties-panel");
    await expect(panel.locator("[data-ca-state]")).toHaveText("Not provisioned");
    await panel.getByLabel("HTTPS origin").fill(endpoint.origin);
    await panel.getByRole("button", { name: "Provision CA & server" }).click();
    await expect(panel.locator("[data-ca-state]")).toHaveText("Ready");

    // Check virtual device still shows VirtualInput, while physical hides it
    await panel.getByRole("button", { name: "Back to site plan" }).click();
    await page
      .locator(".layer-panel")
      .getByRole("button", { name: /Virtual Thermometer/ })
      .click();
    await expect(panel.locator("details.virtual-input summary")).toHaveText("Simulated input");

    await page
      .locator(".layer-panel")
      .getByRole("button", { name: /Field Unit A/ })
      .click();
    await expect(panel.locator("details.virtual-input")).toHaveCount(0);
    await expect(panel.locator(".object-heading")).toContainText("Unbound");

    // Begin pairing with capability subset (only battery.level.v1)
    bridge.dialogState.csrPath = csr1Path;
    await panel.locator("details summary", { hasText: "Pairing & authorization" }).click();
    await panel.getByLabel("Hardware ID").fill("instrument-a");
    await panel.getByRole("checkbox", { name: "Signal" }).uncheck();
    await panel.getByRole("button", { name: "Inspect USB CSR" }).click();

    const reviewCard = panel.locator("[data-review-id]");
    await expect(reviewCard).toBeVisible();
    await expect(reviewCard.locator("[data-review-installation]")).toHaveText(
      usb1.usb.installationId
    );

    // Native cancel during issue keeps review and makes no package
    bridge.dialogState.cancelNextChoose = true;
    await panel.getByRole("button", { name: "Create signed package" }).click();
    await expect(panel.getByRole("status")).toContainText("Operation cancelled in native dialog.");
    await expect(panel.locator("[data-issued-package]")).toHaveCount(0);

    // Issue package then enroll (which mutates alpha world revision and triggers reopen)
    await panel.getByRole("button", { name: "Create signed package" }).click();
    const issuedFilename = await panel
      .locator("[data-issued-package]")
      .getAttribute("data-issued-package");
    expect(issuedFilename).toMatch(/^gaia-.*\.json$/);
    bridge.dialogState.packagePath = join(bridge.usbDir, issuedFilename);
    await panel.getByRole("button", { name: "Enroll from signed package" }).click();

    await expect(panel.locator('[data-assignment-state="pending"]')).toBeVisible();
    const storedAfterBegin = await bridge.readWorld("alpha");
    expect(storedAfterBegin.world.revision).toBe(alpha.revision + 1);
    expect(storedAfterBegin.world.devices["phys-a"].hardwareId).toBe("instrument-a");

    // Activate pending assignment
    await panel.getByRole("button", { name: "Activate after installation" }).click();
    await expect(panel.locator('[data-assignment-state="active"]')).toBeVisible();
    await expect(panel.locator('[data-assignment-state="pending"]')).toHaveCount(0);

    // Renew and cancel pending
    bridge.dialogState.csrPath = csr2Path;
    await panel.getByRole("button", { name: "Inspect USB CSR" }).click();
    await panel.getByRole("button", { name: "Create signed package" }).click();
    const renewFile = await panel
      .locator("[data-issued-package]")
      .getAttribute("data-issued-package");
    bridge.dialogState.packagePath = join(bridge.usbDir, renewFile);
    await panel.getByRole("button", { name: "Enroll from signed package" }).click();
    await expect(panel.locator('[data-assignment-state="pending"]')).toBeVisible();
    await panel.getByRole("button", { name: "Cancel pending assignment" }).click();
    await expect(panel.locator('[data-assignment-state="pending"]')).toHaveCount(0);
    await expect(panel.locator('[data-assignment-state="active"]')).toBeVisible();

    // Replace hardware (rebindHardware)
    await panel.getByLabel("Pairing action").selectOption("rebindHardware");
    await panel.getByLabel("Hardware ID").fill("instrument-a");
    await expect(
      panel.getByText("Enter a new hardware ID different from the current binding.")
    ).toBeVisible();
    await panel.getByLabel("Hardware ID").fill("instrument-b");
    bridge.dialogState.csrPath = csr3Path;
    await panel.getByRole("button", { name: "Inspect USB CSR" }).click();
    await panel.getByRole("button", { name: "Create signed package" }).click();
    const rebindFile = await panel
      .locator("[data-issued-package]")
      .getAttribute("data-issued-package");
    bridge.dialogState.packagePath = join(bridge.usbDir, rebindFile);
    await panel.getByRole("button", { name: "Enroll from signed package" }).click();

    await expect(panel.locator('[data-assignment-state="active"]')).toContainText("instrument-b");
    const storedAfterRebind = await bridge.readWorld("alpha");
    expect(storedAfterRebind.world.devices["phys-a"].hardwareId).toBe("instrument-b");

    // Stage move to project beta, switch projects, use staged move, enroll, then revoke
    await panel.getByRole("button", { name: "Stage for move to another project" }).click();
    await page.getByRole("button", { name: "Projects" }).click();
    await page.locator(".projects select").selectOption("beta");
    await page.getByRole("button", { name: "Open project" }).click();

    await page
      .locator(".layer-panel")
      .getByRole("button", { name: /Field Unit B/ })
      .click();
    await panel.locator("details summary", { hasText: "Pairing & authorization" }).click();
    await panel.getByLabel("Pairing action").selectOption("reassign");
    await panel.getByRole("button", { name: "Use staged move" }).click();
    await expect(panel.getByLabel("Hardware ID")).toHaveValue("instrument-b");

    bridge.dialogState.csrPath = csr4Path;
    await panel.getByRole("button", { name: "Inspect USB CSR" }).click();
    await panel.getByRole("button", { name: "Create signed package" }).click();
    const reassignFile = await panel
      .locator("[data-issued-package]")
      .getAttribute("data-issued-package");
    bridge.dialogState.packagePath = join(bridge.usbDir, reassignFile);
    await panel.getByRole("button", { name: "Enroll from signed package" }).click();

    await expect(panel.locator('[data-assignment-state="active"]')).toContainText("instrument-b");
    await panel.getByRole("button", { name: "Revoke authorization" }).click();
    await expect(panel.locator('[data-assignment-state="active"]')).toHaveCount(0);
  } finally {
    await bridge.cleanup();
  }
});

test("renders measured vs simulated readings, zero values, all 8 physical capabilities, quality states and unavailable auth", async ({
  page,
}) => {
  let mode = "zeros";
  const fixture = createSiteFixture();
  fixture.revision = 0;
  fixture.nodes["b2"] = {
    kind: "mount",
    name: "Dış montaj",
    parent: "ground",
    p: [2, 2, 0],
    yaw: 0,
    geometry: { kind: "point" },
  };
  fixture.devices["virt-1"] = {
    name: "Simülasyon düğümü",
    role: "sensor",
    source: "virtual",
    mount: "mc2",
    capabilities: ["temperature.read.v1"],
  };
  fixture.devices["phys-8"] = {
    name: "Saha sensörü 8",
    role: "client",
    source: "physical",
    hardwareId: "hw-8",
    mount: "b2",
    capabilities: [
      "battery.level.v1",
      "battery.pack-temperature.v1",
      "battery.voltage.v1",
      "battery.charge-state.v1",
      "accelerometer.xyz.v1",
      "proximity.state.v1",
      "network.state.v1",
      "signal.read.v1",
    ],
  };

  const bridge = await setupBridge(page, {
    locale: "tr",
    interceptor: async (name) => {
      if (name !== "GaiaStatus") return undefined;
      if (mode === "auth-unavailable") {
        return {
          revision: 0,
          physicalError: "authorization_unavailable",
          statuses: {
            "virt-1": {
              source: "simulated",
              link: { state: "online", at: 1_700_000_000_000 },
              lastContactAt: 1_700_000_000_000,
              observations: {},
            },
          },
          physical: {},
        };
      }
      if (mode === "mixed") {
        return {
          revision: 0,
          statuses: {},
          physical: {
            "phys-8": {
              source: "measured",
              connection: "online",
              linkRemainingMs: 25_000,
              lastContactAt: 1_700_000_000_000,
              observations: {
                "battery.level.v1": {
                  quality: "valid",
                  value: 15,
                  unit: "%",
                  receivedAt: 1_700_000_000_000,
                  at: 1_700_000_000_000,
                  freshness: "stale",
                  freshRemainingMs: 0,
                },
                "proximity.state.v1": {
                  quality: "invalid",
                  value: null,
                  unit: "state",
                  receivedAt: 1_700_000_000_000,
                  at: 1_700_000_000_000,
                  freshness: "fresh",
                  freshRemainingMs: 25_000,
                },
                "signal.read.v1": {
                  quality: "missing",
                  value: null,
                  unit: "dBm",
                  receivedAt: 1_700_000_000_000,
                  freshness: "noData",
                  freshRemainingMs: 0,
                },
              },
            },
          },
        };
      }
      return {
        revision: 0,
        statuses: {
          "virt-1": {
            source: "simulated",
            link: { state: "online", at: 1_700_000_000_000 },
            lastContactAt: 1_700_000_000_000,
            observations: {
              "temperature.read.v1": {
                at: 1_700_000_000_000,
                receivedAt: 1_700_000_000_000,
                value: 21,
                unit: "C",
                source: "simulated",
                quality: "valid",
              },
            },
          },
        },
        physical: {
          "phys-8": {
            source: "measured",
            connection: "online",
            linkRemainingMs: 30_000,
            lastContactAt: 0,
            observations: {
              "battery.level.v1": {
                quality: "valid",
                value: 0,
                unit: "%",
                receivedAt: 0,
                at: 0,
                freshness: "fresh",
                freshRemainingMs: 30_000,
              },
              "battery.pack-temperature.v1": {
                quality: "valid",
                value: 0,
                unit: "C",
                receivedAt: 0,
                at: 0,
                freshness: "fresh",
                freshRemainingMs: 30_000,
              },
              "battery.voltage.v1": {
                quality: "valid",
                value: 0,
                unit: "mV",
                receivedAt: 0,
                at: 0,
                freshness: "fresh",
                freshRemainingMs: 30_000,
              },
              "battery.charge-state.v1": {
                quality: "valid",
                value: "not_charging",
                unit: "state",
                receivedAt: 0,
                at: 0,
                freshness: "fresh",
                freshRemainingMs: 30_000,
              },
              "accelerometer.xyz.v1": {
                quality: "valid",
                value: [0, 0, 0],
                unit: "m/s2",
                receivedAt: 0,
                at: 0,
                freshness: "fresh",
                freshRemainingMs: 30_000,
              },
              "proximity.state.v1": {
                quality: "valid",
                value: "near",
                unit: "state",
                receivedAt: 0,
                at: 0,
                freshness: "fresh",
                freshRemainingMs: 30_000,
              },
              "network.state.v1": {
                quality: "valid",
                value: { transport: "none", internetCapable: false, validated: false },
                unit: "state",
                receivedAt: 0,
                at: 0,
                freshness: "fresh",
                freshRemainingMs: 30_000,
              },
              "signal.read.v1": {
                quality: "valid",
                value: 0,
                unit: "dBm",
                receivedAt: 0,
                at: 0,
                freshness: "fresh",
                freshRemainingMs: 30_000,
              },
            },
          },
        },
      };
    },
  });

  try {
    await seedWorld(bridge.root, "sensors", fixture);
    await page.goto("/");
    await page.getByRole("button", { name: "Projeyi aç" }).click();

    await page
      .locator(".layer-panel")
      .getByRole("button", { name: /Saha sensörü 8/ })
      .click();
    const panel = page.locator(".properties-panel");
    await expect(panel.getByText("Cihaz · Fiziksel")).toBeVisible();
    await expect(panel.getByText("Sanal durum girişi")).toHaveCount(0);

    await expect(panel.locator('[data-capability="battery.level.v1"]')).toContainText("0 %");
    await expect(panel.locator('[data-capability="battery.pack-temperature.v1"]')).toContainText(
      "0 C"
    );
    await expect(panel.locator('[data-capability="battery.voltage.v1"]')).toContainText("0 mV");
    await expect(panel.locator('[data-capability="battery.charge-state.v1"]')).toContainText(
      "Şarj olmuyor"
    );
    await expect(panel.locator('[data-capability="accelerometer.xyz.v1"]')).toContainText(
      "X 0 · Y 0 · Z 0 m/s2"
    );
    await expect(panel.locator('[data-capability="proximity.state.v1"]')).toContainText("Yakın");
    await expect(panel.locator('[data-capability="network.state.v1"]')).toContainText(
      "Yok · İnternet yok · Doğrulanmadı"
    );
    await expect(panel.locator('[data-capability="signal.read.v1"]')).toContainText("0 dBm");
    await expect(panel.locator('[data-capability="battery.level.v1"]')).toContainText("Ölçülmüş");
    await expect(panel.locator('[data-capability="battery.level.v1"]')).toContainText(
      "Tahmini zaman"
    );
    // Numeric zero timestamps render formatted time rather than placeholder dash
    await expect(panel.locator(".management-facts time")).toHaveCount(2);

    // Mixed invalid / stale / missing states + 2D marker & layer badge integration
    mode = "mixed";
    await page.evaluate(() => globalThis.showGaia(false));
    await expect(panel.locator('[data-capability="proximity.state.v1"]')).toContainText(
      "Veri bekleniyor"
    );
    await page.evaluate(() => globalThis.showGaia(true));
    await expect(panel.locator('[data-capability="proximity.state.v1"]')).toContainText(
      "Hatalı ölçüm"
    );
    await expect(panel.locator('[data-capability="signal.read.v1"]')).toContainText(
      "Veri bekleniyor"
    );
    await expect(panel.locator('[data-capability="battery.level.v1"]')).toContainText(
      "Son bilinen"
    );
    await expect(page.locator('.layer-panel [aria-label="Hatalı ölçüm"]')).toBeVisible();
    await expect(page.locator('svg g[data-gaia-id="phys-8"]')).toHaveAttribute(
      "data-device-health",
      "invalid"
    );

    // Authorization unavailable keeps virtual statuses active and alerts cleanly
    mode = "auth-unavailable";
    await page.evaluate(() => globalThis.showGaia(false));
    await expect(panel.locator('[data-capability="proximity.state.v1"]')).toContainText(
      "Veri bekleniyor"
    );
    await page.evaluate(() => globalThis.showGaia(true));
    await expect(panel.getByRole("alert")).toContainText(
      "Fiziksel cihaz yetki kayıtları kullanılamıyor."
    );
    await page
      .locator(".layer-panel")
      .getByRole("button", { name: /Simülasyon düğümü/ })
      .click();
    await expect(panel.locator("details.virtual-input summary")).toHaveText("Sanal durum girişi");
  } finally {
    await bridge.cleanup();
  }
});

test("enforces monotonic expiry without network requests, 10s poll, hide/delayed-response clearing and field error recovery", async ({
  page,
}) => {
  await page.clock.install();
  let statusDelay;
  let fieldFailNext = false;
  let statusReads = 0;

  const fixture = createSiteFixture();
  fixture.revision = 0;
  fixture.devices["phys-mon"] = {
    name: "Monotonic Meter",
    role: "sensor",
    source: "physical",
    hardwareId: "hw-mon",
    mount: "mc2",
    capabilities: ["battery.level.v1"],
  };

  const bridge = await setupBridge(page, {
    locale: "en",
    interceptor: async (name, _args, runReal) => {
      if (name === "GaiaStatus") {
        statusReads++;
        if (statusDelay) {
          await statusDelay.promise;
        }
        return {
          revision: 0,
          statuses: {},
          physical: {
            "phys-mon": {
              source: "measured",
              connection: "online",
              linkRemainingMs: 7_000,
              lastContactAt: 1_700_000_000_000,
              observations: {
                "battery.level.v1": {
                  quality: "valid",
                  value: 42,
                  unit: "%",
                  receivedAt: 1_700_000_000_000,
                  at: 1_700_000_000_000,
                  freshness: "fresh",
                  freshRemainingMs: 3_000,
                },
              },
            },
          },
        };
      }
      if (name === "GaiaField" && fieldFailNext) {
        fieldFailNext = false;
        return { ok: false, code: "scope_changed" };
      }
      return runReal();
    },
  });

  try {
    await seedWorld(bridge.root, "mono", fixture);
    await page.goto("/");
    await page.getByRole("button", { name: "Open project" }).click();
    await page
      .locator(".layer-panel")
      .getByRole("button", { name: /Monotonic Meter/ })
      .click();

    const panel = page.locator(".properties-panel");
    await expect(panel.locator('[data-capability="battery.level.v1"]')).toContainText("42 %");
    await expect(panel.locator('[data-capability="battery.level.v1"]')).toHaveAttribute(
      "data-freshness",
      "fresh"
    );
    await expect(panel.locator(".object-heading")).toContainText("Online");
    expect(statusReads).toBe(1);

    // Monotonic observation freshness timeout at 3s without any network request
    statusReads = 0;
    await page.clock.runFor(3_100);
    expect(statusReads).toBe(0);
    await expect(panel.locator('[data-capability="battery.level.v1"]')).toHaveAttribute(
      "data-freshness",
      "stale"
    );
    await expect(panel.locator(".object-heading")).toContainText("Online");

    // Monotonic connection timeout at 7s without any network request
    await page.clock.runFor(4_100);
    expect(statusReads).toBe(0);
    await expect(panel.locator(".object-heading")).toContainText("Offline");
    await expect(page.locator('.layer-panel [aria-label="Offline"]')).toBeVisible();

    // 10s periodic poll triggers fresh GaiaStatus at 10s
    await page.clock.runFor(3_000);
    expect(statusReads).toBeGreaterThanOrEqual(1);
    await expect(panel.locator(".object-heading")).toContainText("Online");

    // In-flight delayed response cannot resurrect view after hide
    await page.evaluate(() => globalThis.showGaia(false));
    await expect(panel.locator('[data-capability="battery.level.v1"]')).toContainText(
      "Awaiting data"
    );
    statusDelay = deferred();
    const readsBeforeHide = statusReads;
    await page.evaluate(() => globalThis.showGaia(true));
    await expect.poll(() => statusReads).toBeGreaterThan(readsBeforeHide);
    await page.evaluate(() => globalThis.showGaia(false));
    await expect(panel.locator('[data-capability="battery.level.v1"]')).toContainText(
      "Awaiting data"
    );
    await expect(panel.locator(".object-heading")).toContainText("Unknown");
    statusDelay.resolve();
    statusDelay = undefined;
    await page.clock.runFor(100);
    await expect(panel.locator('[data-capability="battery.level.v1"]')).not.toContainText("42 %");
    await expect(panel.locator('[data-capability="battery.level.v1"]')).toHaveAttribute(
      "data-freshness",
      "noData"
    );

    // Showing again reads fresh GaiaStatus immediately
    await page.evaluate(() => globalThis.showGaia(true));
    await expect(panel.locator('[data-capability="battery.level.v1"]')).toContainText("42 %");

    // Field error triggers state + project reload and clears stale error state properly
    bridge.calls.length = 0;
    fieldFailNext = true;
    await page.getByRole("button", { name: "Field center" }).click();
    await expect(panel.getByRole("alert")).toContainText(
      "Project session or world revision changed"
    );
    await expect(panel.locator("[data-ca-state]")).toHaveText("Not provisioned");
    await expect(panel.getByRole("alert")).toContainText(
      "Project session or world revision changed"
    );
    expect(bridge.calls.some((call) => call.name === "GaiaOpen")).toBe(true);
    expect(bridge.calls.some((call) => call.name === "GaiaStatus")).toBe(true);
    expect(bridge.calls.filter((call) => call.name === "GaiaField").length).toBeGreaterThanOrEqual(
      2
    );
  } finally {
    await bridge.cleanup();
  }
});

test("manual source revision entry remains usable and submits the integer revision", async ({
  page,
}) => {
  const fixture = createSiteFixture();
  fixture.devices["target-phone"] = {
    name: "Target Phone",
    role: "client",
    source: "physical",
    capabilities: ["battery.level.v1"],
  };
  const bridge = await setupBridge(page, {
    interceptor: async (name, args) => {
      if (name === "GaiaField" && args.operation.action === "state") {
        return {
          ok: true,
          data: { ca: "ready", enabled: false, listening: false, assignments: [] },
        };
      }
      if (name === "GaiaField" && args.operation.action === "inspect") {
        return { ok: false, code: "cancelled" };
      }
    },
  });
  try {
    await seedWorld(bridge.root, "target", fixture);
    await page.goto("/");
    await page.getByRole("button", { name: "Open project" }).click();
    await page
      .locator(".layer-panel")
      .getByRole("button", { name: /Target Phone/ })
      .click();
    const panel = page.locator(".properties-panel");
    await panel.locator("details summary", { hasText: "Pairing & authorization" }).click();
    await panel.getByLabel("Pairing action").selectOption("reassign");
    await panel.getByLabel("Hardware ID").fill("test-hardware");
    await panel.getByLabel("Source assignment ID").fill("11111111-1111-4111-8111-111111111111");
    await panel.getByLabel("HTTPS origin").fill("https://127.0.0.1:8443");
    await panel.getByLabel("Source project revision").fill("7");
    await expect(panel.getByRole("button", { name: "Inspect USB CSR" })).toBeEnabled({
      timeout: 3000,
    });
    await panel.getByRole("button", { name: "Inspect USB CSR" }).click();
    await expect
      .poll(
        () =>
          bridge.calls.find((c) => c.name === "GaiaField" && c.args.operation.action === "inspect")
            ?.args.operation.change.expectedSourceRevision
      )
      .toBe(7);
  } finally {
    await bridge.cleanup();
  }
});

test("a pending revoke keeps old physical readings hidden across a poll until the operation resolves", async ({
  page,
}) => {
  await page.clock.install();
  const fixture = createSiteFixture();
  fixture.revision = 0;
  fixture.devices["rev-phone"] = {
    name: "Revoke Phone",
    role: "client",
    source: "physical",
    hardwareId: "test-hardware",
    capabilities: ["battery.level.v1"],
  };
  const gate = deferred();
  let revoked = false;
  let revoking = false;
  const assignment = {
    id: "11111111-1111-4111-8111-111111111111",
    deviceId: "rev-phone",
    hardwareId: "test-hardware",
    fingerprint: "a".repeat(64),
    installationId: "22222222-2222-4222-8222-222222222222",
    authorizationGeneration: 1,
    capabilities: ["battery.level.v1"],
    state: "active",
  };
  const bridge = await setupBridge(page, {
    interceptor: async (name, args) => {
      if (name === "GaiaField" && args.operation.action === "state")
        return {
          ok: true,
          data: {
            ca: "ready",
            enabled: false,
            listening: false,
            assignments: revoked ? [] : [assignment],
          },
        };
      if (name === "GaiaField" && args.operation.action === "revoke") {
        revoking = true;
        await gate.promise;
        revoked = true;
        return { ok: true, data: { ...assignment, state: "revoked" } };
      }
      if (name === "GaiaStatus")
        return {
          revision: 0,
          statuses: {},
          physical: revoked
            ? {}
            : {
                "rev-phone": {
                  source: "measured",
                  connection: "online",
                  linkRemainingMs: 35000,
                  observations: {
                    "battery.level.v1": {
                      quality: "valid",
                      value: 42,
                      unit: "%",
                      receivedAt: 1700000000000,
                      at: 1700000000000,
                      freshness: "fresh",
                      freshRemainingMs: 60000,
                    },
                  },
                },
              },
        };
    },
  });
  try {
    await seedWorld(bridge.root, "revocation", fixture);
    await page.goto("/");
    await page.getByRole("button", { name: "Open project" }).click();
    await page
      .locator(".layer-panel")
      .getByRole("button", { name: /Revoke Phone/ })
      .click();
    const panel = page.locator(".properties-panel");
    const sample = panel.locator('[data-capability="battery.level.v1"]');
    await expect(sample).toContainText("42 %");
    await panel.locator("details summary", { hasText: "Pairing & authorization" }).click();
    await panel.getByRole("button", { name: "Revoke authorization" }).click();
    await expect.poll(() => revoking).toBe(true);
    await expect(sample).not.toContainText("42 %");
    await page.clock.runFor(10100);
    await expect(sample).not.toContainText("42 %", { timeout: 2000 });
    gate.resolve();
    await expect(panel.locator('[data-assignment-state="active"]')).toHaveCount(0);
  } finally {
    gate.resolve();
    await bridge.cleanup();
  }
});
