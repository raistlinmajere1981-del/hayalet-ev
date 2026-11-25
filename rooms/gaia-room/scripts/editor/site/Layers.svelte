<script lang="ts">
  import { tick, untrack } from "svelte";
  import type en from "../../../i18n/en.json";
  import { deviceName } from "../../devices/inventory.ts";
  import type { Id, World } from "../../spatial/world.ts";
  import { badgeSymbols, type DeviceBadge } from "./device-view.ts";

  let {
    world,
    labels,
    selected,
    hidden,
    visibleIds,
    management,
    badges,
    onselect,
    ontoggle,
  }: {
    world: World;
    labels: typeof en.site;
    selected?: Id;
    hidden: ReadonlySet<Id>;
    visibleIds: ReadonlySet<Id>;
    management: boolean;
    badges: ReadonlyMap<Id, DeviceBadge>;
    onselect: (id?: Id) => void;
    ontoggle: (id: Id) => void;
  } = $props();

  let collapsed = $state.raw(new Set<Id>());
  let tree = $state<HTMLElement>();
  const children = $derived.by(() => {
    const index = new Map<Id | null, Id[]>();
    for (const [id, { parent }] of Object.entries(world.nodes)) {
      const siblings = index.get(parent) ?? [];
      siblings.push(id);
      index.set(parent, siblings);
    }
    for (const siblings of index.values())
      siblings.sort((a, b) => (world.nodes[a]?.level ?? 0) - (world.nodes[b]?.level ?? 0));
    return index;
  });
  const devices = $derived.by(() => {
    const index = new Map<Id | null, Id[]>();
    if (management)
      for (const [id, { mount }] of Object.entries(world.devices)) {
        const siblings = index.get(mount ?? null) ?? [];
        siblings.push(id);
        index.set(mount ?? null, siblings);
      }
    return index;
  });

  function collapse(id: Id) {
    const next = new Set(collapsed);
    if (!next.delete(id)) next.add(id);
    collapsed = next;
  }

  $effect(() => {
    if (!selected || !management) return;
    let parent = world.devices[selected]?.mount ?? world.nodes[selected]?.parent;
    const ancestors: Id[] = [];
    while (parent) {
      ancestors.push(parent);
      parent = world.nodes[parent]?.parent;
    }
    const current = untrack(() => collapsed);
    if (ancestors.some((id) => current.has(id)))
      collapsed = new Set([...current].filter((id) => !ancestors.includes(id)));
  });

  $effect(() => {
    const id = selected;
    if (!id || !tree) return;
    void tick().then(() => {
      if (!tree) return;
      tree
        .querySelector<HTMLElement>(`[data-node="${CSS.escape(id)}"], [data-device="${CSS.escape(id)}"]`)
        ?.scrollIntoView({ block: "nearest" });
    });
  });

  // Arrow keys follow the visible tree order; Left/Right operate the collapse control without
  // leaving the row, so keyboard selection does not depend on a pointer reaching tiny controls.
  function navigate(event: KeyboardEvent) {
    if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
      return;
    const target = event.target as HTMLElement;
    const button = target.closest<HTMLButtonElement>("button.layer-select");
    if (!button || !tree?.contains(button)) return;
    const buttons = [...tree.querySelectorAll<HTMLButtonElement>("button.layer-select")].filter(
      (entry) => !entry.disabled && entry.getClientRects().length
    );
    const index = buttons.indexOf(button);
    if (index < 0) return;
    event.preventDefault();
    const row = button.closest<HTMLElement>(".layer-row");
    const toggle = row?.querySelector<HTMLButtonElement>("button.visibility[aria-expanded]");
    if (event.key === "ArrowDown") buttons[index + 1]?.focus();
    else if (event.key === "ArrowUp") buttons[index - 1]?.focus();
    else if (event.key === "Home") buttons[0]?.focus();
    else if (event.key === "End") buttons.at(-1)?.focus();
    else if (event.key === "ArrowRight") {
      if (toggle?.getAttribute("aria-expanded") === "true") buttons[index + 1]?.focus();
      else if (toggle) toggle.click();
    } else if (event.key === "ArrowLeft") {
      if (toggle?.getAttribute("aria-expanded") === "true") toggle.click();
      else
        row?.parentElement
          ?.closest("li")
          ?.querySelector<HTMLButtonElement>("button.layer-select")
          ?.focus();
    }
  }
