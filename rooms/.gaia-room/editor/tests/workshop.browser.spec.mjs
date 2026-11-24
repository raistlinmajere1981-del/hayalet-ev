import { URL } from "node:url";
import { expect, test } from "@playwright/test";

const view = (page) => page.evaluate(() => globalThis.window.__gaiaAcceptance());
const canvas = (page) => page.getByLabel("Floor plan editor canvas");
const tool = (page, name) => page.getByRole("button", { name, exact: true });
const status = (page) => page.getByRole("status");
const ground = (snapshot) => snapshot.draft.floors.find(({ id }) => id === "f-ground");
const table = (snapshot) => ground(snapshot).furniture.find(({ id }) => id === "e-bench");
const wall = (snapshot) => ground(snapshot).walls.find(({ id }) => id === "e-partition");

async function screen(page, [x, y]) {
  const box = await canvas(page).boundingBox();
  const { camera } = await view(page);
  return {
    x: box.x + box.width / 2 + (x - camera.x) * camera.zoom,
    y: box.y + box.height / 2 + (y - camera.y) * camera.zoom,
  };
}

async function clickAt(page, point, options) {
  const { x, y } = await screen(page, point);
  await page.mouse.click(x, y, options);
}

async function drag(page, from, to, { key, afterDown, whileDown } = {}) {
  const start = await screen(page, from);
  const end = await screen(page, to);
  if (key && !afterDown) await page.keyboard.down(key);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  if (key && afterDown) await page.keyboard.down(key);
  await page.mouse.move(end.x, end.y, { steps: 6 });
  if (whileDown) await whileDown();
  await page.mouse.up();
  if (key) await page.keyboard.up(key);
}

async function draw(page, points) {
  await tool(page, "Straight wall").click();
  for (const point of points) await clickAt(page, point);
  await page.keyboard.press("Escape");
}

async function open(page, variant = "") {
  await page.goto(`/${variant}`);
  await expect(canvas(page)).toBeVisible();
  // Initial fit runs in the canvas draw scheduler after the first store projection.
  await expect.poll(async () => (await view(page)).camera.x).not.toEqual(0);
  await tool(page, "Zoom to 100%").click();
  await expect.poll(async () => (await view(page)).camera.zoom).toBe(1);
}

function offset(item, [dx, dy]) {
  const angle = (item.rotation * Math.PI) / 180;
  return [
    item.position.x + dx * Math.cos(angle) - dy * Math.sin(angle),
    item.position.y + dx * Math.sin(angle) + dy * Math.cos(angle),
  ];
}

function effectiveWidth(item) {
  return (item.width ?? 100) * item.scale.x;
}

