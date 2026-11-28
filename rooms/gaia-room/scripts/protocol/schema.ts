import { z } from "zod";

/**
 * Normative source for the Gaia v1 field wire contract.
 *
 * GAIA-CLIENT-PROTOCOL.md is the authority. This module only encodes the
 * structural subset that both endpoints can validate without session state.
 * Cross-message checks live in semantics.ts and transport checks stay with
 * B4/B6/B7 (raw UTF-8, duplicate keys, body size, depth, headers).
 */

export const maxSafeInteger = Number.MAX_SAFE_INTEGER;
export const maxCapabilities = 32;
export const bodyLimitBytes = 16 * 1024;
export const maxJsonDepth = 5;
export const intervalMs = 10_000;
export const timeoutMs = 35_000;

export const capabilityIds = [
  "battery.level.v1",
  "battery.pack-temperature.v1",
  "battery.voltage.v1",
  "battery.charge-state.v1",
  "accelerometer.xyz.v1",
  "proximity.state.v1",
  "network.state.v1",
  "signal.read.v1",
] as const;
export type CapabilityId = (typeof capabilityIds)[number];

const segmentPattern =
  /^(?!(?:con|prn|aux|nul|com[0-9]|lpt[0-9]|constructor|prototype)$)[a-z0-9][a-z0-9-]{0,63}$/;
const capabilityIdPattern = /^[a-z][a-z0-9.-]{0,95}$/;
const uuidV4Pattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

export const segmentSchema = z.string().regex(segmentPattern, "Invalid Gaia segment");
export const capabilityIdSchema = z.string().regex(capabilityIdPattern, "Invalid capability id");
export const uuidV4Schema = z.string().regex(uuidV4Pattern, "Invalid lowercase UUIDv4");

const safeNonNegativeIntegerSchema = z.number().int().min(0).max(maxSafeInteger);
const seqSchema = z.number().int().min(1).max(maxSafeInteger);

interface CapabilityDefinition {
  readonly unit: string;
  readonly valueSchema: z.ZodType;
  readonly valueType: "integer" | "number" | "string" | "vector3" | "object";
  readonly minimum?: number;
  readonly maximum?: number;
  readonly enumValues?: readonly string[];
  readonly length?: number;
  readonly fields?: Readonly<Record<string, string | readonly string[]>>;
}

export const capabilityDefinitions = {
  "battery.level.v1": {
    unit: "%",
    valueSchema: z.number().int().min(0).max(100),
    valueType: "integer",
    minimum: 0,
    maximum: 100,
  },
  "battery.pack-temperature.v1": {
    unit: "°C",
    valueSchema: z.number(),
    valueType: "number",
  },
  "battery.voltage.v1": {
    unit: "mV",
    valueSchema: z.number().int().min(0).max(maxSafeInteger),
    valueType: "integer",
    minimum: 0,
    maximum: maxSafeInteger,
  },
  "battery.charge-state.v1": {
    unit: "1",
    valueSchema: z.enum(["charging", "discharging", "full", "not_charging"]),
    valueType: "string",
    enumValues: ["charging", "discharging", "full", "not_charging"],
  },
  "accelerometer.xyz.v1": {
    unit: "m/s²",
    valueSchema: z.tuple([z.number(), z.number(), z.number()]),
    valueType: "vector3",
    length: 3,
  },
  "proximity.state.v1": {
    unit: "1",
    valueSchema: z.enum(["near", "far"]),
    valueType: "string",
    enumValues: ["near", "far"],
  },
  "network.state.v1": {
    unit: "1",
    valueSchema: z.discriminatedUnion("transport", [
      z
        .object({
          transport: z.literal("none"),
          internetCapable: z.literal(false),
          validated: z.literal(false),
        })
        .strict(),
      z
        .object({
          transport: z.enum(["wifi", "cellular", "other"]),
          internetCapable: z.boolean(),
          validated: z.boolean(),
        })
        .strict(),
    ]),
    valueType: "object",
    fields: {
      transport: ["none", "wifi", "cellular", "other"],
      internetCapable: "boolean",
      validated: "boolean",
    },
  },
  "signal.read.v1": {
    unit: "dBm",
    valueSchema: z.number().int().min(-126).max(0),
    valueType: "integer",
    minimum: -126,
    maximum: 0,
  },
} as const satisfies Record<CapabilityId, CapabilityDefinition>;

function uniqueCapabilities<T extends z.ZodType>(schema: T) {
  return schema.refine(
    (items) => new Set(items as readonly string[]).size === (items as readonly string[]).length,
    { message: "Duplicate capability" }
  );
}

function validSample<Id extends CapabilityId, Unit extends string, Value extends z.ZodType>(
  id: Id,
  unit: Unit,
  valueSchema: Value
) {
  return z
    .object({
      id: z.literal(id),
      quality: z.literal("valid"),
      sampleMonoMs: safeNonNegativeIntegerSchema,
      unit: z.literal(unit),
      value: valueSchema,
    })
    .strict();
}

function invalidSample<Id extends CapabilityId, Unit extends string>(id: Id, unit: Unit) {
  return z
    .object({
      id: z.literal(id),
      quality: z.literal("invalid"),
      sampleMonoMs: safeNonNegativeIntegerSchema,
      unit: z.literal(unit),
      value: z.null(),
    })
    .strict();
}

function missingSample<Id extends CapabilityId, Unit extends string>(id: Id, unit: Unit) {
  return z
    .object({
      id: z.literal(id),
      quality: z.literal("missing"),
      unit: z.literal(unit),
      value: z.null(),
    })
    .strict();
}

