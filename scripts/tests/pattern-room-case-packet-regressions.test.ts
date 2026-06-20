import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createPatternRoomCasePacket } from "../../rooms/pattern-room/shared/adapters/pattern-room-case-packet-adapter.ts";
import { adaptDomainToViewModels } from "../../rooms/pattern-room/shared/adapters/pattern-room-view-adapters.ts";
import { PATTERN_ROOM_DOMAIN_MOCK } from "../../rooms/pattern-room/shared/data/pattern-room-domain.mock.ts";
import { createLocalState } from "../../rooms/pattern-room/shared/state/pattern-room-local-state.ts";
import { PATTERN_ROOM_SNAPSHOT_VERSION } from "../../rooms/pattern-room/shared/types/pattern-room-snapshot.ts";
import type { PatternRoomLocalOverlay } from "../../rooms/pattern-room/shared/state/pattern-room-local-state.ts";
import type { PatternRoomMockData } from "../../rooms/pattern-room/shared/types/pattern-room.ts";

function createLongText(label: string): string {
  return Array.from({ length: 24 }, (_value, index) => {
    return `${label} ${index + 1}: kullanıcı tarafından eklenen uzun yerel araştırma parçası.`;
  }).join(" ");
}

function createCasePacketFixture(): {
  beforeDomain: string;
  viewModels: PatternRoomMockData;
} {
  const beforeDomain = JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK);
  const localState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);

  localState.addAuthoredSource("Uzun kaynak başlığı", "Kullanıcı arşivi", createLongText("Kaynak"));
  localState.addAuthoredClaim("Yerel iddia", "Kullanıcı tarafından eklenen iddia.");
  localState.addAuthoredInspiration("Yerel ilham", "Kullanıcı tarafından eklenen ilham.");
  localState.addAuthoredUncertainty("Eksik bağlam", "Sonraki araştırma için belirsizlik.");
  localState.addAuthoredEvidence(
    "Kaynaklı kanıt",
    createLongText("Alıntı"),
    "Kullanıcı yorumu ayrı kalır.",
    "evidence",
    { sourceId: "local-source-001", sourceLabel: "Uzun kaynak başlığı" }
  );
  localState.addAuthoredEdge(
    "supports",
    "local-node-001",
    "local-evidence-001",
    createLongText("Bağ")
  );
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

  return {
    beforeDomain,
    viewModels: adaptDomainToViewModels(PATTERN_ROOM_DOMAIN_MOCK, overlay),
  };
}

function flattenPacketText(value: unknown): string {
  return JSON.stringify(value);
}

void test("pattern-room phase 15B case packet is deterministic and read-only", () => {
  const { beforeDomain, viewModels } = createCasePacketFixture();
  const beforeViewModels = JSON.stringify(viewModels);

  const firstPacket = createPatternRoomCasePacket(viewModels);
  const secondPacket = createPatternRoomCasePacket(viewModels);

  assert.deepEqual(firstPacket, secondPacket);
  assert.equal(firstPacket.packetVersion, 1);
  assert.equal(firstPacket.roomId, "pattern-room");
  assert.equal(firstPacket.generatedFrom, "local-view-model");
  assert.equal(JSON.stringify(viewModels), beforeViewModels);
  assert.equal(JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK), beforeDomain);
});

