import test from "node:test";
import assert from "node:assert/strict";

import {
  buildFateKnotsAi0DialogueRequest,
  gateFateKnotsAi0ProviderResponse,
  parseFateKnotsAi0RuntimeResponse,
} from "../../rooms/game-room/main-functions/fate-knots/shared/ai0-runtime.ts";

function createDialogueRequest() {
  return buildFateKnotsAi0DialogueRequest(
    "request-1",
    {
      universeId: "universe-1",
      runId: "run-1",
      npcId: "npc-1",
      locationId: "location-1",
      personaFacts: ["Speaks carefully."],
      knownFacts: ["The bridge is closed."],
      relationshipFacts: ["Has met the player once."],
      legalInteractionIds: ["ask-bridge", "leave"],
    },
    ["Rain is falling."],
    "Köprü neden kapalı?"
  );
}

void test("AI0 provider parser rejects malformed response shapes before legality checks", () => {
  const notRecord = parseFateKnotsAi0RuntimeResponse("not-json-object");
  assert.equal(notRecord.ok, false);
  if (!notRecord.ok) assert.deepEqual(notRecord.issues, [{ code: "invalid-response-shape", path: "$" }]);

  const missingUtterance = parseFateKnotsAi0RuntimeResponse({
    requestId: "request-1",
    kind: "npc-dialogue",
  });
  assert.equal(missingUtterance.ok, false);
  if (!missingUtterance.ok) {
    assert.deepEqual(missingUtterance.issues, [
      { code: "invalid-response-shape", path: "utterance" },
    ]);
  }

  const invalidOptionalField = parseFateKnotsAi0RuntimeResponse({
    requestId: "request-1",
    kind: "combat-choice",
    actorId: "enemy-1",
    actionCardId: 42,
  });
  assert.equal(invalidOptionalField.ok, false);
  if (!invalidOptionalField.ok) {
    assert.deepEqual(invalidOptionalField.issues, [
      { code: "invalid-response-shape", path: "actionCardId" },
    ]);
  }
});

void test("AI0 provider parser strips unknown provider fields from accepted bounded output", () => {
  const parsed = parseFateKnotsAi0RuntimeResponse({
    requestId: "request-1",
    kind: "npc-dialogue",
    utterance: "Köprü bu gece açılmayacak.",
    selectedInteractionId: "ask-bridge",
    hiddenCanon: "must-not-survive",
    toolCall: { name: "filesystem" },
  });

  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.deepEqual(parsed.response, {
    requestId: "request-1",
    kind: "npc-dialogue",
    utterance: "Köprü bu gece açılmayacak.",
    selectedInteractionId: "ask-bridge",
  });
  assert.equal("hiddenCanon" in parsed.response, false);
  assert.equal("toolCall" in parsed.response, false);
});

void test("AI0 provider gate runs request and legality validation after shape parsing", () => {
  const request = createDialogueRequest();

  const accepted = gateFateKnotsAi0ProviderResponse(request, {
    requestId: "request-1",
    kind: "npc-dialogue",
    utterance: "Köprü nöbet yüzünden kapalı.",
    selectedInteractionId: "ask-bridge",
  });
  assert.equal(accepted.ok, true);

  const wrongRequest = gateFateKnotsAi0ProviderResponse(request, {
    requestId: "other-request",
    kind: "npc-dialogue",
    utterance: "Yanlış oturum.",
  });
  assert.equal(wrongRequest.ok, false);
  if (!wrongRequest.ok) {
    assert.deepEqual(wrongRequest.issues, [
      { code: "request-id-mismatch", value: "other-request" },
    ]);
  }

  const illegalInteraction = gateFateKnotsAi0ProviderResponse(request, {
    requestId: "request-1",
    kind: "npc-dialogue",
    utterance: "Sana gizli geçidi göstereyim.",
    selectedInteractionId: "invent-secret-route",
  });
  assert.equal(illegalInteraction.ok, false);
  if (!illegalInteraction.ok) {
    assert.deepEqual(illegalInteraction.issues, [
      { code: "illegal-interaction-id", value: "invent-secret-route" },
    ]);
  }
});
