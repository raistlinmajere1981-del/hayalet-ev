import {
  PATTERN_LAYERS,
  type DebateRole,
  type DebateSession,
  type EvidenceItem,
  type PatternEdge,
  type PatternLayer,
  type PatternNode,
  type PatternReliability,
  type PatternSourceType,
  type PatternTraceType,
  type ReportTrace,
  type SourceItem,
  type Topic,
} from "../types/pattern-room-domain.js";
import type {
  PatternBoardCategory,
  PatternBoardCategoryTone,
  PatternBoardPin,
  PatternClaim,
  PatternDebateReference,
  PatternReportSection,
  PatternRoomMockData,
  PatternSource,
} from "../types/pattern-room.js";
import type {
  LocalAuthoredEvidence,
  LocalAuthoredNode,
  LocalAuthoredSource,
  PatternRoomLocalOverlay,
} from "../state/pattern-room-local-state.js";

export type PatternRoomDomainViewSource = {
  topic: Topic;
  nodes: PatternNode[];
  edges: PatternEdge[];
  sources: SourceItem[];
  evidence: EvidenceItem[];
  debateSession: DebateSession;
  reportTrace: ReportTrace[];
};

export type PatternOverviewViewModel = Pick<
  PatternRoomMockData,
  "roomTitle" | "roomLabel" | "roomSummary" | "subject"
>;

export type PatternBoardViewModel = Pick<PatternRoomMockData, "boardCategories">;

export type PatternArchiveViewModel = Pick<PatternRoomMockData, "sources">;

export type PatternDeskViewModel = Pick<PatternRoomMockData, "claims">;

export type PatternTenthManViewModel = Pick<PatternRoomMockData, "tenthManSession">;

export type PatternReportViewModel = Pick<PatternRoomMockData, "reportSummary">;

type PatternReportSectionId =
  | "report-evidence"
  | "report-analysis"
  | "report-uncertainties"
  | "report-next-notes";

const LAYER_TONES: Record<PatternLayer, PatternBoardCategoryTone> = {
  evidence: "evidence",
  analysis: "analysis",
  interpretation: "commentary",
  uncertainty: "uncertainty",
};

const LAYER_LABELS: Record<PatternLayer, string> = {
  evidence: "Kanıt",
  analysis: "Analiz",
  interpretation: "Yorum",
  uncertainty: "Belirsizlik",
};

const LAYER_SUMMARIES: Record<PatternLayer, string> = {
  evidence: "Doğrudan kaynak, gözlem ve alıntı izleri bu katmanda tutulur.",
  analysis: "Kaynaklardan türeyen temkinli çıkarımlar ayrı görünür.",
  interpretation: "Yorum ve senaryo notları kesin sonuçtan ayrılır.",
  uncertainty: "Eksik bağlam, itiraz ve doğrulanmamış noktalar işaretlenir.",
};

const SOURCE_TYPE_LABELS: Record<PatternSourceType, string> = {
  book: "Kitap / Metin",
  religious_text: "Dini metin",
  newspaper: "Gazete",
  subtitle_archive: "Altyazı arşivi",
  web_archive: "Web arşivi",
  visual: "Görsel kaynak",
  laboratory_result: "Laboratory sonucu",
  number_analysis: "Sayı analizi",
  personal_note: "Kişisel not",
  unknown: "Belirsiz kaynak",
};

const RELIABILITY_LABELS: Record<PatternReliability, string> = {
  unverified: "Doğrulanmamış",
  user_provided: "Kullanıcı sağladı",
  verified: "Doğrulanmış",
  disputed: "Tartışmalı",
  unknown: "Güvenilirlik bilinmiyor",
};

const ROLE_NOTES: Record<DebateRole["role"], string> = {
  researcher: "Kanıt izlerini düzenleyen temsili slot.",
  advocate: "Ana açıklamayı savunan temsili slot.",
  "tenth-man": "Karşı argümanları yükselten temsili slot.",
  arbiter: "Gerçek bağlantısı olmayan görsel hakem etiketi.",
};

const LOCAL_AUTHORED_NODE_LAYERS: Record<LocalAuthoredNode["nodeType"], PatternLayer> = {
  claim: "interpretation",
  inspiration: "analysis",
  uncertainty: "uncertainty",
};

