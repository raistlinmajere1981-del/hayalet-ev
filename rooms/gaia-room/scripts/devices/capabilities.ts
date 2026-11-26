export const deviceRoles = ["client", "router", "sensor", "actuator", "external"] as const;
export type DeviceRole = (typeof deviceRoles)[number];

// physical marks the v1 field catalog. Those capabilities are written only through the
// measured-snapshot operation, never through the simulated single-update path.
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
  "battery.level.v1": { kind: "number", unit: "%", physical: true },
  "battery.pack-temperature.v1": { kind: "number", unit: "°C", physical: true },
  "battery.voltage.v1": { kind: "number", unit: "mV", physical: true },
  "battery.charge-state.v1": {
    kind: "enum",
    unit: "1",
    physical: true,
    values: ["charging", "discharging", "full", "not_charging"],
  },
  "accelerometer.xyz.v1": { kind: "vector", unit: "m/s²", physical: true },
  "proximity.state.v1": { kind: "enum", unit: "1", physical: true, values: ["near", "far"] },
  "network.state.v1": { kind: "object", unit: "1", physical: true },
} as const;

export type CapabilityId = keyof typeof capabilities;

export function capabilityOf(id: string) {
  return Object.hasOwn(capabilities, id) ? capabilities[id as CapabilityId] : undefined;
}

export function capabilityId(id: unknown): id is string {
  return typeof id === "string" && /^[a-z][a-z0-9.-]{0,95}$/.test(id);
}
