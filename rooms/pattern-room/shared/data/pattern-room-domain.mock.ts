import type {
  DebateRole,
  DebateSession,
  DebateTurn,
  EvidenceItem,
  PatternEdge,
  PatternNode,
  ReportTrace,
  SourceItem,
  Topic,
} from "../types/pattern-room-domain.js";

export type PatternRoomDomainMockData = {
  topic: Topic;
  nodes: PatternNode[];
  edges: PatternEdge[];
  sources: SourceItem[];
  evidence: EvidenceItem[];
  debateSession: DebateSession;
  reportTrace: ReportTrace[];
};

const topicId = "topic-earth-shape-mock";
const debateSessionId = "debate-earth-shape-mock";

export const PATTERN_ROOM_DOMAIN_TOPIC_MOCK: Topic = {
  id: topicId,
  label: "Dunya'nin sekli arastirmasi",
  description: "Pattern Room v2 domain modelinin static mock konusu.",
  status: "draft",
  createdAt: "2026-05-20T10:00:00.000Z",
  updatedAt: "2026-05-20T10:15:00.000Z",
  rootNodeId: "node-horizon-claim",
};

export const PATTERN_ROOM_DOMAIN_NODES_MOCK: PatternNode[] = [
  {
    id: "node-horizon-claim",
    topicId,
    nodeType: "claim",
    layer: "interpretation",
    label: "Ufuk iddiasi",
    content: "Uzaklasan cisimlerin ufukta asamali kaybolmasi merkezi iddia olarak izleniyor.",
    confidence: null,
    sourceRef: null,
    createdBy: "US1",
    createdAt: "2026-05-20T10:01:00.000Z",
    metadata: { phase: "2B", mock: true },
  },
  {
    id: "node-navigation-source",
    topicId,
    nodeType: "source",
    layer: "evidence",
    label: "Seyir defteri kaynagi",
    content: "Uzun rota gozlemlerini temsil eden arka plan kaynak karti.",
    confidence: null,
    sourceRef: "source-navigation-log",
    createdBy: "AI0",
    createdAt: "2026-05-20T10:03:00.000Z",
    metadata: { shelf: "archive-mock" },
  },
  {
    id: "node-shadow-analysis",
    topicId,
    nodeType: "analysis",
    layer: "analysis",
    label: "Golge acisi analizi",
    content: "Farkli konumlardaki golge acilari karsilastirma gerektiren analiz notu olarak duruyor.",
    confidence: null,
    sourceRef: "source-shadow-comparison",
    createdBy: "AI1",
    createdAt: "2026-05-20T10:05:00.000Z",
    metadata: { table: "desk-mock" },
  },
  {
    id: "node-perspective-uncertainty",
    topicId,
    nodeType: "uncertainty",
    layer: "uncertainty",
    label: "Perspektif belirsizligi",
    content: "Gorsel kayitlarda lens, mesafe ve perspektif etkisi ayrica isaretlenmeli.",
    confidence: null,
    sourceRef: "source-orbit-photograph",
    createdBy: "AI2",
    createdAt: "2026-05-20T10:07:00.000Z",
    metadata: { caution: "visual-context" },
  },
];

export const PATTERN_ROOM_DOMAIN_EDGES_MOCK: PatternEdge[] = [
  {
    id: "edge-navigation-supports-horizon",
    topicId,
    edgeType: "supports",
    sourceNodeId: "node-navigation-source",
    targetNodeId: "node-horizon-claim",
    weight: 0.65,
    createdBy: "AI0",
    createdAt: "2026-05-20T10:08:00.000Z",
    note: "Static mock support relation only.",
  },
  {
    id: "edge-shadow-derived-from-source",
    topicId,
    edgeType: "derived_from",
    sourceNodeId: "node-navigation-source",
    targetNodeId: "node-shadow-analysis",
    weight: 0.5,
    createdBy: "AI1",
    createdAt: "2026-05-20T10:09:00.000Z",
    note: null,
  },
  {
    id: "edge-perspective-questions-claim",
    topicId,
    edgeType: "questions",
    sourceNodeId: "node-perspective-uncertainty",
    targetNodeId: "node-horizon-claim",
    weight: 0.4,
    createdBy: "AI2",
    createdAt: "2026-05-20T10:10:00.000Z",
    note: "Tenth-man style caution marker without runtime behavior.",
  },
];

export const PATTERN_ROOM_DOMAIN_SOURCES_MOCK: SourceItem[] = [
  {
    id: "source-navigation-log",
    topicId,
    label: "Seyir defteri",
    sourceType: "book",
    origin: "Pattern Room static mock archive",
    reliability: "user_provided",
    addedBy: "US1",
    addedAt: "2026-05-20T10:02:00.000Z",
  },
  {
    id: "source-shadow-comparison",
    topicId,
    label: "Golge karsilastirma gorseli",
    sourceType: "visual",
    origin: "Pattern Room static mock lightbox",
    reliability: "unverified",
    addedBy: "AI0",
    addedAt: "2026-05-20T10:04:00.000Z",
  },
  {
    id: "source-table-printout",
    topicId,
    label: "Masa cikti notu",
    sourceType: "personal_note",
    origin: "Pattern Room static mock desk",
    reliability: "unknown",
    addedBy: "AI1",
    addedAt: "2026-05-20T10:06:00.000Z",
  },
  {
    id: "source-orbit-photograph",
    topicId,
    label: "Yorunge fotografi",
    sourceType: "unknown",
    origin: "Pattern Room static mock visual card",
    reliability: "disputed",
    addedBy: "AI2",
    addedAt: "2026-05-20T10:07:30.000Z",
  },
];

