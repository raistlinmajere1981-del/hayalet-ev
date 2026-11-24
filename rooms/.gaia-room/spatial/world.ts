export type Id = string;
export type V2 = [number, number];
export type V3 = [number, number, number];
export type Wall = { kind: "wall"; length: number; thickness: number; height: number };
export type Box = { kind: "box"; size: V3 };
export type EditableGeometry = Wall | Box;
type Geometry = EditableGeometry | { kind: "point" } | { kind: "footprint"; ring: V2[] };

export interface Pose {
  p: V3;
  yaw: number;
}

export interface SpatialNode extends Pose {
  kind: "site" | "building" | "floor" | "zone" | "object" | "mount";
  name: string;
  parent: Id | null;
  geometry?: Geometry;
  role?: string;
  level?: number;
  zoneIds?: Id[];
  basis?: "measured" | "estimated" | "computed";
  [key: string]: unknown;
}

interface Device {
  role: "router" | "client" | "sensor" | "actuator" | "external";
  source: "virtual" | "physical";
  capabilities: string[];
  mount?: Id;
  hardwareId?: Id;
  [key: string]: unknown;
}

export interface World {
  schemaVersion: 1;
  id: Id;
  revision: number;
  nodes: Record<Id, SpatialNode>;
  devices: Record<Id, Device>;
  assets: Record<Id, { mime: string; pixels?: V2 }>;
  references: Record<Id, { frame: Id; asset: Id; opacity: number }>;
  [key: string]: unknown;
}

const epsilon = 0.000001;
export const close = (a: number, b: number): boolean => Math.abs(a - b) <= epsilon;
export const yaw360 = (angle: number): number => ((angle % 360) + 360) % 360;
export const closeYaw = (a: number, b: number): boolean => close(yaw360(a - b + 180), 180);

function rotate([x, y, z]: V3, yaw: number): V3 {
  const radians = (yaw * Math.PI) / 180;
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return [x * c - y * s + 0, x * s + y * c + 0, z + 0];
}

export function toParent({ p, yaw }: Pose, point: V3): V3 {
  const [x, y, z] = rotate(point, yaw);
  return [p[0] + x, p[1] + y, p[2] + z];
}

export function fromParent({ p, yaw }: Pose, [x, y, z]: V3): V3 {
  return rotate([x - p[0], y - p[1], z - p[2]], -yaw);
}

export function worldPose(world: World, id: Id): Pose {
  const node = nodeAt(world, id);
  if (node.parent === null) return { p: node.p, yaw: node.yaw };
  const parent = worldPose(world, node.parent);
  return { p: toParent(parent, node.p), yaw: yaw360(parent.yaw + node.yaw) };
}

export function nodeAt(world: World, id: Id): SpatialNode {
  const node = Object.hasOwn(world.nodes, id) ? world.nodes[id] : undefined;
  if (!node) throw new Error(`Unknown Gaia node ${id}`);
  return node;
}

export function positive(n: number): boolean {
  return Number.isFinite(n) && n > 0;
}

function validRing(ring: V2[]): boolean {
  const edges = ring.map((point, index) => [point, ring[(index + 1) % ring.length]!] as const);
  const area = edges.reduce((sum, [[x, y], [u, v]]) => sum + x * v - y * u, 0);
  const cross = ([x, y]: V2, [u, v]: V2, [a, b]: V2) => (u - x) * (b - y) - (v - y) * (a - x);
  return (
    ring.length >= 3 &&
    ring.every((point) => point.length === 2 && point.every(Number.isFinite)) &&
    new Set(ring.map((point) => JSON.stringify(point))).size === ring.length &&
    positive(area) &&
    edges.every(([a, b], i) =>
      edges.slice(i + 2).every(([c, d], offset) => {
        if (i === 0 && i + 2 + offset === edges.length - 1) return true;
        const disjoint = ([p, q, r, s]: [number, number, number, number]) =>
          Math.max(p, q) < Math.min(r, s) || Math.max(r, s) < Math.min(p, q);
        return (
          disjoint([a[0], b[0], c[0], d[0]]) ||
          disjoint([a[1], b[1], c[1], d[1]]) ||
          cross(a, b, c) * cross(a, b, d) > 0 ||
          cross(c, d, a) * cross(c, d, b) > 0
        );
      })
    )
  );
}

