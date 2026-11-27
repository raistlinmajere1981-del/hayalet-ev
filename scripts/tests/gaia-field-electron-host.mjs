// This harness runs beside a disposable copy of the normal Electron build.
import { app, BrowserWindow, powerMonitor } from "electron";
import { performance } from "node:perf_hooks";
import { createInterface } from "node:readline";

const { gaiaField } = await import(new URL("./dist/electron/main.js", import.meta.url));
async function waitState(expected) {
  const until = performance.now() + 15000;
  while (gaiaField.status().listening !== expected || !BrowserWindow.getAllWindows().length) {
    if (performance.now() > until) throw new Error("Electron field lifecycle timed out");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

const input = createInterface({ input: process.stdin });
input.on("line", (line) => {
  if (line === "quit") app.quit();
  if (line === "suspend" || line === "resume") {
    powerMonitor.emit(line);
    void waitState(line === "resume").then(() => process.stdout.write(line + "\n"));
  }
});
input.on("close", () => app.quit());
void app
  .whenReady()
  .then(async () => {
    await waitState(Boolean(process.env.HEV_GAIA_FIELD_ADDRESS));
    process.stdout.write("listening\n");
  })
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
