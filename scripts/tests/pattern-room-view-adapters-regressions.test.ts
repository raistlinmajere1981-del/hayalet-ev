import test from "node:test";
import assert from "node:assert/strict";

import {
  adaptArchiveViewModel,
  adaptBoardViewModel,
  adaptDeskViewModel,
  adaptDomainToViewModels,
  adaptOverviewViewModel,
  adaptReportViewModel,
  adaptTenthManViewModel,
  type PatternRoomDomainViewSource,
} from "../../rooms/pattern-room/shared/adapters/pattern-room-view-adapters.ts";
import { PATTERN_ROOM_DOMAIN_MOCK } from "../../rooms/pattern-room/shared/data/pattern-room-domain.mock.ts";
import {
  createLocalState,
  type PatternRoomLocalOverlay,
} from "../../rooms/pattern-room/shared/state/pattern-room-local-state.ts";
import {
  PATTERN_SOURCE_TYPES,
  type PatternSourceType,
  type PatternTraceType,
  type ReportTrace,
} from "../../rooms/pattern-room/shared/types/pattern-room-domain.ts";
import type { PatternRoomMockData } from "../../rooms/pattern-room/shared/types/pattern-room.ts";

const EXPECTED_SOURCE_TYPE_LABELS: Record<PatternSourceType, string> = {
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

const TRACE_TYPES_BY_REPORT_SECTION = {
  Kanıtlar: ["source-added", "evidence-added"],
  Analizler: ["edge-added", "confidence-changed", "layer-promoted"],
  Belirsizlikler: ["node-removed", "edge-removed"],
  "Sonraki araştırma notları": [
    "node-added",
    "debate-started",
    "debate-turn",
    "debate-ended",
    "verdict-set",
    "report-generated",
  ],
} as const satisfies Record<string, readonly PatternTraceType[]>;

function createDomainWithAllSourceTypes(): PatternRoomDomainViewSource {
  return {
    ...PATTERN_ROOM_DOMAIN_MOCK,
    sources: PATTERN_SOURCE_TYPES.map((sourceType, index) => {
      return {
        id: `source-${sourceType}`,
        topicId: PATTERN_ROOM_DOMAIN_MOCK.topic.id,
        label: `Source ${index + 1}`,
        sourceType,
        origin: "Synthetic adapter test source",
        reliability: "unknown",
        addedBy: "system",
        addedAt: "2026-05-20T11:30:00.000Z",
      };
    }),
  };
}

function createDomainWithAllTraceTypes(): PatternRoomDomainViewSource {
  const reportTrace: ReportTrace[] = Object.values(TRACE_TYPES_BY_REPORT_SECTION)
    .flat()
    .map((traceType, index) => {
      return {
        id: `trace-${traceType}`,
        topicId: PATTERN_ROOM_DOMAIN_MOCK.topic.id,
        traceType,
        actorId: "system",
        summary: `${traceType} summary`,
        payload: {},
        occurredAt: `2026-05-20T11:${String(index).padStart(2, "0")}:00.000Z`,
      };
    });

  return {
    ...PATTERN_ROOM_DOMAIN_MOCK,
    reportTrace,
  };
}

test("pattern-room phase 3B adapter returns the existing UI mock shape", () => {
  const viewModels: PatternRoomMockData = adaptDomainToViewModels(PATTERN_ROOM_DOMAIN_MOCK);

  assert.equal(viewModels.roomTitle, "İz Sürme Odası");
  assert.equal(viewModels.roomLabel, "Pattern Room");
  assert.equal(viewModels.subject, "Dünya’nın Şekli");
  assert.equal(viewModels.boardCategories.length, 4);
  assert.equal(viewModels.sources.length, 4);
  assert.equal(viewModels.claims.length > 0, true);
  assert.equal(viewModels.tenthManSession.status, "dummy");
  assert.equal(viewModels.reportSummary.sections.length > 0, true);
});

test("pattern-room phase 3B focused adapters keep panel data non-empty", () => {
  assert.equal(adaptOverviewViewModel(PATTERN_ROOM_DOMAIN_MOCK).subject.length > 0, true);
  assert.equal(adaptBoardViewModel(PATTERN_ROOM_DOMAIN_MOCK).boardCategories.length > 0, true);
  assert.equal(adaptArchiveViewModel(PATTERN_ROOM_DOMAIN_MOCK).sources.length > 0, true);
  assert.equal(adaptDeskViewModel(PATTERN_ROOM_DOMAIN_MOCK).claims.length > 0, true);
  assert.equal(
    adaptTenthManViewModel(PATTERN_ROOM_DOMAIN_MOCK).tenthManSession.roles.length > 0,
    true
  );
  assert.equal(
    adaptReportViewModel(PATTERN_ROOM_DOMAIN_MOCK).reportSummary.sections.length > 0,
    true
  );
});

test("pattern-room phase 3B adapter maps source type labels for archive cards", () => {
  const labels = adaptArchiveViewModel(PATTERN_ROOM_DOMAIN_MOCK).sources.map((source) => {
    return source.sourceTypeLabel;
  });

  assert.deepEqual(labels, ["Kitap / Metin", "Görsel kaynak", "Kişisel not", "Belirsiz kaynak"]);
});

test("pattern-room phase 4B adapter applies local overlay without mutating domain mock data", () => {
  const beforeDomain = JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK);
  const localState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);

  localState.sendToDesk("node-navigation-source");
  localState.pinSource("source-shadow-comparison", "evidence");
  localState.addToDebate("node-shadow-analysis");
  localState.addToDebate("source-shadow-comparison");
  localState.addLocalNote("Yerel smoke notu");

  const viewModels = adaptDomainToViewModels(PATTERN_ROOM_DOMAIN_MOCK, localState.getOverlay());
  const evidenceCategory = viewModels.boardCategories.find((category) => {
    return category.id === "board-evidence";
  });
  const localNotesSection = viewModels.reportSummary.sections.find((section) => {
    return section.id === "report-local-notes";
  });

  assert.ok(evidenceCategory);
  assert.ok(evidenceCategory.pins.some((pin) => pin.id === "source-shadow-comparison"));
  assert.ok(viewModels.claims.some((claim) => claim.id === "desk-local-node-navigation-source"));
  assert.ok(
    viewModels.tenthManSession.references.some((reference) => {
      return reference.label === "Golge acisi analizi";
    })
  );
  assert.ok(
    viewModels.tenthManSession.references.some((reference) => {
      return reference.label === "Golge karsilastirma gorseli";
    })
  );
  assert.ok(localNotesSection);
  assert.deepEqual(localNotesSection.bullets, ["Yerel smoke notu"]);
  assert.equal(JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK), beforeDomain);
});

