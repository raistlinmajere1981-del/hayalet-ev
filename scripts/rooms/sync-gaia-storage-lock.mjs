import { copyFile } from "node:fs/promises";

// The backup planner is room-independent. Its lock protocol is the single
// authority; copy it verbatim into the portable Gaia source tree.
await Promise.all(
  ["gaia-storage-lock.mjs", "gaia-storage-lock.d.mts"].map((name) =>
    copyFile(
      new URL("../../shared/" + name, import.meta.url),
      new URL("../../rooms/gaia-room/scripts/storage/" + name, import.meta.url)
    )
  )
);