const profile = {
  site: { parents: [], geometry: ["footprint"] },
  building: { parents: ["site"], geometry: [undefined, "box"] },
  floor: { parents: ["building"], geometry: [undefined, "box"] },
  zone: { parents: ["site", "building", "floor"], geometry: ["footprint"] },
  object: { parents: ["site", "building", "floor", "zone"], geometry: ["wall", "box"] },
  mount: { parents: ["site", "building", "floor", "zone"], geometry: ["point"] },
} satisfies Record<SpatialNode["kind"], { parents: string[]; geometry: (string | undefined)[] }>;

function siteOf(world: World, id: Id, ancestors = new Set<Id>()): Id {
  if (ancestors.has(id)) throw new Error(`Cyclic Gaia parent at ${id}`);
  const { parent } = nodeAt(world, id);
  ancestors.add(id);
  return parent === null ? id : siteOf(world, parent, ancestors);
}

export function validateWorld(world: World): void {
  if (world.schemaVersion !== 1 || !Number.isSafeInteger(world.revision) || world.revision < 0)
    throw new Error("Unsupported Gaia schema or revision");
  const ids = [
    world.id,
    ...Object.keys(world.nodes),
    ...Object.keys(world.devices),
    ...Object.keys(world.assets),
    ...Object.keys(world.references),
  ];
  if (ids.some((id) => !id.trim()) || new Set(ids).size !== ids.length)
    throw new Error("Empty or duplicate Gaia ID");
  const levels = new Set<string>();
  for (const [id, node] of Object.entries(world.nodes)) {
    const rule: { parents: string[]; geometry: (string | undefined)[] } = profile[node.kind];
    const geometry = node.geometry;
    if (
      !rule?.geometry.includes(geometry?.kind) ||
      (node.kind === "site"
        ? node.parent !== null
        : node.parent === null || !rule.parents.includes(nodeAt(world, node.parent).kind))
    )
      throw new Error(`Incompatible Gaia kind, geometry or parent at ${id}`);
    if (
      node.p.length !== 3 ||
      !node.p.every(Number.isFinite) ||
      !Number.isFinite(node.yaw) ||
      node.yaw < 0 ||
      node.yaw >= 360
    )
      throw new Error(`Invalid Gaia pose at ${id}`);
    if (
      (geometry?.kind === "wall" &&
        ![geometry.length, geometry.thickness, geometry.height].every(positive)) ||
      (geometry?.kind === "box" &&
        (geometry.size.length !== 3 || !geometry.size.every(positive))) ||
      (geometry?.kind === "footprint" && !validRing(geometry.ring))
    )
      throw new Error(`Invalid Gaia geometry at ${id}`);
    if (
      node.kind === "object" &&
      ((node.role === "wall" && geometry?.kind !== "wall") ||
        (node.role === "table" && geometry?.kind !== "box"))
    )
      throw new Error(`Incompatible Gaia role at ${id}`);
    const site = siteOf(world, id);
    const zones = node.zoneIds ?? [];
    if (
      new Set(zones).size !== zones.length ||
      zones.some((zone) => nodeAt(world, zone).kind !== "zone" || siteOf(world, zone) !== site)
    )
      throw new Error(`Invalid zone membership at ${id}`);
    if (node.kind === "floor") {
      const key = JSON.stringify([node.parent, node.level]);
      if (!Number.isSafeInteger(node.level) || levels.has(key))
        throw new Error(`Invalid floor level at ${id}`);
      levels.add(key);
    } else if (node.level !== undefined) throw new Error(`Unexpected floor level at ${id}`);
  }
  const hardware = new Set<Id>();
  for (const [id, device] of Object.entries(world.devices)) {
    if (device.mount !== undefined && nodeAt(world, device.mount).kind !== "mount")
      throw new Error(`Invalid device mount at ${id}`);
    if (device.hardwareId !== undefined) {
      if (device.source !== "physical" || hardware.has(device.hardwareId))
        throw new Error(`Invalid hardware binding at ${id}`);
      hardware.add(device.hardwareId);
    }
  }
  for (const [id, reference] of Object.entries(world.references)) {
    nodeAt(world, reference.frame);
    if (
      !Object.hasOwn(world.assets, reference.asset) ||
      !(reference.opacity >= 0 && reference.opacity <= 1)
    )
      throw new Error(`Invalid Gaia reference at ${id}`);
  }
}
