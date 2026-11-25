import { applyDeviceEdit, type DeviceEdit } from "../devices/inventory.ts";
import {
  fromParent,
  nodeAt,
  validateWorld,
  worldPose,
  yaw360,
  type Box,
  type Geometry,
  type Id,
  type Pose,
  type SpatialNode,
  type V2,
  type V3,
  type World,
} from "./world.ts";

type Creation = Pick<SpatialNode, "name" | "parent"> &
  Pose &
  (
    | { kind: "site"; geometry: Extract<Geometry, { kind: "footprint" }> }
    | { kind: "building"; geometry: Box }
    | { kind: "floor"; level: number }
    | { kind: "mount"; geometry: { kind: "point" } }
    | { kind: "route"; geometry: Extract<Geometry, { kind: "path" }> }
  );

export type SiteEdit =
  | DeviceEdit
  | { op: "add"; id: Id; node: Creation }
  | { op: "bindVirtual"; id: Id; mount: Id }
  | { op: "building"; id: Id; pose: Pose; size: V3 }
  | { op: "boundary"; id: Id; ring: V2[] }
  | { op: "elevation"; id: Id; z: number }
  | { op: "point"; id: Id; p: V3 }
  | { op: "path"; id: Id; vertices: V3[] }
  | { op: "reparent"; id: Id; parent: Id; preserve: "world" | "local" }
  | { op: "remove"; ids: Id[]; detach: Id[] };

export interface SiteBatch {
  scope: "site";
  project: Id;
  session: Id;
  baseRevision: number;
  operationId: Id;
  edits: SiteEdit[];
}

export function removalPlan(world: World, id: Id) {
  const ids = [id];
  for (const parent of ids)
    for (const [child, node] of Object.entries(world.nodes))
      if (node.parent === parent) ids.push(child);
  const detach = Object.keys(world.devices).filter((device) =>
    ids.includes(world.devices[device]?.mount ?? "")
  );
  return { ids, detach };
}

function remove(world: World, ids: Id[], detach: Id[]): void {
  const targets = new Set(ids);
  const devices = new Set(detach);
  if (!ids.length || targets.size !== ids.length || devices.size !== detach.length)
    throw new Error("Invalid Gaia removal");
  for (const id of ids) nodeAt(world, id);
  for (const [id, node] of Object.entries(world.nodes)) {
    if (targets.has(id)) continue;
    if (targets.has(node.parent ?? "") || node.zoneIds?.some((zone) => targets.has(zone)))
      throw new Error(`Resolve Gaia relationship with ${id} before deleting`);
  }
  for (const [id, ref] of Object.entries(world.references))
    if (ref.frame !== null && targets.has(ref.frame))
      throw new Error(`Resolve Gaia reference ${id} before deleting`);
  for (const [id, device] of Object.entries(world.devices)) {
    const affected = targets.has(device.mount ?? "");
    if (affected !== devices.delete(id))
      throw new Error(`Confirm Gaia device detachment for ${id}`);
    if (affected) {
      const unmounted = { ...device };
      delete unmounted.mount;
      world.devices[id] = unmounted;
    }
  }
  if (devices.size) throw new Error("Unknown Gaia device detachment");
  for (const id of ids) delete world.nodes[id];
}

function update(
  world: World,
  edit: Exclude<SiteEdit, DeviceEdit | { op: "add" | "remove" | "bindVirtual" }>
): SpatialNode {
  const node = nodeAt(world, edit.id);
  switch (edit.op) {
    case "building":
      if (node.kind === "building")
        return { ...node, ...edit.pose, geometry: { kind: "box", size: edit.size } };
      break;
    case "boundary":
      if (node.kind === "site")
        return { ...node, geometry: { kind: "footprint", ring: edit.ring } };
      break;
    case "elevation":
      if (node.kind === "floor") return { ...node, p: [node.p[0], node.p[1], edit.z] };
      break;
    case "point":
      if (node.kind === "mount") return { ...node, p: edit.p };
      break;
    case "path":
      if (node.kind === "route")
        return { ...node, geometry: { kind: "path", vertices: edit.vertices } };
      break;
    case "reparent": {
      const parent = worldPose(world, edit.parent);
      if (edit.preserve === "local") return { ...node, parent: edit.parent };
      const pose = worldPose(world, edit.id);
      return {
        ...node,
        parent: edit.parent,
        p: fromParent(parent, pose.p),
        yaw: yaw360(pose.yaw - parent.yaw),
      };
    }
  }
  throw new Error(`Incompatible Gaia edit at ${edit.id}`);
}

export function applySiteEdits(world: World, edits: readonly SiteEdit[]): World {
  const candidate = { ...world, nodes: { ...world.nodes }, devices: { ...world.devices } };
  const reserved = new Set([
    ...Object.keys(world.nodes),
    ...Object.keys(world.devices),
    ...Object.keys(world.assets),
    ...Object.keys(world.references),
  ]);
  for (const edit of edits) {
    if (edit.op === "add" || edit.op === "bindVirtual" || edit.op === "createDevice") {
      if (reserved.has(edit.id)) throw new Error(`Gaia ID already exists: ${edit.id}`);
      reserved.add(edit.id);
      if (edit.op === "add") candidate.nodes[edit.id] = { ...edit.node };
      else if (edit.op === "createDevice") applyDeviceEdit(candidate, edit);
      else
        candidate.devices[edit.id] = {
          role: "sensor",
          source: "virtual",
          mount: edit.mount,
          capabilities: ["temperature.read.v1"],
        };
    } else if (edit.op === "remove") remove(candidate, edit.ids, edit.detach);
    else if (edit.op === "updateDevice" || edit.op === "mountDevice" || edit.op === "deleteDevice")
      applyDeviceEdit(candidate, edit);
    else candidate.nodes[edit.id] = update(candidate, edit);
    // Later edits may resolve poses through the new parent chain.
    validateWorld(candidate);
  }
  if (
    JSON.stringify(candidate.nodes) === JSON.stringify(world.nodes) &&
    JSON.stringify(candidate.devices) === JSON.stringify(world.devices)
  )
    return world;
  return candidate;
}
