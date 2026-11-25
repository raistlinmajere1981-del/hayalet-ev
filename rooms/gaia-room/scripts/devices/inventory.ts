import type { Device, Id, World } from "../spatial/world.ts";

export type DeviceDetails = Pick<Device, "manufacturer" | "model" | "capabilities"> & {
  name: string;
  roles: NonNullable<Device["roles"]>;
};

export type DeviceEdit =
  | { op: "createDevice"; id: Id; source: Device["source"]; details: DeviceDetails }
  | { op: "updateDevice"; id: Id; details: DeviceDetails }
  | { op: "mountDevice"; id: Id; mount: Id | null }
  | { op: "deleteDevice"; id: Id; mount: Id | null; hardwareId: Id | null };

export function deviceName(world: World, id: Id): string {
  const device = world.devices[id];
  return device?.name ?? (device?.mount ? world.nodes[device.mount]?.name : undefined) ?? id;
}

export function mountPath(world: World, id: Id): string[] {
  const path: string[] = [];
  for (let cursor: Id | null = id; cursor !== null;) {
    const node: World["nodes"][Id] | undefined = world.nodes[cursor];
    if (!node) break;
    path.unshift(node.name);
    cursor = node.parent;
  }
  return path;
}

export function deviceIdsFor(world: World, area?: Id): Id[] {
  if (!area) return Object.keys(world.devices);
  const kind = world.nodes[area]?.kind;
  const relatedZones = new Set<Id>();
  if (kind === "zone") relatedZones.add(area);
  if (kind === "building" || kind === "floor") {
    for (const [id, node] of Object.entries(world.nodes)) {
      if (node.kind !== "zone") continue;
      for (let parent = node.parent; parent; parent = world.nodes[parent]?.parent ?? null) {
        if (parent === area) {
          relatedZones.add(id);
          break;
        }
      }
    }
  }
  return Object.entries(world.devices).flatMap(([id, device]) => {
    for (let cursor = device.mount; cursor !== undefined;) {
      if (cursor === area) return [id];
      const member = world.nodes[cursor];
      if (member?.zoneIds?.some((zone) => relatedZones.has(zone))) return [id];
      cursor = member?.parent ?? undefined;
    }
    return [];
  });
}

function withDetails(device: Device, details: DeviceDetails): Device {
  const { name, roles, capabilities, manufacturer, model } = details;
  if (!roles[0] || !name.trim()) throw new Error("Gaia device needs a name and role");
  const next = { ...device, name, role: roles[0], roles, capabilities };
  if (manufacturer) next.manufacturer = manufacturer;
  else delete next.manufacturer;
  if (model) next.model = model;
  else delete next.model;
  return next;
}

export function applyDeviceEdit(world: World, edit: DeviceEdit): void {
  if (edit.op === "createDevice") {
    world.devices[edit.id] = withDetails(
      { source: edit.source, role: "external", capabilities: [] },
      edit.details
    );
    return;
  }

  if (!Object.hasOwn(world.devices, edit.id)) throw new Error("Unknown Gaia device");
  const device = world.devices[edit.id]!;
  switch (edit.op) {
    case "updateDevice":
      world.devices[edit.id] = withDetails(device, edit.details);
      break;
    case "mountDevice": {
      const next = { ...device };
      if (edit.mount === null) delete next.mount;
      else next.mount = edit.mount;
      world.devices[edit.id] = next;
      break;
    }
    case "deleteDevice":
      if ((device.mount ?? null) !== edit.mount || (device.hardwareId ?? null) !== edit.hardwareId)
        throw new Error("Confirm the current Gaia device relationships before deleting");
      delete world.devices[edit.id];
      break;
  }
}