test("pattern-room phase 4B adapter silently skips stale overlay ids", () => {
  const overlay: PatternRoomLocalOverlay = {
    deskNodeIds: ["missing-node"],
    pinnedSourceIds: ["missing-source"],
    sourcePinnedLayerById: { "missing-source": "evidence" },
    debateReferenceIds: ["missing-node", "missing-source"],
    debatePhase: "idle",
    debateLocalTurns: [],
    debateRolesConnected: {
      AI0: false,
      AI1: false,
      AI2: false,
      US1: false,
    },
    debateLocalVerdict: null,
    localNotes: [
      {
        id: "local-note-missing",
        text: "Elle yazılmış not",
        createdAt: "2026-05-20T12:00:00.000Z",
      },
    ],
    localAuthoredNodes: [],
    localAuthoredSources: [],
    localAuthoredEvidence: [],
    localAuthoredEdges: [],
  };

  const viewModels = adaptDomainToViewModels(PATTERN_ROOM_DOMAIN_MOCK, overlay);
  const flattenedBoardPins = viewModels.boardCategories.flatMap((category) => {
    return category.pins;
  });

  assert.equal(
    flattenedBoardPins.some((pin) => pin.id === "missing-source"),
    false
  );
  assert.equal(
    viewModels.claims.some((claim) => claim.id.includes("missing-node")),
    false
  );
  assert.deepEqual(viewModels.tenthManSession.references, []);
  assert.ok(
    viewModels.reportSummary.sections.some((section) => {
      return section.label === "Yerel Notlar";
    })
  );
});

test("pattern-room phase 5B local debate state machine stays overlay-only", () => {
  const beforeDomain = JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK);
  const localState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);

  localState.prepareDebate();
  assert.equal(localState.getOverlay().debatePhase, "idle");

  localState.addToDebate("node-navigation-source");
  localState.prepareDebate();
  assert.equal(localState.getOverlay().debatePhase, "preparation");

  localState.assignDebateRoles();
  assert.equal(localState.getOverlay().debatePhase, "role_assignment");
  assert.equal(
    Object.values(localState.getOverlay().debateRolesConnected).every((connected) => connected),
    true
  );

  localState.startDebate();
  localState.advanceDebatePhase();
  localState.advanceDebatePhase();
  localState.advanceDebatePhase();
  localState.advanceDebatePhase();
  assert.equal(localState.getOverlay().debatePhase, "judge_mapping");
  assert.deepEqual(
    localState.getOverlay().debateLocalTurns.map((turn) => turn.actorId),
    ["AI0", "AI2", "AI1", "AI2", "US1"]
  );

  localState.completeDebate();
  localState.reflectDebateToReport();
  localState.reflectDebateToReport();

  const viewModels = adaptDomainToViewModels(PATTERN_ROOM_DOMAIN_MOCK, localState.getOverlay());
  const localNotesSection = viewModels.reportSummary.sections.find((section) => {
    return section.id === "report-local-notes";
  });

  assert.equal(viewModels.tenthManSession.status, "completed");
  assert.equal(viewModels.tenthManSession.phase, "completed");
  assert.equal(viewModels.tenthManSession.turns?.length, 5);
  assert.match(viewModels.tenthManSession.verdict ?? "", /Gerçek AI, provider veya relay/);
  assert.ok(localNotesSection);
  assert.equal(localNotesSection.bullets.length, 1);
  assert.match(localNotesSection.bullets[0] ?? "", /10\. Adam local oturum özeti/);
  assert.equal(JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK), beforeDomain);
});

