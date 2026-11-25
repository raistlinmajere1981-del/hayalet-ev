<script lang="ts">
  import { onMount } from "svelte";
  import en from "../../i18n/en.json";
  import tr from "../../i18n/tr.json";
  import Workshop from "./Workshop.svelte";
  import { command, roomBridge, type Opened, type Saved } from "./client.ts";
  import type { EditBatch } from "./session.ts";
  let locale = $state("en");
  let labels = $state(en.workshop);
  let project = $state("");
  let selected = $state("");
  let projects = $state<string[]>([]);
  let opened = $state.raw<Opened>();
  let busy = $state(false);
  let error = $state("");
  async function refresh() {
    try {
      projects = (await command<{ projects: string[] }>("GaiaProjects", {})).projects;
      selected = projects[0] ?? "";
    } catch (e) {
      error = String(e);
    }
  }
  onMount(() => {
    const bridge = roomBridge();
    const off = bridge?.onHostMessage((msg) => {
      if (msg.type === "host-context") {
        locale = msg.locale === "tr" ? "tr" : "en";
        labels = { ...(locale === "tr" ? tr : en).workshop, ...msg.translations?.workshop };
        document.documentElement.lang = locale;
      } else if (msg.type === "gaia-theme") {
        for (const [key, value] of Object.entries(msg.payload ?? {}))
          document.documentElement.style.setProperty("--gaia-" + key, value);
      }
    });
    bridge?.ready();
    void refresh();
    return off;
  });
  async function choose(create: boolean, fixture = false) {
    busy = true;
    error = "";
    try {
      opened = await command<Opened>(
        create ? "GaiaCreate" : "GaiaOpen",
        create ? { project, fixture, locale } : { project: selected }
      );
    } catch (e) {
      error = String(e);
    } finally {
      busy = false;
    }
  }
  async function save(batch: EditBatch, retry: boolean) {
    const reply = await command<Saved | { error: "unknown" | "conflict"; revision: number }>(
      "GaiaSave",
      { batch, retry }
    );
    if ("error" in reply) throw new Error(labels[reply.error] + " " + reply.revision);
    return reply;
  }
  async function leave() {
    opened = undefined;
    error = "";
    await refresh();
  }
</script>

{#if opened}
  <Workshop
    initial={opened}
    storage={{ save, reopen: () => command<Opened>("GaiaOpen", { project: opened!.world.id }) }}
    {labels}
    onleave={leave}
  />
{:else}
  <main class="projects">
    <h1>Gaia Room</h1>
    <fieldset disabled={busy}>
      {#if projects.length}
        <label
          >{labels.pick}<select bind:value={selected}
            >{#each projects as id}<option value={id}>{id}</option>{/each}</select
          ></label
        >
        <button onclick={() => choose(false)}>{labels.open}</button>
      {/if}
      <label
        >{labels.name}<input
          bind:value={project}
          maxlength="64"
          placeholder="atolye-1"
          aria-describedby="id-help"
        /></label
      >
      <small id="id-help">{labels.hint}</small>
      <div>
        <button disabled={!project} onclick={() => choose(true)}>{labels.create}</button>
        <button disabled={!project} onclick={() => choose(true, true)}>{labels.demo}</button>
      </div>
    </fieldset>
    {#if error}<p role="alert">{labels.error} · {error}</p>{/if}
  </main>
{/if}
