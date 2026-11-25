<script lang="ts">
  import { onMount } from "svelte";
  import en from "../../i18n/en.json";
  import tr from "../../i18n/tr.json";
  import { command, roomBridge, type InteriorOpened, type Opened, type Saved } from "./client.ts";
  import { describeError } from "./site/errors.ts";
  import type { EditBatch } from "./session.ts";
  import type { SiteBatch } from "../spatial/site-edits.ts";
  import type { ReferenceBatch } from "../storage/reference-contract.ts";
  import Workspace from "./site/Workspace.svelte";

  let locale = $state<"en" | "tr">("en");
  let labels = $state(en.workshop);
  let siteLabels = $state(en.site);
  let roomName = $state(en.room.name);
  let project = $state("");
  let selected = $state("");
  let projects = $state<string[]>([]);
  let opened = $state.raw<Opened>();
  let inner = $state.raw<InteriorOpened>();
  let Workshop = $state.raw<typeof import("./Workshop.svelte").default>();
  let siteSelection = $state<string>();
  let busy = $state(false);
  let error = $state("");
  let loadingError = $state("");
  let hostVisible = $state(false);
  let documentVisible = $state(true);
  let disposed = $state(false);
  const visible = $derived(hostVisible && documentVisible && !disposed);

  async function refresh() {
    try {
      projects = (await command<{ projects: string[] }>("GaiaProjects", {})).projects;
      if (!projects.includes(selected)) selected = projects[0] ?? "";
    } catch (e) {
      error = describeError(e, labels.error);
    }
  }

  $effect(() => {
    const bridge = roomBridge();
    if (!visible || !bridge) return;
    const off = bridge.onHostMessage((msg) => {
      if (msg.type === "host-context") {
        locale = msg.locale === "tr" ? "tr" : "en";
        const catalog = locale === "tr" ? tr : en;
        labels = { ...catalog.workshop, ...msg.translations?.workshop };
        siteLabels = { ...catalog.site, ...msg.translations?.site };
        roomName = catalog.room.name;
        document.documentElement.lang = locale;
      } else if (msg.type === "gaia-theme") {
        for (const [key, value] of Object.entries(msg.payload ?? {}))
          document.documentElement.style.setProperty("--gaia-" + key, value);
      }
    }, true);
    return off;
  });

  $effect(() => {
    if (visible && !opened) void refresh();
  });

  $effect(() => {
    if (!visible || !inner || Workshop || loadingError) return;
    let active = true;
    void import("./Workshop.svelte")
      .then(({ default: loaded }) => {
        if (active) Workshop = loaded;
      })
      .catch((e) => {
        if (active) loadingError = describeError(e, labels.error);
      });
    return () => {
      active = false;
    };
  });

  onMount(() => {
    const bridge = roomBridge();
    const readVisibility = () => {
      documentVisible = !document.hidden;
    };
    const dispose = () => {
      disposed = true;
    };
    readVisibility();
    document.addEventListener("visibilitychange", readVisibility);
    window.addEventListener("pagehide", dispose);
    const stop = bridge?.onVisibilityChange?.((value) => {
      hostVisible = value;
    });
    if (!stop) hostVisible = true;
    bridge?.ready();
    return () => {
      document.removeEventListener("visibilitychange", readVisibility);
      window.removeEventListener("pagehide", dispose);
      stop?.();
    };
  });

  async function choose(create: boolean, fixture = false) {
    busy = true;
    error = "";
    try {
      opened = await command<Opened>(
        create ? "GaiaCreate" : "GaiaOpen",
        create ? { project, fixture, locale, layout: "site" } : { project: selected }
      );
      siteSelection = undefined;
    } catch (e) {
      error = describeError(e, labels.error);
    } finally {
      busy = false;
    }
  }

  async function save(batch: EditBatch | SiteBatch | ReferenceBatch, retry: boolean) {
    const reply = await command<Saved | { error: "unknown" | "conflict"; revision: number }>(
      "GaiaSave",
      { batch, retry }
    );
    if ("error" in reply) throw new Error(labels[reply.error] + " " + reply.revision);
    if (opened?.world.id === reply.world.id)
      opened = { ...opened, ...reply, damaged: reply.damaged ?? [] };
    return reply;
  }

  async function reopenSite() {
    const reply = await command<Opened>("GaiaOpen", { project: opened!.world.id });
    opened = reply;
    return reply;
  }

  async function openInterior(building: string) {
    const result = await reopenInterior(building);
    siteSelection = building;
    inner = result;
  }

  async function reopenInterior(building: string): Promise<InteriorOpened> {
    const reply = await command<Opened>("GaiaOpen", { project: opened!.world.id, building });
    if (reply.building !== building) throw new Error(labels.error);
    opened = reply;
    return { ...reply, building };
  }

  function returnToSite() {
    inner = undefined;
    loadingError = "";
  }

  function closeRoom() {
    disposed = true;
    roomBridge()?.close();
  }
</script>

{#if opened && !disposed}
  {#if inner}
    {#if Workshop}
      {@const building = inner.building}
      <Workshop
        initial={inner}
        storage={{ save, reopen: () => reopenInterior(building) }}
        {labels}
        {locale}
        {visible}
        transitionLabels={siteLabels}
        onleave={returnToSite}
      />
    {:else}
      <main class="projects">
        <button type="button" onclick={returnToSite}>{siteLabels.backSite}</button>
        {#if loadingError}<p role="alert">{loadingError}</p>{:else}<p aria-busy="true">
            {labels.workshop}
          </p>{/if}
      </main>
    {/if}
  {:else}
    <Workspace
      {opened}
      labels={siteLabels}
      storageLabels={labels}
      {visible}
      startEditing={!!siteSelection}
      initialSelection={siteSelection}
      {locale}
      onsave={save}
      onreopen={reopenSite}
      oninterior={openInterior}
      onprojects={() => {
        opened = undefined;
        error = "";
      }}
      onclose={closeRoom}
    />
  {/if}
{:else if !disposed}
  <main class="projects">
    <h1>{roomName}</h1>
    <fieldset disabled={busy}>
      {#if projects.length}
        <label>
          {labels.pick}<select bind:value={selected}>
            {#each projects as id}<option value={id}>{id}</option>{/each}
          </select>
        </label>
        <button onclick={() => choose(false)}>{labels.open}</button>
      {/if}
      <label>
        {labels.name}<input
          bind:value={project}
          maxlength="64"
          placeholder={labels.projectPlaceholder}
          aria-describedby="id-help"
        />
      </label>
      <small id="id-help">{labels.hint}</small>
      <div>
        <button disabled={!project} onclick={() => choose(true)}>{labels.create}</button>
        <button disabled={!project} onclick={() => choose(true, true)}>{labels.demo}</button>
      </div>
    </fieldset>
    {#if error}<p role="alert">{labels.error} · {error}</p>{/if}
  </main>
{/if}
