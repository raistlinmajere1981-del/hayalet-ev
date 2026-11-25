<script lang="ts">
  import type en from "../../../i18n/en.json";
  import { capabilityOf, type CapabilityId } from "../../devices/capabilities.ts";
  import { deviceIdsFor, deviceName, mountPath, type DeviceEdit } from "../../devices/inventory.ts";
  import { connection, deviceHealth, type DeviceStatuses } from "../../devices/status.ts";
  import { objectMeasurements } from "../../spatial/measurements.ts";
  import { toParent, worldPose, type Id, type World } from "../../spatial/world.ts";
  import type { VirtualUpdate } from "../../devices/status.ts";
  import DeviceForm from "./DeviceForm.svelte";
  import Observations from "./Observations.svelte";
  import VirtualInput from "./VirtualInput.svelte";
  import { badgeSymbols, healthLabel } from "./device-view.ts";

  let {
    world,
    selected,
    labels,
    locale,
    statuses,
    now,
    disabled,
    statusBusy,
    statusError,
    visibleIds,
    creating,
    oncancel,
    onapply,
    onselect,
    onfocus,
    onplace,
    ondelete,
    onpublish,
  }: {
    world: World;
    selected?: Id;
    labels: typeof en.site;
    locale: string;
    statuses: DeviceStatuses;
    now: number;
    disabled: boolean;
    statusBusy: boolean;
    statusError: boolean;
    visibleIds: ReadonlySet<Id>;
    creating: boolean;
    oncancel: () => void;
    onapply: (edit: DeviceEdit) => Promise<boolean>;
    onselect: (id?: Id) => void;
    onfocus: (id: Id) => void;
    onplace: (id: Id) => void;
    ondelete: (edit: Extract<DeviceEdit, { op: "deleteDevice" }>) => void;
    onpublish: (update: VirtualUpdate) => Promise<void>;
  } = $props();

  const device = $derived(selected ? world.devices[selected] : undefined);
  const hasObservations = $derived(
    device?.capabilities.some((id) => {
      const definition = capabilityOf(id);
      return definition && definition.kind !== "media";
    })
  );
  const node = $derived(selected ? world.nodes[selected] : undefined);
  const status = $derived(selected ? statuses[selected] : undefined);
  const scope = $derived(deviceIdsFor(world, selected));
  const projectTotal = $derived(Object.keys(world.devices).length);
  const placed = $derived(scope.filter((id) => world.devices[id]?.mount));
  const unplaced = $derived(Object.values(world.devices).filter(({ mount }) => !mount).length);
  const links = $derived.by(() => {
    const counts = { online: 0, offline: 0, unknown: 0, unbound: 0 };
    for (const id of scope) counts[connection(world.devices[id]!, statuses[id])]++;
    return counts;
  });
  const attention = $derived(
    scope.filter((id) => deviceHealth(world.devices[id]!, statuses[id], now) !== "online")
  );
  const locations = $derived(
    device
      ? Object.entries(world.nodes)
          .filter(([, node]) => node.kind === "mount")
          .map(([id]) => ({ id, path: mountPath(world, id).join(" / ") }))
          .sort((a, b) => a.path.localeCompare(b.path, locale))
      : []
  );
  const canPlace = $derived(Object.values(world.nodes).some((item) => item.kind === "site"));
  const timeFormat = $derived(
    new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "medium" })
  );
  const numberFormat = $derived(new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }));
  const metric = (value: number) => numberFormat.format(value) + " m";
  const measurements = $derived(selected && node ? objectMeasurements(world, selected) : undefined);
  const route = $derived.by(() => {
    if (!selected || node?.geometry?.kind !== "path") return undefined;
    const pose = worldPose(world, selected);
    return node.geometry.vertices.map((point) => toParent(pose, point));
  });

  let editing = $state(false);
  let mounting = $state(false);
  let mountChoice = $state("");

  async function applyMount(event: SubmitEvent, id: Id) {
    event.preventDefault();
    if (mountChoice && (await onapply({ op: "mountDevice", id, mount: mountChoice })))
      mounting = false;
  }

  async function detach(id: Id) {
    if (await onapply({ op: "mountDevice", id, mount: null })) mounting = false;
  }
</script>

