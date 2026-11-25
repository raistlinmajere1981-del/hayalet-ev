<script lang="ts">
  import type en from "../../../i18n/en.json";
  import { yaw360, worldPose, type Id, type V2, type V3, type World } from "../../spatial/world.ts";
  import type { SiteEdit } from "../../spatial/site-edits.ts";
  import { objectMeasurements } from "../../spatial/measurements.ts";
  import { deviceName } from "../../devices/inventory.ts";

  let {
    world,
    id,
    labels,
    editable,
    disabled,
    onedit,
  }: {
    world: World;
    id: Id;
    labels: typeof en.site;
    editable: boolean;
    disabled: boolean;
    onedit: (edit: SiteEdit, input: HTMLInputElement) => void;
  } = $props();

  const node = $derived(world.nodes[id]!);
  const geometry = $derived(node.geometry);
  const worldPosition = $derived(worldPose(world, id).p);
  const measurements = $derived(objectMeasurements(world, id));
  const devices = $derived(
    Object.entries(world.devices).filter(([, device]) => device.mount === id)
  );
  const fmt = (n: number) => String(Number(n.toFixed(3)));
  const axisLabels = ["X", "Y", "Z"] as const;
  const sizeLabels = $derived([labels.width, labels.depth, labels.height]);

  function replace<T extends V2 | V3>(point: T, axis: number, value: number): T {
    const next = [...point] as T;
    next[axis] = value;
    return next;
  }

  function editBuilding(
    input: HTMLInputElement,
    axis: number,
    value: number,
    field: "size" | "p" | "yaw"
  ) {
    const size: V3 = geometry?.kind === "box" ? geometry.size : [6, 4, 3];
    onedit(
      {
        op: "building",
        id,
        pose: {
          p: field === "p" ? replace(node.p, axis, value) : node.p,
          yaw: field === "yaw" ? yaw360(value) : node.yaw,
        },
        size: field === "size" ? replace(size, axis, value) : size,
      },
      input
    );
  }

  function change(
    event: Event,
    previous: number,
    callback: (input: HTMLInputElement, value: number) => void
  ) {
    const input = event.currentTarget as HTMLInputElement;
    const value = input.valueAsNumber;
    if (Number.isFinite(value)) callback(input, value);
    else input.value = fmt(previous);
  }
</script>

<div class="object-heading" data-selected-id={id}>
  <p class="muted">{labels[node.kind]}</p>
  <h2>{node.name}</h2>
</div>
<dl class="coordinates">
  <dt>{labels.coordinates}</dt>
  <dd>{worldPosition.map(fmt).join(" · ")}</dd>
  <dt>{labels.measureElevation}</dt>
  <dd>{fmt(measurements.elevation)} m</dd>
  {#if measurements.area !== undefined}
    <dt>{labels.measureArea}</dt>
    <dd>{fmt(measurements.area)} m²</dd>
  {/if}
  {#if measurements.dimensions && node.kind !== "building"}
    <dt>{labels.size}</dt>
    <dd>{measurements.dimensions.map(fmt).join(" × ")} m</dd>
  {/if}
  {#if measurements.route}
    <dt>{labels.measureRoute}</dt>
    <dd>{fmt(measurements.route.length)} m</dd>
    <dt>{labels.measureEndpoints} · {labels.measureHorizontal}</dt>
    <dd>{fmt(measurements.route.horizontal)} m</dd>
    <dt>{labels.measureEndpoints} · {labels.measureDirect}</dt>
    <dd>{fmt(measurements.route.direct)} m</dd>
  {/if}
</dl>

{#snippet number(
  label: string,
  n: number,
  callback: (input: HTMLInputElement, value: number) => void
)}
  <label class="number-field">
    <span>{label}</span>
    <input
      type="number"
      step="any"
      value={fmt(n)}
      {disabled}
      onchange={(event) => change(event, n, callback)}
    />
  </label>
{/snippet}

{#if editable && (node.kind === "building" || node.kind === "mount")}
  <fieldset>
    <legend>{labels.local}</legend>
    <div class="field-row">
      {#each axisLabels as axis, i}
        {@render number(axis, node.p[i]!, (input, value) =>
          node.kind === "building"
            ? editBuilding(input, i, value, "p")
            : onedit({ op: "point", id, p: replace(node.p, i, value) }, input)
        )}
      {/each}
    </div>
  </fieldset>
{/if}

{#if node.kind === "building"}
  {#if editable}
    <fieldset>
      <legend>{labels.size}</legend>
      <div class="field-row">
        {#each sizeLabels as label, i}
          {@render number(
            label,
            (geometry?.kind === "box" ? geometry.size : [6, 4, 3])[i]!,
            (input, value) => editBuilding(input, i, value, "size")
          )}
        {/each}
      </div>
    </fieldset>
    {@render number(labels.yaw, node.yaw, (input, value) => editBuilding(input, 0, value, "yaw"))}
  {:else}
    <dl class="coordinates">
      {#if geometry?.kind === "box"}<dt>{labels.size}</dt>
        <dd>{geometry.size.map(fmt).join(" × ")}</dd>{/if}
      <dt>{labels.yaw}</dt>
      <dd>{fmt(node.yaw)}°</dd>
    </dl>
  {/if}
{/if}

{#if node.kind === "floor"}
  {#if editable}
    {@render number(labels.elevation, node.p[2], (input, z) =>
      onedit({ op: "elevation", id, z }, input)
    )}
  {:else}
    <dl class="coordinates">
      <dt>{labels.elevation}</dt>
      <dd>{fmt(node.p[2])}</dd>
    </dl>
  {/if}
{/if}

{#if (geometry?.kind === "footprint" && node.kind === "site") || geometry?.kind === "path"}
  {@const points = geometry.kind === "footprint" ? geometry.ring : geometry.vertices}
  <details open={editable}>
    <summary>{labels.vertices} · {points.length}</summary>
    {#each points as point, i}
      <div class="vertex">
        <span>{i + 1}</span>
        {#if editable}
          <div class="field-row">
            {#each point as n, axis}
              {@render number(axisLabels[axis]!, n, (input, value) => {
                if (geometry.kind === "footprint")
                  onedit(
                    {
                      op: "boundary",
                      id,
                      ring: geometry.ring.map((p, j) => (i === j ? replace(p, axis, value) : p)),
                    },
                    input
                  );
                else
                  onedit(
                    {
                      op: "path",
                      id,
                      vertices: geometry.vertices.map((p, j) =>
                        i === j ? replace(p, axis, value) : p
                      ),
                    },
                    input
                  );
              })}
            {/each}
          </div>
        {:else}
          <span>{point.map(fmt).join(" · ")}</span>
        {/if}
      </div>
    {/each}
  </details>
{/if}

{#if devices.length}
  <div class="device-card">
    <h3>{labels.devices}</h3>
    <ul>
      {#each devices as [deviceId] (deviceId)}
        <li>{deviceName(world, deviceId)}</li>
      {/each}
    </ul>
  </div>
{/if}
