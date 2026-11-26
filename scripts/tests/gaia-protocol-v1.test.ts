import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  ackSchema,
  bodyLimitBytes,
  capabilityCatalogDocument,
  capabilityIds,
  errorResponseSchema,
  jsonSchemaDocuments,
  maxJsonDepth,
  observationPacketSchema,
  sessionOpenRequestSchema,
  sessionOpenResponseSchema,
  type CapabilityId,
  type ObservationPacket,
  type Sample,
} from "../../gaia-protocol/v1/src/schema.ts";
import {
  acceptedNotSubset,
  ackSeqMismatch,
  ackSessionMismatch,
  duplicateCapabilities,
  missingCapabilityIds,
  samplesAfterSend,
  samplesOutsideAccepted,
  t1Accepted,
} from "../../gaia-protocol/v1/src/semantics.ts";

const protocolRoot = fileURLToPath(new URL("../../gaia-protocol/v1/", import.meta.url));
const schemaNames = [
  "sessionOpenRequest",
  "sessionOpenResponse",
  "observation",
  "ack",
  "error",
] as const;

const fixtureCaseSchema = z
  .object({
    id: z.string().min(1),
    file: z.string().min(1),
    schema: z.enum(schemaNames).nullable(),
    expect: z.enum(["valid", "invalid"]),
    layer: z.enum(["schema", "semantic", "raw"]),
    violation: z.string().min(1).optional(),
    check: z.string().min(1).optional(),
    context: z.record(z.string(), z.unknown()).optional(),
    note: z.string().min(1).optional(),
  })
  .strict();
const manifestSchema = z
  .object({
    v: z.literal(1),
    cases: z.array(fixtureCaseSchema),
  })
  .strict();
const t1ScenarioSchema = z
  .object({
    id: z.literal("T1"),
    request: z.string().min(1),
    response: z.string().min(1),
    inventory: z.array(z.string().min(1)),
    permission: z.array(z.string().min(1)),
    expectedAccepted: z.array(z.string().min(1)),
  })
  .strict();
const t2ScenarioSchema = z
  .object({
    id: z.literal("T2"),
    validPacket: z.string().min(1),
    rejected: z.array(z.string().min(1)),
  })
  .strict();

type FixtureCase = z.infer<typeof fixtureCaseSchema>;

const schemaByName: Record<(typeof schemaNames)[number], z.ZodType> = {
  sessionOpenRequest: sessionOpenRequestSchema,
  sessionOpenResponse: sessionOpenResponseSchema,
  observation: observationPacketSchema,
  ack: ackSchema,
  error: errorResponseSchema,
};

function schemaOf(fixtureCase: FixtureCase): z.ZodType {
  const schema = fixtureCase.schema;
  if (schema === null) assert.fail(`${fixtureCase.id} must declare a schema`);
  return schemaByName[schema];
}

function readJson(relativePath: string): unknown {
  const parsed: unknown = JSON.parse(readFileSync(join(protocolRoot, relativePath), "utf8"));
  return parsed;
}

function readRaw(relativePath: string): Buffer {
  return readFileSync(join(protocolRoot, relativePath));
}

function loadManifest(): FixtureCase[] {
  return manifestSchema.parse(readJson("fixtures/manifest.json")).cases;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) assert.fail(`${label} must be a string array`);
  const entries: unknown[] = value;
  const strings = entries.filter((entry): entry is string => typeof entry === "string");
  if (strings.length !== entries.length) assert.fail(`${label} must be a string array`);
  return strings;
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== "string") assert.fail(`${label} must be a string`);
  return value;
}

function listFiles(directory: string, base = directory): string[] {
  const entries = readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(path, base);
    return [relative(base, path).split("\\").join("/")];
  });
}

function containerDepth(value: unknown): number {
  if (Array.isArray(value)) {
    const entries: unknown[] = value;
    return 1 + Math.max(0, ...entries.map((entry) => containerDepth(entry)));
  }
  if (isRecord(value)) {
    return 1 + Math.max(0, ...Object.values(value).map((entry) => containerDepth(entry)));
  }
  return 0;
}

function sampleOf(packet: ObservationPacket, id: CapabilityId): Sample {
  const sample = packet.samples.find((entry) => entry.id === id);
  assert.ok(sample, `missing sample ${id}`);
  return sample;
}

