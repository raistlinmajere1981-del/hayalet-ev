<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import type en from "../../../i18n/en.json";
  import {
    removalPlan,
    type SiteBatch,
    type SiteEdit,
  } from "../../spatial/site-edits.ts";
  import {
    fromParent,
    siteOf,
    toParent,
    worldPose,
    type Id,
    type V2,
    type V3,
  } from "../../spatial/world.ts";
  import {
    projectReference,
    referenceFrame,
    referencePoint,
    type ReferenceProjection,
  } from "../../spatial/reference.ts";
  import { signedArea } from "../../spatial/measurements.ts";
  import type { ReferenceBatch, ReferenceEdit } from "../../storage/reference-contract.ts";
  import { command, UnconfirmedCommand, type Opened, type Saved } from "../client.ts";
  import { referenceImages } from "../reference-images.svelte.ts";
  import { calibrationDraft, calibrationValue, markCalibrationPoint, type CalibrationDraft } from "./calibration.ts";
  import CalibrationImage from "./CalibrationImage.svelte";
  import { commitDraft } from "./draft.ts";
  import { describeError } from "./errors.ts";
  import { revealSelection, type LayerKind } from "./framing.ts";
  import { StatusSession, nextFreshnessDeadline } from "./status-session.ts";
  import Measurements from "./Measurements.svelte";
  import References from "./References.svelte";
  import Layers from "./Layers.svelte";
  import Orbit from "./Orbit.svelte";
  import Plan from "./Plan.svelte";
  import Properties from "./Properties.svelte";
  import Overview from "./Overview.svelte";
  import { deviceMarkers, spatialScene } from "./scene.ts";
  import {
    deviceHealth,
    visibleStatuses,
    type DeviceStatuses,
    type StatusSnapshot,
  } from "../../devices/status.ts";
  import { deviceName, mountPath, type DeviceEdit } from "../../devices/inventory.ts";
  import type { VirtualUpdate } from "../../devices/status.ts";
  import { healthLabel, type DeviceBadge } from "./device-view.ts";
  import "./workspace.css";

  let {
    opened,
    labels,
    storageLabels,
    visible,
    startEditing,
    initialSelection,
    locale,
    onsave,
    onreopen,
    oninterior,
    onprojects,
    onclose,
  }: {
    opened: Opened;
    labels: typeof en.site;
    storageLabels: typeof en.workshop;
    visible: boolean;
    startEditing: boolean;
    initialSelection?: Id;
    locale: string;
    onsave: (batch: SiteBatch | ReferenceBatch, retry: boolean) => Promise<Saved>;
    onreopen: () => Promise<Opened>;
    oninterior: (id: Id) => Promise<void>;
    onprojects: () => void;
    onclose: () => void;
  } = $props();

  let draft = $state.raw(untrack(() => opened.world));
  let selected = $state<Id | undefined>(
    untrack(
      () =>
        initialSelection ??
        Object.keys(opened.world.nodes).find((id) => opened.world.nodes[id]?.kind === "site")
    )
  );
  let editable = $state(untrack(() => startEditing));
  let three = $state(false);
  let webgl = $state(true);
  let underground = $state(false);
  let hidden = $state.raw<ReadonlySet<Id>>(new Set());
  let focus = $state.raw<{ id?: Id }>({});
  let statusSnapshot = $state.raw<StatusSnapshot>();
  let statusBusy = $state(false);
  let statusError = $state(false);
  let creatingDevice = $state(false);
  let deviceDeletion = $state.raw<Extract<DeviceEdit, { op: "deleteDevice" }>>();
  let placingDevice = $state<Id>();
  let placementFrame = $state<Id>();
  let revealed = $state(false);
  const layerKinds: LayerKind[] = [
    "site",
    "building",
    "floor",
    "zone",
    "object",
    "mount",
    "route",
    "device",
  ];
  let hiddenKinds = $state.raw<ReadonlySet<LayerKind>>(new Set());
  let now = $state(Date.now());
  let edits = $state.raw<SiteEdit[]>([]);
  let pending = $state.raw<SiteBatch | ReferenceBatch>();
  let saving = $state(false);
  let error = $state("");
  let leave = $state.raw<() => void | Promise<void>>();
  let deletion = $state.raw<ReturnType<typeof removalPlan>>();
  let tool = $state<"site" | "building" | "mount" | "route">();
  let anchor = $state<Id>();
  let working = $state.raw<V3[]>([]);
  let z = $state(0);
  let referencePanel = $state(false);
  let selectedReference = $state<Id>();
  let calibration = $state<CalibrationDraft>();
  let measuring = $state(false);
  let measurementMode = $state<"points" | "route">("points");
  let measurementZ = $state<number | undefined>(0);
  let measurement = $state.raw<V3[]>([]);
  let disposed = false;
  const status = new StatusSession({
    read: async ({ project, session, update }) => {
      const result = await command<{ statuses: DeviceStatuses; revision: number }>("GaiaStatus", {
        project,
        session,
        ...(update ? { update } : {}),
      });
      return { statuses: result.statuses ?? {}, revision: result.revision };
    },
    active: () => visible && !disposed,
    now: () => Date.now(),
    busy: (value) => (statusBusy = value),
    error: (value) => (statusError = value),
    observed: (value) => (now = value),
    snapshot: (value) => (statusSnapshot = value),
  });
  onDestroy(() => {
    disposed = true;
  });

  const dirty = $derived(draft !== opened.world || !!working.length || !!pending);
  const blocked = $derived(saving || !!pending || !!leave || !!deletion || !!deviceDeletion);
  const spatialItems = $derived(spatialScene(draft, hidden, underground));
  const items = $derived(
    editable
      ? spatialItems
      : [
          ...spatialItems.filter(({ node }) => !hiddenKinds.has(node.kind)),
          ...(hiddenKinds.has("device") ? [] : deviceMarkers(draft, spatialItems)),
        ]
  );
  const visibleIds = $derived(new Set(items.map(({ id }) => id)));
  const placementAreas = $derived(
    Object.keys(draft.nodes).filter((id) => {
      const kind = draft.nodes[id]?.kind;
      return kind === "site" || kind === "building" || kind === "floor" || kind === "zone";
    })
  );
  const selectedNode = $derived(selected ? draft.nodes[selected] : undefined);
  const site = $derived(
    selectedNode && selected
      ? siteOf(draft, selected)
      : Object.keys(draft.nodes).find((id) => draft.nodes[id]?.kind === "site")
  );
  const frameId = $derived(
    selectedNode && ["site", "building", "floor", "zone"].includes(selectedNode.kind)
      ? selected
      : site
  );
  const reference = $derived(selectedReference ? draft.references[selectedReference] : undefined);
  const referenceAsset = $derived(reference ? draft.assets[reference.asset] : undefined);
  const candidate = $derived(calibrationValue(calibration, referenceAsset?.pixels));
  const unavailableAssets = $derived(new Set([...opened.missing, ...(opened.damaged ?? [])]));
  const layers = $derived(
    Object.entries(draft.references).filter(
      ([id, layer]) =>
        (layer.visible !== false || (id === selectedReference && !!calibration?.view)) &&
        (layer.frame === null ||
          spatialItems.some(({ id }) => id === layer.frame) ||
          (id === selectedReference && !!calibration)) &&
        !unavailableAssets.has(layer.asset)
    )
  );
  const imageSource = referenceImages(() => ({
    project: opened.world.id,
    session: opened.session,
    assets: visible
      ? [
          ...layers
            .filter(([, layer]) => !three && !!layer.calibration)
            .map(([, layer]) => layer.asset),
          ...(referencePanel && reference && !unavailableAssets.has(reference.asset)
            ? [reference.asset]
            : []),
        ]
      : [],
  }));
  const currentSource = $derived(reference ? imageSource(reference.asset) : undefined);
  const planLayers = $derived.by(() => {
    const images: { id: Id; projection: ReferenceProjection; opacity: number; source?: string }[] =
      [];
    for (const [id, layer] of layers) {
      const preview = id === selectedReference && calibration?.view !== "pixels" && candidate;
      const view = projectReference(draft, preview ? { ...layer, calibration: candidate } : layer);
      const source = imageSource(layer.asset);
      if (view && source !== null)
        images.push({
          id,
          projection: view,
          source,
          opacity: preview ? Math.max(layer.opacity, 0.55) : layer.opacity,
        });
    }
    return images;
  });
  const calibrationGuide = $derived.by(() => {
    const projected = planLayers.find((layer) => layer.id === selectedReference)?.projection;
    return projected && candidate && calibration?.view !== "pixels"
      ? candidate.pixels.map((point) => referencePoint(projected, point))
      : [];
  });

  const project = $derived(opened.world.id);
  const session = $derived(opened.session);
  const statuses = $derived(visibleStatuses(draft, statusSnapshot, statusError));
  const states = $derived.by(() => {
    const result = new Map<Id, DeviceBadge>();
    if (!editable)
      for (const [id, device] of Object.entries(draft.devices)) {
        const health = deviceHealth(device, statuses[id], now);
        result.set(id, { health, label: healthLabel(labels, health) });
      }
    return result;
  });

  $effect(() => {
    // Reading the revision makes a successful inventory save refetch statuses, because storage
    // reconciles the sidecar against the newly saved world.
    const revision = draft.revision;
    if (!visible || editable) {
      status.cancel();
      return;
    }
    now = Date.now();
    if (revision >= 0 && untrack(() => Object.keys(draft.devices).length))
      void status.load(project, session);
    else statusBusy = false;
    return () => status.cancel();
  });

  $effect(() => {
    if (!visible || editable) return;
    const deadline = nextFreshnessDeadline(statuses, now);
    if (deadline === undefined) return;
    const timer = setTimeout(() => (now = Date.now()), Math.max(0, deadline - Date.now()));
    return () => clearTimeout(timer);
  });

  async function publish(update: VirtualUpdate) {
    if (!visible || editable || blocked || statusBusy) return;
    await status.load(opened.world.id, opened.session, update);
  }

  function manage(edits: SiteEdit[]) {
    if (blocked || editable) return Promise.resolve(false);
    return persist({ scope: "site", ...batchContext(), edits }, false);
  }

  function postManagement(changes: SiteEdit[]) {
    for (const edit of changes) {
      if (edit.op === "createDevice") {
        creatingDevice = false;
        selected = edit.id;
      } else if (edit.op === "deleteDevice" && selected === edit.id) selected = undefined;
      else if (edit.op === "mountDevice" && edit.mount && placingDevice === edit.id) {
        placingDevice = undefined;
        focusSelection(edit.id);
      }
    }
  }

  function toggleKind(kind: LayerKind) {
    const next = new Set(hiddenKinds);
    if (!next.delete(kind)) next.add(kind);
    hiddenKinds = next;
    revealed = false;
  }

  function focusSelection(id: Id) {
    const next = revealSelection(draft, id, {
      visible: visibleIds.has(id),
      hidden,
      hiddenKinds,
      underground,
    });
    revealed = next.revealed;
    hidden = next.hidden;
    hiddenKinds = next.hiddenKinds;
    underground = next.underground;
    focus = { id };
  }

  function startDevicePlacement(id: Id) {
    if (blocked || !placementAreas.length) return;
    const mount = draft.devices[id]?.mount;
    placementFrame = (mount ? draft.nodes[mount]?.parent : undefined) ?? site ?? placementAreas[0];
    placingDevice = id;
    three = false;
    measuring = false;
    referencePanel = false;
  }

  function placeDevice(point: V3) {
    if (!placingDevice || !placementFrame) return;
    const parent = worldPose(draft, placementFrame);
    const p = rounded(fromParent(parent, [point[0], point[1], parent.p[2]]));
    const mount = crypto.randomUUID();
    void manage([
      {
        op: "add",
        id: mount,
        node: {
          parent: placementFrame,
          name: name("mount"),
          p,
          yaw: 0,
          kind: "mount",
          geometry: { kind: "point" },
        },
      },
      { op: "mountDevice", id: placingDevice, mount },
    ]);
  }

  function commit(changes: SiteEdit[]) {
    if (blocked) return false;
    error = "";
    try {
      const next = commitDraft(opened.world, draft, edits, changes);
      draft = next.world;
      edits = next.edits;
      return true;
    } catch (reason) {
      error = describeError(reason, storageLabels.error);
      return false;
    }
  }

  function resetTool() {
    tool = undefined;
    anchor = undefined;
    working = [];
  }

  function begin(kind: typeof tool) {
    resetTool();
    referencePanel = false;
    calibration = undefined;
    measuring = false;
    tool = kind;
    anchor = kind === "building" || kind === "route" ? site : frameId;
    z = 0;
    error = "";
  }

  function name(kind: "building" | "floor" | "mount" | "route" | "site", siblings?: number) {
    return `${labels[kind]} ${(siblings ?? Object.values(draft.nodes).filter((n) => n.kind === kind).length) + 1}`;
  }

  const stable = (n: number) => Math.round(n * 1000) / 1000 || 0;
  const rounded = (p: V3): V3 => [stable(p[0]), stable(p[1]), stable(p[2])];

  function place(point: V3) {
    if (blocked || !tool) return;
    if (tool === "site" || tool === "route") {
      const pose = anchor ? worldPose(draft, anchor) : undefined;
      working = [...working, rounded([point[0], point[1], (pose?.p[2] ?? 0) + z])];
      return;
    }
    if (!anchor) return;
    const parent = worldPose(draft, anchor);
    const p = rounded(fromParent(parent, [point[0], point[1], parent.p[2]]));
    const id = crypto.randomUUID();
    const common = { parent: anchor, name: name(tool), p, yaw: 0 };
    const changes: SiteEdit[] = [
      {
        op: "add",
        id,
        node:
          tool === "building"
            ? { ...common, kind: "building", geometry: { kind: "box", size: [6, 4, 3] } }
            : { ...common, kind: "mount", geometry: { kind: "point" } },
      },
    ];
    if (tool === "mount") changes.push({ op: "bindVirtual", id: crypto.randomUUID(), mount: id });
    if (commit(changes)) {
      selected = id;
      resetTool();
    }
  }

  function finishDrawing() {
    const id = crypto.randomUUID();
    if (tool === "site" && working.length >= 3) {
      const ring = working.map(([x, y]): V2 => [x, y]);
      if (signedArea(ring) < 0) ring.reverse();
      if (
        !commit([
          {
            op: "add",
            id,
            node: {
              kind: "site",
              name: name("site"),
              parent: null,
              p: [0, 0, 0],
              yaw: 0,
              geometry: { kind: "footprint", ring },
            },
          },
        ])
      )
        return;
    } else if (tool === "route" && anchor && working.length >= 2) {
      const pose = worldPose(draft, anchor);
      if (
        !commit([
          {
            op: "add",
            id,
            node: {
              kind: "route",
              name: name("route"),
              parent: anchor,
              p: [0, 0, 0],
              yaw: 0,
              geometry: {
                kind: "path",
                vertices: working.map((p) => rounded(fromParent(pose, p))),
              },
            },
          },
        ])
      )
        return;
    } else return;
    selected = id;
    resetTool();
  }

  function addFloor() {
    if (!selected || selectedNode?.kind !== "building") return;
    const floors = Object.values(draft.nodes).filter(
      (n) => n.kind === "floor" && n.parent === selected
    );
    const level = Math.max(-1, ...floors.map((n) => n.level ?? -1)) + 1;
    const id = crypto.randomUUID();
    if (
      commit([
        {
          op: "add",
          id,
          node: {
            kind: "floor",
            name: name("floor", floors.length),
            parent: selected,
            level,
            p: [0, 0, level * 3],
            yaw: 0,
          },
        },
      ])
    )
      selected = id;
  }

  function moveBuilding(id: Id, [dx, dy]: V2) {
    const node = draft.nodes[id];
    if (!node?.parent || node.kind !== "building") return;
    const pose = worldPose(draft, id);
    const p = rounded(
      fromParent(worldPose(draft, node.parent), toParent({ p: pose.p, yaw: 0 }, [dx, dy, 0]))
    );
    commit([
      {
        op: "building",
        id,
        pose: { p, yaw: node.yaw },
        size: node.geometry?.kind === "box" ? node.geometry.size : [6, 4, 3],
      },
    ]);
  }

  function moveCorner(id: Id, index: number, point: V3) {
    const geometry = draft.nodes[id]?.geometry;
    if (geometry?.kind !== "footprint") return;
    const [x, y] = rounded(fromParent(worldPose(draft, id), point));
    commit([{ op: "boundary", id, ring: geometry.ring.map((p, i) => (i === index ? [x, y] : p)) }]);
  }

  function batchContext() {
    return {
      project: opened.world.id,
      baseRevision: opened.world.revision,
      session: opened.session,
      operationId: crypto.randomUUID(),
    };
  }

  async function save() {
    if (saving || working.length) return false;
    if (!edits.length && !pending) return true;
    return persist(pending ?? { scope: "site", ...batchContext(), edits }, !!pending);
  }

  async function persist(batch: SiteBatch | ReferenceBatch, retry: boolean) {
    saving = true;
    error = "";
    pending = batch;
    try {
      const saved = await onsave(batch, retry);
      draft = saved.world;
      edits = [];
      pending = undefined;
      if (batch.scope === "site" && !editable) postManagement(batch.edits);
      if (batch.scope === "reference") {
        calibration = undefined;
        selectedReference = batch.edit.op === "remove" ? undefined : batch.edit.id;
        if (batch.edit.op === "import" || batch.edit.op === "replace") focus = {};
      }
      return true;
    } catch (reason) {
      if (!(reason instanceof UnconfirmedCommand)) pending = undefined;
      if (reason instanceof UnconfirmedCommand) error = storageLabels.retry;
      else if (
        batch.scope === "reference" &&
        reason instanceof Error &&
        /^Invalid (or unsupported )?Gaia (image upload|reference image)/.test(reason.message)
      )
        error = labels.refInvalidImage;
      else if (describeError(reason, ""))
        error = `${storageLabels.error}: ${describeError(reason, "")}`;
      else error = storageLabels.error;
      return false;
    } finally {
      saving = false;
    }
  }

  async function transition(action: () => void | Promise<void>) {
    if (saving) return;
    resetTool();
    calibration = undefined;
    measuring = false;
    placingDevice = undefined;
    creatingDevice = false;
    leave = undefined;
    try {
      await action();
    } catch (reason) {
      error = describeError(reason, storageLabels.error);
    }
  }

  function request(action: () => void | Promise<void>) {
    if (saving) return;
    if (dirty) leave = action;
    else void transition(action);
  }

  async function resolveLeave(keep: boolean) {
    const action = leave;
    if (!action) return;
    if (keep) {
      if (working.length || !(await save())) return;
    } else {
      try {
        draft = pending ? (await onreopen()).world : opened.world;
      } catch (reason) {
        error = describeError(reason, storageLabels.error);
        return;
      }
      edits = [];
      pending = undefined;
      if (selected && !draft.nodes[selected] && !draft.devices[selected]) selected = undefined;
      if (selectedReference && !draft.references[selectedReference]) selectedReference = undefined;
    }
    await transition(action);
  }

  function mode(value: boolean) {
    if (editable === value) return;
    request(() => {
      if (value && selected && draft.devices[selected]) selected = draft.devices[selected]?.mount;
      editable = value;
      three = false;
    });
  }

  function edit(edit: SiteEdit, input: HTMLInputElement) {
    if (!commit([edit])) input.value = input.defaultValue;
  }

  function toggle(id: Id) {
    const next = new Set(hidden);
    if (!next.delete(id)) next.add(id);
    hidden = next;
    revealed = false;
  }

  function pick(id?: Id) {
    if (tool || blocked) return;
    selected = id;
    revealed = false;
    placingDevice = undefined;
    creatingDevice = false;
    referencePanel = false;
    calibration = undefined;
    measuring = false;
  }

  function openReference(id?: Id) {
    if (blocked || tool) return;
    three = false;
    measuring = false;
    referencePanel = true;
    if (selectedReference !== id) calibration = undefined;
    selectedReference = id;
    error = "";
  }

  function saveReference(edit: ReferenceEdit): Promise<boolean> {
    if (disposed || blocked || working.length) return Promise.resolve(false);
    const persistReference = () => persist({ scope: "reference", ...batchContext(), edit }, false);
    if (!dirty) return persistReference();
    leave = async () => {
      await persistReference();
    };
    return Promise.resolve(false);
  }

  function markPoint(point: V2) {
    if (blocked || !calibration || calibration.view !== "pixels") return;
    const result = markCalibrationPoint(calibration.points, referenceAsset?.pixels, point);
    if (!result.ok) {
      error = result.reason === "outside" ? labels.refOutside : labels.refCoincident;
      return;
    }
    error = "";
    calibration.points = result.points;
  }

  function previewCalibration() {
    if (!calibration || !selectedReference) return;
    calibration.view = "plan";
    focus = { id: selectedReference };
  }

  function measure() {
    if (blocked || tool) return;
    measuring = !measuring;
    if (measuring) {
      three = false;
      referencePanel = false;
      calibration = undefined;
      measurement = [];
      measurementZ = 0;
    }
  }

  function placeOnPlan(point: V3, hit?: Id) {
    if (blocked) return;
    if (placingDevice) {
      placeDevice(point);
      return;
    }
    if (calibration?.view === "anchor" && reference) {
      const pose = referenceFrame(draft, reference.frame);
      const [x, y] = rounded(fromParent(pose, point));
      calibration.anchor = [x, y, calibration.anchor[2]];
      calibration.view = "plan";
      return;
    }
    if (measuring) {
      const mount = hit
        ? (draft.devices[hit]?.mount ?? (draft.nodes[hit]?.kind === "mount" ? hit : undefined))
        : undefined;
      if (!mount && measurementZ === undefined) return;
      const value: V3 = mount ? worldPose(draft, mount).p : [point[0], point[1], measurementZ!];
      measurement =
        measurementMode === "points" && measurement.length === 2
          ? [value]
          : [...measurement, value];
      return;
    }
    place(point);
  }

  async function interior(id: Id) {
    saving = true;
    try {
      await oninterior(id);
    } finally {
      saving = false;
    }
  }
