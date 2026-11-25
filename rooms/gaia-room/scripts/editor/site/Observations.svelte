<script lang="ts">
  import type en from "../../../i18n/en.json";
  import { capabilityOf, type CapabilityId } from "../../devices/capabilities.ts";
  import { observationFreshness, type DeviceStatus } from "../../devices/status.ts";

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
                {typeof reading.value === "number"
                  ? number.format(reading.value) + " " + reading.unit
                  : reading.value
                    ? labels.valueOn
                    : labels.valueOff}
              </span>
            {/if}
          </div>
          <small>
            {#if reading?.quality === "invalid"}<strong>{labels.invalid}</strong> ·
            {/if}
            {labels[freshness]}
            {#if reading}
              · {reading.source === "simulated" ? labels.virtual : labels.measured}
              {#if detailed}
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
