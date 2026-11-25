<script lang="ts">
  import { onMount, untrack } from "svelte";
  import type { Id, V2, V3 } from "../../spatial/world.ts";
  import { boxRing, deviceColor, frame, type Bounds, type SpatialItem } from "./scene.ts";
  import { cssColor, selectedPlan } from "../palette.ts";

  let {
    items,
    selected,
    states,
    label,
    focus,
    editable,
    placement,
    working,
    onselect,
    onplace,
    onmove,
    oncorner,
  }: {
    items: SpatialItem[];
    selected?: Id;
    states: ReadonlyMap<Id, string>;
    label: string;
    focus: { id?: Id };
    editable: boolean;
    placement: boolean;
    working: V3[];
    onselect: (id?: Id) => void;
    onplace: (point: V3) => void;
    onmove: (id: Id, delta: V2) => void;
    oncorner: (id: Id, index: number, point: V3) => void;
  } = $props();

  let svg: SVGSVGElement;
  let width = $state(800);
  let height = $state(600);
  let view = $state({ x: 0, y: 0, scale: 16 });
  let gesture = $state<{
    client: V2;
    origin: V2;
    id?: Id;
    corner?: number;
    mode: "move" | "pan" | "pick";
  }>();
  let delta = $state<V2>([0, 0]);
  const viewWidth = $derived(width / view.scale);
  const viewHeight = $derived(height / view.scale);
  const unit = $derived(1 / view.scale);
  const grid = $derived(10 ** Math.ceil(Math.log10(26 * unit)));
  const selectedBoundary = $derived(
    items.find((item) => item.id === selected && item.node.kind === "site")
  );

  function fit(bounds: Bounds) {
    const w = Math.max(3, bounds.max[0] - bounds.min[0]);
    const h = Math.max(3, bounds.max[1] - bounds.min[1]);
    view = {
      x: (bounds.max[0] + bounds.min[0]) / 2,
      y: -(bounds.max[1] + bounds.min[1]) / 2,
      scale: Math.min(width / w, height / h) * 0.82,
    };
  }

  $effect(() => {
    // The camera follows explicit focus and viewport size changes, leaving edits in place.
    const { id } = focus;
    fit(
      frame(
        untrack(() => items),
        id
      )
    );
  });

  function pointer(event: MouseEvent): V3 {
    const rect = svg.getBoundingClientRect();
    return [
      view.x + (event.clientX - rect.left - width / 2) * unit,
      -(view.y + (event.clientY - rect.top - height / 2) * unit),
      0,
    ];
  }

  function start(event: PointerEvent) {
    if (gesture || (event.button !== 0 && event.button !== 1 && event.button !== 2)) return;
    const hit = (event.target as Element).closest<SVGElement>("[data-gaia-id]");
    const id = hit?.dataset.gaiaId;
    const item = items.find((entry) => entry.id === id);
    const corner = hit?.dataset.corner;
    const move =
      editable &&
      !placement &&
      (corner !== undefined || (item?.node.kind === "building" && item.id === selected));
    gesture = {
      client: [event.clientX, event.clientY],
      origin: [view.x, view.y],
      id,
      corner: corner === undefined ? undefined : Number(corner),
      mode:
        event.button !== 0 || event.shiftKey || (!id && !placement)
          ? "pan"
          : move
            ? "move"
            : "pick",
    };
    delta = [0, 0];
    svg.setPointerCapture(event.pointerId);
  }

  function drag(event: PointerEvent) {
    if (!gesture) return;
    delta = [
      (event.clientX - gesture.client[0]) * unit,
      -(event.clientY - gesture.client[1]) * unit,
    ];
    if (gesture.mode === "pan")
      view = { ...view, x: gesture.origin[0] - delta[0], y: gesture.origin[1] + delta[1] };
  }

  function finish(event: PointerEvent) {
    if (!gesture) return;
    const { mode, client, id, corner } = gesture;
    const moved = Math.hypot(event.clientX - client[0], event.clientY - client[1]) > 4;
    if (event.button === 0 && !moved && !event.shiftKey) {
      if (placement) onplace(pointer(event));
      else onselect(id);
    } else if (mode === "move" && id && moved) {
      if (corner === undefined) onmove(id, delta);
      else {
        const item = items.find((entry) => entry.id === id);
        const ring = item?.shape.kind === "area" ? item.shape.ring : [];
        const point = ring[corner];
        if (point) oncorner(id, corner, [point[0] + delta[0], point[1] + delta[1], point[2]]);
      }
    }
    cancel();
  }

  function cancel() {
    gesture = undefined;
    delta = [0, 0];
  }

  function wheel(event: WheelEvent) {
    event.preventDefault();
    if (gesture) return;
    const [x, y] = pointer(event);
    const scale = Math.min(12000, Math.max(0.000001, view.scale * Math.exp(-event.deltaY * 0.002)));
    const ratio = view.scale / scale;
    view = { scale, x: x + (view.x - x) * ratio, y: -y + (view.y + y) * ratio };
  }

  onMount(() => {
    const observer = new ResizeObserver(([entry]) => {
      if (!entry || !entry.contentRect.width || !entry.contentRect.height) return;
      width = entry.contentRect.width;
      height = entry.contentRect.height;
    });
    observer.observe(svg);
    svg.addEventListener("wheel", wheel, { passive: false });
    return () => {
      observer.disconnect();
      svg.removeEventListener("wheel", wheel);
    };
  });

  const polygon = (ring: V3[]) => ring.map(([x, y]) => `${x},${-y}`).join(" ");
</script>

