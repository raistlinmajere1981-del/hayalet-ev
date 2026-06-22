import { assert, buildFetchedConversationMessage, buildRemoteEmailAccountId, cleanupAccount, createArchiveFactory, createSettings, createSettingsStore, createTransportStub, extractConversationEnvelope, FIXED_NOW, test, Us1ConversationService } from "./us1-conversation-service.helpers.ts";

import type { SendMailRequest } from "./us1-conversation-service.helpers.ts";


describe("US1 conversation service includes room event and room command metadata in outbou", () => {
void test("US1 conversation service includes room event and room command metadata in outbound mail", async () => {
  const accountId = `us1_mail_${Date.now().toString(36)}_room_meta`;
  const store = createSettingsStore(createSettings(accountId));
  const transportStub = createTransportStub();
  const service = new Us1ConversationService({
    now: () => FIXED_NOW,
    transport: transportStub.transport,
    archiveFactory: createArchiveFactory(),
    settingsStore: {
      loadSettings: () => store.loadSettings(),
      saveSettings: (settings) => store.saveSettings(settings),
    },
  });
  const remoteAccountId = buildRemoteEmailAccountId("remote@example.com");

  try {
    const inviteResult = await service.sendMessage({
      text: "Tavla invite from Game Room",
      roomEvent: {
        roomId: "game-room",
        featureId: "backgammon",
        inviteId: "invite-1",
        matchId: "invite-1",
        eventType: "invite",
        starter: "user",
        note: "Ready?",
      },
    });
    const params: Parameters<typeof service.sendMessage>[0] = {
      text: '++cmd:SlotBridge({"action":"room.command","payload":{"commandName":"GameRoomBackgammonRemoteMove","matchId":"invite-1","inviteId":"invite-1","turnIndex":0,"boardHashBeforeMove":".........","cell":4}})',
      roomCommand: {
        roomId: "game-room",
        featureId: "backgammon",
        action: "room.command",
        commandName: "GameRoomBackgammonRemoteMove",
        roomPayload: {
          matchId: "invite-1",
          inviteId: "invite-1",
          turnIndex: 0,
          boardHashBeforeMove: ".........",
          cell: 4,
        },
        matchId: "invite-1",
        turnIndex: 0,
        boardHashBeforeMove: ".........",
        rawArgs:
          '{"matchId":"invite-1","inviteId":"invite-1","turnIndex":0,"boardHashBeforeMove":".........","cell":4}',
      },
    };
    if (inviteResult.localSessionId !== undefined) {
      params.localSessionId = inviteResult.localSessionId;
    }
    const commandResult = await service.sendMessage(params);

    assert.equal(inviteResult.success, true);
    assert.equal(commandResult.success, true);
    assert.equal(transportStub.sentMessages.length, 2);

    const inviteEnvelope = extractConversationEnvelope(
      transportStub.sentMessages[0] as SendMailRequest
    );
    const commandEnvelope = extractConversationEnvelope(
      transportStub.sentMessages[1] as SendMailRequest
    );

    assert.deepEqual(inviteEnvelope["roomEvent"], {
      roomId: "game-room",
      featureId: "backgammon",
      inviteId: "invite-1",
      matchId: "invite-1",
      eventType: "invite",
      starter: "user",
      note: "Ready?",
    });
    assert.deepEqual(commandEnvelope["roomCommand"], {
      roomId: "game-room",
      featureId: "backgammon",
      action: "room.command",
      commandName: "GameRoomBackgammonRemoteMove",
      roomPayload: {
        matchId: "invite-1",
        inviteId: "invite-1",
        turnIndex: 0,
        boardHashBeforeMove: ".........",
        cell: 4,
      },
      matchId: "invite-1",
      turnIndex: 0,
      boardHashBeforeMove: ".........",
      rawArgs:
        '{"matchId":"invite-1","inviteId":"invite-1","turnIndex":0,"boardHashBeforeMove":".........","cell":4}',
    });
  } finally {
    cleanupAccount(accountId);
    cleanupAccount(remoteAccountId);
  }
});
void test("US1 conversation sync projects room events, commands, and invite inbox entries", async () => {
  const accountId = `us1_mail_${Date.now().toString(36)}_room_sync`;
  const store = createSettingsStore(createSettings(accountId));
  const transportStub = createTransportStub();
  const service = new Us1ConversationService({
    now: () => FIXED_NOW,
    transport: transportStub.transport,
    archiveFactory: createArchiveFactory(),
    settingsStore: {
      loadSettings: () => store.loadSettings(),
      saveSettings: (settings) => store.saveSettings(settings),
    },
  });
  const remoteAccountId = buildRemoteEmailAccountId("remote@example.com");

  try {
    transportStub.enqueueFetch({
      accountId,
      mailbox: "INBOX",
      cursor: "uid:31",
      fetchedCount: 2,
      processedCount: 2,
      duplicateCount: 0,
      messages: [
        buildFetchedConversationMessage({
          accountId,
          uid: 31,
          transportMessageId: "<invite-room-sync@example.test>",
          localMessageId: "local-room-sync-invite",
          localSessionId: "room-sync-session",
          nickname: "Remote Player",
          text: "Incoming Tavla invite",
          subject: "Tavla invite",
          roomEvent: {
            roomId: "game-room",
            featureId: "backgammon",
            inviteId: "invite-sync-1",
            matchId: "invite-sync-1",
            eventType: "invite",
            starter: "user",
            note: "Your turn first",
          },
        }),
        buildFetchedConversationMessage({
          accountId,
          uid: 32,
          transportMessageId: "<command-room-sync@example.test>",
          localMessageId: "local-room-sync-command",
          localSessionId: "room-sync-session",
          nickname: "Remote Player",
          text: '++cmd:SlotBridge({"action":"room.command","payload":{"commandName":"GameRoomBackgammonRemoteMove","matchId":"invite-sync-1","inviteId":"invite-sync-1","turnIndex":0,"boardHashBeforeMove":".........","cell":4}})',
          subject: "Tavla move",
          roomCommand: {
            roomId: "game-room",
            featureId: "backgammon",
            action: "room.command",
            commandName: "GameRoomBackgammonRemoteMove",
            roomPayload: {
              matchId: "invite-sync-1",
              inviteId: "invite-sync-1",
              turnIndex: 0,
              boardHashBeforeMove: ".........",
              cell: 4,
            },
            matchId: "invite-sync-1",
            turnIndex: 0,
            boardHashBeforeMove: ".........",
            rawArgs:
              '{"matchId":"invite-sync-1","inviteId":"invite-sync-1","turnIndex":0,"boardHashBeforeMove":".........","cell":4}',
          },
        }),
      ],
    });

    const result = await service.syncMessages({ localSessionId: "room-sync-session" });

    assert.equal(result.success, true);
    assert.equal(result.projectedCount, 2);
    assert.equal(result.roomEvents?.length, 1);
    assert.equal(result.roomCommands?.length, 1);
    assert.equal(result.roomInviteInbox?.length, 1);
    assert.equal(result.roomEvents[0]?.inviteId, "invite-sync-1");
    assert.equal(result.roomEvents[0].matchId, "invite-sync-1");
    assert.equal(result.roomEvents[0].senderNickname, "Remote Player");
    assert.equal(result.roomCommands[0]?.commandName, "GameRoomBackgammonRemoteMove");
    assert.equal(result.roomCommands[0].action, "room.command");
    assert.deepEqual(result.roomCommands[0].roomPayload, {
      matchId: "invite-sync-1",
      inviteId: "invite-sync-1",
      turnIndex: 0,
      boardHashBeforeMove: ".........",
      cell: 4,
    });
    assert.deepEqual(result.roomCommands[0].commandArgs, {
      matchId: "invite-sync-1",
      inviteId: "invite-sync-1",
      turnIndex: 0,
      boardHashBeforeMove: ".........",
      cell: 4,
    });
    assert.equal(result.roomInviteInbox[0]?.remoteUserId, "remote@example.com");
  } finally {
    cleanupAccount(accountId);
    cleanupAccount(remoteAccountId);
  }
});
void test("US1 conversation sync falls back to inline SlotBridge room.command text", async () => {
  const accountId = `us1_mail_${Date.now().toString(36)}_room_inline_cmd`;
  const store = createSettingsStore(createSettings(accountId));
  const transportStub = createTransportStub();
  const service = new Us1ConversationService({
    now: () => FIXED_NOW,
    transport: transportStub.transport,
    archiveFactory: createArchiveFactory(),
    settingsStore: {
      loadSettings: () => store.loadSettings(),
      saveSettings: (settings) => store.saveSettings(settings),
    },
  });
  const remoteAccountId = buildRemoteEmailAccountId("remote@example.com");

  try {
    transportStub.enqueueFetch({
      accountId,
      mailbox: "INBOX",
      cursor: "uid:41",
      fetchedCount: 1,
      processedCount: 1,
      duplicateCount: 0,
      messages: [
        buildFetchedConversationMessage({
          accountId,
          uid: 41,
          transportMessageId: "<inline-room-command@example.test>",
          localMessageId: "local-inline-room-command",
          localSessionId: "room-inline-session",
          nickname: "Remote Player",
          text: '++cmd:SlotBridge({"action":"room.command","payload":{"commandName":"GameRoomBackgammonRemoteMove","matchId":"invite-inline-1","inviteId":"invite-inline-1","turnIndex":0,"boardHashBeforeMove":".........","cell":4}})',
          subject: "Tavla move inline",
        }),
      ],
    });

    const result = await service.syncMessages({ localSessionId: "room-inline-session" });

    assert.equal(result.success, true);
    assert.equal(result.projectedCount, 1);
    assert.equal(result.roomCommands?.length, 1);
    assert.equal(result.roomCommands[0]?.roomId, "game-room");
    assert.equal(result.roomCommands[0].featureId, "backgammon");
    assert.equal(result.roomCommands[0].commandName, "GameRoomBackgammonRemoteMove");
    assert.equal(result.roomCommands[0].action, "room.command");
    assert.deepEqual(result.roomCommands[0].roomPayload, {
      matchId: "invite-inline-1",
      inviteId: "invite-inline-1",
      turnIndex: 0,
      boardHashBeforeMove: ".........",
      cell: 4,
    });
    assert.deepEqual(result.roomCommands[0].commandArgs, {
      matchId: "invite-inline-1",
      inviteId: "invite-inline-1",
      turnIndex: 0,
      boardHashBeforeMove: ".........",
      cell: 4,
    });
  } finally {
    cleanupAccount(accountId);
    cleanupAccount(remoteAccountId);
  }
});
void test("US1 conversation sync does not infer unknown inline room.command identities", async () => {
  const accountId = `us1_mail_${Date.now().toString(36)}_room_inline_unknown`;
  const store = createSettingsStore(createSettings(accountId));
  const transportStub = createTransportStub();
  const service = new Us1ConversationService({
    now: () => FIXED_NOW,
    transport: transportStub.transport,
    archiveFactory: createArchiveFactory(),
    settingsStore: {
      loadSettings: () => store.loadSettings(),
      saveSettings: (settings) => store.saveSettings(settings),
    },
  });
  const remoteAccountId = buildRemoteEmailAccountId("remote@example.com");

  try {
    transportStub.enqueueFetch({
      accountId,
      mailbox: "INBOX",
      cursor: "uid:41b",
      fetchedCount: 1,
      processedCount: 1,
      duplicateCount: 0,
      messages: [
        buildFetchedConversationMessage({
          accountId,
          uid: 41,
          transportMessageId: "<inline-room-command-unknown@example.test>",
          localMessageId: "local-inline-room-command-unknown",
          localSessionId: "room-inline-session-unknown",
          nickname: "Remote Player",
          text: '++cmd:SlotBridge({"action":"room.command","payload":{"commandName":"GameRoomSecretRemoteMove","matchId":"invite-inline-unknown-1","inviteId":"invite-inline-unknown-1","turnIndex":0,"boardHashBeforeMove":".........","cell":4}})',
          subject: "Tavla move inline unknown",
        }),
      ],
    });

    const result = await service.syncMessages({ localSessionId: "room-inline-session-unknown" });

    assert.equal(result.success, true);
    assert.equal(result.projectedCount, 1);
    assert.equal(result.roomCommands?.length, 0);
  } finally {
    cleanupAccount(accountId);
    cleanupAccount(remoteAccountId);
  }
});
});
