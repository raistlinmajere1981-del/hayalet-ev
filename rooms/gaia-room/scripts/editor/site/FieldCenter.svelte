<script lang="ts">
  import type en from "../../../i18n/en.json";
  import { deviceName } from "../../devices/inventory.ts";
  import type { FieldState } from "../../field/management-contract.ts";
  import type { Id, World } from "../../spatial/world.ts";
  import {
    parseHttpsOrigin,
    validateFieldEndpoint,
    type FieldEndpoint,
    type FieldEndpointDraft,
  } from "./field.ts";

  let {
    labels,
    world,
    state: fieldState,
    endpointDraft = $bindable(),
    busy,
    error,
    notice,
    onrefresh,
    onprovision,
    onrotate,
    onstart,
    onstop,
    onselectdevice,
    onclose,
  }: {
    labels: typeof en.site;
    world: World;
    state?: FieldState;
    endpointDraft: FieldEndpointDraft;
    busy: boolean;
    error: string;
    notice: string;
    onrefresh: (origin?: string) => Promise<void>;
    onprovision: (origin: string) => Promise<void>;
    onrotate: (origin: string) => Promise<void>;
    onstart: (endpoint: FieldEndpoint) => Promise<void>;
    onstop: () => Promise<void>;
    onselectdevice: (id: Id) => void;
    onclose: () => void;
  } = $props();

  const originCheck = $derived(parseHttpsOrigin(endpointDraft.origin));
  const endpointCheck = $derived(validateFieldEndpoint(endpointDraft));
  const caState = $derived(fieldState?.ca);
  const receiverActive = $derived(!!(fieldState?.enabled || fieldState?.listening));
  const anyEndpointInput = $derived(
    !!(
      endpointDraft.address.trim() ||
      endpointDraft.port.trim() ||
      endpointDraft.origin.trim()
    )
  );

  function caLabel(state?: FieldState["ca"]): string {
    if (state === "ready") return labels.fieldCaReady;
    if (state === "unavailable") return labels.fieldCaUnavailable;
    return labels.fieldCaAbsent;
  }

  function listenerLabel(state?: FieldState): string {
    if (state?.listening) return labels.fieldListening;
    if (state?.enabled) return labels.fieldConfiguredStopped;
    return labels.fieldStopped;
  }

  function assignmentStateLabel(state: FieldState["assignments"][number]["state"]): string {
    return state === "active" ? labels.assignmentActive : labels.assignmentPending;
  }

  function handleOriginChange() {
    if (originCheck.ok && !busy) {
      void onrefresh(originCheck.origin);
    }
  }
</script>

<div class="object-heading">
  <div class="field-heading-row">
    <p class="muted">{labels.management}</p>
    <button type="button" disabled={busy} onclick={onclose}>{labels.backSite}</button>
  </div>
</div>

