<script lang="ts">
  import type en from "../../../i18n/en.json";
  import { capabilityOf, type CapabilityId } from "../../devices/capabilities.ts";
  import type { PhysicalView } from "../../devices/field-view.ts";
  import {
    observationFreshness,
    type DeviceStatus,
    type NetworkState,
    type Observation,
    type ObservationValue,
  } from "../../devices/status.ts";

  let {
    source,
    capabilities,
    status,
    physical,
    now,
    labels,
    locale,
    detailed = false,
  }: {
    source: "virtual" | "physical";
    capabilities: string[];
    status?: DeviceStatus;
    physical?: PhysicalView;
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

  const enumLabels: Record<string, keyof typeof en.site> = {
    charging: "chargeCharging",
    discharging: "chargeDischarging",
    full: "chargeFull",
    not_charging: "chargeNotCharging",
    near: "proximityNear",
    far: "proximityFar",
  };

  const transportLabels: Record<NetworkState["transport"], keyof typeof en.site> = {
    none: "transportNone",
    wifi: "transportWifi",
    cellular: "transportCellular",
    other: "transportOther",
  };

  function formatScalar(value: number): string {
    return number.format(Object.is(value, -0) ? 0 : value);
  }

  function readingText(value: ObservationValue, unit: string): string {
    if (typeof value === "number") return `${formatScalar(value)} ${unit}`;
    if (typeof value === "boolean") return value ? labels.valueOn : labels.valueOff;
    if (typeof value === "string") {
      const key = Object.hasOwn(enumLabels, value) ? enumLabels[value] : undefined;
      return key ? labels[key] : value;
    }
    if (Array.isArray(value)) {
      const [x, y, z] = value;
      return `X ${formatScalar(x)} · Y ${formatScalar(y)} · Z ${formatScalar(z)} ${unit}`;
    }
    if (value && typeof value === "object") {
      const transport = labels[transportLabels[value.transport]];
      return `${transport} · ${value.internetCapable ? labels.internet : labels.noInternet} · ${value.validated ? labels.validated : labels.notValidated}`;
    }
    return "";
  }
</script>

{#if observable.length}
  <ul class="observation-list">
    {#each observable as capability (capability)}
      {@const physicalReading =
        source === "physical" ? physical?.observations[capability] : undefined}
      {@const virtualReading =
        source === "virtual" ? status?.observations[capability] : undefined}
      {@const reading = physicalReading ?? virtualReading}
      {@const freshness =
        source === "physical"
          ? (physicalReading?.freshness ?? "noData")
          : observationFreshness(status, virtualReading as Observation | undefined, now)}
      {#if detailed || reading}
        <li
          data-capability={capability}
          data-source={source === "physical" ? "measured" : "simulated"}
          data-freshness={freshness}
          data-quality={reading?.quality}
        >
          <div class="observation-title">
            <strong>{labels[capability as CapabilityId] ?? capability}</strong>
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
              · {source === "virtual" ? labels.virtual : labels.measured}
              {#if detailed && reading.at !== undefined}
                · {#if source === "physical"}{labels.estimatedMeasurementTime}: {/if}<time
                  datetime={new Date(reading.at).toISOString()}
                >
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
