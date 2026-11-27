// Only reviewed providers compiled into the application may execute in Electron main.
import { registerStorageProvider } from "../../electron/rooms/storage-commands.ts";
import { gaiaStorage } from "../../rooms/gaia-room/scripts/storage/provider.ts";
import { decodeRaster } from "../../rooms/gaia-room/scripts/storage/electron-raster.ts";
import { app, powerMonitor } from "electron";
import { Paths } from "../../electron/paths.ts";
import { attachGaiaField } from "./gaia-field-main.mjs";

import { FieldManagement } from "../../rooms/gaia-room/scripts/storage/field-management.ts";
import { fieldDialogs } from "./gaia-field-dialogs.mjs";
import "../../electron/main.ts";

export const gaiaField = attachGaiaField(
  app,
  powerMonitor,
  () => Paths.getRoomStorageDir("gaia-room"),
  process.env
);

registerStorageProvider(gaiaStorage(decodeRaster, new FieldManagement(gaiaField, fieldDialogs)));
