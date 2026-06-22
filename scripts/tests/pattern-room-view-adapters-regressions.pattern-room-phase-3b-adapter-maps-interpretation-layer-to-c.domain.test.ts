import test from "node:test";
import assert from "node:assert/strict";

import { adaptBoardViewModel, adaptReportViewModel, adaptTenthManViewModel } from "../../rooms/pattern-room/shared/adapters/pattern-room-view-adapters.ts";
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


describe("pattern-room phase 3B adapter maps interpretation layer to commentary tone", () => {
void test("pattern-room phase 3B adapter maps interpretation layer to commentary tone", () => {
  const interpretationCategory = adaptBoardViewModel(PATTERN_ROOM_DOMAIN_MOCK).boardCategories.find(
    (category) => category.label === "Yorum"
  );

  assert.ok(interpretationCategory);
  assert.equal(interpretationCategory.tone, "commentary");
});
void test("pattern-room phase 3B adapter maps debate roles for the tenth-man panel", () => {
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
void test("pattern-room phase 3B report adapter creates cautious report sections", () => {
  const reportSummary = adaptReportViewModel(PATTERN_ROOM_DOMAIN_MOCK).reportSummary;

  assert.deepEqual(
    reportSummary.sections.map((section) => section.label),
    [
      "Kaynak Özeti",
      "Kanıt Notları",
      "Pano Notları",
      "Yerel Bağlantılar",
      "10. Adam İzleri",
      "Sonraki Araştırma Notları",
    ]
  );
  assert.equal(
    reportSummary.sections.every((section) => section.bullets.length > 0),
    true
  );
});
void test("pattern-room phase 15A report adapter drafts local evidence without verdict language", () => {
  const beforeDomain = JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK);
  const localState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);

  localState.addAuthoredSource("Uzun kaynak başlığı", "Kullanıcı arşivi", "Uzun kaynak gövdesi.");
  localState.addAuthoredClaim("Yerel iddia", "Kullanıcı tarafından eklenen iddia.");
  localState.addAuthoredInspiration("Yerel ilham", "Kullanıcı tarafından eklenen ilham.");
  localState.addAuthoredUncertainty("Eksik bağlam", "Sonraki araştırma için belirsizlik.");
  localState.addAuthoredEvidence(
    "Kaynaklı kanıt",
    "Kaynak detayından seçilen kısa pasaj.",
    "Kullanıcı yorumu ayrı kalır.",
    "evidence",
    { sourceId: "local-source-001", sourceLabel: "Uzun kaynak başlığı" }
  );
  localState.addAuthoredEdge("supports", "local-node-001", "local-evidence-001", "Bağ notu.");
  localState.addLocalNote("Kullanıcı takip notu.");
  localState.addToDebate("local-node-001");
  localState.prepareDebate();
  localState.assignDebateRoles();
  localState.startDebate();
  localState.advanceDebatePhase();
  localState.advanceDebatePhase();
  localState.advanceDebatePhase();
  localState.advanceDebatePhase();
  localState.completeDebate();

  const baseOverlay = localState.getOverlay();
  const firstSource = baseOverlay.localAuthoredSources[0];
  assert.ok(firstSource);
  const overlay: PatternRoomLocalOverlay = {
    ...baseOverlay,
    localAuthoredSources: [
      {
        ...firstSource,
        segments: [
          { id: "segment-001", label: "Segment 1", order: 0, text: "İlk segment." },
          { id: "segment-002", label: "Segment 2", order: 1, text: "İkinci segment." },
        ],
      },
    ],
  };

  const reportSummary = adaptReportViewModel(PATTERN_ROOM_DOMAIN_MOCK, overlay).reportSummary;
  const sourceSection = reportSummary.sections.find((section) => {
    return section.id === "report-source-summary";
  });
  const evidenceSection = reportSummary.sections.find((section) => {
    return section.id === "report-evidence-notes";
  });
  const boardSection = reportSummary.sections.find((section) => {
    return section.id === "report-board-notes";
  });
  const connectionSection = reportSummary.sections.find((section) => {
    return section.id === "report-local-connections";
  });
  const tenthManSection = reportSummary.sections.find((section) => {
    return section.id === "report-tenth-man-traces";
  });
  const nextResearchSection = reportSummary.sections.find((section) => {
    return section.id === "report-next-research-notes";
  });

  assert.ok(sourceSection);
  assert.equal(sourceSection.items[0]?.body, "Archive sayımı: 4 domain kaynak, 1 local kaynak.");
  assert.equal(sourceSection.items[1]?.label, "Uzun kaynak başlığı");
  assert.ok(sourceSection.items[1].meta.includes("Segment: 2"));

  assert.ok(evidenceSection);
  assert.equal(evidenceSection.items[0]?.label, "Kaynaklı kanıt");
  assert.equal(evidenceSection.items[0].body, "Kaynak detayından seçilen kısa pasaj.");
  assert.equal(evidenceSection.items[0].detail, "Yorum: Kullanıcı yorumu ayrı kalır.");
  assert.ok(evidenceSection.items[0].meta.includes("Kaynak: Uzun kaynak başlığı"));

  assert.ok(boardSection);
  assert.deepEqual(
    boardSection.items.map((item) => item.meta.find((meta) => meta.startsWith("Tür:"))),
    ["Tür: İddia", "Tür: İlham", "Tür: Belirsizlik"]
  );

  assert.ok(connectionSection);
  assert.equal(connectionSection.items[0]?.body, "Yerel iddia → destekliyor → Kaynaklı kanıt");
  assert.equal(connectionSection.items[0].detail, "Not: Bağ notu.");

  assert.ok(tenthManSection);
  assert.equal(tenthManSection.items.length > 0, true);
  assert.equal(
    tenthManSection.items.some((item) => item.label === "Yerel tartışma özeti"),
    true
  );

  assert.ok(nextResearchSection);
  assert.ok(nextResearchSection.items.some((item) => item.body === "Kullanıcı takip notu."));
  assert.ok(nextResearchSection.items.some((item) => item.label === "Eksik bağlam"));

  const reportCopy = reportSummary.sections
    .flatMap((section) => [section.label, section.note, section.emptyMessage, ...section.bullets])
    .join(" ");
  assert.doesNotMatch(
    reportCopy,
    /kesin cevap|kesin sonuç|kanıtlandı|doğrulandı|ispatlandı|AI sonucu|nihai rapor|provider|relay|final verdict|truth score/i
  );
  assert.equal(JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK), beforeDomain);
});
});
