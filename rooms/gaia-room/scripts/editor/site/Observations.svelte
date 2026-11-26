<script lang="ts">
  import type en from "../../../i18n/en.json";
  import { capabilityOf, type CapabilityId } from "../../devices/capabilities.ts";
  import {
    observationFreshness,
    type DeviceStatus,
    type ObservationValue,
  } from "../../devices/status.ts";

  let {
    capabilities,
    status,
    now,
    labels,
    locale,
    detailed = false,
  }: {
    capabilities: string[];
    status?: DeviceStatus;
    now: number;
    labels: typeof en.site;
    locale: string;
    detailed?: boolean;
  } = $props();

  const observable = $derived(
    capabilities.filter((id) => {
      const definition = capabilityOf(id);
      return definition && definition.kind !== "media";
    })
  );
  const time = $derived(
    new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "medium" })
  );
  const number = $derived(new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }));

  function readingText(value: ObservationValue, unit: string): string {
    if (typeof value === "number") return `${number.format(value)} ${unit}`;
    if (typeof value === "boolean") return value ? labels.valueOn : labels.valueOff;
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return `${value.map((part) => number.format(part)).join(", ")} ${unit}`;
    if (value && typeof value === "object")
      return `${value.transport} · ${value.internetCapable ? labels.internet : labels.noInternet} · ${value.validated ? labels.validated : labels.notValidated}`;
    return "";
  }
</script>

{#if observable.length}
  <ul class="observation-list">
    {#each observable as capability (capability)}
      {@const reading = status?.observations[capability]}
      {@const freshness = observationFreshness(status, reading, now)}
      {#if detailed || reading}
        <li data-freshness={freshness} data-quality={reading?.quality}>
          <div class="observation-title">
            <strong>{labels[capability as CapabilityId]}</strong>
            {#if reading?.quality === "valid"}
              <span class="reading">
                {readingText(reading.value, reading.unit)}
              </span>
            {/if}
          </div>
          <small>
            {#if reading?.quality === "invalid"}<strong>{labels.invalid}</strong> ·
            {/if}
            {labels[freshness]}
            {#if reading}
              · {reading.source === "simulated" ? labels.virtual : labels.measured}
              {#if detailed && reading.at !== undefined}
                · <time datetime={new Date(reading.at).toISOString()}>
                  {time.format(reading.at)}
                </time>
              {/if}
            {/if}
          </small>
        </li>
      {/if}
    {/each}
  </ul>
{/if}
