import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { initPaths } from "../electron/paths.ts";
import { Us1RelayServer } from "../electron/us1-relay-server/server.ts";

const currentDir = dirname(fileURLToPath(import.meta.url));
const electronDir = fileURLToPath(new URL("../electron", import.meta.url));

initPaths(electronDir);

const host = process.env.US1_RELAY_HOST?.trim() || "0.0.0.0";
const port = Number.parseInt(process.env.US1_RELAY_PORT ?? "47831", 10);
const relayRoot = process.env.US1_RELAY_ROOT?.trim();

const relayServer = new Us1RelayServer(relayRoot && relayRoot !== "" ? relayRoot : undefined);
const listener = relayServer.createListener();

listener.listen(port, host, () => {
  const address = listener.address();
  const location =
    address && typeof address === "object" ? `${address.address}:${address.port}` : `${host}:${port}`;
  console.log(`[us1-relay] listening on ${location}`);
  console.log(`[us1-relay] cwd=${process.cwd()}`);
  console.log(`[us1-relay] scriptDir=${currentDir}`);
});
