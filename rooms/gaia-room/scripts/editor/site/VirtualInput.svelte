<script lang="ts">
  import type en from "../../../i18n/en.json";
  import { capabilityOf, type CapabilityId } from "../../devices/capabilities.ts";
  import { freshForMs, type DeviceStatus } from "../../devices/status.ts";
  import type { VirtualUpdate } from "../../devices/status.ts";

  let {
    id,
    capabilities,
    status,
    labels,
    disabled,
    onpublish,
  }: {
    id: string;
    capabilities: string[];
    status?: DeviceStatus;
    labels: typeof en.site;
    disabled: boolean;
    onpublish: (update: VirtualUpdate) => Promise<void>;
  } = $props();

  const observable = $derived(
    capabilities.filter((key) => {
      const definition = capabilityOf(key);
      return definition && definition.kind !== "media";
    })
  );
  let selected = $state("");
  const capability = $derived(observable.includes(selected) ? selected : observable[0]);
  const definition = $derived(capability ? capabilityOf(capability) : undefined);
  let sampleState = $state<"fresh" | "stale" | "invalid">("fresh");
  let linkState = $state<"online" | "offline">("online");

  function link(event: SubmitEvent) {
    event.preventDefault();
    if (!disabled) void onpublish({ kind: "link", deviceId: id, state: linkState });
  }

  function sample(event: SubmitEvent) {
    event.preventDefault();
    if (disabled || !capability || !definition || definition.kind === "media") return;
    const raw = new FormData(event.currentTarget as HTMLFormElement).get("sample");
    const quality = sampleState === "invalid" ? "invalid" : "valid";
    const value =
      quality === "invalid" ? null : definition.kind === "boolean" ? raw === "on" : Number(raw);
    void onpublish({
      kind: "observation",
      deviceId: id,
      capability,
      at: Date.now() - (sampleState === "stale" ? freshForMs * 5 : 0),
      quality,
      value,
      unit: definition.unit,
    });
  }
</script>

<details class="virtual-input">
  <summary>{labels.virtualInput}</summary>
  <form onsubmit={link}>
    <label>
      {labels.connection}
      <select bind:value={linkState} {disabled}>
        <option value="online">{labels.online}</option>
        <option value="offline">{labels.offline}</option>
      </select>
    </label>
    <button type="submit" {disabled}>{labels.publishLink}</button>
  </form>
  {#if definition && capability && definition.kind !== "media"}
    <form onsubmit={sample}>
      <label>
        {labels.capabilities}
        <select bind:value={() => capability, (value) => (selected = value)} {disabled}>
          {#each observable as key (key)}
            <option value={key}>{labels[key as CapabilityId]}</option>
          {/each}
        </select>
      </label>
      <label>
        {labels.sampleQuality}
        <select bind:value={sampleState} {disabled}>
          <option value="fresh">{labels.fresh}</option>
          <option value="stale">{labels.staleData}</option>
          <option value="invalid">{labels.invalid}</option>
        </select>
      </label>
      {#if sampleState !== "invalid"}
        {#key capability}
          {@const previous = status?.observations[capability]?.value}
          <label>
            {labels.reading}
            {definition.kind === "number" ? `(${definition.unit})` : ""}
            {#if definition.kind === "number"}
              <input
                required
                type="number"
                step="any"
                name="sample"
                value={typeof previous === "number" ? previous : undefined}
                {disabled}
              />
            {:else}
              <select name="sample" value={previous === false ? "off" : "on"} {disabled}>
                <option value="on">{labels.valueOn}</option>
                <option value="off">{labels.valueOff}</option>
              </select>
            {/if}
          </label>
        {/key}
      {/if}
      <button type="submit" {disabled}>{labels.publish}</button>
    </form>
  {/if}
</details>
