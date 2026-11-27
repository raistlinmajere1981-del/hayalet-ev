<script lang="ts">
  import { untrack } from "svelte";
  import type en from "../../../i18n/en.json";
  import type { CapabilityId } from "../../devices/capabilities.ts";
  import type {
    FieldOperation,
    FieldResults,
    FieldState,
  } from "../../field/management-contract.ts";
  import type { Device, Id } from "../../spatial/world.ts";
  import {
    deviceAssignments,
    isUuidV4,
    parseHttpsOrigin,
    type FieldEndpointDraft,
    type StagedReassign,
  } from "./field.ts";

  let {
    project,
    revision,
    deviceId,
    device,
    labels,
    fieldState,
    endpointDraft,
    review,
    issued,
    stagedReassign,
    busy,
    error,
    notice,
    onopenfieldcenter,
    oninspect,
    onissue,
    ondiscardreview,
    onenroll,
    oncomplete,
    onrevoke,
    onstage,
    onclearstage,
  }: {
    project: string;
    revision: number;
    deviceId: Id;
    device: Device;
    labels: typeof en.site;
    fieldState?: FieldState;
    endpointDraft: FieldEndpointDraft;
    review?: FieldResults["inspect"];
    issued?: FieldResults["issue"];
    stagedReassign?: StagedReassign;
    busy: boolean;
    error: string;
    notice: string;
    onopenfieldcenter: () => void;
    oninspect: (input: Extract<FieldOperation, { action: "inspect" }>) => Promise<void>;
    onissue: (reviewId: string) => Promise<void>;
    ondiscardreview: () => void;
    onenroll: (deviceId: string) => Promise<void>;
    oncomplete: (deviceId: string, assignmentId: string) => Promise<void>;
    onrevoke: (deviceId: string, assignmentId: string) => Promise<void>;
    onstage: (value: StagedReassign) => void;
    onclearstage: () => void;
  } = $props();

  const pair = $derived(deviceAssignments(fieldState?.assignments ?? [], deviceId));
  const active = $derived(pair.active);
  const pending = $derived(pair.pending);
  const availableStage = $derived(
    stagedReassign && stagedReassign.sourceProjectId !== project ? stagedReassign : undefined
  );

  let mode = $state<"begin" | "renew" | "rebindHardware" | "reassign">(
    untrack(() => (active ? "renew" : "begin"))
  );
  let hardwareIdInput = $state(untrack(() => device.hardwareId ?? ""));
  let originInput = $state(
    untrack(() => fieldState?.endpoint?.origin || endpointDraft.origin || "")
  );
  let selectedCapabilities = $state<string[]>(untrack(() => [...device.capabilities]));
  let sourceAssignmentId = $state("");
  let sourceRevisionInput = $state<number | undefined>();

  $effect(() => {
    const hasActive = !!active;
    const currentMode = untrack(() => mode);
    if (hasActive && (currentMode === "begin" || currentMode === "reassign")) {
      mode = "renew";
    } else if (!hasActive && (currentMode === "renew" || currentMode === "rebindHardware")) {
      mode = "begin";
    }
  });

  $effect(() => {
    const candidate = fieldState?.endpoint?.origin || endpointDraft.origin;
    if (!candidate) return;
    if (!untrack(() => originInput).trim()) {
      originInput = candidate;
    }
  });

  $effect(() => {
    const currentActive = active;
    const boundHardware = device.hardwareId;
    const capabilities = device.capabilities;
    const currentMode = untrack(() => mode);
    if (currentMode === "renew" && currentActive) {
      if (untrack(() => hardwareIdInput) !== currentActive.hardwareId) {
        hardwareIdInput = currentActive.hardwareId;
      }
      const nextCaps = currentActive.capabilities.filter((cap) => capabilities.includes(cap));
      const prevCaps = untrack(() => selectedCapabilities);
      if (
        prevCaps.length !== nextCaps.length ||
        prevCaps.some((cap, index) => cap !== nextCaps[index])
      ) {
        selectedCapabilities = nextCaps;
      }
    } else if (currentMode === "begin" || currentMode === "reassign") {
      if (boundHardware && untrack(() => hardwareIdInput) !== boundHardware) {
        hardwareIdInput = boundHardware;
      }
      const prevCaps = untrack(() => selectedCapabilities);
      const nextCaps = prevCaps.filter((cap) => capabilities.includes(cap));
      if (prevCaps.length !== nextCaps.length) {
        selectedCapabilities = nextCaps;
      }
    }
  });

  function applyStaged() {
    if (!availableStage) return;
    mode = "reassign";
    sourceAssignmentId = availableStage.assignmentId;
    sourceRevisionInput = availableStage.expectedSourceRevision;
    if (!device.hardwareId) hardwareIdInput = availableStage.hardwareId;
  }

  function switchMode(nextMode: typeof mode) {
    mode = nextMode;
    if (nextMode === "rebindHardware") {
      hardwareIdInput = "";
      selectedCapabilities = [...device.capabilities];
    } else if (nextMode === "renew" && active) {
      hardwareIdInput = active.hardwareId;
      selectedCapabilities = active.capabilities.filter((cap) => device.capabilities.includes(cap));
    } else if (nextMode === "reassign") {
      selectedCapabilities = [...device.capabilities];
      if (availableStage && !sourceAssignmentId) applyStaged();
      else if (device.hardwareId) hardwareIdInput = device.hardwareId;
    } else {
      hardwareIdInput = device.hardwareId ?? "";
      selectedCapabilities = [...device.capabilities];
    }
  }

  const hardwareLocked = $derived(
    mode === "renew" || ((mode === "begin" || mode === "reassign") && !!device.hardwareId)
  );
  const effectiveHardwareId = $derived(
    mode === "renew" && active
      ? active.hardwareId
      : (mode === "begin" || mode === "reassign") && device.hardwareId
        ? device.hardwareId
        : hardwareIdInput.trim()
  );
  const originCheck = $derived(parseHttpsOrigin(originInput));
  const hardwareMustDiffer = $derived(
    mode === "rebindHardware" &&
      !!active &&
      !!effectiveHardwareId &&
      effectiveHardwareId === active.hardwareId
  );
  const parsedSourceRevision = $derived.by(() => {
    const value = sourceRevisionInput;
    return value !== undefined && Number.isSafeInteger(value) && value >= 0
      ? value
      : undefined;
  });
  const canInspect = $derived.by(() => {
    if (busy || pending || fieldState?.ca !== "ready") return false;
    if (!effectiveHardwareId || effectiveHardwareId.length > 256 || hardwareMustDiffer) return false;
    if (!originCheck.ok) return false;
    if (mode === "renew" && !active) return false;
    if (mode === "rebindHardware" && !active) return false;
    if (mode === "reassign") {
      if (!isUuidV4(sourceAssignmentId) || parsedSourceRevision === undefined) return false;
    }
    return true;
  });

  function submitInspect(event: SubmitEvent) {
    event.preventDefault();
    if (!canInspect || !originCheck.ok) return;
    const change: FieldOperation & { action: "inspect" } extends infer I
      ? I extends { change: infer C }
        ? C
        : never
      : never =
      mode === "renew" && active
        ? { kind: "renew", assignmentId: active.id }
        : mode === "rebindHardware" && active
          ? { kind: "rebindHardware", assignmentId: active.id }
          : mode === "reassign"
            ? {
                kind: "reassign",
                assignmentId: sourceAssignmentId.trim(),
                expectedSourceRevision: parsedSourceRevision!,
              }
            : { kind: "begin" };
    void oninspect({
      action: "inspect",
      deviceId,
      hardwareId: effectiveHardwareId,
      capabilities: device.capabilities.filter((cap) => selectedCapabilities.includes(cap)),
      revision,
      origin: originCheck.origin,
      change,
    });
  }