</script>

<main class="gaia-workspace" data-visible={visible}>
  <header class="workspace-header">
    <div class="project-context">
      <button type="button" class="text-button" onclick={() => request(onprojects)}>
        {storageLabels.projects}
      </button>
      <span aria-hidden="true">/</span><strong class="project-id" title={opened.world.id}
        >{opened.world.id}</strong
      >
    </div>
    <nav aria-label="Gaia">
      <button
        type="button"
        class:active={!editable}
        aria-pressed={!editable}
        onclick={() => mode(false)}
      >
        {labels.title}
      </button>
      <button
        type="button"
        class:active={editable}
        aria-pressed={editable}
        onclick={() => mode(true)}
      >
        {labels.studio}
      </button>
    </nav>
    <div class="project-actions">
      {#if editable}
        <small class="muted">
          {saving ? storageLabels.saving : dirty ? labels.unsaved : labels.clean}
        </small>
        <button
          type="button"
          class="primary"
          disabled={saving || (!edits.length && !pending) || !!working.length}
          onclick={save}
        >
          {storageLabels.save}
        </button>
      {:else if pending}
        <button type="button" class="primary" disabled={saving} onclick={save}>
          {storageLabels.save}
        </button>
      {:else}
        <button
          type="button"
          class="primary"
          disabled={blocked}
          onclick={() => {
            pick();
            creatingDevice = true;
          }}
        >
          {labels.addDevice}
        </button>
      {/if}
      <button
        type="button"
        class="close-room"
        aria-label={labels.closeRoom}
        title={labels.closeRoom}
        onclick={() => request(onclose)}
      >
        ×
      </button>
    </div>
  </header>

  <div class="workspace-body">
    <aside class="layer-panel" aria-label={labels.hierarchy}>
      <h2>{labels.hierarchy}</h2>
      <Layers
        world={draft}
        {labels}
        {selected}
        {hidden}
        {visibleIds}
        management={!editable}
        badges={states}
        onselect={pick}
        ontoggle={toggle}
      />
      {#if Object.keys(draft.references).length}
        <section class="reference-list" aria-label={labels.references}>
          <h3>{labels.references}</h3>
          {#each Object.entries(draft.references) as [id, layer] (id)}
            <div
              class="layer-row"
              class:chosen={referencePanel && selectedReference === id}
              class:filtered={layer.visible === false}
            >
              <button
                type="button"
                class="layer-select"
                aria-label={layer.name ?? id}
                aria-pressed={referencePanel && selectedReference === id}
                disabled={blocked || !!tool}
                onclick={() => openReference(id)}
              >
                <span aria-hidden="true" class="layer-icon">▧</span>
                <span>{layer.name ?? id}</span>
              </button>
            </div>
          {/each}
        </section>
      {/if}
    </aside>

    <section class="map-panel" aria-label={labels.sitePlan}>
      <div class="map-toolbar">
        {#if editable}<strong>{labels.sitePlan}</strong>{:else}
          <div class="view-toggle">
            <button type="button" aria-pressed={!three} onclick={() => (three = false)}>
              {labels.overviewPlan}
            </button>
            <button
              type="button"
              aria-pressed={three}
              disabled={!webgl || !items.length || !!placingDevice}
              onclick={() => {
                three = true;
                measuring = false;
                referencePanel = false;
              }}
            >
              {labels.orbit}
            </button>
          </div>
        {/if}
        <button
          type="button"
          disabled={calibration?.view === "pixels"}
          onclick={() => (focus = {})}
        >
          {labels.fit}
        </button>
        {#if editable}
          <button
            type="button"
            aria-pressed={referencePanel}
            disabled={blocked || !!tool}
            onclick={() => {
              if (referencePanel) {
                referencePanel = false;
                calibration = undefined;
              } else openReference(selectedReference ?? Object.keys(draft.references)[0]);
            }}
          >
            {labels.references}
          </button>
        {/if}
        {#if editable || !three}<button
            type="button"
            class:secondary-tool={!editable}
            aria-pressed={measuring}
            disabled={blocked || !!tool || !!placingDevice}
            onclick={measure}
          >
            {labels.measure}
          </button>{/if}
        {#if !editable}
          <details class="visibility-menu">
            <summary>{labels.filters}</summary>
            <div>
              {#each layerKinds as kind (kind)}
                <label>
                  <input
                    type="checkbox"
                    checked={!hiddenKinds.has(kind)}
                    onchange={() => toggleKind(kind)}
                  />
                  {kind === "device" ? labels.devices : labels[kind]}
                </label>
              {/each}
            </div>
          </details>
        {/if}
        <label class="check">
          <input type="checkbox" bind:checked={underground} />{labels.underground}
        </label>
      </div>

      {#if editable}
        <div class="edit-toolbar">
          {#if tool}
            <p>
              {tool === "site"
                ? labels.placeSite
                : tool === "route"
                  ? labels.placeRoute
                  : labels.placeObject}
            </p>
            {#if tool === "route"}<label class="inline-number">
                {labels.elevation}<input
                  type="number"
                  step="any"
                  value={z}
                  onchange={(event) => {
                    const value = event.currentTarget.valueAsNumber;
                    if (Number.isFinite(value)) z = value;
                    else event.currentTarget.value = String(z);
                  }}
                />
              </label>{/if}
            {#if tool === "route" || tool === "site"}
              <button
                type="button"
                disabled={!working.length}
                onclick={() => (working = working.slice(0, -1))}
              >
                {labels.undoPoint}
              </button>
              <button
                type="button"
                disabled={working.length < (tool === "site" ? 3 : 2)}
                onclick={finishDrawing}
              >
                {labels.finish}
              </button>
            {/if}
            <button type="button" onclick={resetTool}>{labels.cancel}</button>
          {:else}
            <button type="button" disabled={blocked} onclick={() => begin("site")}>
              {labels.drawSite}
            </button>
            <button type="button" disabled={blocked || !site} onclick={() => begin("building")}>
              {labels.addBuilding}
            </button>
            <button
              type="button"
              disabled={blocked || selectedNode?.kind !== "building"}
              onclick={addFloor}
            >
              {labels.addFloor}
            </button>
            <button type="button" disabled={blocked || !frameId} onclick={() => begin("mount")}>
              {labels.addMount}
            </button>
            <button type="button" disabled={blocked || !site} onclick={() => begin("route")}>
              {labels.addRoute}
            </button>
          {/if}
        </div>
      {/if}

      {#if placingDevice}
        <div class="edit-toolbar">
          <label class="placement-area">
            {labels.placementFrame}
            <select bind:value={placementFrame} disabled={blocked}>
              {#each placementAreas as id (id)}<option value={id}>
                  {mountPath(draft, id).join(" / ")}
                </option>{/each}
            </select>
          </label>
          <button type="button" disabled={blocked} onclick={() => (placingDevice = undefined)}>
            {labels.cancel}
          </button>
          <p>{labels.placeDeviceHint}</p>
        </div>
      {/if}
      <div class="map-viewport" data-geometry={spatialItems.length}>
        {#if three}
          <Orbit
            {items}
            {visible}
            {selected}
            {states}
            {focus}
            label={labels.orbit}
            onselect={pick}
            unavailable={() => {
              three = false;
              webgl = false;
            }}
          />
        {:else if visible && calibration?.view === "pixels" && currentSource && referenceAsset?.pixels}
          <CalibrationImage
            source={currentSource}
            pixels={referenceAsset.pixels}
            points={calibration.points}
            label={labels.refImage}
            hint={calibration.points.length === 0
              ? labels.refPickA
              : calibration.points.length === 1
                ? labels.refPickB
                : labels.refEnterDistance}
            onpick={markPoint}
          />
        {:else if visible}
          <Plan
            {items}
            {selected}
            {states}
            {focus}
            working={measuring ? measurement : working}
            referenceLayers={planLayers}
            {calibrationGuide}
            editable={editable && !blocked && !referencePanel}
            placement={!!tool || measuring || !!placingDevice || calibration?.view === "anchor"}
            label={labels.overviewPlan}
            onselect={pick}
            onplace={placeOnPlan}
            onmove={moveBuilding}
            oncorner={moveCorner}
          />
        {/if}
        {#if visible && !Object.keys(draft.nodes).length && !planLayers.length && !editable}<p
            class="map-empty"
          >
            {labels.noSite}
          </p>{/if}
      </div>
      <footer class="map-status">
        {#if error}<span role="alert">{error}</span>
        {:else if !webgl && !editable}<span role="status">{labels.webgl}</span>
        {:else if revealed}<span role="status">{labels.revealedSelection}</span>
        {:else if calibration?.view === "anchor"}<span>{labels.refAnchorHint}</span>
        {:else if opened.missing.length}<span>{labels.missing} · {opened.missing.join(", ")}</span>
        {:else if opened.damaged?.length}<span>
            {labels.refDamaged} · {opened.damaged.join(", ")}
          </span>
        {:else}
          <span>
            {three
              ? labels.orbitHelp
              : editable && selectedNode?.kind === "building"
                ? labels.moveHelp
                : editable && selectedNode?.kind === "site"
                  ? labels.boundaryHelp
                  : labels.panHelp}
          </span>
        {/if}
      </footer>
    </section>

    <aside class="properties-panel" aria-label={labels.inspector}>
      <h2>
        {referencePanel
          ? labels.references
          : measuring
            ? labels.measure
            : editable
              ? labels.inspector
              : labels.management}
      </h2>
      {#if referencePanel}
        {#key (selectedReference ?? "") + ":" + draft.revision}
          <References
            world={draft}
            id={selectedReference}
            {labels}
            {editable}
            disabled={blocked}
            frame={frameId ?? null}
            {calibration}
            value={candidate}
            ready={!!currentSource}
            focusable={planLayers.some(({ id }) => id === selectedReference)}
            loadFailed={currentSource === null ||
              !!(reference && opened.damaged?.includes(reference.asset))}
            missing={!!(reference && opened.missing.includes(reference.asset))}
            onsave={saveReference}
            onstart={() => {
              if (!currentSource) return;
              error = "";
              calibration = calibrationDraft(reference?.calibration);
            }}
            oncancel={() => {
              calibration = undefined;
              error = "";
            }}
            onpick={markPoint}
            onpreview={previewCalibration}
            onfocus={() => (focus = { id: selectedReference })}
            onerror={(message) => (error = message)}
          />
        {/key}
      {:else if measuring}
        <Measurements
          {labels}
          bind:mode={measurementMode}
          bind:z={measurementZ}
          points={measurement}
          onundo={() => (measurement = measurement.slice(0, -1))}
          onclear={() => (measurement = [])}
        />
      {:else if !editable}
        {#key selected}
          <Overview
            world={draft}
            {selected}
            {labels}
            {locale}
            {statuses}
            {now}
            disabled={blocked || !!placingDevice}
            {statusBusy}
            {statusError}
            {visibleIds}
            creating={creatingDevice}
            oncancel={() => (creatingDevice = false)}
            onapply={(edit) => manage([edit])}
            onselect={pick}
            onfocus={focusSelection}
            onplace={startDevicePlacement}
            ondelete={(edit) => (deviceDeletion = edit)}
            onpublish={publish}
          />
        {/key}
      {:else if selected && selectedNode}
        {#key selected}
          <Properties
            world={draft}
            id={selected}
            {labels}
            {editable}
            disabled={blocked}
            onedit={edit}
          />
        {/key}
        <div class="property-actions">
          <button
            type="button"
            onclick={() => focusSelection(selected!)}
          >
            {visibleIds.has(selected) ? labels.focus : labels.showFocus}
          </button>
          {#if editable}
            {#if selectedNode.kind === "building" && Object.values(draft.nodes).some((n) => n.kind === "floor" && n.parent === selected)}
              {@const id = selected}
              <button type="button" disabled={saving} onclick={() => request(() => interior(id))}>
                {labels.interior}
              </button>
            {/if}
            <button
              type="button"
              class="danger"
              disabled={blocked}
              onclick={() => (deletion = removalPlan(draft, selected!))}
            >
              {labels.remove}
            </button>
          {/if}
        </div>
      {:else}<p class="muted">{labels.pickObject}</p>{/if}
    </aside>
  </div>

  {#if visible && (leave || deletion || deviceDeletion)}
    <div class="dialog-overlay">
      <div
        class="workspace-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={leave
          ? labels.leavePrompt
          : deviceDeletion
            ? labels.deleteDevicePrompt
            : labels.removeItems}
      >
        {#if leave}
          <h2>{labels.leavePrompt}</h2>
          {#if working.length}<p>{tool === "route" ? labels.placeRoute : labels.placeSite}</p>{/if}
          {#if error}<p role="alert">{error}</p>{/if}
          <div>
            <button type="button" disabled={saving} onclick={() => (leave = undefined)}>
              {labels.keepEditing}
            </button>
            <button type="button" disabled={saving} onclick={() => resolveLeave(false)}>
              {labels.discardChanges}
            </button>
            <button
              type="button"
              class="primary"
              disabled={saving || !!working.length}
              onclick={() => resolveLeave(true)}
            >
              {storageLabels.save}
            </button>
          </div>
        {:else if deviceDeletion}
          {@const edit = deviceDeletion}
          <h2>{labels.deleteDevicePrompt}</h2>
          <p>{deviceName(draft, edit.id)}</p>
          {#if edit.mount}<p>{labels.keptMount} {mountPath(draft, edit.mount).join(" / ")}</p>{/if}
          {#if edit.hardwareId}<p>{labels.removedBinding} · {edit.hardwareId}</p>{/if}
          {#if statuses[edit.id]}<p>{labels.removedStatus}</p>{/if}
          <div>
            <button type="button" onclick={() => (deviceDeletion = undefined)}>
              {labels.cancel}
            </button>
            <button
              type="button"
              class="danger"
              onclick={() => {
                const target = deviceDeletion;
                deviceDeletion = undefined;
                if (target) void manage([target]);
              }}
            >
              {labels.deleteDevice}
            </button>
          </div>
        {:else if deletion}
          <h2>{labels.removeItems}</h2>
          <p>{deletion.ids.map((id) => draft.nodes[id]?.name).join(", ")}</p>
          {#if deletion.detach.length}<p>
              {labels.detachDevices} · {deletion.detach.join(", ")}
            </p>{/if}
          <div>
            <button type="button" onclick={() => (deletion = undefined)}>{labels.cancel}</button>
            <button
              type="button"
              class="danger"
              onclick={() => {
                const plan = deletion!;
                deletion = undefined;
                if (commit([{ op: "remove", ...plan }])) selected = undefined;
              }}
            >
              {labels.remove}
            </button>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</main>
