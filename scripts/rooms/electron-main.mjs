// Only reviewed providers compiled into the application may execute in Electron main.
import { registerStorageProvider } from "../../electron/rooms/storage-commands.ts";
import { gaiaStorage } from "../../rooms/gaia-room/scripts/storage/provider.ts";
import "../../electron/main.ts";

registerStorageProvider(gaiaStorage);