const REPORT_SECTION_DEFINITIONS: Array<{
  id: PatternReportSectionId;
  label: string;
  tone: PatternBoardCategoryTone;
  note: string;
  fallbackBullet: string;
}> = [
  {
    id: "report-evidence",
    label: "Kanıtlar",
    tone: "evidence",
    note: "Kaynak ve kanıt izleri kesin hüküm üretmeden listelenir.",
    fallbackBullet: "Bu mock görünümde kanıt izi henüz boş bırakılmıştır.",
  },
  {
    id: "report-analysis",
    label: "Analizler",
    tone: "analysis",
    note: "Analiz izleri yalnızca pano durumunu özetler.",
    fallbackBullet: "Bu mock görünümde analiz izi henüz boş bırakılmıştır.",
  },
  {
    id: "report-uncertainties",
    label: "Belirsizlikler",
    tone: "uncertainty",
    note: "Eksik bağlam ve temkin gerektiren izler ayrı tutulur.",
    fallbackBullet: "Bu mock görünümde belirsizlik izi henüz boş bırakılmıştır.",
  },
  {
    id: "report-next-notes",
    label: "Sonraki araştırma notları",
    tone: "commentary",
    note: "Tartışma ve takip izleri geçici rapor notu olarak gösterilir.",
    fallbackBullet: "Bu mock görünümde takip notu henüz boş bırakılmıştır.",
  },
];

function adaptSubjectLabel(topic: Topic): string {
  const normalizedLabel = topic.label.toLocaleLowerCase("tr-TR");
  if (normalizedLabel.includes("dunya") || normalizedLabel.includes("dünya")) {
    return "Dünya’nın Şekli";
  }
  return topic.label;
}

function indexSourcesById(sources: readonly SourceItem[]): Map<string, SourceItem> {
  return new Map(
    sources.map((source) => {
      return [source.id, source];
    })
  );
}

function indexNodesById(nodes: readonly PatternNode[]): Map<string, PatternNode> {
  return new Map(
    nodes.map((node) => {
      return [node.id, node];
    })
  );
}

function formatConfidence(confidence: number | null): string {
  if (confidence === null) {
    return "Belirtilmemiş";
  }
  return `${Math.round(confidence * 100)}%`;
}

function adaptBoardNodePin(node: PatternNode, source: SourceItem | undefined): PatternBoardPin {
  return {
    id: node.id,
    label: node.label,
    layer: node.layer,
    layerLabel: LAYER_LABELS[node.layer],
    tone: LAYER_TONES[node.layer],
    confidenceLabel: formatConfidence(node.confidence),
    content: node.content,
    sourceId: node.sourceRef,
    sourceLabel: source?.label ?? node.sourceRef ?? "Kaynak yok",
    origin: source?.origin ?? null,
    kind: "node",
    isLocal: false,
  };
}

function adaptBoardSourcePin(source: SourceItem, layer: PatternLayer): PatternBoardPin {
  return {
    id: source.id,
    label: source.label,
    layer,
    layerLabel: LAYER_LABELS[layer],
    tone: LAYER_TONES[layer],
    confidenceLabel: RELIABILITY_LABELS[source.reliability],
    content: adaptSourceNote(source),
    sourceId: source.id,
    sourceLabel: source.label,
    origin: source.origin,
    kind: "source",
    isLocal: true,
  };
}

function adaptLocalAuthoredNodePin(node: LocalAuthoredNode): PatternBoardPin {
  const layer = LOCAL_AUTHORED_NODE_LAYERS[node.nodeType];
  return {
    id: node.id,
    label: node.label,
    layer,
    layerLabel: LAYER_LABELS[layer],
    tone: LAYER_TONES[layer],
    confidenceLabel: "Yerel",
    content: node.content,
    sourceId: null,
    sourceLabel: "Local overlay",
    origin: null,
    kind: "node",
    isLocal: true,
  };
}

function adaptLocalAuthoredEvidencePin(evidence: LocalAuthoredEvidence): PatternBoardPin {
  const interpretation =
    evidence.interpretation === null ? "" : ` Yorum: ${evidence.interpretation}`;
  return {
    id: evidence.id,
    label: evidence.label,
    layer: "evidence",
    layerLabel: LAYER_LABELS.evidence,
    tone: LAYER_TONES.evidence,
    confidenceLabel: "Yerel",
    content: `${evidence.excerpt}${interpretation}`,
    sourceId: null,
    sourceLabel: "Yerel kanıt notu",
    origin: LAYER_LABELS[evidence.layer],
    kind: "evidence",
    isLocal: true,
  };
}

