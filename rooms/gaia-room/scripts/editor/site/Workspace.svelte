<script lang="ts">
  import { untrack } from "svelte";
  import type en from "../../../i18n/en.json";
  import {
    applySiteEdits,
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
  import { UnconfirmedCommand, type Opened, type Saved } from "../client.ts";
  import Layers from "./Layers.svelte";
  import Orbit from "./Orbit.svelte";
  import Plan from "./Plan.svelte";
  import Properties from "./Properties.svelte";
  import { spatialScene } from "./scene.ts";
  import { type VirtualReading, virtualReadings } from "./virtual.ts";
  import "./workspace.css";

  let {
    opened,
    labels,
    storageLabels,
    visible,
    startEditing,
    initialSelection,
    readingsSource,
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
    readingsSource: ReturnType<typeof virtualReadings>;
    onsave: (batch: SiteBatch, retry: boolean) => Promise<Saved>;
    onreopen: () => Promise<Opened>;
    oninterior: (id: Id) => Promise<void>;
    onprojects: () => void;
    onclose: () => void;
  } = $props();

  let draft = $state.raw(untrack(() => opened.world));
  let selected = $state<Id | undefined>(untrack(() => initialSelection));
  let editable = $state(untrack(() => startEditing));
  let three = $state(false);
  let webgl = $state(true);
  let underground = $state(false);
  let hidden = $state.raw<ReadonlySet<Id>>(new Set());
  let focus = $state.raw<{ id?: Id }>({});
  let readings = $state.raw<ReadonlyMap<Id, VirtualReading>>(new Map());
  let now = $state(Date.now());
  let edits = $state.raw<SiteEdit[]>([]);
  let pending = $state.raw<SiteBatch>();
  let saving = $state(false);
  let error = $state("");
  let leave = $state.raw<() => void | Promise<void>>();
  let deletion = $state.raw<ReturnType<typeof removalPlan>>();
  let tool = $state<"site" | "building" | "mount" | "route">();
  let anchor = $state<Id>();
  let working = $state.raw<V3[]>([]);
  let z = $state(0);

  const dirty = $derived(draft !== opened.world || !!working.length || !!pending);
  const blocked = $derived(saving || !!pending || !!leave || !!deletion);
  const items = $derived(spatialScene(draft, hidden, underground));
  const visibleIds = $derived(new Set(items.map(({ id }) => id)));
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
  const states = $derived.by(() => {
    const result = new Map<Id, string>();
    for (const [id, device] of Object.entries(draft.devices)) {
      const reading = readings.get(id);
      if (device.mount && reading && (reading.state === "online" || !result.has(device.mount)))
        result.set(device.mount, reading.state);
    }
    return result;
  });

  $effect(() => {
    if (!visible) return;
    const stop = readingsSource.subscribe((data) => {
      readings = data;
      now = Date.now();
    });
    return stop;
  });

  $effect(() => {
    if (!visible || !selected) return;
    const timestamps = Object.entries(draft.devices)
      .filter(([, device]) => device.mount === selected)
      .flatMap(([id]) => {
        const reading = readings.get(id);
        return reading && reading.at + 60000 > now ? [reading.at + 60000] : [];
      });
    if (!timestamps.length) return;
    const timer = setTimeout(
      () => (now = Date.now()),
      Math.max(0, Math.min(...timestamps) - Date.now())
    );
    return () => clearTimeout(timer);
  });

  function commit(changes: SiteEdit[]) {
    if (blocked) return false;
    error = "";
    try {
      const candidate = applySiteEdits(draft, changes);
      if (candidate !== draft) {
        if (
          JSON.stringify(candidate.nodes) === JSON.stringify(opened.world.nodes) &&
          JSON.stringify(candidate.devices) === JSON.stringify(opened.world.devices)
        ) {
          draft = opened.world;
          edits = [];
        } else {
          draft = candidate;
          edits = [...edits, ...changes];
        }
      }
      return true;
    } catch (reason) {
      error = reason instanceof Error ? reason.message : String(reason);
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
      const area = ring.reduce((sum, [x, y], i) => {
        const [u, v] = ring[(i + 1) % ring.length]!;
        return sum + x * v - y * u;
      }, 0);
      if (area < 0) ring.reverse();
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

  async function save() {
    if (saving || working.length) return false;
    if (!edits.length) return true;
    saving = true;
    error = "";
    const retry = !!pending;
    const batch =
      pending ??
      ({
        scope: "site",
        project: opened.world.id,
        baseRevision: opened.world.revision,
        session: opened.session,
        operationId: crypto.randomUUID(),
        edits,
      } satisfies SiteBatch);
    pending = batch;
    try {
      const saved = await onsave(batch, retry);
      draft = saved.world;
      edits = [];
      pending = undefined;
      return true;
    } catch (reason) {
      if (!(reason instanceof UnconfirmedCommand)) pending = undefined;
      error = reason instanceof UnconfirmedCommand ? storageLabels.retry : String(reason);
      return false;
    } finally {
      saving = false;
    }
  }

  async function transition(action: () => void | Promise<void>) {
    if (saving) return;
    resetTool();
    leave = undefined;
    try {
      await action();
    } catch (reason) {
      error = String(reason);
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
        error = String(reason);
        return;
      }
      edits = [];
      pending = undefined;
    }
    await transition(action);
  }

  function mode(value: boolean) {
    if (editable === value) return;
    request(() => {
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
  }

  function pick(id?: Id) {
    if (!tool && !saving) selected = id;
  }

  function publish(id: Id, state: VirtualReading["state"], value: number) {
    if (visible && editable) readingsSource.update(id, { state, value, at: Date.now() });
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
      <span aria-hidden="true">/</span><strong>{opened.world.id}</strong>
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
          disabled={saving || !edits.length || !!working.length}
          onclick={save}
        >
          {storageLabels.save}
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
        onselect={pick}
        ontoggle={toggle}
      />
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
              disabled={!webgl || !items.length}
              onclick={() => (three = true)}
            >
              {labels.orbit}
            </button>
          </div>
        {/if}
        <button type="button" onclick={() => (focus = {})}>{labels.fit}</button>
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

      <div class="map-viewport" data-geometry={items.length}>
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
        {:else if visible}
          <Plan
            {items}
            {selected}
            {states}
            {focus}
            {working}
            editable={editable && !blocked}
            placement={!!tool}
            label={labels.overviewPlan}
            onselect={pick}
            onplace={place}
            onmove={moveBuilding}
            oncorner={moveCorner}
          />
        {/if}
        {#if visible && !items.length && !editable}<p class="map-empty">{labels.noSite}</p>{/if}
      </div>
      <footer class="map-status">
        {#if error}<span role="alert">{error}</span>
        {:else if !webgl && !editable}<span role="status">{labels.webgl}</span>
        {:else if opened.missing.length}<span>{labels.missing} · {opened.missing.join(", ")}</span>
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
      <h2>{labels.inspector}</h2>
      {#if selected && selectedNode}
        {#key selected}
          <Properties
            world={draft}
            id={selected}
            {labels}
            {editable}
            disabled={blocked}
            {readings}
            {now}
            onedit={edit}
            onreading={publish}
          />
        {/key}
        <div class="property-actions">
          <button
            type="button"
            disabled={!visibleIds.has(selected)}
            onclick={() => (focus = { id: selected })}
          >
            {labels.focus}
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

  {#if visible && (leave || deletion)}
    <div class="dialog-overlay">
      <div
        class="workspace-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={leave ? labels.leavePrompt : labels.removeItems}
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
