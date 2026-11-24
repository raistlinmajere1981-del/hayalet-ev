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
  import { createFixture } from "../spatial/fixture.ts";
  import { nodeAt } from "../spatial/world.ts";
  import { openSession, type EditBatch } from "./session.ts";

  const building = "glass";
  const model = createFixture();
  const acceptance = import.meta.env.MODE === "acceptance";
  if (acceptance && new URLSearchParams(location.search).get("fixture") === "two-floors") {
    model.nodes["upper"] = {
      kind: "floor",
      name: "Fide katı",
      parent: building,
      level: 1,
      p: [0.5, -1, 3],
      yaw: 25,
    };
  }

  let world = $state.raw(model);
  let session = openSession(model, building);
  let lastBatch: EditBatch | undefined;
  let epoch = $state(0);
  let gesturing = $state(false);
  let saving = $state(false);
  let message = $state("Edit a straight wall or a table, then save to Gaia.");
  let failure = $state(false);
  let readOnly = $derived(session.readOnly.map((id) => nodeAt(world, id).name));
  const unsupported =
    "Curved walls, detected room edits, openings, groups, other catalog items and floor moves are disabled in this editor.";

  function report(text: string, error = false) {
    message = text;
    failure = error;
  }

  function explainBlocked(feature: string) {
    report(`${feature} unavailable in this editor.`, true);
  }

  setEditingPolicy((before, after, intent) => {
    if (saving) return false;
    try {
      session.authorize(before, after, intent);
      return true;
    } catch (error) {
      report(error instanceof Error ? error.message : String(error), true);
      return false;
    }
  });
  loadProject(readProject(session.plan));

  function save() {
    if (gesturing || saving) {
      report("Finish the current gesture before saving.", true);
      return;
    }
    const draft = get(currentProject);
    if (!draft) return;
    saving = true;
    try {
      const { candidate, batch, next } = session.prepareSave(draft, world, readProject);
      if (!batch.edits.length) {
        report(`No changes to save. Gaia revision ${world.revision}.`);
        return;
      }
      const projection = readProject(next.plan);
      world = candidate;
      lastBatch = batch;
      session = next;
      loadProject(projection);
      epoch++;
      report(`Saved to Gaia revision ${world.revision}.`);
    } catch (error) {
      report(error instanceof Error ? error.message : String(error), true);
    } finally {
      saving = false;
    }
  }

  function reopen() {
    const draft = get(currentProject);
    if (!draft || gesturing || saving) return;
    const edited = JSON.stringify(draft.floors) !== JSON.stringify(session.plan.floors);
    if (edited && !confirm("Discard the current draft and reopen the saved Gaia model?")) return;
    session = openSession(world, building, draft.activeFloorId);
    loadProject(readProject(session.plan));
    epoch++;
    report(`Reopened Gaia revision ${world.revision}.`);
  }

  function activate(tool: "select" | "wall" | "furniture") {
    if (gesturing || saving) return;
    panMode.set(false);
    placingFurnitureId.set(tool === "furniture" ? "table" : null);
    placingRotation.set(0);
    selectedTool.set(tool);
  }

  onMount(() => {
    function onSaveKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        event.stopImmediatePropagation();
        save();
      }
    }
    window.addEventListener("keydown", onSaveKey, true);
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
      window.removeEventListener("keydown", onSaveKey, true);
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
      <h1 class="text-lg font-semibold">Gaia Workshop</h1>
      <p class="text-sm text-slate-600">
        {$currentProject?.name} · Revision {world.revision} · In memory
      </p>
    </div>
    <label class="flex items-center gap-2 text-sm">
      Floor
      <select
        class="rounded border border-slate-300 bg-white p-1.5"
        value={$currentProject?.activeFloorId}
        disabled={gesturing || saving}
        onchange={(event) => setActiveFloor(event.currentTarget.value)}
      >
        {#each $currentProject?.floors ?? [] as floor (floor.id)}
          <option value={floor.id}>{floor.name}</option>
        {/each}
      </select>
    </label>
    <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Edit tools">
      <button
        type="button"
        aria-pressed={$selectedTool === "select"}
        onclick={() => activate("select")}>Select</button
      >
      <button type="button" aria-pressed={$selectedTool === "wall"} onclick={() => activate("wall")}
        >Straight wall</button
      >
      <button
        type="button"
        aria-pressed={$selectedTool === "furniture"}
        onclick={() => activate("furniture")}>Table</button
      >
      <button type="button" onclick={undo} disabled={gesturing || saving}>Undo</button>
      <button type="button" onclick={redo} disabled={gesturing || saving}>Redo</button>
    </div>
    <div class="ml-auto flex gap-2">
      <button type="button" onclick={reopen} disabled={gesturing || saving}
        >Reopen saved model</button
      >
      <button type="button" class="save" onclick={save} disabled={saving}>Save to Gaia</button>
    </div>
  </header>
  <div class="flex min-h-0 flex-1">
    {#key epoch}
      <FloorPlanCanvas
        restrictEdits
        onBlocked={explainBlocked}
        onGestureChange={(active) => (gesturing = active)}
      />
    {/key}
  </div>
  <footer class="border-t border-slate-200 bg-white px-4 py-2 text-sm">
    <p role="status" class:failure>{message}</p>
    <details class="mt-1 text-slate-600">
      <summary>Edit scope</summary>
      <p>{unsupported}</p>
      {#if readOnly.length}
        <p>Read-only Gaia records on these floors: {readOnly.join(", ")}.</p>
      {/if}
    </details>
  </footer>
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