</script>

{#if error}
  <p class="field-alert" role="alert">{error}</p>
{/if}
{#if notice}
  <p class="field-status-note" role="status">{notice}</p>
{/if}

{#if !fieldState}
  <p class="muted" aria-busy="true">{labels.refLoading}</p>
{:else if fieldState.ca === "absent"}
  <p class="muted">{labels.pairingNeedsCenter}</p>
  <div class="property-actions">
    <button type="button" disabled={busy} onclick={onopenfieldcenter}>
      {labels.openFieldCenter}
    </button>
  </div>
{:else if fieldState.ca === "unavailable"}
  <p class="field-alert" role="alert">{labels.pairingCenterUnavailable}</p>
  <div class="property-actions">
    <button type="button" disabled={busy} onclick={onopenfieldcenter}>
      {labels.openFieldCenter}
    </button>
  </div>
{:else if fieldState.assignmentError === "unavailable"}
  <p class="field-alert" role="alert">{labels.fieldAssignmentsUnavailable}</p>
{:else}
  {#if active}
    <div class="assignment-card" data-assignment-state="active">
      <h4>{labels.assignmentActive}</h4>
      <dl class="management-facts">
        <dt>{labels.assignmentId}</dt>
        <dd class="device-id">{active.id}</dd>
        <dt>{labels.authorizationGeneration}</dt>
        <dd>{active.authorizationGeneration}</dd>
        <dt>{labels.hardwareId}</dt>
        <dd class="device-id">{active.hardwareId}</dd>
        <dt>{labels.installationId}</dt>
        <dd class="device-id">{active.installationId}</dd>
        <dt>{labels.clientCertFingerprint}</dt>
        <dd class="device-id">{active.fingerprint}</dd>
        <dt>{labels.allowedCapabilities}</dt>
        <dd>
          {active.capabilities.map((cap) => labels[cap as CapabilityId] ?? cap).join(", ") ||
            labels.noCapabilities}
        </dd>
      </dl>
      <div class="property-actions">
        {#if !pending}
          <button
            type="button"
            disabled={busy}
            onclick={() =>
              onstage({
                sourceProjectId: project,
                sourceDeviceId: deviceId,
                assignmentId: active.id,
                expectedSourceRevision: revision,
                hardwareId: active.hardwareId,
              })}
          >
            {labels.prepareReassign}
          </button>
        {/if}
        <button
          type="button"
          class="danger"
          disabled={busy}
          onclick={() => void onrevoke(deviceId, active.id)}
        >
          {labels.pairingRevoke}
        </button>
      </div>
    </div>
  {/if}

  {#if pending}
    <div class="assignment-card" data-assignment-state="pending">
      <h4>{labels.assignmentPending}</h4>
      <dl class="management-facts">
        <dt>{labels.assignmentId}</dt>
        <dd class="device-id">{pending.id}</dd>
        <dt>{labels.authorizationGeneration}</dt>
        <dd>{pending.authorizationGeneration}</dd>
        <dt>{labels.hardwareId}</dt>
        <dd class="device-id">{pending.hardwareId}</dd>
        <dt>{labels.installationId}</dt>
        <dd class="device-id">{pending.installationId}</dd>
        <dt>{labels.clientCertFingerprint}</dt>
        <dd class="device-id">{pending.fingerprint}</dd>
      </dl>
      <div class="property-actions">
        <button
          type="button"
          class="primary"
          disabled={busy}
          onclick={() => void oncomplete(deviceId, pending.id)}
        >
          {labels.pairingActivate}
        </button>
        <button
          type="button"
          class="danger"
          disabled={busy}
          onclick={() => void onrevoke(deviceId, pending.id)}
        >
          {labels.pairingCancelPending}
        </button>
      </div>
    </div>
  {:else if review}
    <div class="assignment-card" data-review-id={review.reviewId}>
      <h4>{labels.pairingReviewHeading}</h4>
      <dl class="management-facts">
        <dt>{labels.installationId}</dt>
        <dd class="device-id" data-review-installation>{review.approval.installationId}</dd>
        <dt>{labels.publicKeyFingerprint}</dt>
        <dd class="device-id" data-review-pubkey>{review.approval.publicKeyFingerprint}</dd>
        <dt>{labels.fieldCaFingerprint}</dt>
        <dd class="device-id" data-review-ca>{review.approval.caFingerprint}</dd>
        <dt>{labels.hardwareId}</dt>
        <dd class="device-id">{review.approval.hardwareId}</dd>
        <dt>{labels.fieldHttpsOrigin}</dt>
        <dd class="device-id">{review.approval.httpsOrigin}</dd>
        <dt>{labels.expectedRevision}</dt>
        <dd>{review.approval.expectedRevision}</dd>
        <dt>{labels.allowedCapabilities}</dt>
        <dd>
          {review.approval.capabilities
            .map((cap) => labels[cap as CapabilityId] ?? cap)
            .join(", ") || labels.noCapabilities}
        </dd>
      </dl>
      <div class="property-actions">
        <button
          type="button"
          class="primary"
          disabled={busy}
          onclick={() => void onissue(review.reviewId)}
        >
          {labels.pairingIssue}
        </button>
        <button type="button" disabled={busy} onclick={ondiscardreview}>
          {labels.pairingDiscardReview}
        </button>
      </div>
    </div>
  {:else}
    {#if issued}
      <div class="assignment-card" data-issued-package={issued.filename}>
        <dl class="management-facts">
          <dt>{labels.pairingIssuedFile}</dt>
          <dd class="device-id">{issued.filename}</dd>
          <dt>{labels.clientCertFingerprint}</dt>
          <dd class="device-id">{issued.fingerprint}</dd>
        </dl>
        <div class="property-actions">
          <button
            type="button"
            class="primary"
            disabled={busy}
            onclick={() => void onenroll(deviceId)}
          >
            {labels.pairingEnroll}
          </button>
        </div>
      </div>
    {/if}

    <form class="device-form" onsubmit={submitInspect}>
      <fieldset disabled={busy}>
        <label>
          {labels.pairingMode}
          <select value={mode} onchange={(e) => switchMode(e.currentTarget.value as typeof mode)}>
            {#if active}
              <option value="renew">{labels.pairingRenew}</option>
              <option value="rebindHardware">{labels.pairingRebind}</option>
            {:else}
              <option value="begin">{labels.pairingBegin}</option>
              <option value="reassign">{labels.pairingReassign}</option>
            {/if}
          </select>
        </label>

        {#if mode === "reassign" && availableStage}
          <div class="assignment-card">
            <p class="muted">
              {labels.stagedReassign}: <strong>{availableStage.sourceProjectId}</strong> · {availableStage.sourceDeviceId}
            </p>
            <div class="property-actions">
              <button type="button" disabled={busy} onclick={applyStaged}>
                {labels.applyStaged}
              </button>
              <button type="button" disabled={busy} onclick={onclearstage}>
                {labels.clearStaged}
              </button>
            </div>
          </div>
        {/if}

        <label>
          {labels.hardwareId}
          <input
            type="text"
            maxlength="256"
            placeholder={labels.hardwareIdPlaceholder}
            disabled={busy || hardwareLocked}
            bind:value={hardwareIdInput}
          />
        </label>
        {#if hardwareMustDiffer}
          <small class="field-alert">{labels.pairingHardwareMustDiffer}</small>
        {/if}

        {#if mode === "reassign"}
          <label>
            {labels.sourceAssignmentId}
            <input type="text" bind:value={sourceAssignmentId} />
          </label>
          <label>
            {labels.sourceRevision}
            <input type="number" min="0" step="1" bind:value={sourceRevisionInput} />
          </label>
        {/if}

        <label>
          {labels.fieldHttpsOrigin}
          <input
            type="url"
            placeholder="https://127.0.0.1:8443"
            bind:value={originInput}
          />
        </label>
        {#if !originCheck.ok}
          <small class="muted">{labels.pairingOriginRequired}</small>
        {/if}

        {#if device.capabilities.length}
          <div class="management-checks" role="group" aria-label={labels.allowedCapabilities}>
            <strong>{labels.allowedCapabilities}</strong>
            {#each device.capabilities as capability (capability)}
              <label>
                <input
                  type="checkbox"
                  bind:group={selectedCapabilities}
                  value={capability}
                />
                {labels[capability as CapabilityId] ?? capability}
              </label>
            {/each}
          </div>
        {/if}

        <div class="property-actions">
          <button type="submit" class="primary" disabled={!canInspect}>
            {labels.pairingInspectCsr}
          </button>
          {#if !issued}
            <button type="button" disabled={busy} onclick={() => void onenroll(deviceId)}>
              {labels.pairingEnroll}
            </button>
          {/if}
        </div>
      </fieldset>
    </form>
  {/if}
{/if}
