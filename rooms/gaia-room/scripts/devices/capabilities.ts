export const deviceRoles = ["client", "router", "sensor", "actuator", "external"] as const;
export type DeviceRole = (typeof deviceRoles)[number];

export const capabilities = {
  "camera.view.v1": { kind: "media" },
  "microphone.listen.v1": { kind: "media" },
  "temperature.read.v1": { kind: "number", unit: "°C" },
  "humidity.read.v1": { kind: "number", unit: "%" },
  "level.read.v1": { kind: "number", unit: "m" },
  "motion.read.v1": { kind: "boolean", unit: "1" },
  "energy.read.v1": { kind: "number", unit: "kWh" },
  "link.status.v1": { kind: "boolean", unit: "1" },
  "signal.read.v1": { kind: "number", unit: "dBm" },
  "digital.read.v1": { kind: "boolean", unit: "1" },
} as const;

export type CapabilityId = keyof typeof capabilities;

export function capabilityOf(id: string) {
  return Object.hasOwn(capabilities, id) ? capabilities[id as CapabilityId] : undefined;
}

export function capabilityId(id: unknown): id is string {
  return typeof id === "string" && /^[a-z][a-z0-9.-]{0,95}$/.test(id);
}