function createLayerPlaceholderPin(layer: PatternLayer): PatternBoardPin {
  return {
    id: `board-placeholder-${layer}`,
    label: LAYER_LABELS[layer],
    layer,
    layerLabel: LAYER_LABELS[layer],
    tone: LAYER_TONES[layer],
    confidenceLabel: "Dummy",
    content: LAYER_SUMMARIES[layer],
    sourceId: null,
    sourceLabel: "Kaynak yok",
    origin: null,
    kind: "placeholder",
    isLocal: false,
  };
}

function adaptClaimNode(node: PatternNode): PatternClaim {
  const stance: PatternClaim["stance"] =
    node.nodeType === "contradiction" || node.nodeType === "uncertainty" ? "counter" : "primary";
  return {
    id: `claim-${node.id}`,
    label: node.label,
    summary: node.content,
    stance,
  };
}

function adaptLocalAuthoredClaimNode(node: LocalAuthoredNode): PatternClaim {
  return {
    id: `claim-${node.id}`,
    label: node.label,
    summary: node.content,
    stance: "primary",
  };
}

function adaptSourceNote(source: SourceItem): string {
  const reliabilityLabel = RELIABILITY_LABELS[source.reliability];
  if (source.sourceType === "personal_note") {
    return `Masa çıktısı geçici kartı; kaynak türü ${SOURCE_TYPE_LABELS[source.sourceType]} ve güvenilirlik ${reliabilityLabel}.`;
  }
  return `${reliabilityLabel}; kaynak origin: ${source.origin}.`;
}

function adaptLocalAuthoredSource(source: LocalAuthoredSource): PatternSource {
  return {
    id: source.id,
    label: source.label,
    sourceTypeLabel: "Yerel Kaynak",
    origin: source.origin,
    status: "local",
    note: source.note === "" ? "Local overlay içinde eklenen kaynak." : source.note,
    isLocal: true,
  };
}

function adaptRoleLabel(role: DebateRole): string {
  if (role.slotId === "AI0" && role.role === "researcher") {
    return "AI0 — Araştırmacı";
  }
  if (role.slotId === "AI1" && role.role === "advocate") {
    return "AI1 — Savunucu";
  }
  if (role.slotId === "AI2" && role.role === "tenth-man") {
    return "AI2 — 10. Adam / Karşıt";
  }
  if (role.slotId === "US1" && role.role === "arbiter") {
    return "US1 — Hakem / Uzak kullanıcı";
  }
  return `${role.slotId} — ${role.label}`;
}

function classifyTraceSection(traceType: PatternTraceType): PatternReportSectionId {
  switch (traceType) {
    case "source-added":
    case "evidence-added":
      return "report-evidence";
    case "edge-added":
    case "confidence-changed":
    case "layer-promoted":
      return "report-analysis";
    case "node-removed":
    case "edge-removed":
      return "report-uncertainties";
    case "node-added":
    case "debate-started":
    case "debate-turn":
    case "debate-ended":
    case "verdict-set":
    case "report-generated":
      return "report-next-notes";
  }
}

export function adaptOverviewViewModel(
  domain: PatternRoomDomainViewSource
): PatternOverviewViewModel {
  return {
    roomTitle: "İz Sürme Odası",
    roomLabel: "Pattern Room",
    roomSummary:
      "Near-future dedektif ofisinde kanıt panosu, holografik masa ve temkinli rapor terminali.",
    subject: adaptSubjectLabel(domain.topic),
  };
}

export function adaptBoardViewModel(
  domain: PatternRoomDomainViewSource,
  overlay?: PatternRoomLocalOverlay
): PatternBoardViewModel {
  const sourceById = indexSourcesById(domain.sources);
  const pinnedSourcePinsByLayer = new Map<PatternLayer, PatternBoardPin[]>();
  const localPinsByLayer = new Map<PatternLayer, PatternBoardPin[]>();

  if (overlay !== undefined) {
    for (const sourceId of overlay.pinnedSourceIds) {
      const source = sourceById.get(sourceId);
      if (source === undefined) {
        continue;
      }
      const layer = overlay.sourcePinnedLayerById[sourceId] ?? "evidence";
      const pins = pinnedSourcePinsByLayer.get(layer) ?? [];
      pins.push(adaptBoardSourcePin(source, layer));
      pinnedSourcePinsByLayer.set(layer, pins);
    }

    for (const localNode of overlay.localAuthoredNodes) {
      const pin = adaptLocalAuthoredNodePin(localNode);
      const pins = localPinsByLayer.get(pin.layer) ?? [];
      pins.push(pin);
      localPinsByLayer.set(pin.layer, pins);
    }

    for (const localEvidence of overlay.localAuthoredEvidence) {
      const pin = adaptLocalAuthoredEvidencePin(localEvidence);
      const pins = localPinsByLayer.get(pin.layer) ?? [];
      pins.push(pin);
      localPinsByLayer.set(pin.layer, pins);
    }
  }

  const boardCategories: PatternBoardCategory[] = PATTERN_LAYERS.map((layer) => {
    const nodePins = domain.nodes
      .filter((node) => node.layer === layer)
      .map((node) => {
        const source = node.sourceRef === null ? undefined : sourceById.get(node.sourceRef);
        return adaptBoardNodePin(node, source);
      });
    const pinnedSourcePins = pinnedSourcePinsByLayer.get(layer) ?? [];
    const localPins = localPinsByLayer.get(layer) ?? [];
    const pins = [...nodePins, ...pinnedSourcePins, ...localPins];

    return {
      id: `board-${layer}`,
      label: LAYER_LABELS[layer],
      tone: LAYER_TONES[layer],
      summary: LAYER_SUMMARIES[layer],
      pins: pins.length > 0 ? pins : [createLayerPlaceholderPin(layer)],
    };
  });

  return { boardCategories };
}

