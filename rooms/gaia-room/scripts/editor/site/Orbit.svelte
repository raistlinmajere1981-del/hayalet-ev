<script lang="ts">
  import { onDestroy } from "svelte";
  import type { Id } from "../../spatial/world.ts";
  import type { SpatialItem } from "./scene.ts";
  import type { createOrbit } from "./orbit.ts";

  let {
    items,
    visible,
    selected,
    states,
    focus,
    label,
    onselect,
    unavailable,
  }: {
    items: SpatialItem[];
    visible: boolean;
    selected?: Id;
    states: ReadonlyMap<Id, string>;
    focus: { id?: Id };
    label: string;
    onselect: (id?: Id) => void;
    unavailable: () => void;
  } = $props();
  let host: HTMLDivElement;
  let viewer = $state.raw<ReturnType<typeof createOrbit>>();
  $effect(() => viewer?.setActive(visible));
  $effect(() => viewer?.replace(items));
  $effect(() => viewer?.update(selected, states));
  $effect(() => viewer?.focus(focus.id));
  $effect(() => {
    if (!visible || viewer) return;
    let active = true;
    void import("./orbit.ts")
      .then(({ createOrbit }) => {
        if (!active) return;
        viewer = createOrbit(host, onselect, unavailable);
      })
      .catch(() => {
        if (active) unavailable();
      });
    return () => {
      active = false;
    };
  });
  onDestroy(() => viewer?.dispose());
</script>

<div class="orbit" bind:this={host} aria-label={label}></div>

<style>
  .orbit {
    width: 100%;
    height: 100%;
  }
  .orbit :global(canvas[hidden]) {
    display: none;
  }
  .orbit :global(canvas) {
    display: block;
    width: 100%;
    height: 100%;
    touch-action: none;
  }
</style>
