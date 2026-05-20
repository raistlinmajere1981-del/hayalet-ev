import type { PatternLayer, PatternNode, SourceItem } from "../types/pattern-room-domain.js";

export type LocalNote = {
  id: string;
  text: string;
  createdAt: string;
};

export type PatternRoomLocalOverlay = {
  deskNodeIds: readonly string[];
  pinnedSourceIds: readonly string[];
  sourcePinnedLayerById: Readonly<Record<string, PatternLayer>>;
  debateReferenceIds: readonly string[];
  localNotes: readonly LocalNote[];
};

export type PatternRoomLocalDomainReference = {
  readonly nodes: readonly PatternNode[];
  readonly sources: readonly SourceItem[];
};

export type PatternRoomLocalState = {
  sendToDesk: (nodeId: string) => void;
  pinSource: (sourceId: string, layer: PatternLayer) => void;
  addToDebate: (entityId: string) => void;
  addLocalNote: (text: string) => void;
  getOverlay: () => PatternRoomLocalOverlay;
  subscribe: (listener: () => void) => () => void;
};

function appendUnique(values: string[], value: string): boolean {
  if (values.includes(value)) {
    return false;
  }
  values.push(value);
  return true;
}

function cloneNotes(notes: readonly LocalNote[]): LocalNote[] {
  return notes.map((note) => {
    return { ...note };
  });
}

export function createLocalState(
  domainMock: PatternRoomLocalDomainReference
): PatternRoomLocalState {
  const domainRef = domainMock;
  const deskNodeIds: string[] = [];
  const pinnedSourceIds: string[] = [];
  const sourcePinnedLayerById: Record<string, PatternLayer> = {};
  const debateReferenceIds: string[] = [];
  const localNotes: LocalNote[] = [];
  const listeners = new Set<() => void>();
  let noteIndex = 0;

  function hasNode(nodeId: string): boolean {
    return domainRef.nodes.some((node) => node.id === nodeId);
  }

  function hasSource(sourceId: string): boolean {
    return domainRef.sources.some((source) => source.id === sourceId);
  }

  function notify(): void {
    listeners.forEach((listener) => {
      listener();
    });
  }

  return {
    sendToDesk(nodeId: string): void {
      if (!hasNode(nodeId)) {
        return;
      }
      if (appendUnique(deskNodeIds, nodeId)) {
        notify();
      }
    },
    pinSource(sourceId: string, layer: PatternLayer): void {
      if (!hasSource(sourceId)) {
        return;
      }
      const wasPinned = appendUnique(pinnedSourceIds, sourceId);
      const previousLayer = sourcePinnedLayerById[sourceId];
      sourcePinnedLayerById[sourceId] = layer;
      if (wasPinned || previousLayer !== layer) {
        notify();
      }
    },
    addToDebate(entityId: string): void {
      if (!hasNode(entityId) && !hasSource(entityId)) {
        return;
      }
      if (appendUnique(debateReferenceIds, entityId)) {
        notify();
      }
    },
    addLocalNote(text: string): void {
      const trimmedText = text.trim();
      if (trimmedText === "") {
        return;
      }
      noteIndex += 1;
      localNotes.push({
        id: `local-note-${String(noteIndex).padStart(3, "0")}`,
        text: trimmedText,
        createdAt: new Date().toISOString(),
      });
      notify();
    },
    getOverlay(): PatternRoomLocalOverlay {
      return {
        deskNodeIds: [...deskNodeIds],
        pinnedSourceIds: [...pinnedSourceIds],
        sourcePinnedLayerById: { ...sourcePinnedLayerById },
        debateReferenceIds: [...debateReferenceIds],
        localNotes: cloneNotes(localNotes),
      };
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