export function adaptArchiveViewModel(
  domain: PatternRoomDomainViewSource,
  overlay?: PatternRoomLocalOverlay
): PatternArchiveViewModel {
  const sources: PatternSource[] = domain.sources.map((source) => {
    return {
      id: source.id,
      label: source.label,
      sourceTypeLabel: SOURCE_TYPE_LABELS[source.sourceType],
      origin: source.origin,
      status: "mocked",
      note: adaptSourceNote(source),
      isLocal: false,
    };
  });

  const localSources = overlay?.localAuthoredSources.map(adaptLocalAuthoredSource) ?? [];

  return { sources: [...sources, ...localSources] };
}

export function adaptDeskViewModel(
  domain: PatternRoomDomainViewSource,
  overlay?: PatternRoomLocalOverlay
): PatternDeskViewModel {
  const claimNodes = domain.nodes.filter((node) => {
    return (
      node.nodeType === "claim" ||
      node.nodeType === "decision" ||
      node.nodeType === "contradiction" ||
      node.nodeType === "uncertainty"
    );
  });

  const claims =
    claimNodes.length > 0
      ? claimNodes.map(adaptClaimNode)
      : [
          {
            id: `claim-${domain.topic.id}`,
            label: domain.topic.label,
            summary: domain.topic.description,
            stance: "primary" as const,
          },
        ];

  const nodeById = indexNodesById(domain.nodes);
  const localClaims =
    overlay?.deskNodeIds
      .map((nodeId) => {
        const node = nodeById.get(nodeId);
        if (node === undefined) {
          return null;
        }
        return {
          id: `desk-local-${node.id}`,
          label: node.label,
          summary: `Yerel masaya gönderildi: ${node.content}`,
          stance:
            node.nodeType === "contradiction" || node.nodeType === "uncertainty"
              ? ("counter" as const)
              : ("primary" as const),
        };
      })
      .filter((claim): claim is PatternClaim => claim !== null) ?? [];
  const authoredClaims =
    overlay?.localAuthoredNodes
      .filter((node) => {
        return node.nodeType === "claim";
      })
      .map(adaptLocalAuthoredClaimNode) ?? [];

  return { claims: [...claims, ...localClaims, ...authoredClaims] };
}