test("pattern-room phase 7B local authoring appears in board, archive, desk, report, and debate views", () => {
  const beforeDomain = JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK);
  const localState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);

  localState.addAuthoredClaim("Yerel iddia", "Kullanıcının local iddia notu.");
  localState.addAuthoredInspiration("Yerel ilham", "Analiz katmanına düşen fikir.");
  localState.addAuthoredUncertainty("Yerel belirsizlik", "Belirsizlik katmanında izlenecek soru.");
  localState.addAuthoredEvidence("Yerel kanıt", "Local alıntı", "Local yorum");
  localState.addAuthoredSource("Yerel kaynak", "Kullanıcı not defteri", "Sadece overlay kaynağı.");

  localState.addToDebate("local-node-001");
  localState.addToDebate("local-source-001");
  localState.addToDebate("local-evidence-001");
  localState.addToDebate("local-node-999");

  const viewModels = adaptDomainToViewModels(PATTERN_ROOM_DOMAIN_MOCK, localState.getOverlay());
  const interpretationCategory = viewModels.boardCategories.find((category) => {
    return category.id === "board-interpretation";
  });
  const analysisCategory = viewModels.boardCategories.find((category) => {
    return category.id === "board-analysis";
  });
  const uncertaintyCategory = viewModels.boardCategories.find((category) => {
    return category.id === "board-uncertainty";
  });
  const evidenceCategory = viewModels.boardCategories.find((category) => {
    return category.id === "board-evidence";
  });
  const localSource = viewModels.sources.find((source) => {
    return source.id === "local-source-001";
  });
  const localEvidenceSection = viewModels.reportSummary.sections.find((section) => {
    return section.label === "Yerel Kanıt Notları";
  });

  assert.ok(interpretationCategory);
  assert.ok(
    interpretationCategory.pins.some((pin) => {
      return pin.id === "local-node-001" && pin.isLocal && pin.layer === "interpretation";
    })
  );
  assert.ok(analysisCategory);
  assert.ok(
    analysisCategory.pins.some((pin) => {
      return pin.id === "local-node-002" && pin.isLocal && pin.layer === "analysis";
    })
  );
  assert.ok(uncertaintyCategory);
  assert.ok(
    uncertaintyCategory.pins.some((pin) => {
      return pin.id === "local-node-003" && pin.isLocal && pin.layer === "uncertainty";
    })
  );
  assert.ok(evidenceCategory);
  assert.ok(
    evidenceCategory.pins.some((pin) => {
      return pin.id === "local-evidence-001" && pin.kind === "evidence" && pin.isLocal;
    })
  );
  assert.ok(localSource);
  assert.equal(localSource.sourceTypeLabel, "Yerel Kaynak");
  assert.equal(localSource.isLocal, true);
  assert.ok(
    viewModels.claims.some((claim) => {
      return claim.id === "claim-local-node-001" && claim.label === "Yerel iddia";
    })
  );
  assert.ok(localEvidenceSection);
  assert.deepEqual(localEvidenceSection.bullets, ["Yerel kanıt: Local alıntı Yorum: Local yorum"]);
  assert.deepEqual(localState.getOverlay().debateReferenceIds, [
    "local-node-001",
    "local-source-001",
    "local-evidence-001",
  ]);
  assert.deepEqual(
    viewModels.tenthManSession.references.map((reference) => reference.kind),
    ["node", "source", "evidence"]
  );
  assert.equal(JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK), beforeDomain);
});