export const PATTERN_ROOM_DOMAIN_EVIDENCE_MOCK: EvidenceItem[] = [
  {
    id: "evidence-navigation-excerpt",
    topicId,
    sourceId: "source-navigation-log",
    layer: "evidence",
    excerpt: "Uzak rota gozlemlerinde ufuk etkisi tekrar eden bir iz olarak kayda gecmis.",
    interpretation: null,
    addedBy: "AI0",
    addedAt: "2026-05-20T10:11:00.000Z",
    linkedNodeIds: ["node-navigation-source", "node-horizon-claim"],
  },
  {
    id: "evidence-shadow-note",
    topicId,
    sourceId: "source-shadow-comparison",
    layer: "analysis",
    excerpt: "Golge acilarinin farkli konumlarda degismesi analiz panosuna isaretlenmis.",
    interpretation: "Karsilastirma yorumu kesin hukum degil, sadece analiz katmani icin kullanilir.",
    addedBy: "AI1",
    addedAt: "2026-05-20T10:12:00.000Z",
    linkedNodeIds: ["node-shadow-analysis"],
  },
];

export const PATTERN_ROOM_DOMAIN_ROLES_MOCK: DebateRole[] = [
  {
    slotId: "AI0",
    role: "researcher",
    label: "AI0 Researcher",
    connected: false,
    provider: null,
  },
  {
    slotId: "AI1",
    role: "advocate",
    label: "AI1 Advocate",
    connected: false,
    provider: null,
  },
  {
    slotId: "AI2",
    role: "tenth-man",
    label: "AI2 Tenth Man",
    connected: false,
    provider: null,
  },
  {
    slotId: "US1",
    role: "arbiter",
    label: "US1 Arbiter",
    connected: false,
    provider: null,
  },
];

export const PATTERN_ROOM_DOMAIN_TURNS_MOCK: DebateTurn[] = [
  {
    id: "turn-researcher-opening",
    sessionId: debateSessionId,
    actorId: "AI0",
    content: "Kaynak ve iddia once ayri dugumler olarak tutulmali.",
    stance: "support",
    referencedNodeIds: ["node-navigation-source", "node-horizon-claim"],
    turnIndex: 0,
    createdAt: "2026-05-20T10:13:00.000Z",
  },
  {
    id: "turn-tenth-man-question",
    sessionId: debateSessionId,
    actorId: "AI2",
    content: "Gorsel kaydin perspektif etkisi ayri belirsizlik olarak isaretlenmeli.",
    stance: "question",
    referencedNodeIds: ["node-perspective-uncertainty"],
    turnIndex: 1,
    createdAt: "2026-05-20T10:14:00.000Z",
  },
];

export const PATTERN_ROOM_DOMAIN_DEBATE_SESSION_MOCK: DebateSession = {
  id: debateSessionId,
  topicId,
  status: "mock",
  prompt: "Static Faz 2B domain mock tartismasi; gercek AI veya relay cagrisi yapmaz.",
  roles: PATTERN_ROOM_DOMAIN_ROLES_MOCK,
  turns: PATTERN_ROOM_DOMAIN_TURNS_MOCK,
  verdict: null,
  startedAt: "2026-05-20T10:13:00.000Z",
  endedAt: null,
};

export const PATTERN_ROOM_DOMAIN_REPORT_TRACE_MOCK: ReportTrace[] = [
  {
    id: "trace-topic-node-added",
    topicId,
    traceType: "node-added",
    actorId: "US1",
    summary: "Root claim node added to the mock topic.",
    payload: { nodeId: "node-horizon-claim" },
    occurredAt: "2026-05-20T10:01:00.000Z",
  },
  {
    id: "trace-evidence-added",
    topicId,
    traceType: "evidence-added",
    actorId: "AI0",
    summary: "Navigation evidence linked to the claim.",
    payload: { evidenceId: "evidence-navigation-excerpt" },
    occurredAt: "2026-05-20T10:11:00.000Z",
  },
  {
    id: "trace-debate-turn",
    topicId,
    traceType: "debate-turn",
    actorId: "AI2",
    summary: "Tenth-man mock turn recorded as a trace item.",
    payload: { turnId: "turn-tenth-man-question" },
    occurredAt: "2026-05-20T10:14:00.000Z",
  },
];

export const PATTERN_ROOM_DOMAIN_MOCK: PatternRoomDomainMockData = {
  topic: PATTERN_ROOM_DOMAIN_TOPIC_MOCK,
  nodes: PATTERN_ROOM_DOMAIN_NODES_MOCK,
  edges: PATTERN_ROOM_DOMAIN_EDGES_MOCK,
  sources: PATTERN_ROOM_DOMAIN_SOURCES_MOCK,
  evidence: PATTERN_ROOM_DOMAIN_EVIDENCE_MOCK,
  debateSession: PATTERN_ROOM_DOMAIN_DEBATE_SESSION_MOCK,
  reportTrace: PATTERN_ROOM_DOMAIN_REPORT_TRACE_MOCK,
};