function hasSemanticViolation(fixtureCase: FixtureCase, fixture: unknown): boolean {
  const context = fixtureCase.context ?? {};
  switch (fixtureCase.violation ?? "") {
    case "duplicate-capability": {
      const packet = observationPacketSchema.parse(fixture);
      return duplicateCapabilities(packet.samples.map((sample) => sample.id)).length > 0;
    }
    case "unapproved-capability": {
      const packet = observationPacketSchema.parse(fixture);
      return (
        samplesOutsideAccepted(packet, stringArray(context["accepted"], "accepted")).length > 0
      );
    }
    case "missing-capability": {
      const packet = observationPacketSchema.parse(fixture);
      return missingCapabilityIds(packet, stringArray(context["accepted"], "accepted")).length > 0;
    }
    case "sample-after-send": {
      const packet = observationPacketSchema.parse(fixture);
      return samplesAfterSend(packet).length > 0;
    }
    case "accepted-not-subset": {
      const response = sessionOpenResponseSchema.parse(fixture);
      return acceptedNotSubset(response, stringArray(context["offered"], "offered")).length > 0;
    }
    case "ack-session-mismatch": {
      const ack = ackSchema.parse(fixture);
      const packet = observationPacketSchema.parse(
        readJson(`fixtures/${stringValue(context["observation"], "observation")}`)
      );
      return ackSessionMismatch(ack, packet);
    }
    case "ack-seq-mismatch": {
      const ack = ackSchema.parse(fixture);
      const packet = observationPacketSchema.parse(
        readJson(`fixtures/${stringValue(context["observation"], "observation")}`)
      );
      return ackSeqMismatch(ack, packet);
    }
    default:
      return assert.fail(`Unknown semantic violation: ${String(fixtureCase.violation)}`);
  }
}

function rawViolation(fixtureCase: FixtureCase, bytes: Buffer): boolean {
  switch (fixtureCase.check ?? "") {
    case "duplicate-json-key": {
      const text = bytes.toString("utf8");
      const count = text.match(/"seq"\s*:/g)?.length ?? 0;
      assert.equal(count, 2, "raw body must retain both seq keys");
      const packet = observationPacketSchema.parse(JSON.parse(text) as unknown);
      assert.equal(packet.seq, 7, "JSON.parse keeps the last duplicate value");
      return true;
    }
    case "prototype-key": {
      const text = bytes.toString("utf8");
      for (const key of ["__proto__", "constructor", "prototype"]) {
        assert.ok(text.includes(`"${key}"`), `raw body must contain ${key}`);
      }
      const parsed: unknown = JSON.parse(text);
      assert.ok(isRecord(parsed));
      assert.equal(Object.hasOwn(parsed, "__proto__"), true);
      assert.equal(Object.hasOwn(Object.prototype, "polluted"), false);
      assert.equal(observationPacketSchema.safeParse(parsed).success, false);
      return true;
    }
    case "invalid-utf8": {
      assert.throws(() => new TextDecoder("utf-8", { fatal: true }).decode(bytes));
      return true;
    }
    case "body-at-limit": {
      assert.equal(bytes.byteLength, bodyLimitBytes);
      const parsed: unknown = JSON.parse(bytes.toString("utf8"));
      assert.equal(observationPacketSchema.safeParse(parsed).success, true);
      return false;
    }
    case "body-too-large": {
      assert.equal(bytes.byteLength, bodyLimitBytes + 1);
      const parsed: unknown = JSON.parse(bytes.toString("utf8"));
      assert.equal(observationPacketSchema.safeParse(parsed).success, true);
      return true;
    }
    case "depth-too-deep": {
      const parsed: unknown = JSON.parse(bytes.toString("utf8"));
      assert.ok(containerDepth(parsed) > maxJsonDepth, `fixture must exceed depth ${maxJsonDepth}`);
      return true;
    }
    case "unsafe-integer-literal": {
      const text = bytes.toString("utf8");
      assert.ok(text.includes("9007199254740993"));
      const parsed: unknown = JSON.parse(text);
      assert.ok(isRecord(parsed));
      const seq = parsed["seq"];
      assert.equal(typeof seq, "number");
      assert.equal(Number.isSafeInteger(seq), false);
      assert.equal(observationPacketSchema.safeParse(parsed).success, false);
      return true;
    }
    case "non-finite-number": {
      const parsed: unknown = JSON.parse(bytes.toString("utf8"));
      assert.ok(isRecord(parsed));
      const samples = parsed["samples"];
      assert.ok(Array.isArray(samples));
      const entries: unknown[] = samples;
      const pack = entries.find(
        (entry) => isRecord(entry) && entry["id"] === "battery.pack-temperature.v1"
      );
      assert.ok(isRecord(pack));
      const value = pack["value"];
      assert.equal(typeof value, "number");
      assert.equal(Number.isFinite(value), false);
      assert.equal(observationPacketSchema.safeParse(parsed).success, false);
      return true;
    }
    default:
      return assert.fail(`Unknown raw check: ${String(fixtureCase.check)}`);
  }
}

void test("fixture manifest covers every fixture file exactly once", () => {
  const cases = loadManifest();
  const fixtureFiles = listFiles(join(protocolRoot, "fixtures"))
    .filter((file) => file !== "manifest.json")
    .sort();
  const manifestFiles = cases.map((fixtureCase) => fixtureCase.file).sort();
  assert.deepEqual(manifestFiles, fixtureFiles);
});

