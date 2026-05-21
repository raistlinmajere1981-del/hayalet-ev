import { createPatternRoomDebateDummyTurn } from "../data/pattern-room-debate-dummy-turns.js";
import type {
  DebateRole,
  DebateTurn,
  PatternActorId,
  PatternEdgeType,
  PatternLayer,
  PatternNode,
  SourceItem,
  Topic,
} from "../types/pattern-room-domain.js";
import type {
  SourceImportEvidenceDraft,
  SourceImportResult,
} from "../source-workbench/types/source-package.js";

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

export type LocalAuthoredEdge = {
  id: string;
  edgeType: PatternEdgeType;
  sourceId: string;
  targetId: string;
  note: string | null;
  createdAt: string;
};

export type SourceImportApplySummary = {
  sourcesAdded: number;
  evidenceAdded: number;
  nodesAdded: number;
  edgesAdded: number;
  notesAdded: number;
  edgesDropped: number;
  duplicatesSkipped: number;
  warnings: readonly string[];
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
  localAuthoredEdges: readonly LocalAuthoredEdge[];
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
  addAuthoredEdge: (
    edgeType: PatternEdgeType,
    sourceId: string,
    targetId: string,
    note?: string
  ) => void;
  applySourceImportResult: (result: SourceImportResult) => SourceImportApplySummary;
  resolveEntityExists: (id: string) => boolean;
  resolveEntityLabel: (id: string) => string | null;
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

const PATTERN_EDGE_TYPES: readonly PatternEdgeType[] = [
  "supports",
  "contradicts",
  "references",
  "derived_from",
  "inspired_by",
  "questions",
  "needs_review",
];

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

function cloneAuthoredEdges(edges: readonly LocalAuthoredEdge[]): LocalAuthoredEdge[] {
  return edges.map((edge) => {
    return { ...edge };
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

function isPatternEdgeType(value: string): value is PatternEdgeType {
  return PATTERN_EDGE_TYPES.includes(value as PatternEdgeType);
}

function createDuplicateKey(...parts: readonly string[]): string {
  return parts
    .map((part) => {
      return part.trim().toLocaleLowerCase();
    })
    .join("\n");
}

function readOptionalImportText(value: string | null): string | null {
  const trimmedValue = value?.trim() ?? "";
  return trimmedValue === "" ? null : trimmedValue;
}

function createEvidenceInterpretation(draft: SourceImportEvidenceDraft): string | null {
  const interpretation = readOptionalImportText(draft.interpretation);
  const contextParts = [
    readOptionalImportText(draft.timecode) === null
      ? null
      : `Zaman: ${readOptionalImportText(draft.timecode)}`,
    readOptionalImportText(draft.page) === null
      ? null
      : `Sayfa: ${readOptionalImportText(draft.page)}`,
    readOptionalImportText(draft.speaker) === null
      ? null
      : `Konuşmacı: ${readOptionalImportText(draft.speaker)}`,
    readOptionalImportText(draft.context) === null
      ? null
      : `Bağlam: ${readOptionalImportText(draft.context)}`,
  ].flatMap((part) => {
    return part === null ? [] : [part];
  });

  if (contextParts.length === 0) {
    return interpretation;
  }

  const contextSummary = `Kaynak bağlamı: ${contextParts.join(" · ")}`;
  return interpretation === null ? contextSummary : `${interpretation}\n\n${contextSummary}`;
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
  const localAuthoredEdges: LocalAuthoredEdge[] = [];
  const listeners = new Set<() => void>();
  let debatePhase: DebateLocalPhase = "idle";
  let debateLocalVerdict: string | null = null;
  let debateReportReflected = false;
  let noteIndex = 0;
  let authoredNodeIndex = 0;
  let authoredSourceIndex = 0;
  let authoredEvidenceIndex = 0;
  let authoredEdgeIndex = 0;

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

  function resolveEntityExists(id: string): boolean {
    return (
      hasNode(id) ||
      hasSource(id) ||
      hasLocalAuthoredNode(id) ||
      hasLocalAuthoredSource(id) ||
      hasLocalAuthoredEvidence(id)
    );
  }

  function resolveEntityLabel(id: string): string | null {
    const domainNode = domainRef.nodes.find((node) => node.id === id);
    if (domainNode !== undefined) {
      return domainNode.label;
    }

    const domainSource = domainRef.sources.find((source) => source.id === id);
    if (domainSource !== undefined) {
      return domainSource.label;
    }

    const localNode = localAuthoredNodes.find((node) => node.id === id);
    if (localNode !== undefined) {
      return localNode.label;
    }

    const localSource = localAuthoredSources.find((source) => source.id === id);
    if (localSource !== undefined) {
      return localSource.label;
    }

    const localEvidence = localAuthoredEvidence.find((evidence) => evidence.id === id);
    return localEvidence?.label ?? null;
  }

  function hasDebateReference(entityId: string): boolean {
    return resolveEntityExists(entityId);
  }

  function notify(): void {
    listeners.forEach((listener) => {
      listener();
    });
  }

  function addLocalNoteRecord(text: string, createdAt = new Date().toISOString()): string | null {
    const trimmedText = text.trim();
    if (trimmedText === "") {
      return null;
    }
    noteIndex += 1;
    const id = createLocalId("local-note", noteIndex);
    localNotes.push({
      id,
      text: trimmedText,
      createdAt,
    });
    return id;
  }

  function addAuthoredNodeRecord(
    nodeType: LocalAuthoredNode["nodeType"],
    label: string,
    content: string,
    createdAt = new Date().toISOString()
  ): string | null {
    const trimmedLabel = label.trim();
    const trimmedContent = content.trim();
    if (trimmedLabel === "" || trimmedContent === "") {
      return null;
    }

    authoredNodeIndex += 1;
    const id = createLocalId("local-node", authoredNodeIndex);
    localAuthoredNodes.push({
      id,
      nodeType,
      label: trimmedLabel,
      content: trimmedContent,
      createdAt,
    });
    return id;
  }

  function addAuthoredSourceRecord(
    label: string,
    origin: string,
    note: string,
    createdAt = new Date().toISOString()
  ): string | null {
    const trimmedLabel = label.trim();
    const trimmedOrigin = origin.trim();
    const trimmedNote = note.trim();
    if (trimmedLabel === "" || trimmedOrigin === "") {
      return null;
    }

    authoredSourceIndex += 1;
    const id = createLocalId("local-source", authoredSourceIndex);
    localAuthoredSources.push({
      id,
      label: trimmedLabel,
      origin: trimmedOrigin,
      note: trimmedNote,
      createdAt,
    });
    return id;
  }

  function addAuthoredEvidenceRecord(
    label: string,
    excerpt: string,
    interpretation?: string,
    layer?: PatternLayer,
    createdAt = new Date().toISOString()
  ): string | null {
    const trimmedLabel = label.trim();
    const trimmedExcerpt = excerpt.trim();
    const trimmedInterpretation = interpretation?.trim() ?? "";
    if (trimmedLabel === "" || trimmedExcerpt === "") {
      return null;
    }

    authoredEvidenceIndex += 1;
    const id = createLocalId("local-evidence", authoredEvidenceIndex);
    localAuthoredEvidence.push({
      id,
      label: trimmedLabel,
      excerpt: trimmedExcerpt,
      interpretation: trimmedInterpretation === "" ? null : trimmedInterpretation,
      layer: layer ?? "evidence",
      createdAt,
    });
    return id;
  }

  function addAuthoredEdgeRecord(
    edgeType: PatternEdgeType,
    sourceId: string,
    targetId: string,
    note?: string,
    createdAt = new Date().toISOString()
  ): string | null {
    const trimmedSourceId = sourceId.trim();
    const trimmedTargetId = targetId.trim();
    const trimmedNote = note?.trim() ?? "";
    if (
      trimmedSourceId === "" ||
      trimmedTargetId === "" ||
      trimmedSourceId === trimmedTargetId ||
      !isPatternEdgeType(edgeType) ||
      !resolveEntityExists(trimmedSourceId) ||
      !resolveEntityExists(trimmedTargetId)
    ) {
      return null;
    }

    authoredEdgeIndex += 1;
    const id = createLocalId("local-edge", authoredEdgeIndex);
    localAuthoredEdges.push({
      id,
      edgeType,
      sourceId: trimmedSourceId,
      targetId: trimmedTargetId,
      note: trimmedNote === "" ? null : trimmedNote,
      createdAt,
    });
    return id;
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

  function applySourceImportResult(result: SourceImportResult): SourceImportApplySummary {
    const importedAt = new Date().toISOString();
    const draftIdToLocalId = new Map<string, string>();
    const summary = {
      sourcesAdded: 0,
      evidenceAdded: 0,
      nodesAdded: 0,
      edgesAdded: 0,
      notesAdded: 0,
      edgesDropped: 0,
      duplicatesSkipped: 0,
      warnings: result.warnings.map((warning) => {
        return warning.message;
      }),
    };
    const sourceKeys = new Set(
      localAuthoredSources.map((source) => {
        return createDuplicateKey(source.label, source.origin);
      })
    );
    const evidenceKeys = new Set(
      localAuthoredEvidence.map((evidence) => {
        return createDuplicateKey(evidence.excerpt);
      })
    );
    const nodeKeys = new Set(
      localAuthoredNodes.map((node) => {
        return createDuplicateKey(node.label, node.content);
      })
    );

    result.sources.forEach((source) => {
      const sourceKey = createDuplicateKey(source.label, source.origin);
      if (sourceKeys.has(sourceKey)) {
        summary.duplicatesSkipped += 1;
        summary.warnings.push(`Duplicate source draft skipped: ${source.draftId}`);
        return;
      }

      const localId = addAuthoredSourceRecord(source.label, source.origin, source.note, importedAt);
      if (localId === null) {
        summary.warnings.push(`Source draft skipped because it was incomplete: ${source.draftId}`);
        return;
      }

      sourceKeys.add(sourceKey);
      draftIdToLocalId.set(source.draftId, localId);
      summary.sourcesAdded += 1;
    });

    result.evidence.forEach((evidence) => {
      const evidenceKey = createDuplicateKey(evidence.excerpt);
      if (evidenceKeys.has(evidenceKey)) {
        summary.duplicatesSkipped += 1;
        summary.warnings.push(`Duplicate evidence draft skipped: ${evidence.draftId}`);
        return;
      }

      const localId = addAuthoredEvidenceRecord(
        evidence.label,
        evidence.excerpt,
        createEvidenceInterpretation(evidence) ?? undefined,
        "evidence",
        importedAt
      );
      if (localId === null) {
        summary.warnings.push(
          `Evidence draft skipped because it was incomplete: ${evidence.draftId}`
        );
        return;
      }

      evidenceKeys.add(evidenceKey);
      draftIdToLocalId.set(evidence.draftId, localId);
      summary.evidenceAdded += 1;
    });

    result.nodes.forEach((node) => {
      const nodeKey = createDuplicateKey(node.label, node.content);
      if (nodeKeys.has(nodeKey)) {
        summary.duplicatesSkipped += 1;
        summary.warnings.push(`Duplicate node draft skipped: ${node.draftId}`);
        return;
      }

      const localId = addAuthoredNodeRecord(node.nodeType, node.label, node.content, importedAt);
      if (localId === null) {
        summary.warnings.push(`Node draft skipped because it was incomplete: ${node.draftId}`);
        return;
      }

      nodeKeys.add(nodeKey);
      draftIdToLocalId.set(node.draftId, localId);
      summary.nodesAdded += 1;
    });

    result.notes.forEach((note) => {
      const localId = addLocalNoteRecord(note.text, importedAt);
      if (localId === null) {
        summary.warnings.push(`Note draft skipped because it was empty: ${note.draftId}`);
        return;
      }

      draftIdToLocalId.set(note.draftId, localId);
      summary.notesAdded += 1;
    });

    result.edges.forEach((edge) => {
      const sourceId = draftIdToLocalId.get(edge.sourceDraftId);
      const targetId = draftIdToLocalId.get(edge.targetDraftId);
      if (sourceId === undefined || targetId === undefined) {
        summary.edgesDropped += 1;
        summary.warnings.push(
          `Edge draft dropped because a draft endpoint was not imported: ${edge.draftId}`
        );
        return;
      }

      const localId = addAuthoredEdgeRecord(
        edge.edgeType,
        sourceId,
        targetId,
        edge.note ?? undefined,
        importedAt
      );
      if (localId === null) {
        summary.edgesDropped += 1;
        summary.warnings.push(
          `Edge draft dropped because the mapped endpoints were not valid local entities: ${edge.draftId}`
        );
        return;
      }

      draftIdToLocalId.set(edge.draftId, localId);
      summary.edgesAdded += 1;
    });

    if (
      summary.sourcesAdded > 0 ||
      summary.evidenceAdded > 0 ||
      summary.nodesAdded > 0 ||
      summary.edgesAdded > 0 ||
      summary.notesAdded > 0
    ) {
      notify();
    }

    return {
      ...summary,
      warnings: [...summary.warnings],
    };
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
    addAuthoredEdge(
      edgeType: PatternEdgeType,
      sourceId: string,
      targetId: string,
      note?: string
    ): void {
      if (addAuthoredEdgeRecord(edgeType, sourceId, targetId, note)) {
        notify();
      }
    },
    applySourceImportResult(result: SourceImportResult): SourceImportApplySummary {
      return applySourceImportResult(result);
    },
    resolveEntityExists(id: string): boolean {
      return resolveEntityExists(id);
    },
    resolveEntityLabel(id: string): string | null {
      return resolveEntityLabel(id);
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
        localAuthoredEdges: cloneAuthoredEdges(localAuthoredEdges),
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
      localAuthoredEdges.splice(
        0,
        localAuthoredEdges.length,
        ...cloneAuthoredEdges(overlay.localAuthoredEdges)
      );
      debatePhase = overlay.debatePhase;
      debateLocalVerdict = overlay.debateLocalVerdict;
      debateReportReflected = guards.debateReportReflected;
      noteIndex = Math.max(guards.noteIndex, getMaxLocalIdIndex(localNotes, "local-note"));
      authoredNodeIndex = getMaxLocalIdIndex(localAuthoredNodes, "local-node");
      authoredSourceIndex = getMaxLocalIdIndex(localAuthoredSources, "local-source");
      authoredEvidenceIndex = getMaxLocalIdIndex(localAuthoredEvidence, "local-evidence");
      authoredEdgeIndex = getMaxLocalIdIndex(localAuthoredEdges, "local-edge");
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