</script>

{#snippet deviceRows(parent: Id | null, depth: number)}
  {#each devices.get(parent) ?? [] as id (id)}
    {@const badge = badges.get(id)}
    <li
      class="layer-row"
      class:filtered={!!parent && !visibleIds.has(id)}
      class:chosen={selected === id}
      style:--gaia-layer-indent={`${depth * 0.65}rem`}
    >
      <button
        class="layer-select"
        data-device={id}
        type="button"
        aria-pressed={selected === id}
        onclick={() => onselect(id)}
        title={`${deviceName(world, id)} · ${badge?.label ?? labels.device}`}
      >
        {#if badge}
          <span class="status-icon" data-device-health={badge.health} aria-label={badge.label}>
            {badgeSymbols[badge.health]}
          </span>
        {/if}
        <span>{deviceName(world, id)}</span>
      </button>
    </li>
  {/each}
{/snippet}

{#snippet branch(parent: Id | null, depth: number)}
  <ul>
    {#each children.get(parent) ?? [] as id (id)}
      {@const node = world.nodes[id]!}
      {@const canToggle =
        node.kind === "building" ||
        node.kind === "floor" ||
        (management && (node.kind === "site" || node.kind === "zone"))}
      {@const nested = children.has(id) || devices.has(id)}
      {@const expanded = !management || !collapsed.has(id)}
      <li>
        <div
          class="layer-row"
          class:filtered={!visibleIds.has(id)}
          class:chosen={selected === id}
          style:--gaia-layer-indent={`${depth * 0.65}rem`}
        >
          {#if management && nested}
            <button
              class="visibility"
              type="button"
              aria-expanded={expanded}
              aria-label={`${expanded ? labels.collapse : labels.expand} ${node.name}`}
              onclick={() => collapse(id)}
            >
              {expanded ? "▾" : "▸"}
            </button>
          {/if}
          <button
            class="layer-select"
            data-node={id}
            type="button"
            aria-pressed={selected === id}
            onclick={() => onselect(id)}
            title={`${node.name} · ${labels[node.kind]}`}
          >
            <span class="layer-icon" aria-hidden="true">
              {#if node.kind === "site"}◇{:else if node.kind === "building"}▣{:else if node.kind === "floor"}≡{:else if node.kind === "route"}⌁{:else if node.kind === "mount"}●{:else}▫{/if}
            </span>
            <span>{node.name}</span>
          </button>
          {#if canToggle}
            <button
              class="visibility"
              type="button"
              aria-pressed={hidden.has(id)}
              aria-label={`${hidden.has(id) ? labels.show : labels.hide} ${node.name}`}
              title={`${hidden.has(id) ? labels.show : labels.hide} ${node.name}`}
              onclick={() => ontoggle(id)}
            >
              {hidden.has(id) ? "○" : "◉"}
            </button>
          {/if}
        </div>
        {#if nested && expanded}{@render branch(id, depth + 1)}{/if}
      </li>
    {/each}
    {#if parent !== null}{@render deviceRows(parent, depth)}{/if}
  </ul>
{/snippet}

{#if management}
  <button class="inventory-link" type="button" aria-pressed={!selected} onclick={() => onselect()}>
    {labels.inventory}
  </button>
{/if}

<div class="layer-tree" role="tree" tabindex="-1" bind:this={tree} onkeydown={navigate}>
  {#if children.has(null)}
    {@render branch(null, 0)}
  {:else if !devices.has(null)}
    <p class="muted">{labels.emptyLayers}</p>
  {/if}

  {#if devices.has(null)}
    <section class="reference-list">
      <h3>{labels.unplacedDevices}</h3>
      <ul>{@render deviceRows(null, 0)}</ul>
    </section>
  {/if}
</div>