{#snippet time(at?: number)}
  {#if at}
    <time datetime={new Date(at).toISOString()}>{timeFormat.format(at)}</time>
  {:else}—{/if}
{/snippet}

{#snippet badge(health: ReturnType<typeof deviceHealth>)}
  <span class="status-label" data-device-health={health}>
    <span class="status-icon" aria-hidden="true">{badgeSymbols[health]}</span>
    <span>{healthLabel(labels, health)}</span>
  </span>
{/snippet}

{#snippet focus(id: Id)}
  <button type="button" {disabled} onclick={() => onfocus(id)}>
    {visibleIds.has(id) ? labels.focus : labels.showFocus}
  </button>
{/snippet}

{#snippet deviceRows(ids: Id[], showObservations: boolean)}
  <ul class="scope-devices">
    {#each ids as id (id)}
      {@const item = world.devices[id]!}
      {@const current = statuses[id]}
      {@const link = connection(item, current)}
      {@const health = deviceHealth(item, current, now)}
      <li>
        <button class="device-link" type="button" {disabled} onclick={() => onselect(id)}>
          {deviceName(world, id)}
        </button>
        {@render badge(link)}
        {#if health !== link}<small>{healthLabel(labels, health)}</small>{/if}
        {#if showObservations}
          <Observations capabilities={item.capabilities} status={current} {now} {labels} {locale} />
        {/if}
      </li>
    {/each}
  </ul>
{/snippet}

{#if statusError}<p role="alert">{labels.statusUnavailable}</p>{/if}
{#if creating}
  <DeviceForm {labels} {disabled} {onapply} {oncancel} />
{:else if device && selected}
  {@const id = selected}
  {@const link = connection(device, status)}
  {@const last = Math.max(0, ...Object.values(status?.observations ?? {}).map(({ at }) => at))}
  <div class="object-heading" data-selected-id={id}>
    <p class="muted">
      {labels.device} · {device.source === "virtual" ? labels.virtual : labels.physical}
    </p>
    <h2>{deviceName(world, id)}</h2>
    {@render badge(link)}
  </div>
  {#if editing}
    <DeviceForm
      {id}
      {device}
      initialName={deviceName(world, id)}
      {labels}
      {disabled}
      {onapply}
      oncancel={() => (editing = false)}
    />
  {:else}
    <dl class="management-facts">
      <dt>{labels.position}</dt>
      <dd>{device.mount ? mountPath(world, device.mount).join(" / ") : labels.unplaced}</dd>
      <dt>{labels.lastContact}</dt>
      <dd>{@render time(status?.lastContactAt)}</dd>
      <dt>{labels.lastMeasurement}</dt>
      <dd>{@render time(last)}</dd>
    </dl>

    {#if device.mount || locations.length || canPlace}
      <div class="property-actions">
        {#if device.mount}{@render focus(id)}{/if}
        {#if locations.length || canPlace}
          <button
            type="button"
            {disabled}
            aria-expanded={mounting}
            onclick={() => {
              mounting = !mounting;
              mountChoice = device?.mount ?? "";
            }}
          >
            {labels.changeMount}
          </button>
        {/if}
      </div>
      {#if mounting}
        {#if locations.length}
          <form class="device-form" onsubmit={(event) => applyMount(event, id)}>
            <label>
              {labels.chooseMount}
              <select bind:value={mountChoice} {disabled}>
                <option value="">—</option>
                {#each locations as option (option.id)}<option value={option.id}>
                    {option.path}
                  </option>{/each}
              </select>
            </label>
            <button
              type="submit"
              disabled={disabled || !mountChoice || mountChoice === device.mount}
            >
              {labels.changeMount}
            </button>
          </form>
        {/if}
        <div class="property-actions">
          {#if canPlace}<button
              type="button"
              {disabled}
              onclick={() => {
                mounting = false;
                onplace(id);
              }}
            >
              {labels.newMount}
            </button>{/if}
          {#if device.mount}<button type="button" {disabled} onclick={() => detach(id)}>
              {labels.detachMount}
            </button>{/if}
        </div>
      {/if}
    {/if}

    {#if hasObservations}
      <section class="management-section" aria-label={labels.observations}>
        <h3>{labels.observations}</h3>
        <Observations
          capabilities={device.capabilities}
          {status}
          {now}
          {labels}
          {locale}
          detailed
        />
      </section>
    {/if}
    {#if device.source === "virtual"}
      <VirtualInput
        {id}
        capabilities={device.capabilities}
        {status}
        {labels}
        disabled={disabled || statusBusy}
        {onpublish}
      />
    {/if}
    <details class="management-section">
      <summary>{labels.device}</summary>
      <dl class="management-facts">
        <dt>{labels.deviceId}</dt>
        <dd class="device-id">{id}</dd>
        <dt>{labels.deviceRoles}</dt>
        <dd>{(device.roles ?? [device.role]).map((role) => labels[role]).join(", ")}</dd>
        <dt>{labels.capabilities}</dt>
        <dd>
          {device.capabilities.map((key) => labels[key as CapabilityId] ?? key).join(", ") ||
            labels.noCapabilities}
        </dd>
        {#if device.manufacturer}<dt>{labels.manufacturer}</dt>
          <dd>{device.manufacturer}</dd>{/if}
        {#if device.model}<dt>{labels.model}</dt>
          <dd>{device.model}</dd>{/if}
      </dl>
    </details>
    <div class="property-actions">
      <button type="button" {disabled} onclick={() => (editing = true)}>{labels.editDevice}</button>
      <button
        type="button"
        class="danger"
        {disabled}
        onclick={() =>
          ondelete({
            op: "deleteDevice",
            id,
            mount: device?.mount ?? null,
            hardwareId: device?.hardwareId ?? null,
          })}
      >
        {labels.deleteDevice}
      </button>
    </div>
  {/if}
{:else}
  <div class="object-heading" data-selected-id={selected}>
    {#if node}<p class="muted">{labels[node.kind]}</p>{/if}
    <h2>{node?.name ?? labels.inventory}</h2>
    {#if selected}{@render focus(selected)}{/if}
  </div>
  {#if route && measurements?.route}
    {@const role = node?.role}
    {@const elevations = route.map((point) => point[2])}
    <dl class="management-facts">
      <dt>{labels.routeType}</dt>
      <dd>
        {role === "water" || role === "electricity" ? labels[role] : (role ?? labels.unspecified)}
      </dd>
      <dt>{labels.measureRoute}</dt>
      <dd>{metric(measurements.route.length)}</dd>
      <dt>{labels.measureHorizontal} · {labels.measureEndpoints}</dt>
      <dd>{metric(measurements.route.horizontal)}</dd>
      <dt>{labels.measureDirect} · {labels.measureEndpoints}</dt>
      <dd>{metric(measurements.route.direct)}</dd>
      <dt>{labels.routeElevations}</dt>
      <dd>{metric(Math.min(...elevations))} → {metric(Math.max(...elevations))}</dd>
    </dl>
    <details class="management-section">
      <summary>{labels.vertices} · {route.length}</summary>
      <ol>
        {#each route as point}
          <li>{point.map((value) => numberFormat.format(value)).join(" · ")} m</li>
        {/each}
      </ol>
    </details>
  {:else if node?.kind !== "object"}
    <dl class="management-facts scope-counts">
      <dt>{node?.kind === "site" ? labels.projectDeviceTotal : labels.deviceTotal}</dt>
      <dd data-count="total">{node?.kind === "site" ? projectTotal : scope.length}</dd>
      {#if !node || node.kind === "site"}
        <dt>{node ? labels.siteDevicePlaced : labels.devicePlaced}</dt>
        <dd data-count="placed">{placed.length}</dd>
      {/if}
      {#if node?.kind === "site" && unplaced}
        <dt>{labels.unplacedDevices}</dt>
        <dd>
          <button type="button" {disabled} onclick={() => onselect(undefined)}>{unplaced}</button>
        </dd>
      {/if}
    </dl>
    {#if scope.length}
      <ul class="status-summary" aria-label={labels.connection}>
        {#each Object.entries(links) as [link, count] (link)}
          {#if count}<li>
              {@render badge(link as keyof typeof links)} <strong>{count}</strong>
            </li>{/if}
        {/each}
      </ul>
      {#if !node || node.kind === "site"}
        {#if attention.length}
          <section class="management-section">
            <h3>{labels.attention} · {attention.length}</h3>
            {@render deviceRows(attention, false)}
          </section>
        {/if}
      {/if}
      {#if !node || node.kind !== "site"}
        <section class="management-section">
          <h3>{labels.devices}</h3>
          {@render deviceRows(scope, !!node)}
        </section>
      {/if}
    {:else}
      <p class="muted">{labels.noDevices}</p>
    {/if}
  {:else if measurements}
    <details class="management-section">
      <summary>{labels.inspector}</summary>
      <dl class="management-facts">
        {#if measurements.dimensions}<dt>{labels.size}</dt>
          <dd>{measurements.dimensions.map(metric).join(" × ")}</dd>{/if}
        <dt>{labels.measureElevation}</dt>
        <dd>{metric(measurements.elevation)}</dd>
      </dl>
    </details>
  {/if}
{/if}