<svg
  bind:this={svg}
  class:placement
  viewBox={`${view.x - viewWidth / 2} ${view.y - viewHeight / 2} ${viewWidth} ${viewHeight}`}
  role="application"
  aria-label={label}
  onpointerdown={start}
  onpointermove={drag}
  onpointerup={finish}
  onpointercancel={cancel}
  onlostpointercapture={cancel}
  oncontextmenu={(event) => event.preventDefault()}
>
  <defs>
    <pattern id="gaia-grid" width={grid} height={grid} patternUnits="userSpaceOnUse">
      <path
        d={`M ${grid} 0 L 0 0 0 ${grid}`}
        fill="none"
        stroke="currentColor"
        stroke-opacity=".12"
        stroke-width={unit}
      />
    </pattern>
  </defs>
  <rect
    x={view.x - viewWidth / 2}
    y={view.y - viewHeight / 2}
    width={viewWidth}
    height={viewHeight}
    fill="url(#gaia-grid)"
  />
  {#each items as item (item.id)}
    {@const { id, shape, pose, node } = item}
    {@const active = id === selected}
    {@const color = cssColor(active ? selectedPlan : node.kind === "mount" ? deviceColor(states.get(id)) : item.color)}
    {@const moving = gesture?.mode === "move" && gesture.id === id && gesture.corner === undefined}
    <g
      data-gaia-id={id}
      data-kind={node.kind}
      data-below={item.below}
      style:color
      transform={moving ? `translate(${delta[0]} ${-delta[1]})` : undefined}
    >
      <title>{node.name}</title>
      {#if shape.kind === "area" || shape.kind === "box"}
        <polygon
          points={polygon(shape.kind === "area" ? shape.ring : boxRing(pose, shape.size))}
          fill="currentColor"
          fill-opacity={active ? 0.25 : node.kind === "floor" ? 0.04 : 0.16}
          pointer-events={node.kind === "floor" ? "stroke" : "visiblePainted"}
          stroke="currentColor"
          stroke-width={active ? 2.3 * unit : node.kind === "floor" ? 0.9 * unit : 1.3 * unit}
          stroke-dasharray={item.below || node.kind === "floor"
            ? `${5 * unit} ${3 * unit}`
            : undefined}
        />
      {:else if shape.kind === "point" || shape.kind === "cylinder"}
        <circle
          cx={pose.p[0]}
          cy={-pose.p[1]}
          r={shape.kind === "cylinder" ? Math.max(4 * unit, shape.radius) : 5 * unit}
          stroke={node.kind === "mount" ? "var(--gaia-bg-surface)" : color}
          stroke-width={1.5 * unit}
          fill="currentColor"
          fill-opacity={shape.kind === "cylinder" ? 0.35 : 1}
        />
      {:else}
        {#each shape.segments as [a, b]}
          {#if a[0] === b[0] && a[1] === b[1]}
            <circle cx={a[0]} cy={-a[1]} r={3 * unit} fill="currentColor" />
          {:else}
            <line
              x1={a[0]}
              y1={-a[1]}
              x2={b[0]}
              y2={-b[1]}
              stroke="transparent"
              stroke-width={12 * unit}
            />
            <line
              x1={a[0]}
              y1={-a[1]}
              x2={b[0]}
              y2={-b[1]}
              stroke="currentColor"
              stroke-width={(active ? 3.5 : 2.3) * unit}
              stroke-dasharray={a[2] < item.ground || b[2] < item.ground
                ? `${5 * unit} ${3 * unit}`
                : undefined}
            />
          {/if}
        {/each}
      {/if}
    </g>
  {/each}
  {#each items.filter(({ node }) => node.kind === "building") as item (item.id)}
    <text
      data-gaia-id={item.id}
      x={item.pose.p[0]}
      y={-item.bounds.min[1] + 15 * unit}
      font-size={13 * unit}
      text-anchor="middle"
      class="map-label"
    >
      {item.node.name}
    </text>
  {/each}
  {#if editable && !placement && selectedBoundary?.shape.kind === "area"}
    {#each selectedBoundary.shape.ring as point, index}
      {@const dragging = gesture?.mode === "move" && gesture.corner === index}
      <circle
        data-gaia-id={selectedBoundary.id}
        data-corner={index}
        cx={point[0] + (dragging ? delta[0] : 0)}
        cy={-point[1] - (dragging ? delta[1] : 0)}
        r={5 * unit}
        class="handle"
        stroke-width={1.5 * unit}
      />
    {/each}
  {/if}
  {#if working.length}
    <polyline points={polygon(working)} fill="none" stroke={cssColor(selectedPlan)} stroke-width={2 * unit} />
    {#each working as [x, y]}<circle cx={x} cy={-y} r={4 * unit} fill={cssColor(selectedPlan)} />{/each}
  {/if}
  <g
    transform={`translate(${view.x - viewWidth / 2 + 20 * unit}, ${view.y + viewHeight / 2 - 24 * unit})`}
    pointer-events="none"
  >
    <path
      d={`M 0 ${-4 * unit} V 0 H ${grid} V ${-4 * unit}`}
      fill="none"
      stroke="currentColor"
      stroke-width={unit}
    />
    <text x={grid / 2} y={-6 * unit} font-size={10 * unit} text-anchor="middle" fill="currentColor">
      {grid} m
    </text>
  </g>
</svg>

<style>
  svg {
    display: block;
    width: 100%;
    height: 100%;
    touch-action: none;
    user-select: none;
  }
  .placement {
    cursor: crosshair;
  }
  .map-label {
    fill: currentColor;
    paint-order: stroke;
    stroke: var(--gaia-bg-surface);
    stroke-width: var(--gaia-map-label-stroke);
    cursor: pointer;
    font-weight: 600;
  }
  .handle {
    fill: var(--gaia-map-handle);
    stroke: var(--gaia-bg-surface);
    cursor: move;
  }
</style>