void test("manifest declares schema, semantic and raw validation layers", () => {
  const cases = loadManifest();
  for (const layer of ["schema", "semantic", "raw"] as const) {
    assert.ok(
      cases.some((fixtureCase) => fixtureCase.layer === layer),
      `missing ${layer} layer`
    );
  }
  const requiredViolations = [
    "protocol-version",
    "missing-field",
    "extra-field",
    "wrong-unit",
    "wrong-value-type",
    "unsafe-integer",
    "invalid-uuid",
    "duplicate-capability",
    "unapproved-capability",
    "sample-after-send",
    "ack-session-mismatch",
    "ack-seq-mismatch",
    "duplicate-json-key",
    "prototype-key",
    "invalid-utf8",
    "body-too-large",
    "depth-too-deep",
    "non-finite-number",
  ];
  for (const violation of requiredViolations) {
    assert.ok(
      cases.some((fixtureCase) => fixtureCase.violation === violation),
      `missing violation ${violation}`
    );
  }
});

void test("valid fixtures pass their declared schema", () => {
  for (const fixtureCase of loadManifest()) {
    if (fixtureCase.layer !== "schema" || fixtureCase.expect !== "valid") continue;
    const result = schemaOf(fixtureCase).safeParse(readJson(`fixtures/${fixtureCase.file}`));
    assert.equal(result.success, true, `${fixtureCase.id}: ${result.error?.message ?? ""}`);
  }
});

void test("schema-invalid fixtures fail their declared schema", () => {
  for (const fixtureCase of loadManifest()) {
    if (fixtureCase.layer !== "schema" || fixtureCase.expect !== "invalid") continue;
    const result = schemaOf(fixtureCase).safeParse(readJson(`fixtures/${fixtureCase.file}`));
    assert.equal(result.success, false, `${fixtureCase.id} unexpectedly passed`);
  }
});

void test("semantic-invalid fixtures pass schema and fail the declared runtime rule", () => {
  for (const fixtureCase of loadManifest()) {
    if (fixtureCase.layer !== "semantic") continue;
    assert.equal(fixtureCase.expect, "invalid", fixtureCase.id);
    const fixture = readJson(`fixtures/${fixtureCase.file}`);
    const result = schemaOf(fixtureCase).safeParse(fixture);
    assert.equal(result.success, true, `${fixtureCase.id} must be schema-valid`);
    assert.equal(hasSemanticViolation(fixtureCase, fixture), true, fixtureCase.id);
  }
});

void test("raw fixtures retain pre-parse violations that JSON.parse hides", () => {
  for (const fixtureCase of loadManifest()) {
    if (fixtureCase.layer !== "raw") continue;
    assert.ok(fixtureCase.check, fixtureCase.id);
    const violation = rawViolation(fixtureCase, readRaw(`fixtures/${fixtureCase.file}`));
    assert.equal(violation, fixtureCase.expect === "invalid", fixtureCase.id);
  }
});

void test("capability matrix covers valid, invalid and missing for all eight capabilities", () => {
  const allValid = observationPacketSchema.parse(
    readJson("fixtures/valid/observation-all-valid.json")
  );
  const allInvalid = observationPacketSchema.parse(
    readJson("fixtures/valid/observation-all-invalid.json")
  );
  const allMissing = observationPacketSchema.parse(
    readJson("fixtures/valid/observation-all-missing.json")
  );
  const expectedIds = [...capabilityIds].sort();
  for (const packet of [allValid, allInvalid, allMissing]) {
    assert.deepEqual(packet.samples.map((sample) => sample.id).sort(), expectedIds);
  }
  for (const sample of allValid.samples) {
    if (sample.quality !== "valid") assert.fail(`${sample.id} must be valid`);
  }
  for (const sample of allInvalid.samples) {
    if (sample.quality !== "invalid") assert.fail(`${sample.id} must be invalid`);
    assert.equal(sample.value, null);
    assert.ok(Number.isSafeInteger(sample.sampleMonoMs));
  }
  for (const sample of allMissing.samples) {
    if (sample.quality !== "missing") assert.fail(`${sample.id} must be missing`);
    assert.equal(sample.value, null);
    assert.equal("sampleMonoMs" in sample, false);
  }
  assert.equal(sampleOf(allValid, "battery.level.v1").value, 0);
  assert.equal(sampleOf(allValid, "battery.voltage.v1").value, 0);
  assert.deepEqual(sampleOf(allValid, "accelerometer.xyz.v1").value, [0, 0, 0]);
  assert.deepEqual(sampleOf(allValid, "network.state.v1").value, {
    transport: "none",
    internetCapable: false,
    validated: false,
  });
  assert.equal(sampleOf(allValid, "signal.read.v1").value, -126);
  assert.equal(sampleOf(allValid, "proximity.state.v1").value, "near");
  assert.equal(sampleOf(allValid, "battery.charge-state.v1").value, "not_charging");
  assert.equal(sampleOf(allValid, "battery.pack-temperature.v1").value, -5.5);
});