test("wall and table gestures save to Gaia, then reopen from the saved model with external access blocked", async ({
  page,
}) => {
  const external = [];
  const missing = [];
  const errors = [];
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin === "http://127.0.0.1:4177") return route.continue();
    external.push(url.href);
    return route.abort();
  });
  page.on("response", (response) => {
    if (response.status() >= 400) missing.push(response.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    globalThis.window.indexedDbCalls = [];
    for (const name of ["open", "deleteDatabase"]) {
      globalThis.IDBFactory.prototype[name] = (...args) => {
        globalThis.window.indexedDbCalls.push([name, ...args]);
        throw new Error("IndexedDB is disabled in this acceptance run");
      };
    }
  });
  await open(page);
  const baseline = await view(page);
  await clickAt(page, [-250, 0]);
  expect((await view(page)).selected).toBe("e-partition");
  await drag(page, [-400, 0], [-425, 0]);
  expect(wall(await view(page)).start.x).toBe(-425);
  await drag(page, [-425, 0], [-400, 0]);
  await drag(page, [-100, 0], [0, 0], {
    whileDown: async () => {
      await page.keyboard.press("Control+s");
      await expect(status(page)).toContainText("Finish the current gesture");
      expect((await view(page)).world.revision).toBe(7);
    },
  });
  expect(wall(await view(page)).end.x).toBeCloseTo(0);
  await draw(page, [
    [0, 0],
    [0, 150],
  ]);
  let draft = await view(page);
  expect(ground(draft).walls).toHaveLength(2);
  const linkedWallId = ground(draft).walls.find(({ id }) => id !== "e-partition").id;
  await clickAt(page, [-200, 0]);
  await drag(page, [0, 0], [0, 25]);
  const moved = await view(page);
  expect(wall(moved).end).toEqual(ground(moved).walls.find(({ id }) => id === linkedWallId).start);
  await page.keyboard.press("Control+z");
  expect(Math.hypot(...Object.values(wall(await view(page)).end))).toBeCloseTo(0);
  await page.keyboard.press("Control+Shift+Z");
  expect(wall(await view(page)).end.x).toBeCloseTo(wall(moved).end.x);
  expect(wall(await view(page)).end.y).toBeCloseTo(wall(moved).end.y);
  await tool(page, "Undo").click();

  await drag(page, [200, -100], [300, -100]);
  draft = await view(page);
  expect(table(draft).position).toEqual({ x: 300, y: -100 });
  const item = table(draft);
  await drag(page, offset(item, [0, -30 - 18 / draft.camera.zoom]), [220, -100], {
    key: "Shift",
    afterDown: true,
  });
  draft = await view(page);
  expect(table(draft).rotation).toBe(270);
  const rotated = table(draft);
  await drag(page, offset(rotated, [60, 0]), offset(rotated, [90, 0]));
  const resized = table(await view(page));
  expect(effectiveWidth(resized)).toBeCloseTo(150, 0);
  await drag(page, [resized.position.x, resized.position.y], [300, -100]);
  const beforeSave = await view(page);
  expect(table(beforeSave).position).toEqual({ x: 300, y: -100 });

  await page.keyboard.press("Control+s");
  await expect(status(page)).toContainText("Saved to Gaia revision 8");
  const saved = await view(page);
  expect(saved.lastBatch.edits.map(({ op, id }) => [op, id])).toEqual([
    ["geometry", "partition"],
    ["create", expect.any(String)],
    ["pose", "bench"],
    ["geometry", "bench"],
  ]);
  const created = saved.lastBatch.edits.find(({ op }) => op === "create").id;
  expect(saved.world.nodes[created]).toMatchObject({
    parent: "ground",
    role: "wall",
    p: [0, 0, 0],
  });
  expect(saved.world.nodes.partition).toMatchObject({
    geometry: { length: 4 },
    basis: "measured",
    surveyMark: "W-17",
  });
  expect(saved.world.nodes.bench).toMatchObject({
    parent: "ground",
    p: [3, 1, 0],
    yaw: 90,
    zoneIds: ["bed"],
    inventory: { loadKg: 40 },
  });
  expect(saved.world.nodes.bench.geometry.size).toEqual([
    effectiveWidth(table(beforeSave)) / 100,
    0.6,
    0.8,
  ]);
  expect(saved.world.devices).toEqual(baseline.world.devices);
  expect(saved.world.nodes.mc2).toEqual(baseline.world.nodes.mc2);
  expect(saved.world.survey).toEqual(baseline.world.survey);
  expect(saved.history.entries).toEqual([]);

  await tool(page, "Reopen saved model").click();
  await expect(status(page)).toContainText("Reopened Gaia revision 8");
  const reopened = await view(page);
  expect(reopened.world).toEqual(saved.world);
  expect(effectiveWidth(table(reopened))).toBeCloseTo(effectiveWidth(table(beforeSave)), 8);
  expect(wall(reopened).end.x).toBeCloseTo(0);
  expect(ground(reopened).walls.some(({ id }) => id === `e-${created}`)).toBe(true);
  await page.keyboard.press("Meta+s");
  await expect(status(page)).toContainText("No changes to save. Gaia revision 8");

  await tool(page, "Zoom to 100%").click();
  await clickAt(page, [-200, 0]);
  await drag(page, [0, 0], [0, 25]);
  await tool(page, "Save to Gaia").click();
  await expect(status(page)).toContainText("Saved to Gaia revision 9");
  const linked = await view(page);
  expect(new Set(linked.lastBatch.edits.map(({ id }) => id))).toEqual(
    new Set(["partition", created])
  );
  const secondWall = ground(linked).walls.find(({ id }) => id === `e-${created}`);
  expect(wall(linked).end.x).toBeCloseTo(secondWall.start.x, 8);
  expect(wall(linked).end.y).toBeCloseTo(secondWall.start.y, 8);
  expect(wall(linked).end.y).toBeCloseTo(25, 8);
  await test.info().attach("Gaia wall and table batches", {
    body: JSON.stringify([saved.lastBatch, linked.lastBatch]),
    contentType: "application/json",
  });
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => globalThis.window.indexedDbCalls)).toEqual([]);
  expect(external).toEqual([]);
  expect(missing).toEqual([]);
  expect(errors).toEqual([]);
});

