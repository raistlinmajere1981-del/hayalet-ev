import {
  assert,
  buildFetchedConversationMessage,
  buildRemoteEmailAccountId,
  cleanupAccount,
  createArchiveFactory,
  createMultiRemoteSettings,
  createSettings,
  createSettingsStore,
  createTransportStub,
  extractConversationEnvelope,
  FIXED_NOW,
  test,
  Us1ConversationService,
} from "./us1-conversation-service.helpers.ts";

import type { SendMailRequest } from "./us1-conversation-service.helpers.ts";


describe("US1 conversation sync preserves pending room commands until a consumer drains th", () => {
void test("US1 conversation sync preserves pending room commands until a consumer drains them", async () => {
  const accountId = `us1_mail_${Date.now().toString(36)}_room_pending_cmd`;
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
      cursor: "uid:42",
      fetchedCount: 1,
      processedCount: 1,
      duplicateCount: 0,
      messages: [
        buildFetchedConversationMessage({
          accountId,
          uid: 42,
          transportMessageId: "<pending-room-command@example.test>",
          localMessageId: "local-pending-room-command",
          localSessionId: "room-pending-session",
          nickname: "Remote Player",
          text: '++cmd:SlotBridge({"action":"room.command","payload":{"commandName":"GameRoomBackgammonRemoteMove","matchId":"invite-pending-1","inviteId":"invite-pending-1","turnIndex":0,"boardHashBeforeMove":".........","cell":0}})',
          subject: "Tavla move pending",
        }),
      ],
    });

    const previewResult = await service.syncMessages({ localSessionId: "room-pending-session" });
    const repeatedPreviewResult = await service.syncMessages({
      localSessionId: "room-pending-session",
    });
    const consumeResult = await service.syncMessages({
      localSessionId: "room-pending-session",
      consumeRoomCommands: true,
    });
    const drainedResult = await service.syncMessages({
      localSessionId: "room-pending-session",
      consumeRoomCommands: true,
    });

    assert.equal(previewResult.success, true);
    assert.equal(previewResult.roomCommands?.length, 1);
    assert.equal(repeatedPreviewResult.success, true);
    assert.equal(repeatedPreviewResult.roomCommands?.length, 1);
    assert.equal(repeatedPreviewResult.duplicateCount, 0);
    assert.equal(consumeResult.success, true);
    assert.equal(consumeResult.roomCommands?.length, 1);
    assert.equal(consumeResult.roomCommands[0]?.commandName, "GameRoomBackgammonRemoteMove");
    assert.equal(drainedResult.success, true);
    assert.equal(drainedResult.roomCommands?.length, 0);
  } finally {
    cleanupAccount(accountId);
    cleanupAccount(remoteAccountId);
  }
});
void test("US1 conversation service preserves Team Tetris start events and turnToken metadata", async () => {
  const accountId = `us1_mail_${Date.now().toString(36)}_team_tetris_meta`;
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
    const startResult = await service.sendMessage({
      text: "Team Tetris match started.",
      roomEvent: {
        roomId: "game-room",
        featureId: "team-tetris",
        inviteId: "tt-match-1",
        matchId: "tt-match-1",
        eventType: "start",
        note: '{"seed":"tt-seed","hiddenPairs":true}',
      },
    });
    const params: Parameters<typeof service.sendMessage>[0] = {
      text: '++cmd:SlotBridge({"action":"room.command","payload":{"commandName":"GameRoomTeamTetrisRemoteMove","schemaVersion":1,"matchId":"tt-match-1","turnIndex":2,"turnToken":"tt_token","pieceId":"T","rotation":1,"rowShifts":[0,1,0]}})',
      roomCommand: {
        roomId: "game-room",
        featureId: "team-tetris",
        action: "room.command",
        commandName: "GameRoomTeamTetrisRemoteMove",
        roomPayload: {
          schemaVersion: 1,
          matchId: "tt-match-1",
          turnIndex: 2,
          turnToken: "tt_token",
          pieceId: "T",
          rotation: 1,
          rowShifts: [0, 1, 0],
        },
        matchId: "tt-match-1",
        turnIndex: 2,
        turnToken: "tt_token",
        boardHashBeforeMove: "..........|..........",
        rawArgs:
          '{"schemaVersion":1,"matchId":"tt-match-1","turnIndex":2,"turnToken":"tt_token","pieceId":"T","rotation":1,"rowShifts":[0,1,0]}',
      },
    };
    if (startResult.localSessionId !== undefined) {
      params.localSessionId = startResult.localSessionId;
    }
    const commandResult = await service.sendMessage(params);

    assert.equal(startResult.success, true);
    assert.equal(commandResult.success, true);

    const startEnvelope = extractConversationEnvelope(
      transportStub.sentMessages[0] as SendMailRequest
    );
    const commandEnvelope = extractConversationEnvelope(
      transportStub.sentMessages[1] as SendMailRequest
    );

    assert.deepEqual(startEnvelope["roomEvent"], {
      roomId: "game-room",
      featureId: "team-tetris",
      inviteId: "tt-match-1",
      matchId: "tt-match-1",
      eventType: "start",
      note: '{"seed":"tt-seed","hiddenPairs":true}',
    });
    assert.deepEqual(commandEnvelope["roomCommand"], {
      roomId: "game-room",
      featureId: "team-tetris",
      action: "room.command",
      commandName: "GameRoomTeamTetrisRemoteMove",
      roomPayload: {
        schemaVersion: 1,
        matchId: "tt-match-1",
        turnIndex: 2,
        turnToken: "tt_token",
        pieceId: "T",
        rotation: 1,
        rowShifts: [0, 1, 0],
      },
      matchId: "tt-match-1",
      turnIndex: 2,
      turnToken: "tt_token",
      boardHashBeforeMove: "..........|..........",
      rawArgs:
        '{"schemaVersion":1,"matchId":"tt-match-1","turnIndex":2,"turnToken":"tt_token","pieceId":"T","rotation":1,"rowShifts":[0,1,0]}',
    });
  } finally {
    cleanupAccount(accountId);
    cleanupAccount(remoteAccountId);
  }
});
void test("US1 conversation sync keeps invite inbox entries from all registered remote accounts", async () => {
  const accountIdA = `us1_mail_${Date.now().toString(36)}_multi_a`;
  const accountIdB = `us1_mail_${Date.now().toString(36)}_multi_b`;
  const store = createSettingsStore(
    createMultiRemoteSettings("alpha@example.com", [
      {
        accountId: accountIdA,
        remoteUserId: "alpha@example.com",
        nickname: "Alpha Remote",
      },
      {
        accountId: accountIdB,
        remoteUserId: "beta@example.com",
        nickname: "Beta Remote",
      },
    ])
  );
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
  const remoteAccountIdA = buildRemoteEmailAccountId("alpha@example.com");
  const remoteAccountIdB = buildRemoteEmailAccountId("beta@example.com");

  try {
    transportStub.enqueueFetch({
      accountId: accountIdA,
      mailbox: "INBOX",
      cursor: "uid:41",
      fetchedCount: 1,
      processedCount: 1,
      duplicateCount: 0,
      messages: [
        buildFetchedConversationMessage({
          accountId: accountIdA,
          uid: 41,
          transportMessageId: "<invite-alpha@example.test>",
          localMessageId: "local-alpha-invite",
          remoteUserId: "alpha@example.com",
          nickname: "Alpha Remote",
          localSessionId: "alpha-session",
          text: "Alpha invite",
          roomEvent: {
            roomId: "game-room",
            featureId: "backgammon",
            inviteId: "invite-alpha",
            matchId: "invite-alpha",
            eventType: "invite",
            starter: "user",
            note: "Alpha note",
          },
        }),
      ],
    });
    transportStub.enqueueFetch({
      accountId: accountIdB,
      mailbox: "INBOX",
      cursor: "uid:42",
      fetchedCount: 1,
      processedCount: 1,
      duplicateCount: 0,
      messages: [
        buildFetchedConversationMessage({
          accountId: accountIdB,
          uid: 42,
          transportMessageId: "<invite-beta@example.test>",
          localMessageId: "local-beta-invite",
          remoteUserId: "beta@example.com",
          nickname: "Beta Remote",
          localSessionId: "beta-session",
          text: "Beta invite",
          roomEvent: {
            roomId: "game-room",
            featureId: "backgammon",
            inviteId: "invite-beta",
            matchId: "invite-beta",
            eventType: "invite",
            starter: "opponent",
            note: "Beta note",
          },
        }),
      ],
    });

    const result = await service.syncMessages();

    assert.equal(result.success, true);
    assert.equal(result.fetchedCount, 2);
    assert.equal(result.roomInviteInbox?.length, 2);
    assert.deepEqual(result.roomInviteInbox.map((entry) => entry.remoteUserId).sort(), [
      "alpha@example.com",
      "beta@example.com",
    ]);
    assert.equal(result.remoteUserId, "alpha@example.com");
  } finally {
    cleanupAccount(accountIdA);
    cleanupAccount(accountIdB);
    cleanupAccount(remoteAccountIdA);
    cleanupAccount(remoteAccountIdB);
  }
});
void test("US1 conversation service projects reset lifecycle events and clears invite inbox", async () => {
  const accountId = `us1_mail_${Date.now().toString(36)}_room_reset`;
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
      cursor: "uid:51",
      fetchedCount: 2,
      processedCount: 2,
      duplicateCount: 0,
      messages: [
        buildFetchedConversationMessage({
          accountId,
          uid: 51,
          transportMessageId: "<invite-reset-sync@example.test>",
          localMessageId: "local-reset-invite",
          localSessionId: "reset-sync-session",
          nickname: "Remote Player",
          text: "Incoming Tavla invite",
          roomEvent: {
            roomId: "game-room",
            featureId: "backgammon",
            inviteId: "invite-reset-sync",
            matchId: "invite-reset-sync",
            eventType: "invite",
            starter: "user",
          },
        }),
        buildFetchedConversationMessage({
          accountId,
          uid: 52,
          transportMessageId: "<reset-sync@example.test>",
          localMessageId: "local-reset-event",
          localSessionId: "reset-sync-session",
          nickname: "Remote Player",
          text: "Tavla match reset.",
          roomEvent: {
            roomId: "game-room",
            featureId: "backgammon",
            inviteId: "invite-reset-sync",
            matchId: "invite-reset-sync",
            eventType: "reset",
          },
        }),
      ],
    });

    const result = await service.syncMessages({ localSessionId: "reset-sync-session" });

    assert.equal(result.success, true);
    assert.equal(result.roomEvents?.length, 2);
    assert.equal(result.roomEvents[1]?.eventType, "reset");
    assert.equal(result.roomEvents[1].matchId, "invite-reset-sync");
    assert.equal(result.roomInviteInbox?.length, 0);
  } finally {
    cleanupAccount(accountId);
    cleanupAccount(remoteAccountId);
  }
});
});
