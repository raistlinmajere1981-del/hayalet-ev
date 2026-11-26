import { join } from "node:path";
import { derBase64 } from "../field/certificates.ts";
import { fields, record, uuid } from "./batch.ts";
import { privateBytes } from "./field-trust.ts";
import { publish } from "./files.ts";

interface Issuances {
  version: 1;
  certificates: Record<string, string>;
  discarded: string[];
}

const limit = 64 * 1024 * 1024;

export async function readIssuances(dir: string): Promise<Issuances> {
  const journal: unknown = JSON.parse(
    (await privateBytes(join(dir, "issued.json"), limit)).toString()
  );
  fields(journal, ["version", "certificates", "discarded"]);
  const certificates = journal["certificates"],
    discarded = journal["discarded"];
  if (
    journal["version"] !== 1 ||
    !record(certificates) ||
    !Array.isArray(discarded) ||
    new Set(discarded).size !== discarded.length
  )
    throw new Error("Invalid Gaia issuance journal");
  for (const [id, der] of Object.entries(certificates)) {
    uuid(id);
    derBase64(der);
  }
  for (const id of discarded) {
    uuid(id);
    if (!Object.hasOwn(certificates, id)) throw new Error("Invalid discarded Gaia issuance");
  }
  return journal as unknown as Issuances;
}

export async function writeIssuances(dir: string, journal: Issuances) {
  const bytes = JSON.stringify(journal);
  if (Buffer.byteLength(bytes) > limit) throw new Error("Gaia issuance journal is full");
  await publish(join(dir, "issued.json"), bytes);
}

export function issuedCertificate(journal: Issuances, operationId: string) {
  if (journal.discarded.includes(operationId)) throw new Error("Gaia issuance was discarded");
  return journal.certificates[operationId];
}
