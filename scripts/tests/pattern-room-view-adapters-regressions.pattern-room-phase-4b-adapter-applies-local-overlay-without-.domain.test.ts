import test from "node:test";
import assert from "node:assert/strict";

import { adaptDomainToViewModels } from "../../rooms/pattern-room/shared/adapters/pattern-room-view-adapters.ts";
import { PATTERN_ROOM_DOMAIN_MOCK } from "../../rooms/pattern-room/shared/data/pattern-room-domain.mock.ts";
import { createLocalState } from "../../rooms/pattern-room/shared/state/pattern-room-local-state.ts";
import { PATTERN_SOURCE_TYPES } from "../../rooms/pattern-room/shared/types/pattern-room-domain.ts";

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


describe("pattern-room phase 4B adapter applies local overlay without mutating domain mock", () => {
void test("pattern-room phase 4B adapter applies local overlay without mutating domain mock data", () => {
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
  const nextResearchSection = viewModels.reportSummary.sections.find((section) => {
    return section.id === "report-next-research-notes";
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
  assert.ok(nextResearchSection);
  assert.deepEqual(
    nextResearchSection.items.map((item) => item.body),
    ["Yerel smoke notu"]
  );
  assert.equal(JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK), beforeDomain);
});
void test("pattern-room phase 4B adapter silently skips stale overlay ids", () => {
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
  const nextResearchSection = viewModels.reportSummary.sections.find((section) => {
    return section.id === "report-next-research-notes";
  });
  assert.ok(nextResearchSection);
  assert.deepEqual(
    nextResearchSection.items.map((item) => item.body),
    ["Elle yazılmış not"]
  );
});
void test("pattern-room phase 5B local debate state machine stays overlay-only", () => {
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
  const nextResearchSection = viewModels.reportSummary.sections.find((section) => {
    return section.id === "report-next-research-notes";
  });

  assert.equal(viewModels.tenthManSession.status, "completed");
  assert.equal(viewModels.tenthManSession.phase, "completed");
  assert.equal(viewModels.tenthManSession.turns?.length, 5);
  assert.match(viewModels.tenthManSession.verdict ?? "", /Gerçek AI, provider veya relay/);
  assert.ok(nextResearchSection);
  assert.equal(nextResearchSection.items.length, 1);
  assert.match(nextResearchSection.items[0]?.body ?? "", /10\. Adam local oturum özeti/);
  assert.equal(JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK), beforeDomain);
});
void test("pattern-room phase 7B local authoring appears in board, archive, desk, report, and debate views", () => {
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
    return section.id === "report-evidence-notes";
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
  assert.deepEqual(
    localEvidenceSection.items.map((item) => {
      return {
        body: item.body,
        detail: item.detail,
        label: item.label,
      };
    }),
    [
      {
        body: "Local alıntı",
        detail: "Yorum: Local yorum",
        label: "Yerel kanıt",
      },
    ]
  );
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
});