void test("pattern-room phase 15B case packet carries local sources, evidence, notes, connections, and debate previews", () => {
  const { viewModels } = createCasePacketFixture();
  const packet = createPatternRoomCasePacket(viewModels);

  assert.ok(
    packet.sources.some((source) => {
      return source.label === "Seyir defteri";
    })
  );
  const longSource = packet.sources.find((source) => {
    return source.label === "Uzun kaynak başlığı";
  });
  assert.ok(longSource);
  assert.equal(longSource.segmentCount, 2);
  assert.equal(longSource.typeLabel, "Yerel Kaynak");

  const evidence = packet.evidence.find((item) => {
    return item.label === "Kaynaklı kanıt";
  });
  assert.ok(evidence);
  assert.equal(evidence.sourceLabel, "Uzun kaynak başlığı");
  assert.match(evidence.excerptPreview, /^Alıntı 1:/);
  assert.equal(evidence.interpretationPreview, "Kullanıcı yorumu ayrı kalır.");
  assert.equal(evidence.layer, "Kanıt");

  assert.deepEqual(
    packet.boardNotes.map((note) => {
      return { type: note.type, layer: note.layer };
    }),
    [
      { type: "İddia", layer: "interpretation" },
      { type: "İlham", layer: "analysis" },
      { type: "Belirsizlik", layer: "uncertainty" },
    ]
  );

  const connection = packet.connections[0];
  assert.ok(connection);
  assert.equal(connection.id, "local-edge-001");
  assert.equal(connection.sourceLabel, "Yerel iddia");
  assert.equal(connection.edgeTypeLabel, "destekliyor");
  assert.equal(connection.targetLabel, "Kaynaklı kanıt");
  assert.match(connection.notePreview ?? "", /^Bağ 1:/);
  assert.equal((connection.notePreview ?? "").length <= 500, true);
  assert.match(connection.notePreview ?? "", /(?:\.\.\.|…)$/);

  assert.equal(packet.debate.referenceCount, 1);
  assert.equal(packet.debate.turnCount, 5);
  assert.equal(packet.debate.phaseLabel, "completed");
  assert.ok(packet.debate.turnPreviews.some((preview) => preview.includes("karşıt argüman")));
  assert.match(packet.debate.verdictPreview ?? "", /Local 10\. Adam oturumu tamamlandı/);
  assert.match(packet.debate.verdictPreview ?? "", /Dış üretim çağrısı yapılmadı/);
  assert.ok(packet.openQuestions.some((question) => question.includes("Kullanıcı takip notu.")));
});

void test("pattern-room phase 15B case packet limits long previews without verdict wording", () => {
  const { viewModels } = createCasePacketFixture();
  const packet = createPatternRoomCasePacket(viewModels, {
    maxSources: 1,
    maxEvidence: 1,
    maxBoardNotes: 1,
    maxConnections: 1,
    excerptMaxLength: 80,
  });

  assert.equal(packet.sources.length, 1);
  assert.equal(packet.evidence.length, 1);
  assert.equal(packet.boardNotes.length, 1);
  assert.equal(packet.connections.length, 1);
  assert.equal(packet.limits.excerptMaxLength, 80);
  assert.equal(packet.evidence[0]?.excerptPreview.length, 80);
  assert.match(packet.evidence[0]?.excerptPreview ?? "", /\.\.\.$/);
  assert.equal((packet.connections[0]?.notePreview ?? "").length, 80);

  assert.doesNotMatch(
    flattenPacketText(packet),
    /\bkesin\b|kanıtlandı|doğrulandı|ispatlandı|AI sonucu|nihai|final verdict|truth score/i
  );
});

void test("pattern-room phase 15B case packet adapter stays independent from UI, host, transport, and snapshot contracts", () => {
  const adapterSource = readFileSync(
    resolve("rooms/pattern-room/shared/adapters/pattern-room-case-packet-adapter.ts"),
    "utf8"
  );
  const typeSource = readFileSync(
    resolve("rooms/pattern-room/shared/types/pattern-room-case-packet.ts"),
    "utf8"
  );

  assert.doesNotMatch(adapterSource, /from\s+["'][^"']*(?:host|ui|pattern-report-panel)/i);
  assert.doesNotMatch(adapterSource, /ipcRenderer|ipcMain|roomAPI|autosave|SourcePackage/i);
  assert.doesNotMatch(adapterSource, /from\s+["'][^"']*(?:ai|provider|relay)/i);
  assert.doesNotMatch(adapterSource, /PatternRoomLocalOverlay/);
  assert.doesNotMatch(typeSource, /PatternRoomLocalOverlay|SourcePackage|ipcRenderer|roomAPI/);
  assert.equal(PATTERN_ROOM_SNAPSHOT_VERSION, 1);
});