export function adaptTenthManViewModel(
  domain: PatternRoomDomainViewSource,
  overlay?: PatternRoomLocalOverlay
): PatternTenthManViewModel {
  const nodeById = indexNodesById(domain.nodes);
  const sourceById = indexSourcesById(domain.sources);
  const references =
    overlay?.debateReferenceIds
      .map((referenceId) => {
        const node = nodeById.get(referenceId);
        if (node !== undefined) {
          return {
            id: `debate-reference-node-${node.id}`,
            label: node.label,
            note: `Yerel 10. Adam referansı: ${node.content}`,
            kind: "node" as const,
          };
        }

        const source = sourceById.get(referenceId);
        if (source !== undefined) {
          return {
            id: `debate-reference-source-${source.id}`,
            label: source.label,
            note: `Yerel kaynak referansı: ${source.origin}`,
            kind: "source" as const,
          };
        }

        const localNode = overlay.localAuthoredNodes.find((node) => node.id === referenceId);
        if (localNode !== undefined) {
          return {
            id: `debate-reference-local-node-${localNode.id}`,
            label: localNode.label,
            note: `Yerel öğe referansı: ${localNode.content}`,
            kind: "node" as const,
          };
        }

        const localSource = overlay.localAuthoredSources.find(
          (source) => source.id === referenceId
        );
        if (localSource !== undefined) {
          return {
            id: `debate-reference-local-source-${localSource.id}`,
            label: localSource.label,
            note: `Yerel kaynak referansı: ${localSource.origin}`,
            kind: "source" as const,
          };
        }

        const localEvidence = overlay.localAuthoredEvidence.find((evidence) => {
          return evidence.id === referenceId;
        });
        if (localEvidence !== undefined) {
          return {
            id: `debate-reference-local-evidence-${localEvidence.id}`,
            label: localEvidence.label,
            note: `Yerel kanıt notu: ${localEvidence.excerpt}`,
            kind: "evidence" as const,
          };
        }

        return null;
      })
      .filter((reference): reference is PatternDebateReference => reference !== null) ?? [];

  return {
    tenthManSession: {
      id: domain.debateSession.id,
      label: "Masaya bağlı 10. Adam cihazı",
      status:
        overlay?.debatePhase === "completed"
          ? "completed"
          : overlay?.debatePhase !== undefined && overlay.debatePhase !== "idle"
            ? "active"
            : "dummy",
      prompt: domain.debateSession.prompt,
      roles: domain.debateSession.roles.map((role) => {
        return {
          id: `role-${role.slotId.toLocaleLowerCase("en-US")}-${role.role}`,
          label: adaptRoleLabel(role),
          note: ROLE_NOTES[role.role],
          connected: overlay?.debateRolesConnected[role.slotId] ?? role.connected,
        };
      }),
      references,
      phase: overlay?.debatePhase ?? "idle",
      turns:
        overlay?.debateLocalTurns.map((turn) => {
          return { ...turn };
        }) ?? [],
      verdict: overlay?.debateLocalVerdict ?? null,
    },
  };
}

export function adaptReportViewModel(
  domain: PatternRoomDomainViewSource,
  overlay?: PatternRoomLocalOverlay
): PatternReportViewModel {
  const tracesBySection = new Map<PatternReportSectionId, ReportTrace[]>();

  for (const trace of domain.reportTrace) {
    const sectionId = classifyTraceSection(trace.traceType);
    const traces = tracesBySection.get(sectionId) ?? [];
    traces.push(trace);
    tracesBySection.set(sectionId, traces);
  }

  // Temporary view-only grouping until a real report capability exists; it avoids verdict language.
  const sections: PatternReportSection[] = REPORT_SECTION_DEFINITIONS.map((definition) => {
    const traces = tracesBySection.get(definition.id) ?? [];
    const bullets =
      traces.length > 0 ? traces.map((trace) => trace.summary) : [definition.fallbackBullet];
    return {
      id: definition.id,
      label: definition.label,
      tone: definition.tone,
      note: definition.note,
      bullets,
    };
  });

  if (overlay !== undefined && overlay.localNotes.length > 0) {
    sections.push({
      id: "report-local-notes",
      label: "Yerel Notlar",
      tone: "commentary",
      note: "Sadece bu oturumun belleğinde tutulan geçici notlar.",
      bullets: overlay.localNotes.map((note) => note.text),
    });
  }

  if (overlay !== undefined && overlay.localAuthoredEvidence.length > 0) {
    sections.push({
      id: "report-local-evidence-notes",
      label: "Yerel Kanıt Notları",
      tone: "evidence",
      note: "Local overlay içinde eklenen kanıt notları rapor terminalinde ayrı tutulur.",
      bullets: overlay.localAuthoredEvidence.map((evidence) => {
        return evidence.interpretation === null
          ? `${evidence.label}: ${evidence.excerpt}`
          : `${evidence.label}: ${evidence.excerpt} Yorum: ${evidence.interpretation}`;
      }),
    });
  }

  return {
    reportSummary: {
      id: `report-summary-${domain.topic.id}`,
      label: "Küçük rapor terminali",
      status: "dummy",
      sections,
    },
  };
}

export function adaptDomainToViewModels(
  domain: PatternRoomDomainViewSource,
  overlay?: PatternRoomLocalOverlay
): PatternRoomMockData {
  return {
    ...adaptOverviewViewModel(domain),
    ...adaptBoardViewModel(domain, overlay),
    ...adaptArchiveViewModel(domain, overlay),
    ...adaptDeskViewModel(domain, overlay),
    ...adaptTenthManViewModel(domain, overlay),
    ...adaptReportViewModel(domain, overlay),
  };
}