test("pattern-room phase 8B local authored connections appear only in the report", () => {
  const beforeDomain = JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK);
  const localState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);

  localState.addAuthoredEdge("supports", "node-navigation-source", "source-shadow-comparison");
  localState.addAuthoredEdge("supports", "node-navigation-source", "node-navigation-source");

  const viewModels = adaptDomainToViewModels(PATTERN_ROOM_DOMAIN_MOCK, localState.getOverlay());
  const flattenedBoardPins = viewModels.boardCategories.flatMap((category) => {
    return category.pins;
  });
  const connectionsSection = viewModels.reportSummary.sections.find((section) => {
    return section.id === "report-local-connections";
  });

  assert.equal(
    flattenedBoardPins.some((pin) => pin.id === "local-edge-001"),
    false
  );
  assert.ok(connectionsSection);
  assert.equal(connectionsSection.label, "Yerel Bağlantılar");
  assert.equal(connectionsSection.tone, "analysis");
  assert.equal(connectionsSection.note, "Local overlay içinde kurulan öğe arası bağlantılar.");
  assert.deepEqual(connectionsSection.bullets, [
    "Seyir defteri kaynagi → destekliyor → Golge karsilastirma gorseli",
  ]);
  assert.equal(localState.getOverlay().localAuthoredEdges.length, 1);
  assert.equal(JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK), beforeDomain);
});

test("pattern-room phase 8B board adapter exposes connection options without edge pins", () => {
  const localState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);

  localState.addAuthoredClaim("Yerel bağlantı iddiası", "Yerel node seçeneği.");
  localState.addAuthoredSource("Yerel bağlantı kaynağı", "Yerel arşiv", "");
  localState.addAuthoredEvidence("Yerel bağlantı kanıtı", "Yerel alıntı", "");
  localState.addAuthoredEdge("questions", "local-node-001", "local-evidence-001");

  const boardViewModel = adaptBoardViewModel(PATTERN_ROOM_DOMAIN_MOCK, localState.getOverlay());
  const connectionOptionIds = boardViewModel.connectionOptions.map((option) => option.id);
  const flattenedBoardPins = boardViewModel.boardCategories.flatMap((category) => {
    return category.pins;
  });

  assert.ok(connectionOptionIds.includes("node-navigation-source"));
  assert.ok(connectionOptionIds.includes("source-shadow-comparison"));
  assert.ok(connectionOptionIds.includes("local-node-001"));
  assert.ok(connectionOptionIds.includes("local-source-001"));
  assert.ok(connectionOptionIds.includes("local-evidence-001"));
  assert.equal(
    flattenedBoardPins.some((pin) => pin.id === "local-edge-001"),
    false
  );
});

test("pattern-room phase 3B adapter maps every source type label", () => {
  const labels = adaptArchiveViewModel(createDomainWithAllSourceTypes()).sources.map((source) => {
    return source.sourceTypeLabel;
  });

  assert.deepEqual(
    labels,
    PATTERN_SOURCE_TYPES.map((sourceType) => {
      return EXPECTED_SOURCE_TYPE_LABELS[sourceType];
    })
  );
});

test("pattern-room phase 3B adapter maps interpretation layer to commentary tone", () => {
  const interpretationCategory = adaptBoardViewModel(PATTERN_ROOM_DOMAIN_MOCK).boardCategories.find(
    (category) => category.label === "Yorum"
  );

  assert.ok(interpretationCategory);
  assert.equal(interpretationCategory.tone, "commentary");
});

test("pattern-room phase 3B adapter maps debate roles for the tenth-man panel", () => {
  const labels = adaptTenthManViewModel(PATTERN_ROOM_DOMAIN_MOCK).tenthManSession.roles.map(
    (role) => role.label
  );

  assert.deepEqual(labels, [
    "AI0 — Araştırmacı",
    "AI1 — Savunucu",
    "AI2 — 10. Adam / Karşıt",
    "US1 — Hakem / Uzak kullanıcı",
  ]);
});

test("pattern-room phase 3B report adapter creates cautious report sections", () => {
  const reportSummary = adaptReportViewModel(PATTERN_ROOM_DOMAIN_MOCK).reportSummary;

  assert.deepEqual(
    reportSummary.sections.map((section) => section.label),
    ["Kanıtlar", "Analizler", "Belirsizlikler", "Sonraki araştırma notları"]
  );
  assert.equal(
    reportSummary.sections.every((section) => section.bullets.length > 0),
    true
  );
});

test("pattern-room phase 3B report adapter groups every trace type without verdict language", () => {
  const reportSummary = adaptReportViewModel(createDomainWithAllTraceTypes()).reportSummary;

  for (const [sectionLabel, traceTypes] of Object.entries(TRACE_TYPES_BY_REPORT_SECTION)) {
    const section = reportSummary.sections.find((candidate) => candidate.label === sectionLabel);

    assert.ok(section);
    assert.deepEqual(
      section.bullets,
      traceTypes.map((traceType) => `${traceType} summary`)
    );
  }

  const reportCopy = reportSummary.sections
    .flatMap((section) => [section.note, ...section.bullets])
    .join(" ");
  assert.doesNotMatch(
    reportCopy,
    /kesin cevap|kanıtlandı|doğrulandı|ispatlandı|final verdict|truth score/i
  );
});
