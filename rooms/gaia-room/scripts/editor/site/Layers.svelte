<script lang="ts">
  import type en from "../../../i18n/en.json";
  import type { Id, World } from "../../spatial/world.ts";

  let {
    world,
    labels,
    selected,
    hidden,
    visibleIds,
    onselect,
    ontoggle,
  }: {
    world: World;
    labels: typeof en.site;
    selected?: Id;
    hidden: ReadonlySet<Id>;
    visibleIds: ReadonlySet<Id>;
    onselect: (id: Id) => void;
    ontoggle: (id: Id) => void;
  } = $props();
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
</script>

{#snippet branch(parent: Id | null, depth: number)}
  <ul>
    {#each children.get(parent) ?? [] as id (id)}
      {@const node = world.nodes[id]!}
      {@const canToggle = node.kind === "building" || node.kind === "floor"}
      <li>
        <div
          class="layer-row"
          class:filtered={!visibleIds.has(id)}
          class:chosen={selected === id}
          style:--indent={`${depth * 0.7}rem`}
        >
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
              aria-label={`${hidden.has(id) ? labels.show : labels.hide} ${node.name}`}
              title={`${hidden.has(id) ? labels.show : labels.hide} ${node.name}`}
              onclick={() => ontoggle(id)}
            >
              {hidden.has(id) ? "○" : "◉"}
            </button>
          {/if}
        </div>
        {#if children.has(id)}{@render branch(id, depth + 1)}{/if}
      </li>
    {/each}
  </ul>
{/snippet}

{#if children.has(null)}
  {@render branch(null, 0)}
{:else}
  <p class="muted">{labels.emptyLayers}</p>
{/if}
