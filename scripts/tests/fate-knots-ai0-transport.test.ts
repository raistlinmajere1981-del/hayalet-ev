import test from "node:test";
import assert from "node:assert/strict";

import {
  FATE_KNOTS_AI0_RUNTIME_PROFILE_ID,
  buildFateKnotsAi0DialogueRequest,
} from "../../rooms/game-room/main-functions/fate-knots/shared/ai0-runtime.ts";
import { invokeFateKnotsAi0Runtime } from "../../rooms/game-room/main-functions/fate-knots/host/ai0-transport.ts";

function createRequest() {
  return buildFateKnotsAi0DialogueRequest(
    "request-transport-1",
    {
      universeId: "universe-1",
      runId: "run-1",
      npcId: "npc-1",
      locationId: "location-1",
      personaFacts: ["Patient."],
      knownFacts: ["The west gate is watched."],
      relationshipFacts: [],
      legalInteractionIds: ["ask-gate"],
    },
    ["The player stands beside the west gate."],
    "Kim nöbet tutuyor?"
  );
}

void test("AI0 transport prepares isolated workspace before invoking a provider", async () => {
  const request = createRequest();
  const originalFacts = request.rolePacket.knownFacts.slice();
  const order: string[] = [];

  const result = await invokeFateKnotsAi0Runtime(
    {
      async prepareWorkspace(universeId) {
        order.push(`prepare:${universeId}`);
        return {
          ok: true as const,
          workspace: {
            workspaceDir: "/app-data/room-storage/game-room/fate-knots/ai0-runtime/universe-1",
            policyPath:
              "/app-data/room-storage/game-room/fate-knots/ai0-runtime/universe-1/AGENTS.md",
            runtimeProfileId: FATE_KNOTS_AI0_RUNTIME_PROFILE_ID,
          },
        };
      },
      provider: {
        async invoke(invocation) {
          order.push(`provider:${invocation.workspaceDir}`);
          assert.equal(invocation.runtimeProfile.role, "npc-actor");
          assert.equal(invocation.runtimeProfile.workspaceIsolation, "external-app-data");
          assert.equal(invocation.runtimeProfile.discoverMcpTools, false);
          assert.equal(invocation.runtimeProfile.bootstrapProjectMemory, false);
          assert.deepEqual(invocation.runtimeProfile.toolIds, []);

          if (invocation.request.kind === "npc-dialogue") {
            invocation.request.rolePacket.knownFacts.push("provider-mutation");
          }

          return {
            requestId: "request-transport-1",
            kind: "npc-dialogue",
            utterance: "Batı kapısında iki muhafız var.",
            selectedInteractionId: "ask-gate",
            ignoredProviderField: "discard-me",
          };
        },
      },
    },
    { universeId: "universe-1", request }
  );

  assert.equal(result.ok, true);
  assert.deepEqual(order, [
    "prepare:universe-1",
    "provider:/app-data/room-storage/game-room/fate-knots/ai0-runtime/universe-1",
  ]);
  assert.deepEqual(request.rolePacket.knownFacts, originalFacts);
  if (result.ok) {
    assert.equal("ignoredProviderField" in result.response, false);
  }
});

void test("AI0 transport rejects runtime universe mismatch before workspace/provider work", async () => {
  const request = createRequest();
  let prepareCalled = false;
  let providerCalled = false;

  const result = await invokeFateKnotsAi0Runtime(
    {
      async prepareWorkspace() {
        prepareCalled = true;
        throw new Error("must not run");
      },
      provider: {
        async invoke() {
          providerCalled = true;
          return null;
        },
      },
    },
    { universeId: "other-universe", request }
  );

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, "invalid-runtime-context");
  assert.equal(prepareCalled, false);
  assert.equal(providerCalled, false);
});

void test("AI0 transport rejects malformed or illegal provider output", async () => {
  const request = createRequest();
  const baseDeps = {
    async prepareWorkspace() {
      return {
        ok: true as const,
        workspace: {
          workspaceDir: "/runtime/universe-1",
          policyPath: "/runtime/universe-1/AGENTS.md",
          runtimeProfileId: FATE_KNOTS_AI0_RUNTIME_PROFILE_ID,
        },
      };
    },
  };

  const malformed = await invokeFateKnotsAi0Runtime(
    {
      ...baseDeps,
      provider: {
        async invoke() {
          return { requestId: "request-transport-1", kind: "npc-dialogue", utterance: 42 };
        },
      },
    },
    { universeId: "universe-1", request }
  );
  assert.equal(malformed.ok, false);
  if (!malformed.ok) {
    assert.equal(malformed.error, "provider-response-rejected");
    assert.deepEqual(malformed.issues, [
      { code: "invalid-response-shape", path: "utterance" },
    ]);
  }

  const illegal = await invokeFateKnotsAi0Runtime(
    {
      ...baseDeps,
      provider: {
        async invoke() {
          return {
            requestId: "request-transport-1",
            kind: "npc-dialogue",
            utterance: "Gizli bir yol açıyorum.",
            selectedInteractionId: "invent-route",
          };
        },
      },
    },
    { universeId: "universe-1", request }
  );
  assert.equal(illegal.ok, false);
  if (!illegal.ok) {
    assert.equal(illegal.error, "provider-response-rejected");
    assert.deepEqual(illegal.issues, [
      { code: "illegal-interaction-id", value: "invent-route" },
    ]);
  }
});

void test("AI0 transport reduces provider exceptions to a bounded failure", async () => {
  const request = createRequest();
  const result = await invokeFateKnotsAi0Runtime(
    {
      async prepareWorkspace() {
        return {
          ok: true as const,
          workspace: {
            workspaceDir: "/runtime/universe-1",
            policyPath: "/runtime/universe-1/AGENTS.md",
            runtimeProfileId: FATE_KNOTS_AI0_RUNTIME_PROFILE_ID,
          },
        };
      },
      provider: {
        async invoke() {
          throw new Error("provider private failure details");
        },
      },
    },
    { universeId: "universe-1", request }
  );

  assert.deepEqual(result, {
    ok: false,
    error: "provider-failed",
    response: null,
    issues: [],
  });
});