test("duplicates, deletes and branches with upstream undo and redo", async ({ page }) => {
  await open(page);
  await clickAt(page, [200, -100], { button: "right" });
  await page.getByRole("menuitem", { name: "Duplicate" }).click();
  let snapshot = await view(page);
  expect(ground(snapshot).furniture).toHaveLength(2);
  const copy = ground(snapshot).furniture.find(({ id }) => id !== "e-bench");
  expect(snapshot.selected).toBe(copy.id);
  await page.keyboard.press("Delete");
  expect(ground(await view(page)).furniture).toHaveLength(1);
  await tool(page, "Undo").click();
  expect(ground(await view(page)).furniture.find(({ id }) => id === copy.id)).toEqual(copy);
  await tool(page, "Redo").click();
  expect(ground(await view(page)).furniture).toHaveLength(1);
  await tool(page, "Undo").click();
  await tool(page, "Undo").click();
  await tool(page, "Redo").click();
  expect(ground(await view(page)).furniture.find(({ id }) => id === copy.id)).toEqual(copy);
  await tool(page, "Undo").click();
  await tool(page, "Table").click();
  await clickAt(page, [-225, 150]);
  await page.keyboard.press("Escape");
  snapshot = await view(page);
  const newTable = ground(snapshot).furniture.find(({ id }) => id !== "e-bench");
  expect(newTable.id).not.toBe(copy.id);
  await tool(page, "Redo").click();
  expect(ground(await view(page)).furniture.find(({ id }) => id !== "e-bench")).toEqual(newTable);
  await tool(page, "Save to Gaia").click();
  await expect(status(page)).toContainText("Saved to Gaia revision 8");
  snapshot = await view(page);
  const [edit] = snapshot.lastBatch.edits;
  expect(edit.op).toBe("create");
  expect(edit.id).not.toBe(newTable.id);
  expect(snapshot.world.nodes[edit.id].geometry).toEqual({ kind: "box", size: [1, 0.6, 0.75] });
  expect(snapshot.world.nodes[edit.id]).not.toHaveProperty("zoneIds");
  expect(snapshot.world.nodes[edit.id]).not.toHaveProperty("inventory");
  expect(snapshot.world.nodes.bench.zoneIds).toEqual(["bed"]);

  await tool(page, "Zoom to 100%").click();
  await clickAt(page, [newTable.position.x, newTable.position.y]);
  await page.keyboard.press("Delete");
  await tool(page, "Undo").click();
  expect(ground(await view(page)).furniture.find(({ id }) => id === newTable.id)).toBeTruthy();
  await tool(page, "Redo").click();
  await tool(page, "Save to Gaia").click();
  await expect(status(page)).toContainText("Saved to Gaia revision 9");
  const deleted = await view(page);
  expect(deleted.lastBatch.edits).toEqual([{ op: "remove", id: edit.id }]);
  expect(deleted.world.nodes[edit.id]).toBeUndefined();
  expect(deleted.world.nodes.bench).toEqual(snapshot.world.nodes.bench);
  await test.info().attach("Gaia creation and deletion batches", {
    body: JSON.stringify([snapshot.lastBatch, deleted.lastBatch]),
    contentType: "application/json",
  });

  await tool(page, "Zoom to 100%").click();
  await clickAt(page, [200, -100]);
  await page.keyboard.press("Control+c");
  await page.keyboard.press("Control+v");
  expect(ground(await view(page)).furniture).toHaveLength(2);
  await tool(page, "Undo").click();
  await tool(page, "Save to Gaia").click();
  await expect(status(page)).toContainText("No changes to save. Gaia revision 9");
});

