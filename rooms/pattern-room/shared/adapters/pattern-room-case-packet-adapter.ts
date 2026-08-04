import type {
  PatternBoardPin,
  PatternReportItem,
  PatternReportSection,
  PatternRoomWorkspaceModel,
} from "../types/pattern-room.js";
import {
  PATTERN_ROOM_CASE_PACKET_VERSION,
  type PatternRoomCasePacket,
  type PatternRoomCasePacketBoardNote,
  type PatternRoomCasePacketConnection,
  type PatternRoomCasePacketDebate,
  type PatternRoomCasePacketEvidence,
  type PatternRoomCasePacketLimits,
  type PatternRoomCasePacketSource,
} from "../types/pattern-room-case-packet.js";

export type PatternRoomCasePacketBuilderOptions = Partial<PatternRoomCasePacketLimits>;

export type PatternRoomCasePacketInput =
  | PatternRoomWorkspaceModel
  | {
      viewModels: PatternRoomWorkspaceModel;
      topicLabel?: string;
    };

const DEFAULT_LIMITS: PatternRoomCasePacketLimits = {
  maxSources: 20,
  maxEvidence: 30,
  maxBoardNotes: 30,
  maxConnections: 30,
  excerptMaxLength: 500,
};

const CASE_PACKET_CAUTION =
  "Bu paket kullanıcı tarafından eklenen ve henüz dışarıdan denetlenmemiş yerel araştırma izlerinden hazırlanmıştır; sonuç veya doğrulama beyanı içermez.";

const TRUNCATION_SUFFIX = "...";

const BOARD_NOTE_LAYER_BY_TYPE_LABEL: Readonly<Record<string, string>> = {
  İddia: "interpretation",
  Iddia: "interpretation",
  İlham: "analysis",
  Ilham: "analysis",
  Belirsizlik: "uncertainty",
};

function resolveInput(input: PatternRoomCasePacketInput): {
  viewModels: PatternRoomWorkspaceModel;
  topicLabel: string;
} {
  if ("viewModels" in input) {
    return {
      viewModels: input.viewModels,
      topicLabel: normalizePlainText(input.topicLabel ?? input.viewModels.subject),
    };
  }

  return {
    viewModels: input,
    topicLabel: normalizePlainText(input.subject),
  };
}

function normalizeLimit(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.floor(value));
}

function resolveLimits(
  options: PatternRoomCasePacketBuilderOptions | undefined
): PatternRoomCasePacketLimits {
  return {
    maxSources: normalizeLimit(options?.maxSources, DEFAULT_LIMITS.maxSources),
    maxEvidence: normalizeLimit(options?.maxEvidence, DEFAULT_LIMITS.maxEvidence),
    maxBoardNotes: normalizeLimit(options?.maxBoardNotes, DEFAULT_LIMITS.maxBoardNotes),
    maxConnections: normalizeLimit(options?.maxConnections, DEFAULT_LIMITS.maxConnections),
    excerptMaxLength: normalizeLimit(options?.excerptMaxLength, DEFAULT_LIMITS.excerptMaxLength),
  };
}

