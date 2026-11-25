<script lang="ts">
  import { untrack } from "svelte";
  import type en from "../../../i18n/en.json";
  import { referenceScale } from "../../spatial/reference.ts";
  import type { Calibration, Id, V2, World } from "../../spatial/world.ts";
  import {
    imageMimes,
    maxImageBytes,
    type ReferenceEdit,
  } from "../../storage/reference-contract.ts";
  import type { CalibrationDraft } from "./calibration.ts";

  let {
    world,
    id,
    labels,
    editable,
    disabled,
    frame,
    calibration,
    value,
    ready,
    focusable,
    loadFailed,
    missing,
    onsave,
    onstart,
    oncancel,
    onpick,
    onpreview,
    onfocus,
    onerror,
  }: {
    world: World;
    id?: Id;
    labels: typeof en.site;
    editable: boolean;
    disabled: boolean;
    frame: Id | null;
    calibration?: CalibrationDraft;
    value?: Calibration;
    ready: boolean;
    focusable: boolean;
    loadFailed: boolean;
    missing: boolean;
    onsave: (edit: ReferenceEdit) => Promise<boolean>;
    onstart: () => void;
    oncancel: () => void;
    onpick: (point: V2) => void;
    onpreview: () => void;
    onfocus: () => void;
    onerror: (message: string) => void;
  } = $props();

  const layer = $derived(id ? world.references[id] : undefined);
  const pixels = $derived(layer && world.assets[layer.asset]?.pixels);
  const frames = $derived(
    Object.entries(world.nodes).filter(([, node]) =>
      ["site", "building", "floor", "zone"].includes(node.kind)
    )
  );
  const unavailable = $derived(missing || loadFailed);
  let confirmRemove = $state(false);
  let uploading = $state(false);
  let u = $state<number>();
  let v = $state<number>();
  let target = $state<string>(untrack(() => layer?.frame ?? ""));
  let shown = $state(untrack(() => layer?.visible !== false));
  let locked = $state(untrack(() => layer?.locked === true));
  let opacity = $state(untrack(() => Math.round((layer?.opacity ?? 1) * 100)));
  const changed = $derived(
    layer &&
      (target !== (layer.frame ?? "") ||
        shown !== (layer.visible !== false) ||
        locked !== (layer.locked === true) ||
        opacity !== Math.round(layer.opacity * 100))
  );
  const formats = imageMimes.join(",") + ",.png,.jpg,.jpeg,.bmp";
  const fmt = (n: number) => Number(n.toPrecision(7)).toString();

  async function upload(event: Event, replace: boolean) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    if (!file.size || file.size > maxImageBytes) {
      onerror(labels.refSizeLimit);
      return;
    }
    uploading = true;
    try {
      const image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error);
        reader.onload = () => resolve(String(reader.result).split(",", 2)[1] ?? "");
        reader.readAsDataURL(file);
      });
      const asset = crypto.randomUUID();
      const name = file.name.trim().slice(0, 160) || labels.references;
      await onsave(
        replace && id
          ? { op: "replace", id, asset, name, image }
          : { op: "import", id: crypto.randomUUID(), asset, name, image, frame }
      );
    } catch (error) {
      onerror(String(error));
    } finally {
      uploading = false;
    }
  }
</script>

