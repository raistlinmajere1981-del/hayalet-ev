import { cssColor, planWall } from "./palette.ts";
import { projectReference } from "../spatial/reference.ts";
import {
  close,
  fromParent,
  nodeAt,
  positive,
  toParent,
  yaw360,
  type EditableGeometry,
  type Id,
  type Pose,
  type V3,
  type World,
} from "../spatial/world.ts";

type Point = { x: number; y: number };
interface WallRow {
  id: Id;
  start: Point;
  end: Point;
  thickness: number;
  height: number;
  startHeight: number;
  endHeight: number;
  color: string;
}
interface TableRow {
  id: Id;
  catalogId: "table";
  position: Point;
  rotation: number;
  scale: { x: number; y: number; z: number };
  width?: number;
  depth?: number;
  height?: number;
  elevation?: number;
}
const fixedCollections = [
  "rooms",
  "doors",
  "windows",
  "stairs",
  "columns",
  "guides",
  "measurements",
  "annotations",
  "textAnnotations",
  "groups",
] as const;
type FixedCollection = (typeof fixedCollections)[number];
interface PlanFloor extends Record<FixedCollection, []> {
  id: Id;
  name: string;
  level: number;
  elevation: number;
  walls: WallRow[];
  furniture: TableRow[];
}
export interface Plan {
  id: Id;
  name: string;
  activeFloorId: Id;
  createdAt: Date;
  updatedAt: Date;
  floors: PlanFloor[];
}
export type Collection = "walls" | "furniture";
type PlanShape = Pose & { geometry: EditableGeometry; wallEnd?: V3 };

export interface PlanObject extends PlanShape {
  key: string;
  editorId: Id;
  floor: Id;
  collection: Collection;
}

const wallColor = cssColor(planWall);
const planPoint = ([x, y]: V3): Point => ({ x: x * 100, y: -y * 100 + 0 });
const fromPlan = ({ x, y }: Point, z: number): V3 => [x / 100, -y / 100, z];
export const objectKey = (floor: Id, collection: Collection, id: Id): string =>
  JSON.stringify([floor, collection, id]);

export function floorId(id: Id): Id {
  return `f-${id}`;
}

export function interiorReferences(world: World, building: Id, activeFloorId?: Id) {
  const floor = Object.keys(world.nodes).find((id) => floorId(id) === activeFloorId);
  if (!floor) return [];
  const floorNode = nodeAt(world, floor);
  if (floorNode.kind !== "floor" || floorNode.parent !== building) return [];
  const frames = new Set<Id | null>([null, floor, building]);
  let parent = nodeAt(world, building).parent;
  while (parent !== null) {
    frames.add(parent);
    parent = nodeAt(world, parent).parent;
  }
  for (const [id, node] of Object.entries(world.nodes))
    if (node.kind === "zone" && node.parent === floor) frames.add(id);

  return Object.entries(world.references).flatMap(([id, layer]) => {
    if (layer.visible === false || !frames.has(layer.frame)) return [];
    const projected = projectReference(world, layer, floor);
    if (!projected) return [];
    // The editor draws each floor in building XY and keeps the floor height separately.
    const origin = planPoint(toParent(floorNode, projected.origin));
    return [
      {
        id,
        asset: layer.asset,
        opacity: layer.opacity,
        x: origin.x,
        y: origin.y,
        width: projected.pixels[0] * projected.scale * 100,
        height: projected.pixels[1] * projected.scale * 100,
        rotation: -yaw360(projected.yaw + floorNode.yaw),
      },
    ];
  });
}