function samplesFor<Id extends CapabilityId, Unit extends string, Value extends z.ZodType>(
  id: Id,
  definition: { readonly unit: Unit; readonly valueSchema: Value }
) {
  return z.discriminatedUnion("quality", [
    validSample(id, definition.unit, definition.valueSchema),
    invalidSample(id, definition.unit),
    missingSample(id, definition.unit),
  ]);
}

export const sampleSchema = z.union([
  samplesFor("battery.level.v1", capabilityDefinitions["battery.level.v1"]),
  samplesFor("battery.pack-temperature.v1", capabilityDefinitions["battery.pack-temperature.v1"]),
  samplesFor("battery.voltage.v1", capabilityDefinitions["battery.voltage.v1"]),
  samplesFor("battery.charge-state.v1", capabilityDefinitions["battery.charge-state.v1"]),
  samplesFor("accelerometer.xyz.v1", capabilityDefinitions["accelerometer.xyz.v1"]),
  samplesFor("proximity.state.v1", capabilityDefinitions["proximity.state.v1"]),
  samplesFor("network.state.v1", capabilityDefinitions["network.state.v1"]),
  samplesFor("signal.read.v1", capabilityDefinitions["signal.read.v1"]),
]);

const offeredSchema = uniqueCapabilities(z.array(capabilityIdSchema).max(maxCapabilities)).meta({
  uniqueItems: true,
});
const acceptedSchema = uniqueCapabilities(z.array(z.enum(capabilityIds)).max(maxCapabilities)).meta(
  { uniqueItems: true }
);

export const sessionOpenRequestSchema = z
  .object({
    v: z.literal(1),
    projectId: segmentSchema,
    deviceId: segmentSchema,
    installationId: uuidV4Schema,
    runId: uuidV4Schema,
    offered: offeredSchema,
  })
  .strict()
  .meta({
    title: "Gaia v1 session open request",
    description: "POST /gaia/v1/sessions. offered may contain unknown but syntactically valid ids.",
  });

export const sessionOpenResponseSchema = z
  .object({
    v: z.literal(1),
    sessionId: uuidV4Schema,
    accepted: acceptedSchema,
    intervalMs: z.literal(intervalMs),
    timeoutMs: z.literal(timeoutMs),
  })
  .strict()
  .meta({
    title: "Gaia v1 session open response",
    description: "201 response. accepted is a unique subset of offered and the v1 field catalog.",
  });

export const observationPacketSchema = z
  .object({
    v: z.literal(1),
    sessionId: uuidV4Schema,
    seq: seqSchema,
    sentMonoMs: safeNonNegativeIntegerSchema,
    deviceWallMs: safeNonNegativeIntegerSchema,
    samples: z.array(sampleSchema).max(maxCapabilities),
  })
  .strict()
  .meta({
    title: "Gaia v1 observation packet",
    description:
      "POST /gaia/v1/observations. Every accepted capability appears once; an empty array is a heartbeat.",
  });

export const ackSchema = z
  .object({
    v: z.literal(1),
    sessionId: uuidV4Schema,
    seq: seqSchema,
    acceptedAt: safeNonNegativeIntegerSchema,
  })
  .strict()
  .meta({
    title: "Gaia v1 observation ACK",
    description:
      "HTTP 200 response for one observation packet. Session and seq must match the packet.",
  });

export const errorCodes = [
  "invalid_packet",
  "media_type",
  "too_large",
  "not_authorized",
  "session_expired",
  "session_busy",
  "sequence_conflict",
  "rate_limited",
  "unavailable",
] as const;
export type ErrorCode = (typeof errorCodes)[number];

export const errorResponseSchema = z
  .object({
    v: z.literal(1),
    error: z.enum(errorCodes),
  })
  .strict()
  .meta({
    title: "Gaia v1 error response",
    description: "Error body. Retry-After stays in HTTP headers and is not part of this body.",
  });

export type SessionOpenRequest = z.infer<typeof sessionOpenRequestSchema>;
export type SessionOpenResponse = z.infer<typeof sessionOpenResponseSchema>;
export type ObservationPacket = z.infer<typeof observationPacketSchema>;
export type Ack = z.infer<typeof ackSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
export type Sample = z.infer<typeof sampleSchema>;

const jsonSchemaOptions = { target: "draft-2020-12", io: "input" } as const;

export const jsonSchemaDocuments = {
  "session-open-request.schema.json": z.toJSONSchema(sessionOpenRequestSchema, jsonSchemaOptions),
  "session-open-response.schema.json": z.toJSONSchema(sessionOpenResponseSchema, jsonSchemaOptions),
  "observation.schema.json": z.toJSONSchema(observationPacketSchema, jsonSchemaOptions),
  "ack.schema.json": z.toJSONSchema(ackSchema, jsonSchemaOptions),
  "error.schema.json": z.toJSONSchema(errorResponseSchema, jsonSchemaOptions),
} as const;

export const capabilityCatalogDocument = {
  v: 1,
  capabilities: capabilityIds.map((id) => {
    const definition: CapabilityDefinition = capabilityDefinitions[id];
    return {
      id,
      unit: definition.unit,
      valueType: definition.valueType,
      ...(definition.minimum === undefined ? {} : { minimum: definition.minimum }),
      ...(definition.maximum === undefined ? {} : { maximum: definition.maximum }),
      ...(definition.enumValues === undefined ? {} : { enumValues: definition.enumValues }),
      ...(definition.length === undefined ? {} : { length: definition.length }),
      ...(definition.fields === undefined ? {} : { fields: definition.fields }),
    };
  }),
};
