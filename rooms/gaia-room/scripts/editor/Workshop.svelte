<script lang="ts">
  import { onMount } from "svelte";
  import { get } from "svelte/store";
  import FloorPlanCanvas from "$lib/components/editor/FloorPlanCanvas.svelte";
  import {
    canvasCamX,
    canvasCamY,
    canvasZoom,
    currentProject,
    detectedRoomsStore,
    loadProject,
    panMode,
    placingFurnitureId,
    placingRotation,
    redo,
    selectedElementId,
    selectedTool,
    setActiveFloor,
    setEditingPolicy,
    undo,
    undoHistoryStore,
  } from "$lib/stores/project";
  import { readProject } from "$lib/utils/projectValidation";
  import en from "../../i18n/en.json";
  import { UnconfirmedCommand, type InteriorOpened, type WorkshopStorage } from "./client.ts";
  import { nodeAt } from "../spatial/world.ts";
  import { floorId } from "./projection.ts";
  import { openSession, type EditBatch } from "./session.ts";
  import { untrack } from "svelte";

  let {
    initial,
    storage,
    labels = en.workshop,
    onleave,
    visible = true,
    transitionLabels,
  }: {
    initial: InteriorOpened;
    storage: WorkshopStorage;
    labels?: typeof en.workshop;
    onleave?: () => void;
    visible?: boolean;
    transitionLabels?: typeof en.site;
  } = $props();
  const opened = untrack(() => initial);
  const building = opened.building;
  const acceptance = import.meta.env.MODE === "acceptance";
  let world = $state.raw(opened.world);
  const ground = Object.keys(opened.world.nodes).find((id) => {
    const node = opened.world.nodes[id];
    return node?.kind === "floor" && node.parent === building && node.level === 0;
  });
  let session = $state.raw(
    openSession(opened.world, building, ground ? floorId(ground) : undefined)
  );
  let trustedSession = opened.session;
  let cleanFloors: string | undefined;
  let missing = $state(opened.missing);
  let pending: EditBatch | undefined;
  let lastBatch: EditBatch | undefined;
  let epoch = $state(0);
  let leaving = $state(false);
  let current = $state.raw(get(currentProject));
  let tool = $state(get(selectedTool));
  let gesturing = $state(false);
  let saving = $state(false);
  let message = $state("");
  let failure = $state(false);
  let readOnly = $derived(session.readOnly.map((id) => nodeAt(world, id).name));
  function report(text: string, error = false) {
    message = text;
    failure = error;
  }

  function explainBlocked(feature: string) {
    report(`${feature} ${labels.blocked}`, true);
  }

  setEditingPolicy((before, after, intent) => {
    if (saving || !visible || leaving) return false;
    try {
      session.authorize(before, after, intent);
      return true;
    } catch (error) {
      report(error instanceof Error ? error.message : String(error), true);
      return false;
    }
  });
  loadProject(readProject(untrack(() => session.plan)));

  cleanFloors = JSON.stringify(get(currentProject)?.floors);

  async function save() {
    if (!visible || gesturing || saving) {
      report(labels.gesture, true);
      return;
    }
    const draft = get(currentProject);
    if (!draft) return false;
    saving = true;
    try {
      const { candidate, batch, next } = session.prepareSave(draft, world, readProject);
      if (pending && JSON.stringify(pending.edits) !== JSON.stringify(batch.edits)) {
        report(labels.changedAfterTimeout, true);
        return false;
      }
      if (!batch.edits.length) {
        report(`${labels.same} ${world.revision}.`);
        return true;
      }
      const projection = readProject(next.plan);
      batch.session = trustedSession;
      const retry = pending !== undefined;
      if (pending) batch.operationId = pending.operationId;
      pending = batch;
      let saved;
      try {
        saved = await storage.save(batch, retry);
      } catch (error) {
        if (error instanceof UnconfirmedCommand) throw new Error(labels.retry);
        pending = undefined;
        throw error;
      }
      if (JSON.stringify(saved.world) !== JSON.stringify(candidate))
        throw new Error("Saved projection mismatch");
      pending = undefined;
      world = saved.world;
      missing = saved.missing;
      lastBatch = batch;
      session = next;
      loadProject(projection);
      cleanFloors = JSON.stringify(get(currentProject)?.floors);
      epoch++;
      report(`${labels.saved} ${world.revision}.`);
      return true;
    } catch (error) {
      report(error instanceof Error ? error.message : String(error), true);
      return false;
    } finally {
      saving = false;
    }
  }

  async function reopen() {
    const draft = get(currentProject);
    if (!draft || gesturing || saving) return;
    const edited = JSON.stringify(draft.floors) !== cleanFloors;
    if (edited && !confirm(labels.discard)) return;
    saving = true;
    try {
      const saved = await storage.reopen();
      session = openSession(saved.world, saved.building, draft.activeFloorId);
      world = saved.world;
      trustedSession = saved.session;
      missing = saved.missing;
      pending = undefined;
      loadProject(readProject(session.plan));
      cleanFloors = JSON.stringify(get(currentProject)?.floors);
      epoch++;
      report(`${labels.reopened} ${world.revision}.`);
    } catch (e) {
      report(String(e), true);
    } finally {
      saving = false;
    }
  }

  function leave() {
    if (saving || gesturing) return;
    if (pending || JSON.stringify(get(currentProject)?.floors) !== cleanFloors) {
      if (transitionLabels) {
        leaving = true;
        return;
      }
      if (!confirm(labels.discard)) return;
    }
    onleave?.();
  }

  function activate(tool: "select" | "wall" | "furniture") {
    if (gesturing || saving) return;
    panMode.set(false);
    placingFurnitureId.set(tool === "furniture" ? "table" : null);
    placingRotation.set(0);
    selectedTool.set(tool);
  }

  $effect(() => {
    if (!visible) return;
    const stopProject = currentProject.subscribe((project) => (current = project));
    const stopTool = selectedTool.subscribe((value) => (tool = value));
    function onSaveKey(event: KeyboardEvent) {
      if (saving) {
        event.stopImmediatePropagation();
        event.preventDefault();
        return;
      }
      if (!leaving && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        event.stopImmediatePropagation();
        void save();
      }
    }
    window.addEventListener("keydown", onSaveKey, true);
    return () => {
      stopProject();
      stopTool();
      window.removeEventListener("keydown", onSaveKey, true);
      gesturing = false;
    };
  });

  onMount(() => {
    if (acceptance) {
      Object.defineProperty(window, "__gaiaAcceptance", {
        configurable: true,
        value: () =>
          structuredClone({
            world,
            lastBatch,
            draft: get(currentProject),
            history: get(undoHistoryStore),
            rooms: get(detectedRoomsStore),
            selected: get(selectedElementId),
            camera: { x: get(canvasCamX), y: get(canvasCamY), zoom: get(canvasZoom) },
          }),
      });
    }
    return () => {
      setEditingPolicy();
      if (acceptance) Reflect.deleteProperty(window, "__gaiaAcceptance");
    };
  });