export function projectWorld(
  world: World,
  building: Id,
  editorId: (floor: Id, collection: Collection, id: Id) => Id = (_, __, id) => `e-${id}`,
  activeFloor?: Id
): { plan: Plan; ids: Map<string, Id>; readOnly: Id[] } {
  const buildingNode = nodeAt(world, building);
  if (buildingNode.kind !== "building") throw new Error(`Not a Gaia building: ${building}`);
  const ids = new Map<string, Id>();
  const floors: PlanFloor[] = [];
  const readOnly: Id[] = [];
  for (const [id, floor] of Object.entries(world.nodes)) {
    if (floor.kind !== "floor" || floor.parent !== building) continue;
    const view: PlanFloor = {
      id: floorId(id),
      name: floor.name,
      level: floor.level!,
      elevation: floor.p[2] * 100,
      walls: [],
      furniture: [],
      rooms: [],
      doors: [],
      windows: [],
      stairs: [],
      columns: [],
      guides: [],
      measurements: [],
      annotations: [],
      textAnnotations: [],
      groups: [],
    };
    for (const [gaiaId, node] of Object.entries(world.nodes)) {
      if (node.parent !== id) continue;
      const geometry = node.geometry;
      const p = toParent(floor, node.p);
      const yaw = yaw360(floor.yaw + node.yaw);
      if (
        node.kind === "object" &&
        node.role === "wall" &&
        geometry?.kind === "wall" &&
        node.p[2] === 0
      ) {
        const collection = "walls";
        const rowId = editorId(id, collection, gaiaId);
        view.walls.push({
          id: rowId,
          start: planPoint(p),
          end: planPoint(toParent({ p, yaw }, [geometry.length, 0, 0])),
          thickness: geometry.thickness * 100,
          height: geometry.height * 100,
          startHeight: geometry.height * 100,
          endHeight: geometry.height * 100,
          color: wallColor,
        });
        ids.set(objectKey(id, collection, rowId), gaiaId);
      } else if (
        node.kind === "object" &&
        node.role === "table" &&
        geometry?.kind === "box" &&
        node.p[2] >= 0 &&
        node.p[2] <= 100
      ) {
        const collection = "furniture";
        const rowId = editorId(id, collection, gaiaId);
        const [width, depth, height] = geometry.size;
        view.furniture.push({
          id: rowId,
          catalogId: "table",
          position: planPoint(p),
          rotation: yaw360(-yaw),
          width: width * 100,
          depth: depth * 100,
          height: height * 100,
          elevation: node.p[2] * 100,
          scale: { x: 1, y: 1, z: 1 },
        });
        ids.set(objectKey(id, collection, rowId), gaiaId);
      } else {
        readOnly.push(gaiaId);
      }
    }
    floors.push(view);
  }
  floors.sort((a, b) => a.level - b.level);
  const first = floors[0];
  if (!first) throw new Error(`No Gaia floor for ${building}`);
  return {
    ids,
    readOnly,
    plan: {
      id: world.id,
      name: buildingNode.name,
      floors,
      activeFloorId: floors.some((floor) => floor.id === activeFloor) ? activeFloor! : first.id,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    },
  };
}

