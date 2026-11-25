import {
  nodeAt,
  siteOf,
  toParent,
  worldPose,
  type Id,
  type Pose,
  type SpatialNode,
  type V3,
  type World,
} from "../../spatial/world.ts";

export interface Bounds {
  min: V3;
  max: V3;
}
type Shape =
  | { kind: "area"; ring: V3[] }
  | { kind: "box"; size: V3; shell: boolean }
  | { kind: "cylinder"; radius: number; height: number }
  | { kind: "point" }
  | { kind: "path"; segments: [V3, V3][] };

export interface SpatialItem {
  id: Id;
  node: SpatialNode;
  pose: Pose;
  shape: Shape;
  bounds: Bounds;
  color: number;
  below: boolean;
  ground: number;
}

function clip(a: V3, b: V3, ground: number): [V3, V3][] {
  if (a[2] >= ground && b[2] >= ground) return [[a, b]];
  if (a[2] <= ground && b[2] <= ground) return [];
  const ratio = (ground - a[2]) / (b[2] - a[2]);
  const cut: V3 = [a[0] + ratio * (b[0] - a[0]), a[1] + ratio * (b[1] - a[1]), ground];
  return [a[2] >= ground ? [a, cut] : [cut, b]];
}

export function boxRing(pose: Pose, [w, d]: V3): V3[] {
  return [
    [-w / 2, -d / 2, 0],
    [w / 2, -d / 2, 0],
    [w / 2, d / 2, 0],
    [-w / 2, d / 2, 0],
  ].map((point) => toParent(pose, point as V3));
}

export function boundsOf(points: V3[]): Bounds {
  const min: V3 = [...points[0]!];
  const max: V3 = [...min];
  for (const point of points) {
    for (const axis of [0, 1, 2] as const) {
      min[axis] = Math.min(min[axis], point[axis]);
      max[axis] = Math.max(max[axis], point[axis]);
    }
  }
  return { min, max };
}

export function frame(items: SpatialItem[], id?: Id): Bounds {
  const item = items.find((item) => item.id === id);
  const selected = item ? [item] : items;
  return selected.length
    ? boundsOf(selected.flatMap(({ bounds }) => [bounds.min, bounds.max]))
    : { min: [-5, -5, 0], max: [5, 5, 0] };
}

const colors = {
  site: 0x73948c,
  building: 0x528eaa,
  floor: 0x76a9bd,
  zone: 0x73a878,
  object: 0xb1864c,
  mount: 0x10a699,
  route: 0x496dec,
};

export const deviceColor = (state?: string) =>
  state === "online" ? 0x10a699 : state === "offline" ? 0xcf7152 : 0x80929b;

const order = { site: 0, zone: 1, building: 2, floor: 3, object: 4, route: 5, mount: 6 };

export function spatialScene(
  world: World,
  hidden: ReadonlySet<Id>,
  underground: boolean
): SpatialItem[] {
  const entries = Object.entries(world.nodes);
  const poses = new Map(entries.map(([id]) => [id, worldPose(world, id)]));
  const floorParents = new Set(
    entries.filter(([, node]) => node.kind === "floor").map(([, node]) => node.parent)
  );
  const items: SpatialItem[] = [];
  for (const [id, node] of entries) {
    const pose = poses.get(id)!;
    const ground = poses.get(siteOf(world, id))!.p[2];
    let ancestor: Id | null = id;
    while (ancestor !== null) {
      const current = nodeAt(world, ancestor);
      if (
        hidden.has(ancestor) ||
        (!underground && current.kind === "floor" && poses.get(ancestor)!.p[2] < ground)
      )
        break;
      ancestor = current.parent;
    }
    if (ancestor !== null) continue;

    const geometry = node.geometry;
    let shape: Shape;
    let points: V3[];
    const color =
      node.kind === "route" && node.role === "electricity" ? 0xc79236 : colors[node.kind];
    if (geometry?.kind === "path") {
      const vertices = geometry.vertices.map((point) => toParent(pose, point));
      const segments = vertices
        .slice(1)
        .flatMap((b, i): [V3, V3][] =>
          underground ? [[vertices[i]!, b]] : clip(vertices[i]!, b, ground)
        );
      if (!segments.length) continue;
      shape = { kind: "path", segments };
      points = segments.flat();
    } else if (geometry?.kind === "footprint") {
      if (!underground && pose.p[2] < ground) continue;
      points = geometry.ring.map(([x, y]) => toParent(pose, [x, y, 0]));
      shape = { kind: "area", ring: points };
    } else if (geometry?.kind === "cylinder") {
      const top = pose.p[2] + geometry.height;
      if (!underground && top <= ground) continue;
      const [x, y, z] = pose.p;
      const base = underground ? z : Math.max(z, ground);
      const r = geometry.radius;
      shape = { kind: "cylinder", radius: r, height: top - base };
      points = [
        [x - r, y - r, base],
        [x + r, y + r, top],
      ];
    } else {
      const parentGeometry = node.parent === null ? undefined : nodeAt(world, node.parent).geometry;
      const size: V3 | undefined =
        geometry?.kind === "box"
          ? geometry.size
          : geometry?.kind === "wall"
            ? [geometry.length, geometry.thickness, geometry.height]
            : node.kind === "floor" && parentGeometry?.kind === "box"
              ? [parentGeometry.size[0], parentGeometry.size[1], 0.1]
              : undefined;
      if (!size) {
        if (!underground && pose.p[2] < ground) continue;
        shape = { kind: "point" };
        points = [pose.p];
      } else {
        const base = geometry?.kind === "wall" ? toParent(pose, [size[0] / 2, 0, 0]) : pose.p;
        const top = base[2] + size[2];
        if (!underground && top <= ground) continue;
        const z = underground ? base[2] : Math.max(base[2], ground);
        const shell = node.kind === "building" && floorParents.has(id);
        const clipped: V3 = [size[0], size[1], top - z];
        shape = { kind: "box", size: clipped, shell };
        const ring = boxRing({ ...pose, p: [base[0], base[1], z] }, clipped);
        points = [...ring, ...ring.map(([x, y]): V3 => [x, y, top])];
        items.push({
          id,
          node,
          pose: { ...pose, p: [base[0], base[1], z] },
          shape,
          bounds: boundsOf(points),
          color,
          ground,
          below: base[2] < ground,
        });
        continue;
      }
    }
    const bounds = boundsOf(points);
    items.push({
      id,
      node,
      pose:
        shape.kind === "cylinder" ? { ...pose, p: [pose.p[0], pose.p[1], bounds.min[2]] } : pose,
      shape,
      bounds,
      color,
      ground,
      below: bounds.min[2] < ground,
    });
  }
  return items.sort((a, b) => order[a.node.kind] - order[b.node.kind] || a.pose.p[2] - b.pose.p[2]);
}
