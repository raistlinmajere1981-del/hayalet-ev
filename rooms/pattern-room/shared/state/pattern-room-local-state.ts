import { createPatternRoomDebateDummyTurn } from "../data/pattern-room-debate-dummy-turns.js";
import type {
  DebateRole,
  DebateTurn,
  PatternActorId,
  PatternLayer,
  PatternNode,
  SourceItem,
  Topic,
} from "../types/pattern-room-domain.js";

export type LocalNote = {
  id: string;
  text: string;
  createdAt: string;
};

export type LocalAuthoredNode = {
  id: string;
  nodeType: "claim" | "inspiration" | "uncertainty";
  label: string;
  content: string;
  createdAt: string;
};

export type LocalAuthoredSource = {
  id: string;
  label: string;
  origin: string;
  note: string;
  createdAt: string;
};

export type LocalAuthoredEvidence = {
  id: string;
  label: string;
  excerpt: string;
  interpretation: string | null;
  layer: PatternLayer;
  createdAt: string;
};

export type DebateLocalPhase =
  | "idle"
  | "preparation"
  | "role_assignment"
  | "opening"
  | "counter_argument"
  | "evidence_review"
  | "weak_point"
  | "judge_mapping"
  | "completed";

export type DebateLocalTurn = {
  id: string;
  actorId: PatternActorId;
  role: DebateRole["role"];
  content: string;
  stance: DebateTurn["stance"];
  phaseKey: DebateLocalPhase;
  turnIndex: number;
  referencedIds?: readonly string[];
};

export type PatternRoomLocalOverlay = {
  deskNodeIds: readonly string[];
  pinnedSourceIds: readonly string[];
  sourcePinnedLayerById: Readonly<Record<string, PatternLayer>>;
  debateReferenceIds: readonly string[];
  debatePhase: DebateLocalPhase;
  debateLocalTurns: readonly DebateLocalTurn[];
  debateRolesConnected: Readonly<Record<string, boolean>>;
  debateLocalVerdict: string | null;
  localNotes: readonly LocalNote[];
  localAuthoredNodes: readonly LocalAuthoredNode[];
  localAuthoredSources: readonly LocalAuthoredSource[];
  localAuthoredEvidence: readonly LocalAuthoredEvidence[];
};

export type PatternRoomLocalGuards = {
  debateReportReflected: boolean;
  noteIndex: number;
};

export type PatternRoomLocalDomainReference = {
  readonly topic: Pick<Topic, "id">;
  readonly nodes: readonly PatternNode[];
  readonly sources: readonly SourceItem[];
};

export type PatternRoomLocalState = {
  getTopicId: () => string;
  sendToDesk: (nodeId: string) => void;
  pinSource: (sourceId: string, layer: PatternLayer) => void;
  addToDebate: (entityId: string) => void;
  addLocalNote: (text: string) => void;
  addAuthoredClaim: (label: string, content: string) => void;
  addAuthoredInspiration: (label: string, content: string) => void;
  addAuthoredUncertainty: (label: string, content: string) => void;
  addAuthoredSource: (label: string, origin: string, note: string) => void;
  addAuthoredEvidence: (
    label: string,
    excerpt: string,
    interpretation?: string,
    layer?: PatternLayer
  ) => void;
  prepareDebate: () => void;
  assignDebateRoles: () => void;
  startDebate: () => void;
  advanceDebatePhase: () => void;
  completeDebate: () => void;
  reflectDebateToReport: () => void;
  getOverlay: () => PatternRoomLocalOverlay;
  getGuards: () => PatternRoomLocalGuards;
  restoreOverlay: (overlay: PatternRoomLocalOverlay, guards: PatternRoomLocalGuards) => void;
  subscribe: (listener: () => void) => () => void;
};

const ROLE_CONNECTION_IDS = ["AI0", "AI1", "AI2", "US1"] as const;