void test("T1 returns only the catalog, offered, inventory and permission intersection", () => {
  const scenario = t1ScenarioSchema.parse(readJson("scenarios/t1.json"));
  const request = sessionOpenRequestSchema.parse(readJson(`fixtures/${scenario.request}`));
  const response = sessionOpenResponseSchema.parse(readJson(`fixtures/${scenario.response}`));
  const expected = t1Accepted(
    request.offered,
    scenario.inventory,
    scenario.permission,
    capabilityIds
  );
  assert.deepEqual([...response.accepted].sort(), [...expected].sort());
  assert.deepEqual([...response.accepted].sort(), [...scenario.expectedAccepted].sort());
  assert.equal(request.offered.includes("camera.view.v1"), true);
  const acceptedIds: readonly string[] = response.accepted;
  assert.equal(acceptedIds.includes("camera.view.v1"), false);
  assert.deepEqual(acceptedNotSubset(response, request.offered), []);
});

void test("T2 preserves zero, false, negative RSSI, closed enums, vectors and network state", () => {
  const scenario = t2ScenarioSchema.parse(readJson("scenarios/t2.json"));
  const packet = observationPacketSchema.parse(readJson(`fixtures/${scenario.validPacket}`));
  assert.equal(sampleOf(packet, "battery.level.v1").value, 0);
  assert.deepEqual(sampleOf(packet, "accelerometer.xyz.v1").value, [0, 0, 0]);
  assert.deepEqual(sampleOf(packet, "network.state.v1").value, {
    transport: "none",
    internetCapable: false,
    validated: false,
  });
  const main = observationPacketSchema.parse(readJson("fixtures/valid/observation.json"));
  assert.deepEqual(sampleOf(main, "network.state.v1").value, {
    transport: "wifi",
    internetCapable: true,
    validated: false,
  });
  assert.equal(sampleOf(main, "signal.read.v1").value, null);
  assert.equal(sampleOf(main, "proximity.state.v1").value, "far");
  assert.equal(sampleOf(packet, "battery.charge-state.v1").value, "full");
  assert.equal(sampleOf(packet, "proximity.state.v1").value, null);
  assert.equal(sampleOf(packet, "proximity.state.v1").quality, "missing");
  assert.equal(sampleOf(packet, "signal.read.v1").value, null);
  assert.equal(sampleOf(packet, "signal.read.v1").quality, "missing");
  assert.equal(sampleOf(packet, "battery.voltage.v1").quality, "invalid");
  assert.equal(sampleOf(packet, "battery.pack-temperature.v1").quality, "valid");
  const qualities = new Set(packet.samples.map((sample) => sample.quality));
  assert.deepEqual([...qualities].sort(), ["invalid", "missing", "valid"]);
  const cases = loadManifest();
  for (const caseId of scenario.rejected) {
    const fixtureCase = cases.find((entry) => entry.id === caseId);
    assert.ok(fixtureCase, `missing rejected case ${caseId}`);
    assert.equal(fixtureCase.expect, "invalid", caseId);
  }
});

void test("generated JSON Schema and capability catalog match the authority", () => {
  for (const [file, document] of Object.entries(jsonSchemaDocuments)) {
    const actual: unknown = JSON.parse(readFileSync(join(protocolRoot, "schema", file), "utf8"));
    assert.deepEqual(actual, document, `${file} is stale; run npm run gaia-protocol:schemas`);
  }
  const catalog: unknown = JSON.parse(
    readFileSync(join(protocolRoot, "schema", "capabilities.json"), "utf8")
  );
  assert.deepEqual(catalog, capabilityCatalogDocument);
});

void test("capability catalog keeps battery pack temperature separate from ambient temperature", () => {
  const catalogIds = capabilityCatalogDocument.capabilities.map((entry) => entry.id);
  assert.deepEqual([...catalogIds].sort(), [...capabilityIds].sort());
  const ids: readonly string[] = catalogIds;
  assert.equal(ids.includes("temperature.read.v1"), false);
  const pack = capabilityCatalogDocument.capabilities.find(
    (entry) => entry.id === "battery.pack-temperature.v1"
  );
  assert.ok(pack);
  assert.equal(pack.unit, "°C");
  const cases = loadManifest();
  assert.ok(cases.some((entry) => entry.id === "observation.ambient-capability"));
  assert.ok(cases.some((entry) => entry.id === "observation.pack-temperature-ambient-object"));
});
