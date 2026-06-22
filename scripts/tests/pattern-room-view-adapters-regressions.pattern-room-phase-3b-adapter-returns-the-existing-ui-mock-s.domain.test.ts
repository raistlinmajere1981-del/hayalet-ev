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


describe("pattern-room phase 3B adapter returns the existing UI mock shape", () => {
void test("pattern-room phase 3B adapter returns the existing UI mock shape", () => {
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
void test("pattern-room phase 3B focused adapters keep panel data non-empty", () => {
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
void test("pattern-room phase 3B adapter maps source type labels for archive cards", () => {
  const labels = adaptArchiveViewModel(PATTERN_ROOM_DOMAIN_MOCK).sources.map((source) => {
    return source.sourceTypeLabel;
  });

  assert.deepEqual(labels, ["Kitap / Metin", "Görsel kaynak", "Kişisel not", "Belirsiz kaynak"]);
});
void test("pattern-room phase 13D archive source previews stay compact while notes stay intact", () => {
  const localState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);
  const longNote =
    "Uzun kaynak gövdesi arşiv kartında tam olarak basılmamalı. Bu gövde snapshot ve local state içinde korunur; kart ise kısa bir önizleme gösterir. Böylece uzun kitap, makale veya arşiv metinleri paneli aşağı doğru aşırı büyütmez ve mevcut kaynak kartı davranışı korunur.\n\n" +
    "Bu kuyruk state içinde kalmalı fakat Archive kart metninde görünmemelidir.";
  const expectedPreview = `${longNote.replace(/\s+/g, " ").trim().slice(0, 240).trimEnd()}…`;

  localState.addAuthoredSource("Uzun kaynak", "Arşiv", longNote);

  const viewModels = adaptDomainToViewModels(PATTERN_ROOM_DOMAIN_MOCK, localState.getOverlay());
  const localSource = viewModels.sources.find((source) => {
    return source.id === "local-source-001";
  });
  const domainSource = adaptArchiveViewModel(PATTERN_ROOM_DOMAIN_MOCK).sources[0];

  assert.ok(localSource);
  assert.equal(localSource.note, longNote);
  assert.equal(localSource.notePreview, expectedPreview);
  assert.equal(localSource.notePreview.includes("Bu kuyruk"), false);
  assert.ok(domainSource);
  assert.equal(domainSource.notePreview, domainSource.note);
});
});