function allowFields(value: unknown, fields: readonly string[], path: string): void {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${path}: expected a record`);
  for (const field of Object.keys(value)) {
    if (!fields.includes(field)) throw new Error(`${path}.${field}: unsupported field`);
  }
}

function checkPoint(value: Point, path: string): void {
  allowFields(value, ["x", "y"], path);
  if (![value.x, value.y].every(Number.isFinite)) throw new Error(`${path}: invalid point`);
}

function readWall(row: WallRow, floor: Pose, path: string): PlanShape {
  allowFields(
    row,
    ["id", "start", "end", "thickness", "height", "startHeight", "endHeight", "color"],
    path
  );
  checkPoint(row.start, `${path}.start`);
  checkPoint(row.end, `${path}.end`);
  const dx = (row.end.x - row.start.x) / 100;
  const dy = (row.start.y - row.end.y) / 100;
  const length = Math.hypot(dx, dy);
  if (!positive(length) || close(length, 0))
    throw new Error(`${path}.end: coincident wall endpoints`);
  if (row.color !== wallColor) throw new Error(`${path}.color: unsupported wall finish`);
  if (!positive(row.thickness)) throw new Error(`${path}.thickness: expected a positive value`);
  if (!positive(row.height) || row.startHeight !== row.height || row.endHeight !== row.height)
    throw new Error(`${path}.height: expected a positive, uniform wall height`);
  return {
    p: fromParent(floor, fromPlan(row.start, floor.p[2])),
    wallEnd: fromParent(floor, fromPlan(row.end, floor.p[2])),
    yaw: yaw360((Math.atan2(dy, dx) * 180) / Math.PI - floor.yaw),
    geometry: { kind: "wall", length, thickness: row.thickness / 100, height: row.height / 100 },
  };
}

function tableSize(row: TableRow): V3 {
  return [
    (row.width ?? 100) * row.scale.x,
    (row.depth ?? 60) * row.scale.y,
    (row.height ?? 75) * row.scale.z,
  ];
}

function readTable(row: TableRow, floor: Pose, path: string): PlanShape {
  allowFields(
    row,
    ["id", "catalogId", "position", "rotation", "scale", "width", "depth", "height", "elevation"],
    path
  );
  if (row.catalogId !== "table") throw new Error(`${path}.catalogId: only the table is editable`);
  checkPoint(row.position, `${path}.position`);
  allowFields(row.scale, ["x", "y", "z"], `${path}.scale`);
  if (![row.scale.x, row.scale.y, row.scale.z].every(positive))
    throw new Error(`${path}.scale: only finite positive scale is allowed`);
  for (const key of ["width", "depth", "height"] as const) {
    const value = row[key];
    if (value !== undefined && !positive(value))
      throw new Error(`${path}.${key}: invalid dimension`);
  }
  const [width, depth, height] = tableSize(row);
  if (![width, depth, height].every(positive))
    throw new Error(`${path}.size: invalid effective dimensions`);
  const elevation = row.elevation === undefined ? 0 : row.elevation;
  if (!(Number.isFinite(elevation) && elevation >= 0 && elevation <= 10_000))
    throw new Error(`${path}.elevation: out of range`);
  if (!Number.isFinite(row.rotation)) throw new Error(`${path}.rotation: expected a finite angle`);
  const p = fromParent(floor, fromPlan(row.position, floor.p[2] + elevation / 100));
  p[2] = elevation / 100;
  return {
    p,
    yaw: yaw360(-row.rotation - floor.yaw),
    geometry: { kind: "box", size: [width / 100, depth / 100, height / 100] },
  };
}

/** The raw policy runs before upstream can populate defaults or repair any fields. */
export function inspectPlan(
  snapshot: unknown,
  baseline: Plan,
  world: World,
  building: Id
): Map<string, PlanObject> {
  allowFields(
    snapshot,
    ["id", "name", "activeFloorId", "createdAt", "updatedAt", "floors"],
    "project"
  );
  const raw = snapshot as Plan;
  if (
    raw.id !== baseline.id ||
    raw.name !== baseline.name ||
    +raw.createdAt !== +baseline.createdAt
  )
    throw new Error("project: changed project identity or metadata");
  if (!Array.isArray(raw.floors) || raw.floors.length !== baseline.floors.length)
    throw new Error("floors: a complete building snapshot is required");
  if (!baseline.floors.some((floor) => floor.id === raw.activeFloorId))
    throw new Error("activeFloorId: unknown floor");
  const baselineFloors = new Map(baseline.floors.map((floor) => [floor.id, floor]));
  const gaiaFloors = new Map(
    Object.entries(world.nodes)
      .filter(([, node]) => node.kind === "floor" && node.parent === building)
      .map(([id, node]) => [floorId(id), { id, node }])
  );
  const seen = new Set<Id>();
  const objects = new Map<string, PlanObject>();
  for (const floor of raw.floors) {
    allowFields(
      floor,
      ["id", "name", "level", "elevation", "walls", "furniture", ...fixedCollections],
      floor?.id ?? "floor"
    );
    const baselineFloor = baselineFloors.get(floor.id);
    const gaiaFloor = gaiaFloors.get(floor.id);
    if (!baselineFloor || !gaiaFloor || !baselineFloors.delete(floor.id))
      throw new Error(`${floor.id}: unknown or duplicate floor`);
    for (const key of ["name", "level", "elevation"] as const) {
      if (floor[key] !== baselineFloor[key])
        throw new Error(`${floor.id}.${key}: floor editing is disabled`);
    }
    for (const key of fixedCollections) {
      if (!Array.isArray(floor[key]) || floor[key].length !== 0)
        throw new Error(`${floor.id}.${key}: editing this collection is disabled`);
    }
    const readRows = <Row extends { id: Id }>(
      collection: Collection,
      rows: Row[],
      decode: (row: Row, floor: Pose, path: string) => PlanShape
    ) => {
      if (!Array.isArray(rows)) throw new Error(`${floor.id}.${collection}: missing collection`);
      for (const row of rows) {
        const path = `${floor.id}.${collection}.${row?.id ?? "?"}`;
        if (typeof row?.id !== "string" || !row.id.trim() || seen.has(row.id))
          throw new Error(`${path}: invalid or duplicate editor ID`);
        const key = objectKey(gaiaFloor.id, collection, row.id);
        seen.add(row.id);
        objects.set(key, {
          key,
          editorId: row.id,
          floor: gaiaFloor.id,
          collection,
          ...decode(row, gaiaFloor.node, path),
        });
      }
    };
    readRows("walls", floor.walls, readWall);
    readRows("furniture", floor.furniture, readTable);
  }
  return objects;
}
