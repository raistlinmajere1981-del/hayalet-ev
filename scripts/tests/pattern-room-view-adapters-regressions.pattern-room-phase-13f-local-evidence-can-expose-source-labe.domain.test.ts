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


describe("pattern-room phase 13F local evidence can expose source labels in board and repo", () => {
void test("pattern-room phase 13F local evidence can expose source labels in board and report", () => {
  const localState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);
  localState.addAuthoredSource("Kaynaklı arşiv", "Kullanıcı arşivi", "Tam kaynak metni.");
  localState.addAuthoredEvidence(
    "Kaynaklı kanıt",
    "Kaynaklı alıntı",
    "Kaynaklı yorum",
    "evidence",
    {
      sourceId: "local-source-001",
      sourceLabel: "Kaynaklı arşiv",
    }
  );

  const viewModels = adaptDomainToViewModels(PATTERN_ROOM_DOMAIN_MOCK, localState.getOverlay());
  const evidenceCategory = viewModels.boardCategories.find((category) => {
    return category.id === "board-evidence";
  });
  const localEvidenceSection = viewModels.reportSummary.sections.find((section) => {
    return section.id === "report-evidence-notes";
  });
  const evidencePin = evidenceCategory?.pins.find((pin) => {
    return pin.id === "local-evidence-001";
  });

  assert.ok(evidencePin);
  assert.equal(evidencePin.sourceId, "local-source-001");
  assert.equal(evidencePin.sourceLabel, "Kaynaklı arşiv");
  assert.ok(localEvidenceSection);
  assert.equal(localEvidenceSection.items[0]?.body, "Kaynaklı alıntı");
  assert.equal(localEvidenceSection.items[0].detail, "Yorum: Kaynaklı yorum");
  assert.ok(localEvidenceSection.items[0].meta.includes("Kaynak: Kaynaklı arşiv"));
});
void test("pattern-room phase 8B local authored connections appear only in the report", () => {
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
  assert.equal(
    connectionsSection.note,
    "Oda içinde kurulan yerel bağlantılar kesin hüküm üretmeden gösterilir."
  );
  assert.deepEqual(
    connectionsSection.items.map((item) => item.body),
    ["Seyir defteri kaynagi → destekliyor → Golge karsilastirma gorseli"]
  );
  assert.equal(localState.getOverlay().localAuthoredEdges.length, 1);
  assert.equal(JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK), beforeDomain);
});
void test("pattern-room phase 8B board adapter exposes connection options without edge pins", () => {
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
void test("pattern-room phase 3B adapter maps every source type label", () => {
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
});
