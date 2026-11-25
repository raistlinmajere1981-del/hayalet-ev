<script lang="ts">
  import type { V2 } from "../../spatial/world.ts";
  let {
    source,
    pixels,
    points,
    label,
    hint,
    onpick,
  }: {
    source: string;
    pixels: V2;
    points: V2[];
    label: string;
    hint: string;
    onpick: (point: V2) => void;
  } = $props();

  let svg: SVGSVGElement;
  const marker = $derived(Math.max(...pixels) / 90);

  function pick(event: PointerEvent) {
    if (event.button !== 0) return;
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    const { x, y } = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    onpick([x, y]);
  }
</script>

<div class="calibration-image">
  <svg
    bind:this={svg}
    role="img"
    aria-label={label}
    onpointerup={pick}
    viewBox={`0 0 ${pixels.join(" ")}`}
  >
    <image href={source} width={pixels[0]} height={pixels[1]} preserveAspectRatio="none" />
    {#if points.length === 2}
      <polyline
        points={points.map((point) => point.join(",")).join(" ")}
        fill="none"
        stroke="var(--gaia-map-handle)"
        stroke-width="2"
        vector-effect="non-scaling-stroke"
      />
    {/if}
    {#each points as [x, y], index}
      <circle
        cx={x}
        cy={y}
        r={marker}
        fill="var(--gaia-map-handle)"
        stroke="var(--gaia-bg-surface)"
        stroke-width="2"
        vector-effect="non-scaling-stroke"
      />
      <text
        x={x + marker * 1.5}
        y={y + marker * 0.55}
        font-size={marker * 2.2}
        fill="var(--gaia-text-primary)"
        stroke="var(--gaia-bg-surface)"
        stroke-width="3"
        paint-order="stroke"
        vector-effect="non-scaling-stroke">{index === 0 ? "A" : "B"}</text
      >
    {/each}
  </svg>
  <p>{hint}</p>
</div>

<style>
  .calibration-image {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    padding: var(--gaia-panel-padding);
    gap: var(--gaia-space-10);
  }
  svg {
    width: 100%;
    flex: 1;
    min-height: 0;
    cursor: crosshair;
  }
  p {
    text-align: center;
    margin: 0;
  }
</style>
