import {
  close,
  closeYaw,
  nodeAt,
  validateWorld,
  type EditableGeometry,
  type Id,
  type Pose,
  type V3,
  type World,
} from "../spatial/world.ts";
import { inspectPlan, projectWorld, type PlanObject } from "./projection.ts";

export type MutationIntent =
  { kind: "create" | "remove"; ids: readonly Id[] } | { kind: "history" };
type Edit =
  | ({ op: "create"; id: Id; floor: Id; geometry: EditableGeometry } & Pose)
  | ({ op: "pose"; id: Id } & Pose)
  | { op: "geometry"; id: Id; geometry: EditableGeometry }
  | { op: "remove"; id: Id };

export interface EditBatch {
  project: Id;
  building: Id;
  session: Id;
  baseRevision: number;
  operationId: Id;
  edits: Edit[];
}

const closePoint = (a: V3, b: V3): boolean => a.every((n, i) => close(n, b[i]!));
const preservePoint = (a: V3, b: V3): V3 => [
  close(a[0], b[0]) ? a[0] : b[0],
  close(a[1], b[1]) ? a[1] : b[1],
  close(a[2], b[2]) ? a[2] : b[2],
];

function preserveGeometry(a: EditableGeometry, b: EditableGeometry): EditableGeometry {
  if (a.kind === "box" && b.kind === "box") return { ...a, size: preservePoint(a.size, b.size) };
  if (a.kind === "wall" && b.kind === "wall") {
    return {
      ...a,
      length: close(a.length, b.length) ? a.length : b.length,
      thickness: close(a.thickness, b.thickness) ? a.thickness : b.thickness,
      height: close(a.height, b.height) ? a.height : b.height,
    };
  }
  throw new Error("Gaia geometry kind changed");
}

function sameGeometry(a: EditableGeometry, b: EditableGeometry): boolean {
  if (a.kind === "box" && b.kind === "box") return closePoint(a.size, b.size);
  return (
    a.kind === "wall" &&
    b.kind === "wall" &&
    close(a.length, b.length) &&
    close(a.thickness, b.thickness) &&
    close(a.height, b.height)
  );
}

function applyBatch(world: World, batch: EditBatch, scope: ReadonlyMap<Id, PlanObject>): World {
  if (batch.project !== world.id || batch.baseRevision !== world.revision)
    throw new Error("Gaia revision changed. Reopen the saved model before editing again.");
  if (!batch.edits.length) return world;
  const nodes = { ...world.nodes };
  for (const edit of batch.edits) {
    const target = scope.get(edit.id);
    if (!target || nodeAt(world, target.floor).parent !== batch.building)
      throw new Error(`Out-of-scope Gaia ID: ${edit.id}`);
    if (edit.op === "create") {
      if (
        Object.hasOwn(nodes, edit.id) ||
        target.floor !== edit.floor ||
        target.geometry.kind !== edit.geometry.kind
      )
        throw new Error(`Invalid Gaia creation: ${edit.id}`);
      const wall = edit.geometry.kind === "wall";
      nodes[edit.id] = {
        kind: "object",
        role: wall ? "wall" : "table",
        name: wall ? "Wall" : "Table",
        parent: edit.floor,
        p: edit.p,
        yaw: edit.yaw,
        geometry: edit.geometry,
      };
      continue;
    }

    const node = nodeAt({ ...world, nodes }, edit.id);
    if (node.parent !== target.floor || node.geometry?.kind !== target.geometry.kind)
      throw new Error(`Gaia identity moved outside its scope: ${edit.id}`);
    if (edit.op === "pose") {
      nodes[edit.id] = {
        ...node,
        p: preservePoint(node.p, edit.p),
        yaw: closeYaw(node.yaw, edit.yaw) ? node.yaw : edit.yaw,
      };
    } else if (edit.op === "geometry") {
      const geometry = node.geometry as EditableGeometry;
      nodes[edit.id] = { ...node, geometry: preserveGeometry(geometry, edit.geometry) };
    } else {
      const dependants = [
        ...(node.zoneIds ?? []),
        ...Object.keys(world.nodes).filter(
          (id) => world.nodes[id]?.parent === edit.id || world.nodes[id]?.zoneIds?.includes(edit.id)
        ),
        ...Object.keys(world.devices).filter((id) => world.devices[id]?.mount === edit.id),
        ...Object.keys(world.references).filter((id) => world.references[id]?.frame === edit.id),
      ];
      if (dependants.length)
        throw new Error(
          `${edit.id}: resolve Gaia relationships with ${dependants.join(", ")} before deleting`
        );
      delete nodes[edit.id];
    }
  }
  const candidate = { ...world, revision: world.revision + 1, nodes };
  validateWorld(candidate);
  return candidate;
}