{#if editable && !calibration}
  <label class="reference-file">
    <span>{labels.refImport}</span>
    <input
      type="file"
      accept={formats}
      disabled={disabled || uploading}
      onchange={(event) => upload(event, false)}
    />
  </label>
{/if}

{#if layer && id}
  <div class="object-heading">
    <h2>{layer.name ?? id}</h2>
    {#if pixels}<p class="muted">{pixels.join(" × ")} px</p>{/if}
    {#if unavailable}<p role="status">{missing ? labels.refMissing : labels.refDamaged}</p>
    {:else if !ready}<p class="muted" role="status">{labels.refLoading}</p>{/if}
  </div>
  {#if calibration}
    <form
      onsubmit={(event) => {
        event.preventDefault();
        if (id && value && calibration?.view === "plan")
          void onsave({ op: "calibrate", id, calibration: value });
      }}
    >
      <fieldset {disabled}>
        <legend>{labels.refCalibration}</legend>
        <p>{labels.refMarkPoints}</p>
        {#each calibration.points as point, index}
          <div class="calibration-coordinate">
            {index === 0 ? "A" : "B"} · {point.map(fmt).join(", ")} px
          </div>
        {/each}
        <button
          type="button"
          disabled={calibration.view === "pixels" && calibration.points.length === 0}
          onclick={() => {
            if (calibration) {
              calibration.points = [];
              calibration.view = "pixels";
            }
          }}>{labels.refResetPoints}</button
        >
        <details>
          <summary>{labels.refPixelEntry}</summary>
          <div class="field-row">
            <label class="number-field"
              ><span>{labels.refPixelU}</span><input type="number" step="any" bind:value={u} /></label
            >
            <label class="number-field"
              ><span>{labels.refPixelV}</span><input type="number" step="any" bind:value={v} /></label
            >
          </div>
          <button
            type="button"
            disabled={u === undefined || v === undefined}
            onclick={() => {
              if (u !== undefined && v !== undefined) onpick([u, v]);
            }}>{labels.refAddPoint}</button
          >
        </details>
        <label class="number-field">
          <span>{labels.refDistance}</span>
          <input type="number" step="any" min="0" bind:value={calibration.distanceM} required />
        </label>
        <div class="calibration-pose">
          <span>{labels.refAnchor}</span>
          <div class="field-row">
            {#each ["X", "Y", "Z"] as axis, index}
              <label class="number-field"
                ><span>{axis}</span>
                <input type="number" step="any" bind:value={calibration.anchor[index]} required />
              </label>
            {/each}
          </div>
        </div>
        <label class="number-field"
          ><span>{labels.refBearing}</span>
          <input type="number" step="any" bind:value={calibration.bearingDeg} required />
        </label>
        <small class="muted">{labels.refBearingHelp}</small>
        {#if value}<output>{labels.refScale} {fmt(referenceScale(value))} m/px</output>
        {:else if calibration.points.length === 2 && calibration.distanceM !== undefined}
          <p role="status">{labels.refInvalidCalibration}</p>
        {/if}
        <div class="property-actions">
          {#if calibration.view === "pixels"}
            <button type="button" disabled={!value} onclick={onpreview}>{labels.refPreview}</button>
          {:else}
            <button
              type="button"
              disabled={!value || calibration.view === "anchor"}
              onclick={() => {
                if (calibration) calibration.view = "anchor";
              }}>{labels.refPlaceAnchor}</button
            >
            <button type="submit" class="primary" disabled={!value || calibration.view !== "plan"}>
              {labels.refApplyCalibration}
            </button>
          {/if}
          <button type="button" onclick={oncancel}>{labels.cancel}</button>
        </div>
      </fieldset>
    </form>
  {:else}
    {#if layer.calibration}
      <dl class="coordinates">
        <dt>{labels.refScale}</dt>
        <dd>{fmt(referenceScale(layer.calibration))} m/px</dd>
      </dl>
    {:else}
      <p class="muted">{labels.refUncalibrated}</p>
    {/if}
    {#if editable}
      <form
        onsubmit={(event) => {
          event.preventDefault();
          if (id)
            void onsave({
              op: "appearance",
              id,
              frame: target || null,
              visible: shown,
              locked,
              opacity: opacity === Math.round(layer.opacity * 100) ? layer.opacity : opacity / 100,
            });
        }}
      >
        <fieldset disabled={disabled || uploading}>
          <label>
            <span>{labels.refFrame}</span>
            <select bind:value={target} disabled={layer.locked}>
              <option value="">{labels.refWorld}</option>
              {#each frames as [key, node] (key)}
                <option value={key}>{node.name} · {labels[node.kind]}</option>
              {/each}
              {#if layer.frame && !frames.some(([key]) => key === layer.frame)}
                <option value={layer.frame}>{world.nodes[layer.frame]?.name}</option>
              {/if}
            </select>
          </label>
          <label><input type="checkbox" bind:checked={shown} />{labels.refVisible}</label>
          <label><input type="checkbox" bind:checked={locked} />{labels.refLocked}</label>
          <label>
            <span>{labels.refOpacity} · {opacity}%</span>
            <input type="range" min="0" max="100" bind:value={opacity} />
          </label>
          <button type="submit" disabled={!changed}>{labels.refApplySettings}</button>
        </fieldset>
      </form>
      <div class="property-actions">
        <button
          type="button"
          disabled={disabled || !ready || unavailable || layer.locked || uploading}
          onclick={onstart}
        >
          {layer.calibration ? labels.refEditCalibration : labels.refCalibrate}
        </button>
        {#if !layer.locked}
          <label class="reference-file">
            <span>{labels.refReplace}</span>
            <input
              type="file"
              accept={formats}
              disabled={disabled || uploading}
              onchange={(event) => upload(event, true)}
            />
          </label>
        {/if}
      </div>
      {#if !layer.locked}
        <div class="property-actions">
          {#if confirmRemove}
            <p>{labels.refRemovePrompt}</p>
            <button
              type="button"
              disabled={disabled || uploading}
              onclick={() => (confirmRemove = false)}>{labels.cancel}</button
            >
          {/if}
          <button
            type="button"
            class="danger"
            disabled={disabled || uploading}
            onclick={() => {
              if (!confirmRemove) confirmRemove = true;
              else if (id) void onsave({ op: "remove", id });
            }}>{labels.refRemove}</button
          >
        </div>
      {/if}
    {:else}
      <p>{layer.frame === null ? labels.refWorld : world.nodes[layer.frame]?.name}</p>
    {/if}
    {#if layer.calibration && layer.visible !== false && !unavailable}
      <div class="property-actions">
        <button type="button" disabled={!focusable} onclick={onfocus}>{labels.focus}</button>
      </div>
    {/if}
  {/if}
{:else}
  <p class="muted">{labels.refPick}</p>
{/if}

<style>
  form fieldset,
  .reference-file {
    display: grid;
    gap: var(--gaia-space-8);
  }
  select,
  input[type="file"],
  input[type="range"] {
    display: block;
    width: 100%;
    min-width: 0;
  }
  .reference-file {
    min-width: 0;
    width: 100%;
  }
  .calibration-coordinate {
    font-variant-numeric: tabular-nums;
  }
</style>