function normalizePlainText(value: string | null | undefined): string {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function keepPreviewLanguageCautious(value: string): string {
  return value
    .replace(/Gerçek AI, provider veya relay çağrısı yapılmadı\./g, "Dış üretim çağrısı yapılmadı.")
    .replace(/\bkesin hüküm değil\b/gi, "hüküm dili değil")
    .replace(/\bkesin hukum degil\b/gi, "hüküm dili değil")
    .replace(/\bkesin sonuç\b/gi, "sonuç")
    .replace(/\bkesin cevap\b/gi, "cevap")
    .replace(/\bkanıtlandı\b/gi, "öne sürüldü")
    .replace(/\bdoğrulandı\b/gi, "denetlendi")
    .replace(/\bnihai\b/gi, "son")
    .replace(/\bAI sonucu\b/gi, "dış üretim sonucu");
}

export function createPatternRoomCasePacketPreview(
  value: string | null | undefined,
  maxLength: number
): string {
  const normalizedValue = keepPreviewLanguageCautious(normalizePlainText(value));
  if (maxLength <= 0) {
    return "";
  }

  if (normalizedValue.length <= maxLength) {
    return normalizedValue;
  }

  if (maxLength <= TRUNCATION_SUFFIX.length) {
    return normalizedValue.slice(0, maxLength);
  }

  return `${normalizedValue.slice(0, maxLength - TRUNCATION_SUFFIX.length).trimEnd()}${TRUNCATION_SUFFIX}`;
}

function stripPrefix(value: string, prefix: string): string {
  return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

function stripLabelPrefix(value: string, prefix: string): string {
  const normalizedValue = normalizePlainText(value);
  return normalizedValue.startsWith(prefix)
    ? normalizedValue.slice(prefix.length).trim()
    : normalizedValue;
}

function readReportSection(
  viewModels: PatternRoomWorkspaceModel,
  sectionId: string
): PatternReportSection | null {
  return (
    viewModels.reportSummary.sections.find((section) => {
      return section.id === sectionId;
    }) ?? null
  );
}

function readMetaValue(item: PatternReportItem, label: string): string | null {
  const prefix = `${label}:`;
  const metaValue = item.meta.find((value) => {
    return value.startsWith(prefix);
  });
  if (metaValue === undefined) {
    return null;
  }

  const value = normalizePlainText(metaValue.slice(prefix.length));
  return value === "" ? null : value;
}

function createBoardPinIndex(viewModels: PatternRoomWorkspaceModel): Map<string, PatternBoardPin> {
  const pinIndex = new Map<string, PatternBoardPin>();
  for (const category of viewModels.boardCategories) {
    for (const pin of category.pins) {
      pinIndex.set(pin.id, pin);
    }
  }
  return pinIndex;
}

function createCasePacketSources(
  viewModels: PatternRoomWorkspaceModel,
  limits: PatternRoomCasePacketLimits
): PatternRoomCasePacketSource[] {
  return viewModels.sources.slice(0, limits.maxSources).map((source) => {
    return {
      id: source.id,
      label: normalizePlainText(source.label),
      typeLabel: normalizePlainText(source.sourceTypeLabel),
      origin: normalizePlainText(source.origin),
      status: source.status,
      preview: createPatternRoomCasePacketPreview(
        source.notePreview ?? source.note,
        limits.excerptMaxLength
      ),
      segmentCount: source.segments?.length ?? null,
    };
  });
}

function createCasePacketEvidence(
  viewModels: PatternRoomWorkspaceModel,
  limits: PatternRoomCasePacketLimits
): PatternRoomCasePacketEvidence[] {
  const evidenceSection = readReportSection(viewModels, "report-evidence-notes");
  if (evidenceSection === null) {
    return [];
  }

  return evidenceSection.items.slice(0, limits.maxEvidence).map((item) => {
    const sourceLabel = readMetaValue(item, "Kaynak");
    const interpretationPreview =
      item.detail === null
        ? null
        : createPatternRoomCasePacketPreview(
            stripLabelPrefix(item.detail, "Yorum:"),
            limits.excerptMaxLength
          );

    return {
      id: stripPrefix(item.id, "report-evidence-"),
      label: normalizePlainText(item.label),
      sourceLabel: sourceLabel === "Belirtilmemiş" ? null : sourceLabel,
      excerptPreview: createPatternRoomCasePacketPreview(item.body, limits.excerptMaxLength),
      interpretationPreview,
      layer: readMetaValue(item, "Katman") ?? "",
    };
  });
}

function createCasePacketBoardNotes(
  viewModels: PatternRoomWorkspaceModel,
  limits: PatternRoomCasePacketLimits
): PatternRoomCasePacketBoardNote[] {
  const boardSection = readReportSection(viewModels, "report-board-notes");
  if (boardSection === null) {
    return [];
  }

  const pinIndex = createBoardPinIndex(viewModels);
  return boardSection.items.slice(0, limits.maxBoardNotes).map((item) => {
    const noteId = stripPrefix(item.id, "report-board-node-");
    const typeLabel = readMetaValue(item, "Tür") ?? "";
    const indexedPin = pinIndex.get(noteId);
    const layer = indexedPin?.layer ?? BOARD_NOTE_LAYER_BY_TYPE_LABEL[typeLabel] ?? "";

    return {
      id: noteId,
      label: normalizePlainText(item.label),
      type: typeLabel,
      layer,
      contentPreview: createPatternRoomCasePacketPreview(item.body, limits.excerptMaxLength),
    };
  });
}

function parseConnectionBody(body: string): {
  sourceLabel: string;
  edgeTypeLabel: string;
  targetLabel: string;
} {
  const parts = body.split("→").map((part) => {
    return normalizePlainText(part);
  });
  const sourceLabel = parts[0] ?? "";
  const edgeTypeLabel = parts[1] ?? "";
  const targetLabel = parts.slice(2).join(" → ");

  return {
    sourceLabel,
    edgeTypeLabel,
    targetLabel,
  };
}

function createCasePacketConnections(
  viewModels: PatternRoomWorkspaceModel,
  limits: PatternRoomCasePacketLimits
): PatternRoomCasePacketConnection[] {
  const connectionSection = readReportSection(viewModels, "report-local-connections");
  if (connectionSection === null) {
    return [];
  }

  return connectionSection.items.slice(0, limits.maxConnections).map((item) => {
    const parsedConnection = parseConnectionBody(item.body);
    return {
      id: stripPrefix(item.id, "report-local-edge-"),
      sourceLabel: createPatternRoomCasePacketPreview(
        parsedConnection.sourceLabel,
        limits.excerptMaxLength
      ),
      edgeTypeLabel: normalizePlainText(parsedConnection.edgeTypeLabel),
      targetLabel: createPatternRoomCasePacketPreview(
        parsedConnection.targetLabel,
        limits.excerptMaxLength
      ),
      notePreview:
        item.detail === null
          ? null
          : createPatternRoomCasePacketPreview(
              stripLabelPrefix(item.detail, "Not:"),
              limits.excerptMaxLength
            ),
    };
  });
}

function createCasePacketDebate(
  viewModels: PatternRoomWorkspaceModel,
  limits: PatternRoomCasePacketLimits
): PatternRoomCasePacketDebate {
  const session = viewModels.tenthManSession;
  const turns = session.turns ?? [];
  return {
    phaseLabel: normalizePlainText(session.phase ?? session.status),
    statusLabel: normalizePlainText(session.status),
    referenceCount: session.references.length,
    turnCount: turns.length,
    verdictPreview:
      session.verdict === null || session.verdict === undefined
        ? null
        : createPatternRoomCasePacketPreview(session.verdict, limits.excerptMaxLength),
    turnPreviews: turns.map((turn) => {
      return createPatternRoomCasePacketPreview(turn.content, limits.excerptMaxLength);
    }),
  };
}

function createOpenQuestions(
  viewModels: PatternRoomWorkspaceModel,
  limits: PatternRoomCasePacketLimits
): string[] {
  const nextResearchSection = readReportSection(viewModels, "report-next-research-notes");
  if (nextResearchSection === null) {
    return [];
  }

  return nextResearchSection.items.map((item) => {
    const label = normalizePlainText(item.label);
    const body = createPatternRoomCasePacketPreview(item.body, limits.excerptMaxLength);
    return label === "" ? body : `${label}: ${body}`;
  });
}

export function createPatternRoomCasePacket(
  input: PatternRoomCasePacketInput,
  options?: PatternRoomCasePacketBuilderOptions
): PatternRoomCasePacket {
  const { viewModels, topicLabel } = resolveInput(input);
  const limits = resolveLimits(options);

  return {
    packetVersion: PATTERN_ROOM_CASE_PACKET_VERSION,
    roomId: "pattern-room",
    topicLabel,
    generatedFrom: "local-view-model",
    caution: CASE_PACKET_CAUTION,
    sources: createCasePacketSources(viewModels, limits),
    evidence: createCasePacketEvidence(viewModels, limits),
    boardNotes: createCasePacketBoardNotes(viewModels, limits),
    connections: createCasePacketConnections(viewModels, limits),
    debate: createCasePacketDebate(viewModels, limits),
    openQuestions: createOpenQuestions(viewModels, limits),
    limits,
  };
}
