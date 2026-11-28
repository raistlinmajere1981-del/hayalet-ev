import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { join } from "node:path";
import { capabilityIds } from "../../protocol/schema.ts";
import { inspectUsbRequest } from "../../field/installation.ts";
import { createSiteFixture } from "../../spatial/fixture.ts";
import { openFieldAuthority } from "../../storage/enrollment-service.ts";
import { provisionAuthorizationStore } from "../../storage/enrollment-store.ts";
import {
  issueLocalInstallation,
  provisionFieldCa,
  rotateFieldServer,
} from "../../storage/field-issuer.ts";

export async function temporaryEndpoint() {
  const address = "127.0.0.1";
  const reservation = createServer();
  await new Promise<void>((resolve, reject) =>
    reservation.once("error", reject).listen(0, address, resolve)
  );
  const bound = reservation.address();
  if (!bound || typeof bound === "string") throw new Error("Missing temporary address");
  await new Promise<void>((resolve) => reservation.close(() => resolve()));
  return { address, port: bound.port, origin: `https://${address}:${bound.port}` };
}

export async function syntheticFieldCenter(
  root: string,
  directory: string,
  usb: unknown,
  inventory: readonly string[] = capabilityIds,
  allowed: readonly string[] = inventory
) {
  const endpoint = await temporaryEndpoint();
  const media = { directory, passphrase: Buffer.from(randomUUID()) };
  await provisionAuthorizationStore(root);
  const caFingerprint = await provisionFieldCa(root, media);
  await rotateFieldServer(root, media, endpoint.origin);
  const world = createSiteFixture();
  world.id = "demo";
  world.devices["phone"] = { role: "client", source: "physical", capabilities: [...inventory] };
  const dir = join(root, "projects", world.id);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await writeFile(
    join(dir, "world.json"),
    JSON.stringify({ world, statusEpoch: 0, lastOperation: null })
  );
  const client = inspectUsbRequest(usb);
  const pkg = await issueLocalInstallation(root, media, usb, {
    operationId: randomUUID(),
    projectId: world.id,
    deviceId: "phone",
    hardwareId: "test-instrument",
    capabilities: [...allowed],
    expectedRevision: world.revision,
    installationId: client.installationId,
    publicKeyFingerprint: client.fingerprint,
    caFingerprint,
    httpsOrigin: endpoint.origin,
    change: { kind: "begin" },
  });
  const owner = await openFieldAuthority(root, { certificatesRequired: true });
  try {
    const { assignment } = await owner.enrollLocalInstallation(pkg);
    await owner.enrollmentCommand({
      action: "complete",
      operationId: randomUUID(),
      assignmentId: assignment.id,
    });
    return { endpoint, media, pkg, dir, assignmentId: assignment.id };
  } finally {
    await owner.close();
  }
}
