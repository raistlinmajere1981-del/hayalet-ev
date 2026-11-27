import { FieldReceiverControl } from "../../rooms/gaia-room/scripts/field/lifecycle.ts";

// The storage root is resolved by the host, independently of any Room or webContents.
export function attachGaiaField(app, powerMonitor, root, env) {
  const control = new FieldReceiverControl(root);
  let quitting = false;
  let drained = false;
  const report = () => console.error("Gaia field listener unavailable");
  void app
    .whenReady()
    .then(async () => {
      if (quitting) return;
      powerMonitor.on("suspend", () => void control.suspend().catch(report));
      powerMonitor.on("resume", () => void control.resume().catch(report));
      if (env.HEV_GAIA_FIELD_ADDRESS || env.HEV_GAIA_FIELD_PORT || env.HEV_GAIA_FIELD_ORIGIN)
        await control.start({
          address: env.HEV_GAIA_FIELD_ADDRESS,
          port: Number(env.HEV_GAIA_FIELD_PORT),
          origin: env.HEV_GAIA_FIELD_ORIGIN,
        });
    })
    .catch(report);
  app.on("before-quit", (event) => {
    if (drained) return;
    if (!quitting && !control.needsDrain()) {
      quitting = true;
      drained = true;
      void control.shutdown().catch(report);
      return;
    }
    event.preventDefault();
    if (quitting) return;
    quitting = true;
    void control
      .shutdown()
      .catch(report)
      .then(() => {
        drained = true;
        app.quit();
      });
  });
  return control;
}