{#if error}
  <p class="field-alert" role="alert">{error}</p>
{/if}
{#if notice}
  <p class="field-status-note" role="status">{notice}</p>
{/if}

{#if !fieldState}
  <p class="muted" aria-busy="true">{labels.refLoading}</p>
{:else}
  <dl class="management-facts">
    <dt>{labels.fieldCaStatus}</dt>
    <dd data-ca-state={caState}>{caLabel(caState)}</dd>
    <dt>{labels.fieldListenerStatus}</dt>
    <dd data-listening={fieldState.listening ? "true" : "false"}>{listenerLabel(fieldState)}</dd>
    {#if fieldState.endpoint}
      <dt>{labels.fieldEndpointAddress}</dt>
      <dd class="device-id">{fieldState.endpoint.address}</dd>
      <dt>{labels.fieldEndpointPort}</dt>
      <dd>{fieldState.endpoint.port}</dd>
      <dt>{labels.fieldHttpsOrigin}</dt>
      <dd class="device-id">{fieldState.endpoint.origin}</dd>
    {/if}
    {#if caState === "ready"}
      <dt>{labels.fieldCaFingerprint}</dt>
      <dd class="device-id" data-ca-fingerprint>{fieldState.caFingerprint}</dd>
      <dt>{labels.fieldServerFingerprint}</dt>
      {#if fieldState.serverFingerprint}
        <dd class="device-id" data-server-fingerprint>{fieldState.serverFingerprint}</dd>
      {:else if !originCheck.ok}
        <dd class="muted">{labels.fieldServerCertUnchecked}</dd>
      {:else}
        <dd class="muted">{labels.fieldServerCertMissing}</dd>
      {/if}
    {/if}
  </dl>

  {#if caState === "unavailable"}
    <p class="field-alert" role="alert">{labels.fieldCaUnavailableHint}</p>
  {:else if caState === "absent"}
    <section class="management-section">
      <p class="muted">{labels.fieldNativeHint}</p>
      <form
        class="device-form"
        onsubmit={(event) => {
          event.preventDefault();
          if (originCheck.ok && !busy && !receiverActive) void onprovision(originCheck.origin);
        }}
      >
        <fieldset disabled={busy || receiverActive}>
          <label>
            {labels.fieldHttpsOrigin}
            <input
              type="url"
              placeholder="https://127.0.0.1:8443"
              bind:value={endpointDraft.origin}
            />
          </label>
          {#if endpointDraft.origin.trim() && !originCheck.ok}
            <small class="field-alert">{labels.fieldOriginInvalid}</small>
          {/if}
          <div class="property-actions">
            <button
              type="submit"
              class="primary"
              disabled={busy || !originCheck.ok || receiverActive}
            >
              {labels.fieldProvision}
            </button>
            <button
              type="button"
              disabled={busy}
              onclick={() => onrefresh(originCheck.ok ? originCheck.origin : undefined)}
            >
              {labels.fieldRefreshState}
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  {:else if caState === "ready"}
    <section class="management-section">
      <p class="muted">{labels.fieldNativeHint}</p>
      <form
        class="device-form"
        onsubmit={(event) => {
          event.preventDefault();
          if (endpointCheck.ok && !busy && !fieldState.listening) {
            void onstart(endpointCheck.endpoint);
          }
        }}
      >
        <fieldset disabled={busy}>
          <label>
            {labels.fieldEndpointAddress}
            <input type="text" placeholder="127.0.0.1" bind:value={endpointDraft.address} />
          </label>
          <label>
            {labels.fieldEndpointPort}
            <input
              type="text"
              inputmode="numeric"
              placeholder="8443"
              bind:value={endpointDraft.port}
            />
          </label>
          <label>
            {labels.fieldHttpsOrigin}
            <input
              type="url"
              placeholder="https://127.0.0.1:8443"
              bind:value={endpointDraft.origin}
              onchange={handleOriginChange}
            />
          </label>
          {#if anyEndpointInput && !endpointCheck.ok}
            <small class="muted">{labels.fieldEndpointInvalid}</small>
          {/if}
          <div class="property-actions">
            <button
              type="submit"
              class="primary"
              disabled={busy || !endpointCheck.ok || fieldState.listening}
            >
              {labels.fieldStartListener}
            </button>
            <button
              type="button"
              disabled={busy || !receiverActive}
              onclick={() => void onstop()}
            >
              {labels.fieldStopListener}
            </button>
            <button
              type="button"
              disabled={busy || !originCheck.ok || receiverActive}
              onclick={() => {
                if (originCheck.ok) void onrotate(originCheck.origin);
              }}
            >
              {labels.fieldRotateServer}
            </button>
            <button
              type="button"
              disabled={busy}
              onclick={() => onrefresh(originCheck.ok ? originCheck.origin : undefined)}
            >
              {labels.fieldRefreshState}
            </button>
          </div>
          {#if receiverActive}
            <small class="muted">{labels.fieldStopBeforeRotate}</small>
          {/if}
        </fieldset>
      </form>
    </section>
  {/if}

  <section class="management-section">
    <h3>{labels.fieldAssignments}</h3>
    {#if fieldState.assignmentError === "unavailable"}
      <p class="field-alert" role="alert">{labels.fieldAssignmentsUnavailable}</p>
    {:else if fieldState.assignments.length}
      <ul class="scope-devices">
        {#each fieldState.assignments as assignment (assignment.id)}
          <li>
            <button
              type="button"
              class="device-link"
              disabled={busy}
              onclick={() => onselectdevice(assignment.deviceId)}
            >
              {deviceName(world, assignment.deviceId)}
            </button>
            <span>{assignmentStateLabel(assignment.state)}</span>
            <small class="device-id">
              {assignment.hardwareId} · {labels.authorizationGeneration} {assignment.authorizationGeneration}
            </small>
          </li>
        {/each}
      </ul>
    {:else if caState === "ready"}
      <p class="muted">{labels.fieldNoAssignments}</p>
    {/if}
  </section>
{/if}