test("failed Gaia save preserves the draft and its upstream history", async ({ page }) => {
  await open(page);
  const baseline = await view(page);
  await clickAt(page, [-250, 0]);
  await drag(page, [-100, 0], [0, 0]);
  await drag(page, [200, -100], [300, -100]);
  await clickAt(page, [300, -100]);
  await page.keyboard.press("Delete");
  const beforeSave = await view(page);
  expect(table(beforeSave)).toBeUndefined();
  await tool(page, "Save to Gaia").click();
  await expect(status(page)).toContainText("bench: resolve Gaia relationships with bed");
  const failed = await view(page);
  expect(failed.world).toEqual(baseline.world);
  expect(failed.draft).toEqual(beforeSave.draft);
  expect(failed.history).toEqual(beforeSave.history);
  await tool(page, "Undo").click();
  expect(table(await view(page)).position.x).toBe(300);
  await tool(page, "Save to Gaia").click();
  await expect(status(page)).toContainText("Saved to Gaia revision 8");
  expect((await view(page)).world.nodes.bench.zoneIds).toEqual(["bed"]);
  expect((await view(page)).world.nodes.partition.geometry.length).toBe(4);
});

test("blocks curved walls, room deletion, openings, groups, catalog drops and cross-floor edits before mutation", async ({
  page,
}) => {
  await open(page, "?fixture=two-floors");
  const baseline = await view(page);
  await clickAt(page, [-250, 0]);
  await drag(page, [-250, 0], [-250, 80], { key: "Alt" });
  await expect(status(page)).toContainText("Curved walls unavailable");
  expect(ground(await view(page))).toEqual(ground(baseline));
  expect((await view(page)).history).toEqual(baseline.history);
  await clickAt(page, [-250, 0], { button: "right" });
  await expect(page.getByRole("menuitem", { name: "Curve On" })).toBeDisabled();
  await page.keyboard.press("Escape");

  await draw(page, [
    [-100, 0],
    [-100, 150],
    [-400, 150],
    [-400, 0],
  ]);
  await expect.poll(async () => (await view(page)).rooms.length).toBe(1);
  const closed = await view(page);
  await clickAt(page, [-250, 100], { button: "right" });
  const deleteRoom = page.getByRole("menuitem", { name: "Delete Room" });
  await expect(deleteRoom).toBeDisabled();
  const deleteBox = await deleteRoom.boundingBox();
  await page.mouse.click(deleteBox.x + deleteBox.width / 2, deleteBox.y + deleteBox.height / 2);
  await page.keyboard.press("Escape");
  await clickAt(page, [-250, 100]);
  await page.keyboard.press("Delete");
  await drag(page, [-250, 100], [-200, 150]);
  await page.keyboard.press("Control+a");
  await page.keyboard.press("Control+g");
  await expect(status(page)).toContainText("This shortcut unavailable");
  await clickAt(page, [100, 125], { button: "right" });
  await expect(page.getByRole("menuitem", { name: /Group Selected/ })).toBeDisabled();
  await page.keyboard.press("Escape");
  await page.keyboard.press("d");
  await clickAt(page, [-250, 0]);
  for (const [type, id] of [
    ["door", "single"],
    ["window", "fixed"],
    ["furniture", "chair"],
  ]) {
    const payload = await page.evaluateHandle(
      ([type, id]) => {
        const data = new globalThis.DataTransfer();
        data.setData("application/o3d-type", type);
        data.setData("application/o3d-id", id);
        return data;
      },
      [type, id]
    );
    await canvas(page).dispatchEvent("drop", { dataTransfer: payload });
    await expect(status(page)).toContainText("Catalog and file drops unavailable");
  }
  expect(ground(await view(page))).toEqual(ground(closed));
  expect((await view(page)).history).toEqual(closed.history);

  await clickAt(page, [200, -100]);
  await expect(page.getByRole("button", { name: /move to floor/i })).toHaveCount(0);
  await page.keyboard.press("Control+c");
  await page.getByRole("combobox", { name: "Floor" }).selectOption("f-upper");
  const changedFloor = await view(page);
  expect(changedFloor.draft.activeFloorId).toBe("f-upper");
  expect(changedFloor.draft.floors).toEqual(closed.draft.floors);
  expect(changedFloor.history).toEqual(closed.history);
  await canvas(page).focus();
  await page.keyboard.press("Control+v");
  await expect(status(page)).toContainText("Pasting from another floor");
  expect((await view(page)).draft).toEqual(changedFloor.draft);
  expect((await view(page)).world).toEqual(baseline.world);
});