export function openSession(
  world: World,
  building: Id,
  activeFloor?: Id,
  previousIds = new Map<string, Id>()
) {
  validateWorld(world);
  const editorByGaia = new Map(
    [...previousIds].map(([key, gaiaId]) => [gaiaId, (JSON.parse(key) as [Id, string, Id])[2]])
  );
  const initial = projectWorld(
    world,
    building,
    (_, __, id) => editorByGaia.get(id) ?? `e-${id}`,
    activeFloor
  );
  const baseline = inspectPlan(initial.plan, initial.plan, world, building);
  const identities = new Map(initial.ids);
  const allocated = new Set([
    world.id,
    ...Object.keys(world.nodes),
    ...Object.keys(world.devices),
    ...Object.keys(world.assets),
    ...Object.keys(world.references),
  ]);
  const session = crypto.randomUUID();
  let activeKeys = new Set(baseline.keys());

  const read = (snapshot: unknown) => inspectPlan(snapshot, initial.plan, world, building);

  function authorize(before: unknown, next: unknown, intent?: MutationIntent): void {
    const oldRows = read(before);
    const newRows = read(next);
    const added = [...newRows.values()].filter((row) => !oldRows.has(row.key));
    const removed = [...oldRows.values()].filter((row) => !newRows.has(row.key));
    if (intent?.kind === "history") {
      if (added.some((row) => !identities.has(row.key)))
        throw new Error("History contains an unbound editor identity");
    } else {
      const oldOrder = [...oldRows.keys()].filter((key) => newRows.has(key));
      const newOrder = [...newRows.keys()].filter((key) => oldRows.has(key));
      if (oldOrder.some((key, index) => key !== newOrder[index]))
        throw new Error("Reordering editor objects is disabled");
      const declared = new Set(intent?.ids);
      const matches = (rows: PlanObject[], kind: "create" | "remove") =>
        rows.length === (intent?.kind === kind ? declared.size : 0) &&
        rows.every((row) => declared.has(row.editorId));
      if (!matches(added, "create") || !matches(removed, "remove"))
        throw new Error("Editor creation or deletion lacks an explicit Gaia intent");
      const usedEditorIds = new Set(
        [...identities.keys()].map((key) => (JSON.parse(key) as [Id, string, Id])[2])
      );
      if (added.some((row) => usedEditorIds.has(row.editorId)))
        throw new Error("Editor identity was reused or moved");
      for (const row of added) {
        let gaiaId: Id;
        do {
          gaiaId = crypto.randomUUID();
        } while (allocated.has(gaiaId));
        allocated.add(gaiaId);
        identities.set(row.key, gaiaId);
      }
    }
    activeKeys = new Set(newRows.keys());
  }

  function prepareSave(
    snapshot: unknown,
    currentWorld: World,
    normalize: (raw: unknown) => unknown
  ) {
    const rawRows = read(snapshot);
    if (rawRows.size !== activeKeys.size || [...rawRows.keys()].some((key) => !activeKeys.has(key)))
      throw new Error("Snapshot membership differs from the accepted editor actions");
    const rows = read(normalize(snapshot));
    verifyProjection(rawRows, rows);
    const edits: Edit[] = [];
    const scope = new Map<Id, PlanObject>();
    for (const [key, previous] of baseline) {
      const id = identities.get(key)!;
      scope.set(id, previous);
      if (!rows.has(key)) edits.push({ op: "remove", id });
    }
    for (const [key, row] of rows) {
      const id = identities.get(key)!;
      const { floor, p, yaw, geometry } = row;
      scope.set(id, row);
      if (!baseline.has(key)) {
        edits.push({ op: "create", id, floor, p, yaw, geometry });
        continue;
      }
      const node = nodeAt(world, id);
      if (!closePoint(node.p, p) || !closeYaw(node.yaw, yaw))
        edits.push({ op: "pose", id, p, yaw });
      if (!sameGeometry(node.geometry as EditableGeometry, geometry))
        edits.push({ op: "geometry", id, geometry });
    }
    const batch = {
      project: world.id,
      building,
      session,
      baseRevision: world.revision,
      operationId: crypto.randomUUID(),
      edits,
    };
    const candidate = applyBatch(currentWorld, batch, scope);
    const next = openSession(
      candidate,
      building,
      (snapshot as { activeFloorId: Id }).activeFloorId,
      identities
    );
    verifyProjection(rows, inspectPlan(next.plan, next.plan, candidate, building));
    return { candidate, batch, next };
  }

  return { plan: initial.plan, readOnly: initial.readOnly, authorize, prepareSave };
}

function verifyProjection(
  expected: ReadonlyMap<string, PlanObject>,
  actual: ReadonlyMap<string, PlanObject>
): void {
  if (actual.size !== expected.size) throw new Error("Projection lost or added editor objects");
  for (const row of expected.values()) {
    const other = actual.get(row.key);
    if (
      !other ||
      !closePoint(row.p, other.p) ||
      !closeYaw(row.yaw, other.yaw) ||
      !sameGeometry(row.geometry, other.geometry) ||
      (row.wallEnd !== undefined && (!other.wallEnd || !closePoint(row.wallEnd, other.wallEnd)))
    )
      throw new Error(`${row.editorId}: projection could not preserve its geometry and pose`);
  }
}
