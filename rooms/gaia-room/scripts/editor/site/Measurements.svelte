<script lang="ts">
  import type en from "../../../i18n/en.json";
  import { directDistance, horizontalDistance, routeLength } from "../../spatial/measurements.ts";
  import type { V3 } from "../../spatial/world.ts";

  let {
    labels,
    mode = $bindable(),
    z = $bindable(),
    points,
    onundo,
    onclear,
  }: {
    labels: typeof en.site;
    mode: "points" | "route";
    z: number | undefined;
    points: V3[];
    onundo: () => void;
    onclear: () => void;
  } = $props();

  const fmt = (value: number) => Number(value.toFixed(3)) + " m";
</script>

<p>{labels.measureHint}</p>
<label>
  <span>{labels.measureMode}</span>
  <select bind:value={mode} onchange={onclear}>
    <option value="points">{labels.measurePoints}</option>
    <option value="route">{labels.measureRoute}</option>
  </select>
</label>
<label class="number-field"
  ><span>{labels.measureZ}</span>
  <input type="number" step="any" bind:value={z} />
</label>
{#if points.length}
  <ol aria-label={labels.coordinates}>
    {#each points as point}
      <li>{point.map((n) => Number(n.toFixed(3))).join(" · ")} m</li>
    {/each}
  </ol>
  <div class="property-actions">
    <button type="button" onclick={onundo}>{labels.undoPoint}</button>
    <button type="button" onclick={onclear}>{labels.measureClear}</button>
  </div>
{/if}
{#if points.length >= 2}
  <dl class="coordinates" aria-live="polite">
    {#if mode === "points"}
      <dt>{labels.measureHorizontal}</dt>
      <dd>{fmt(horizontalDistance(points[0]!, points[1]!))}</dd>
      <dt>{labels.measureDirect}</dt>
      <dd>{fmt(directDistance(points[0]!, points[1]!))}</dd>
    {:else}
      <dt>{labels.measureRoute}</dt>
      <dd>{fmt(routeLength(points))}</dd>
    {/if}
  </dl>
{/if}

<style>
  select {
    display: block;
    width: 100%;
  }
  .number-field {
    margin-top: var(--gaia-space-10);
  }
  ol {
    padding-left: var(--gaia-space-17);
    font-variant-numeric: tabular-nums;
  }
</style>