</script>

<div class="flex h-full flex-col bg-slate-50 text-slate-900">
  <header
    class="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-slate-200 bg-white px-4 py-3"
  >
    <div>
      <h1 class="text-lg font-semibold">{labels.workshop}</h1>
      <p class="text-sm text-slate-600">
        {world.id} · {current?.name} · {labels.revision}
        {world.revision}
      </p>
    </div>
    <label class="flex items-center gap-2 text-sm">
      {labels.floor}
      <select
        class="rounded border border-slate-300 bg-white p-1.5"
        value={current?.activeFloorId}
        disabled={gesturing || saving}
        onchange={(event) => setActiveFloor(event.currentTarget.value)}
      >
        {#each current?.floors ?? [] as floor (floor.id)}
          <option value={floor.id}>{floor.name}</option>
        {/each}
      </select>
    </label>
    <div class="flex flex-wrap items-center gap-2" role="group" aria-label={labels.tools}>
      <button type="button" aria-pressed={tool === "select"} onclick={() => activate("select")}>
        {labels.select}
      </button>
      <button type="button" aria-pressed={tool === "wall"} onclick={() => activate("wall")}>
        {labels.wall}
      </button>
      <button
        type="button"
        aria-pressed={tool === "furniture"}
        onclick={() => activate("furniture")}
      >
        {labels.table}
      </button>
      <button type="button" onclick={undo} disabled={gesturing || saving}>{labels.undo}</button>
      <button type="button" onclick={redo} disabled={gesturing || saving}>{labels.redo}</button>
    </div>
    <div class="ml-auto flex gap-2">
      {#if onleave}<button type="button" onclick={leave} disabled={gesturing || saving}>
          {transitionLabels?.backSite ?? labels.projects}
        </button>{/if}
      <button type="button" onclick={reopen} disabled={gesturing || saving}>{labels.reopen}</button>
      <button type="button" class="save" onclick={save} disabled={saving}>{labels.save}</button>
    </div>
  </header>
  <div class="flex min-h-0 flex-1" inert={saving || leaving}>
    {#if visible}
      {#key epoch}
        <FloorPlanCanvas
          restrictEdits
          onBlocked={explainBlocked}
          onGestureChange={(active) => (gesturing = active)}
        />
      {/key}
    {/if}
  </div>
  <footer class="border-t border-slate-200 bg-white px-4 py-2 text-sm">
    <p role="status" class:failure>{saving ? labels.saving : message || labels.ready}</p>
    {#if missing.length}<p>{labels.missing} · {missing.join(", ")}</p>{/if}
    <details class="mt-1 text-slate-600">
      <summary>{labels.scope}</summary>
      <p>{labels.unsupported}</p>
      <p>{labels.receiptLimit}</p>
      {#if readOnly.length}
        <p>{labels.readonly} · {readOnly.join(", ")}.</p>
      {/if}
    </details>
  </footer>
  {#if visible && leaving && transitionLabels}
    <div class="gaia-workspace">
      <div class="dialog-overlay">
        <div
          class="workspace-dialog"
          role="dialog"
          aria-modal="true"
          aria-label={transitionLabels.leavePrompt}
        >
          <h2>{transitionLabels.leavePrompt}</h2>
          {#if failure}<p role="alert">{message}</p>{/if}
          <div>
            <button type="button" disabled={saving} onclick={() => (leaving = false)}>
              {transitionLabels.keepEditing}
            </button>
            <button
              type="button"
              disabled={saving}
              onclick={async () => {
                if (pending) {
                  saving = true;
                  try {
                    await storage.reopen();
                  } catch (error) {
                    report(String(error), true);
                    return;
                  } finally {
                    saving = false;
                  }
                }
                onleave?.();
              }}
            >
              {transitionLabels.discardChanges}
            </button>
            <button
              type="button"
              class="save"
              disabled={saving}
              onclick={async () => {
                if (await save()) onleave?.();
              }}
            >
              {labels.save}
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  button {
    border: 1px solid #cbd5e1;
    border-radius: 0.375rem;
    background: white;
    padding: 0.35rem 0.65rem;
    font-size: 0.875rem;
    cursor: pointer;
  }
  button:hover:not(:disabled) {
    background: #f1f5f9;
  }
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  button[aria-pressed="true"] {
    border-color: #0f766e;
    color: #115e59;
    background: #f0fdfa;
  }
  .save,
  .save:hover:not(:disabled) {
    background: #115e59;
    color: white;
    border-color: #115e59;
  }
  .failure {
    color: #9f1239;
  }
</style>
