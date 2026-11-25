import { toParent, worldPose, type Id, type V2, type V3, type World } from "./world.ts";

export function horizontalDistance(a: V3, b: V3): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

export function directDistance(a: V3, b: V3): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
}

export function routeLength(points: readonly V3[]): number {
  return points.slice(1).reduce((sum, point, i) => sum + directDistance(points[i]!, point), 0);
}

export function signedArea(ring: readonly V2[]): number {
  if (ring.length < 3) return 0;
  const [ox, oy] = ring[0]!;
  return (
    ring.reduce((sum, [x, y], i) => {
      const [u, v] = ring[(i + 1) % ring.length]!;
      return sum + (x - ox) * (v - oy) - (y - oy) * (u - ox);
    }, 0) / 2
  );
}

export function objectMeasurements(world: World, id: Id) {
  const pose = worldPose(world, id);
  const geometry = world.nodes[id]?.geometry;
  const result: {
    elevation: number;
    dimensions?: V3;
    area?: number;
    route?: { horizontal: number; direct: number; length: number };
  } = { elevation: pose.p[2] };
  if (geometry?.kind === "box") result.dimensions = geometry.size;
  if (geometry?.kind === "wall")
    result.dimensions = [geometry.length, geometry.thickness, geometry.height];
  if (geometry?.kind === "cylinder")
    result.dimensions = [geometry.radius * 2, geometry.radius * 2, geometry.height];
  if (geometry?.kind === "footprint") result.area = Math.abs(signedArea(geometry.ring));
  if (geometry?.kind === "path") {
    const points = geometry.vertices.map((p) => toParent(pose, p));
    const a = points[0]!;
    const b = points[points.length - 1]!;
    result.route = {
      horizontal: horizontalDistance(a, b),
      direct: directDistance(a, b),
      length: routeLength(points),
    };
  }
  return result;
}