const NEXT_DEBATE_TURN_PHASE: Partial<Record<DebateLocalPhase, DebateLocalPhase>> = {
  opening: "counter_argument",
  counter_argument: "evidence_review",
  evidence_review: "weak_point",
  weak_point: "judge_mapping",
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

function cloneAuthoredNodes(nodes: readonly LocalAuthoredNode[]): LocalAuthoredNode[] {
  return nodes.map((node) => {
    return { ...node };
  });
}

function cloneAuthoredSources(sources: readonly LocalAuthoredSource[]): LocalAuthoredSource[] {
  return sources.map((source) => {
    return { ...source };
  });
}

function cloneAuthoredEvidence(
  evidenceItems: readonly LocalAuthoredEvidence[]
): LocalAuthoredEvidence[] {
  return evidenceItems.map((evidence) => {
    return { ...evidence };
  });
}

function cloneTurns(turns: readonly DebateLocalTurn[]): DebateLocalTurn[] {
  return turns.map((turn) => {
    return turn.referencedIds === undefined
      ? { ...turn }
      : { ...turn, referencedIds: [...turn.referencedIds] };
  });
}

function createLocalId(prefix: string, index: number): string {
  return `${prefix}-${String(index).padStart(3, "0")}`;
}

function getLocalIdIndex(id: string, prefix: string): number {
  const match = new RegExp(`^${prefix}-(\\d{3,})$`).exec(id);
  if (match === null) {
    return 0;
  }
  return Number.parseInt(match[1] ?? "0", 10);
}

function getMaxLocalIdIndex(values: readonly { id: string }[], prefix: string): number {
  return values.reduce((maxIndex, value) => {
    return Math.max(maxIndex, getLocalIdIndex(value.id, prefix));
  }, 0);
}

export function createLocalState(
  domainMock: PatternRoomLocalDomainReference
): PatternRoomLocalState {
  const domainRef = domainMock;
  const deskNodeIds: string[] = [];
  const pinnedSourceIds: string[] = [];
  const sourcePinnedLayerById: Record<string, PatternLayer> = {};
  const debateReferenceIds: string[] = [];
  const debateLocalTurns: DebateLocalTurn[] = [];
  const debateRolesConnected: Record<string, boolean> = {};
  const localNotes: LocalNote[] = [];
  const localAuthoredNodes: LocalAuthoredNode[] = [];
  const localAuthoredSources: LocalAuthoredSource[] = [];
  const localAuthoredEvidence: LocalAuthoredEvidence[] = [];
  const listeners = new Set<() => void>();
  let debatePhase: DebateLocalPhase = "idle";
  let debateLocalVerdict: string | null = null;
  let debateReportReflected = false;
  let noteIndex = 0;
  let authoredNodeIndex = 0;
  let authoredSourceIndex = 0;
  let authoredEvidenceIndex = 0;

  ROLE_CONNECTION_IDS.forEach((roleId) => {
    debateRolesConnected[roleId] = false;
  });

  function hasNode(nodeId: string): boolean {
    return domainRef.nodes.some((node) => node.id === nodeId);
  }

  function hasSource(sourceId: string): boolean {
    return domainRef.sources.some((source) => source.id === sourceId);
  }

  function hasLocalAuthoredNode(nodeId: string): boolean {
    return localAuthoredNodes.some((node) => node.id === nodeId);
  }

  function hasLocalAuthoredSource(sourceId: string): boolean {
    return localAuthoredSources.some((source) => source.id === sourceId);
  }

  function hasLocalAuthoredEvidence(evidenceId: string): boolean {
    return localAuthoredEvidence.some((evidence) => evidence.id === evidenceId);
  }

  function hasDebateReference(entityId: string): boolean {
    return (
      hasNode(entityId) ||
      hasSource(entityId) ||
      hasLocalAuthoredNode(entityId) ||
      hasLocalAuthoredSource(entityId) ||
      hasLocalAuthoredEvidence(entityId)
    );
  }

  function notify(): void {
    listeners.forEach((listener) => {
      listener();
    });
  }

  function addLocalNoteRecord(text: string): boolean {
    const trimmedText = text.trim();
    if (trimmedText === "") {
      return false;
    }
    noteIndex += 1;
    localNotes.push({
      id: `local-note-${String(noteIndex).padStart(3, "0")}`,
      text: trimmedText,
      createdAt: new Date().toISOString(),
    });
    return true;
  }

  function addAuthoredNodeRecord(
    nodeType: LocalAuthoredNode["nodeType"],
    label: string,
    content: string
  ): boolean {
    const trimmedLabel = label.trim();
    const trimmedContent = content.trim();
    if (trimmedLabel === "" || trimmedContent === "") {
      return false;
    }

    authoredNodeIndex += 1;
    localAuthoredNodes.push({
      id: createLocalId("local-node", authoredNodeIndex),
      nodeType,
      label: trimmedLabel,
      content: trimmedContent,
      createdAt: new Date().toISOString(),
    });
    return true;
  }

  function addAuthoredSourceRecord(label: string, origin: string, note: string): boolean {
    const trimmedLabel = label.trim();
    const trimmedOrigin = origin.trim();
    const trimmedNote = note.trim();
    if (trimmedLabel === "" || trimmedOrigin === "") {
      return false;
    }

    authoredSourceIndex += 1;
    localAuthoredSources.push({
      id: createLocalId("local-source", authoredSourceIndex),
      label: trimmedLabel,
      origin: trimmedOrigin,
      note: trimmedNote,
      createdAt: new Date().toISOString(),
    });
    return true;
  }

  function addAuthoredEvidenceRecord(
    label: string,
    excerpt: string,
    interpretation?: string,
    layer?: PatternLayer
  ): boolean {
    const trimmedLabel = label.trim();
    const trimmedExcerpt = excerpt.trim();
    const trimmedInterpretation = interpretation?.trim() ?? "";
    if (trimmedLabel === "" || trimmedExcerpt === "") {
      return false;
    }

    authoredEvidenceIndex += 1;
    localAuthoredEvidence.push({
      id: createLocalId("local-evidence", authoredEvidenceIndex),
      label: trimmedLabel,
      excerpt: trimmedExcerpt,
      interpretation: trimmedInterpretation === "" ? null : trimmedInterpretation,
      layer: layer ?? "evidence",
      createdAt: new Date().toISOString(),
    });
    return true;
  }

  function appendDebateTurn(phaseKey: DebateLocalPhase): void {
    debateLocalTurns.push(createPatternRoomDebateDummyTurn(phaseKey, debateLocalTurns.length));
  }

  function setRolesConnected(connected: boolean): void {
    ROLE_CONNECTION_IDS.forEach((roleId) => {
      debateRolesConnected[roleId] = connected;
    });
  }

  function createDebateVerdict(): string {
    const referenceCount = debateReferenceIds.length;
    const turnCount = debateLocalTurns.length;
    return `Local 10. Adam oturumu tamamlandı: ${referenceCount} referans üzerinden ${turnCount} dummy tur işlendi. Gerçek AI, provider veya relay çağrısı yapılmadı.`;
  }

  function createDebateReportSummary(): string {
    const turnSummary = debateLocalTurns
      .map((turn) => {
        return `${turn.actorId}: ${turn.content}`;
      })
      .join(" ");
    return `10. Adam local oturum özeti: ${debateLocalVerdict ?? createDebateVerdict()} ${turnSummary}`;
  }

  return {
    getTopicId(): string {
      return domainRef.topic.id;
    },
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
      if (!hasDebateReference(entityId)) {
        return;
      }
      if (appendUnique(debateReferenceIds, entityId)) {
        notify();
      }
    },
    addLocalNote(text: string): void {
      if (addLocalNoteRecord(text)) {
        notify();
      }
    },
    addAuthoredClaim(label: string, content: string): void {
      if (addAuthoredNodeRecord("claim", label, content)) {
        notify();
      }
    },
    addAuthoredInspiration(label: string, content: string): void {
      if (addAuthoredNodeRecord("inspiration", label, content)) {
        notify();
      }
    },
    addAuthoredUncertainty(label: string, content: string): void {
      if (addAuthoredNodeRecord("uncertainty", label, content)) {
        notify();
      }
    },
    addAuthoredSource(label: string, origin: string, note: string): void {
      if (addAuthoredSourceRecord(label, origin, note)) {
        notify();
      }
    },
    addAuthoredEvidence(
      label: string,
      excerpt: string,
      interpretation?: string,
      layer?: PatternLayer
    ): void {
      if (addAuthoredEvidenceRecord(label, excerpt, interpretation, layer)) {
        notify();
      }
    },
    prepareDebate(): void {
      if (debateReferenceIds.length === 0) {
        return;
      }
      debatePhase = "preparation";
      debateLocalTurns.length = 0;
      debateLocalVerdict = null;
      debateReportReflected = false;
      setRolesConnected(false);
      notify();
    },
    assignDebateRoles(): void {
      if (debatePhase !== "preparation") {
        return;
      }
      debatePhase = "role_assignment";
      setRolesConnected(true);
      notify();
    },
    startDebate(): void {
      if (debatePhase !== "role_assignment") {
        return;
      }
      debatePhase = "opening";
      debateLocalTurns.length = 0;
      appendDebateTurn("opening");
      notify();
    },
    advanceDebatePhase(): void {
      const nextPhase = NEXT_DEBATE_TURN_PHASE[debatePhase];
      if (nextPhase === undefined) {
        return;
      }
      debatePhase = nextPhase;
      appendDebateTurn(nextPhase);
      notify();
    },
    completeDebate(): void {
      if (debatePhase !== "judge_mapping") {
        return;
      }
      debatePhase = "completed";
      debateLocalVerdict = createDebateVerdict();
      notify();
    },
    reflectDebateToReport(): void {
      if (debatePhase !== "completed" || debateReportReflected) {
        return;
      }
      if (addLocalNoteRecord(createDebateReportSummary())) {
        debateReportReflected = true;
        notify();
      }
    },
    getOverlay(): PatternRoomLocalOverlay {
      return {
        deskNodeIds: [...deskNodeIds],
        pinnedSourceIds: [...pinnedSourceIds],
        sourcePinnedLayerById: { ...sourcePinnedLayerById },
        debateReferenceIds: [...debateReferenceIds],
        debatePhase,
        debateLocalTurns: cloneTurns(debateLocalTurns),
        debateRolesConnected: { ...debateRolesConnected },
        debateLocalVerdict,
        localNotes: cloneNotes(localNotes),
        localAuthoredNodes: cloneAuthoredNodes(localAuthoredNodes),
        localAuthoredSources: cloneAuthoredSources(localAuthoredSources),
        localAuthoredEvidence: cloneAuthoredEvidence(localAuthoredEvidence),
      };
    },
    getGuards(): PatternRoomLocalGuards {
      return {
        debateReportReflected,
        noteIndex,
      };
    },
    restoreOverlay(overlay: PatternRoomLocalOverlay, guards: PatternRoomLocalGuards): void {
      deskNodeIds.splice(0, deskNodeIds.length, ...overlay.deskNodeIds);
      pinnedSourceIds.splice(0, pinnedSourceIds.length, ...overlay.pinnedSourceIds);

      Object.keys(sourcePinnedLayerById).forEach((sourceId) => {
        delete sourcePinnedLayerById[sourceId];
      });
      Object.entries(overlay.sourcePinnedLayerById).forEach(([sourceId, layer]) => {
        sourcePinnedLayerById[sourceId] = layer;
      });

      debateReferenceIds.splice(0, debateReferenceIds.length, ...overlay.debateReferenceIds);
      debateLocalTurns.splice(0, debateLocalTurns.length, ...cloneTurns(overlay.debateLocalTurns));

      ROLE_CONNECTION_IDS.forEach((roleId) => {
        debateRolesConnected[roleId] = overlay.debateRolesConnected[roleId] ?? false;
      });

      localNotes.splice(0, localNotes.length, ...cloneNotes(overlay.localNotes));
      localAuthoredNodes.splice(
        0,
        localAuthoredNodes.length,
        ...cloneAuthoredNodes(overlay.localAuthoredNodes)
      );
      localAuthoredSources.splice(
        0,
        localAuthoredSources.length,
        ...cloneAuthoredSources(overlay.localAuthoredSources)
      );
      localAuthoredEvidence.splice(
        0,
        localAuthoredEvidence.length,
        ...cloneAuthoredEvidence(overlay.localAuthoredEvidence)
      );
      debatePhase = overlay.debatePhase;
      debateLocalVerdict = overlay.debateLocalVerdict;
      debateReportReflected = guards.debateReportReflected;
      noteIndex = Math.max(guards.noteIndex, localNotes.length);
      authoredNodeIndex = getMaxLocalIdIndex(localAuthoredNodes, "local-node");
      authoredSourceIndex = getMaxLocalIdIndex(localAuthoredSources, "local-source");
      authoredEvidenceIndex = getMaxLocalIdIndex(localAuthoredEvidence, "local-evidence");
      notify();
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
