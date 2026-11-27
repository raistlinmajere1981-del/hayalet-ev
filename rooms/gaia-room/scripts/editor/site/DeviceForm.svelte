<script lang="ts">
  import { untrack } from "svelte";
  import type en from "../../../i18n/en.json";
  import {
    capabilities,
    capabilityOf,
    deviceRoles,
    type CapabilityId,
    type DeviceRole,
  } from "../../devices/capabilities.ts";
  import type { DeviceDetails, DeviceEdit } from "../../devices/inventory.ts";
  import type { Device, Id } from "../../spatial/world.ts";

  let {
    id,
    device,
    initialName = "",
    labels,
    disabled,
    onapply,
    oncancel,
  }: {
    id?: Id;
    device?: Device;
    initialName?: string;
    labels: typeof en.site;
    disabled: boolean;
    onapply: (edit: DeviceEdit) => Promise<boolean>;
    oncancel: () => void;
  } = $props();

  let name = $state(untrack(() => device?.name ?? initialName));
  let manufacturer = $state(untrack(() => device?.manufacturer ?? ""));
  let model = $state(untrack(() => device?.model ?? ""));
  let source = $state<Device["source"]>("virtual");
  let selectedRoles = $state<DeviceRole[]>(
    untrack(() => device?.roles ?? [device?.role ?? "sensor"])
  );
  let selectedCapabilities = $state<string[]>(untrack(() => device?.capabilities ?? []));
  function available(capability: string): boolean {
    const definition = capabilityOf(capability);
    if (!definition || !("physical" in definition) || !definition.physical) return true;
    return device?.source === "physical" || (!device && source === "physical");
  }
  const capabilityOptions = $derived([
    ...Object.keys(capabilities).filter(available),
    ...(device?.capabilities.filter((capability) => !Object.hasOwn(capabilities, capability)) ??
      []),
  ]);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (disabled || !name.trim() || !selectedRoles.length) return;
    const filteredCapabilities = selectedCapabilities.filter((capability) =>
      device ? available(capability) || device.capabilities.includes(capability) : available(capability)
    );
    const details: DeviceDetails = {
      name: name.trim(),
      roles: [...selectedRoles],
      capabilities: filteredCapabilities,
      ...(manufacturer.trim() ? { manufacturer: manufacturer.trim() } : {}),
      ...(model.trim() ? { model: model.trim() } : {}),
    };
    const edit: DeviceEdit = id
      ? { op: "updateDevice", id, details }
      : { op: "createDevice", id: crypto.randomUUID(), source, details };
    if (await onapply(edit)) oncancel();
  }
</script>

<form class="device-form" onsubmit={submit}>
  <h3>{id ? labels.editDevice : labels.addDevice}</h3>
  <fieldset {disabled}>
    <label>{labels.deviceName}<input required maxlength="100" bind:value={name} /></label>
    {#if !device}
      <label>
        {labels.deviceSource}
        <select bind:value={source}>
          <option value="virtual">{labels.virtual}</option>
          <option value="physical">{labels.physical}</option>
        </select>
      </label>
    {/if}
    <label>{labels.manufacturer}<input maxlength="100" bind:value={manufacturer} /></label>
    <label>{labels.model}<input maxlength="100" bind:value={model} /></label>

    <div class="management-checks" role="group" aria-label={labels.deviceRoles}>
      <strong>{labels.deviceRoles}</strong>
      {#each deviceRoles as role (role)}
        <label>
          <input type="checkbox" bind:group={selectedRoles} value={role} />{labels[role]}
        </label>
      {/each}
      {#if !selectedRoles.length}<small>{labels.roleRequired}</small>{/if}
    </div>

    <div class="management-checks" role="group" aria-label={labels.capabilities}>
      <strong>{labels.capabilities}</strong>
      {#each capabilityOptions as capability (capability)}
        <label>
          <input type="checkbox" bind:group={selectedCapabilities} value={capability} />
          {labels[capability as CapabilityId] ?? capability}
        </label>
      {/each}
    </div>
    <div class="property-actions">
      <button type="submit" class="primary" disabled={!name.trim() || !selectedRoles.length}>
        {id ? labels.applyDevice : labels.createDevice}
      </button>
      <button type="button" onclick={oncancel}>{labels.cancel}</button>
    </div>
  </fieldset>
</form>
