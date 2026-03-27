import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { loadGameRoomHostModule } from "./helpers/game-room-host-module.ts";

const gameRoomHostModule = await loadGameRoomHostModule();

type TeamTetrisEngine = ReturnType<typeof loadTeamTetrisEngine>;

class FakeElement {
  tagName: string;
  ownerDocument: FakeDocument;
  children: FakeElement[] = [];
  parentElement: FakeElement | null = null;
  dataset: Record<string, string> = {};
  className = "";
  textContent = "";
  innerHTML = "";
  type = "";
  id = "";
  value = "";
  placeholder = "";
  rows = 0;
  disabled = false;
  style: Record<string, string> = {};
  eventListeners = new Map<string, Array<(event?: Record<string, unknown>) => void>>();

  constructor(tagName: string, ownerDocument: FakeDocument) {
    this.tagName = tagName.toLowerCase();
    this.ownerDocument = ownerDocument;
  }

  append(...children: FakeElement[]): void {
    for (const child of children) {
      child.parentElement = this;
      this.children.push(child);
    }
  }

  replaceChildren(...children: FakeElement[]): void {
    this.children = [];
    this.append(...children);
  }

  addEventListener(type: string, handler: (event?: Record<string, unknown>) => void): void {
    const handlers = this.eventListeners.get(type) ?? [];
    handlers.push(handler);
    this.eventListeners.set(type, handlers);
  }
}

class FakeDocument {
  documentElement = { lang: "und", dataset: {} as Record<string, string> };
  title = "";
  readonly body: FakeElement;

  constructor() {
    this.body = new FakeElement("body", this);
  }

  createElement(tagName: string): FakeElement {
    return new FakeElement(tagName, this);
  }

  getElementById(id: string): FakeElement | null {
    return findFirst(this.body, (element) => element.id === id);
  }
}

function findFirst(
  root: FakeElement,
  predicate: (element: FakeElement) => boolean
): FakeElement | null {
  if (predicate(root)) {
    return root;
  }

  for (const child of root.children) {
    const match = findFirst(child, predicate);
    if (match !== null) {
      return match;
    }
  }

  return null;
}

function findAll(root: FakeElement, predicate: (element: FakeElement) => boolean): FakeElement[] {
  const matches: FakeElement[] = [];
  if (predicate(root)) {
    matches.push(root);
  }

  for (const child of root.children) {
    matches.push(...findAll(child, predicate));
  }

  return matches;
}

function trigger(element: FakeElement | null, type: string): void {
  assert.ok(element, `Missing element for ${type}`);
  const handlers = element.eventListeners.get(type) ?? [];
  handlers.forEach((handler) => {
    handler({
      currentTarget: element,
      preventDefault() {
        return undefined;
      },
    });
  });
}

function loadTeamTetrisEngine() {
  return gameRoomHostModule.teamTetrisEngine as {
    createMatch: (options: Record<string, unknown>) => Record<string, unknown>;
    buildSeatView: (
      match: Record<string, unknown>,
      seatId: string
    ) => Record<string, unknown> | null;
    buildTurnToken: (
      matchId: string,
      turnIndex: number,
      seatId: string,
      teamId: string,
      pieceId: string,
      board: string[][]
    ) => string;
  };
}

function findSeedForUserTurn(engine: TeamTetrisEngine): string {
  for (let index = 0; index < 250; index += 1) {
    const seed = `ui-user-seed-${index}`;
    const match = engine.createMatch({ seed, hiddenPairs: true });
    if ((match.currentTurn as Record<string, unknown>).seatId === "user") {
      return seed;
    }
  }
  throw new Error("No Team Tetris seed found for a local-user opening turn");
}

function buildHostContext(translations: Record<string, unknown>) {
  return {
    type: "host-context",
    locale: "en",
    translations,
    room: {
      id: "game-room",
      name: "Game Room",
    },
    features: [
      { id: "xox", name: "XOX" },
      { id: "team-tetris", name: "Team Tetris" },
    ],
    activeFeature: {
      id: "team-tetris",
      name: "Team Tetris",
    },
    user: {
      nickname: "Raistlin",
    },
    slots: {
      ai1: {
        slotId: "ai1",
        nickname: "Atlas",
        assigned: true,
        connected: true,
        ready: true,
        state: "connected",
      },
      ai2: {
        slotId: "ai2",
        nickname: "Nova",
        assigned: true,
        connected: true,
        ready: true,
        state: "connected",
      },
      us1: {
        slotId: "us1",
        nickname: "Remote Ghost",
        assigned: true,
        connected: true,
        ready: true,
        state: "connected",
        remoteUserId: "remote@example.com",
      },
    },
  };
}

function buildTeamTetrisState(engine: TeamTetrisEngine) {
  const seed = findSeedForUserTurn(engine);
  const match = engine.createMatch({ seed, hiddenPairs: true });
  const currentTurn = match.currentTurn as Record<string, unknown>;
  const actingTeam = match.teams[String(currentTurn.teamId)] as Record<string, unknown>;
  currentTurn.pieceId = "T";
  currentTurn.legalRotations = [0, 1, 2, 3];
  currentTurn.turnToken = engine.buildTurnToken(
    String(match.matchId),
    Number(currentTurn.turnIndex),
    String(currentTurn.seatId),
    String(currentTurn.teamId),
    "T",
    actingTeam.board as string[][]
  );

  const userView = engine.buildSeatView(match, "user");
  return {
    type: "team-tetris-state",
    payload: {
      state: {
        roomId: "game-room",
        featureId: "team-tetris",
        schemaVersion: 1,
        active: true,
        result: "pending",
        hiddenPairs: true,
        revealPairsOnFinish: true,
        blockedReason: "",
        matchId: match.matchId,
        canStart: true,
        requiredSlots: {
          ai1: true,
          ai2: true,
          us1: true,
        },
        board: {
          width: 10,
          height: 20,
          seedLabel: String(match.matchId),
        },
        boards: [
          {
            teamId: userView?.ownTeam?.teamId ?? "team-a",
            visibility: "private",
            rows: userView?.ownTeam?.boardRows ?? [],
            boardBeforePartnerPieceRows: userView?.ownTeam?.boardBeforePartnerPieceRows ?? [],
            partnerLastPiece: userView?.ownTeam?.partnerLastPiece ?? null,
          },
          {
            teamId: userView?.opponentTeam?.teamId ?? "team-b",
            visibility: "public",
            rows: userView?.opponentTeam?.boardRows ?? [],
          },
        ],
        turnLoop: ["team-a-opener", "team-b-opener", "team-a-followup", "team-b-followup"],
        currentTurn,
        teams: userView?.teams ?? null,
        userView,
        status: "Your turn. Rotate the piece, draw the path, and submit the move.",
      },
    },
  };
}

function createUiRuntime() {
  const document = new FakeDocument();
  const app = document.createElement("div");
  app.id = "app";
  document.body.append(app);

  const sentCommands: Array<{ command: string; payload: Record<string, unknown> }> = [];
  let hostMessageHandler: ((message: Record<string, unknown>) => void) | null = null;

  const windowObject: Record<string, unknown> = {
    roomAPI: {
      sendCommand(command: string, payload: Record<string, unknown>) {
        sentCommands.push({ command, payload });
        return true;
      },
      onHostMessage(handler: (message: Record<string, unknown>) => void) {
        hostMessageHandler = handler;
      },
      ready() {
        return undefined;
      },
    },
  };

  const context = {
    window: windowObject,
    document,
    navigator: { language: "en-US" },
    console,
  };
  [
    "rooms/game-room/ui/context-runtime.js",
    "rooms/game-room/main-functions/xox/ui/module.js",
    "rooms/game-room/main-functions/team-tetris/ui/module.js",
    "rooms/game-room/ui/index.js",
  ].forEach((filePath) => {
    vm.runInNewContext(readFileSync(filePath, "utf8"), context);
  });

  return {
    document,
    windowObject,
    sentCommands,
    emitHostMessage(message: Record<string, unknown>) {
      hostMessageHandler?.(message);
    },
  };
}

test("Team Tetris UI renders the playable room surface with two board cards", () => {
  const runtime = createUiRuntime();
  const translations = JSON.parse(readFileSync("rooms/game-room/i18n/en.json", "utf8")) as Record<
    string,
    unknown
  >;
  const engine = loadTeamTetrisEngine();

  runtime.emitHostMessage(buildHostContext(translations));
  runtime.emitHostMessage(buildTeamTetrisState(engine));

  const boardCards = findAll(
    runtime.document.body,
    (element) => element.className === "tt-board-card"
  );
  assert.equal(boardCards.length >= 2, true);
  assert.ok(
    findFirst(runtime.document.body, (element) => element.textContent === "Team Tetris Table")
  );
  assert.ok(findFirst(runtime.document.body, (element) => element.textContent === "Submit Move"));
});

test("Team Tetris UI derives visible board and seat labels from room-local translations", () => {
  const runtime = createUiRuntime();
  const translations = JSON.parse(readFileSync("rooms/game-room/i18n/tr.json", "utf8")) as Record<
    string,
    unknown
  >;
  const engine = loadTeamTetrisEngine();
  const teamTetrisState = buildTeamTetrisState(engine);

  teamTetrisState.payload.state.boards[0].label = "Team A";
  teamTetrisState.payload.state.boards[1].label = "Team B";
  if (teamTetrisState.payload.state.userView?.seat) {
    teamTetrisState.payload.state.userView.seat.label = "USER";
    teamTetrisState.payload.state.userView.hiddenPairs = false;
    teamTetrisState.payload.state.userView.revealedPairs = true;
    teamTetrisState.payload.state.userView.teams = [
      { teamId: "team-a", seatIds: ["user", "ai1"], seatLabels: ["USER", "ATLAS"] },
      { teamId: "team-b", seatIds: ["ai2", "us1"], seatLabels: ["NOVA", "UZAK"] },
    ];
  }
  teamTetrisState.payload.state.hiddenPairs = false;
  teamTetrisState.payload.state.teams = [
    { teamId: "team-a", seatIds: ["user", "ai1"], seatLabels: ["USER", "ATLAS"] },
    { teamId: "team-b", seatIds: ["ai2", "us1"], seatLabels: ["NOVA", "UZAK"] },
  ];

  const hostContext = buildHostContext(translations);
  hostContext.locale = "tr";
  hostContext.room.name = "Oyun Odasi";
  hostContext.features[1].name = "Takim Tetris";
  hostContext.activeFeature.name = "Takim Tetris";
  hostContext.user.nickname = "Kullanici";
  hostContext.slots.us1.nickname = "Uzak";

  runtime.emitHostMessage(hostContext);
  runtime.emitHostMessage(teamTetrisState);

  assert.ok(
    findFirst(runtime.document.body, (element) => element.textContent === "Takim A Tahtasi")
  );
  assert.ok(
    findFirst(runtime.document.body, (element) => element.textContent === "Takim B Tahtasi")
  );
  assert.ok(
    findFirst(runtime.document.body, (element) => element.textContent === "Yerel Koltuk: Sen")
  );
  assert.equal(
    findFirst(runtime.document.body, (element) => element.textContent === "Team A"),
    null
  );
  assert.equal(
    findFirst(runtime.document.body, (element) => element.textContent === "Team B"),
    null
  );
  assert.equal(
    findFirst(runtime.document.body, (element) => element.textContent === "Local Seat: USER"),
    null
  );
  assert.equal(
    findFirst(
      runtime.document.body,
      (element) => element.textContent === "Takim A Tahtasi: USER + ATLAS"
    ),
    null
  );
  assert.ok(
    findFirst(
      runtime.document.body,
      (element) => element.textContent === "Takim A Tahtasi: Sen + Atlas"
    )
  );
});

test("Team Tetris UI rotates a piece, draws a path, and submits the canonical move payload", () => {
  const runtime = createUiRuntime();
  const translations = JSON.parse(readFileSync("rooms/game-room/i18n/en.json", "utf8")) as Record<
    string,
    unknown
  >;
  const engine = loadTeamTetrisEngine();

  runtime.emitHostMessage(buildHostContext(translations));
  runtime.emitHostMessage(buildTeamTetrisState(engine));

  const rotateButton = findFirst(
    runtime.document.body,
    (element) => element.tagName === "button" && element.textContent === "Rotate CW"
  );
  trigger(rotateButton, "click");

  const interactiveBoard = findFirst(
    runtime.document.body,
    (element) => element.className === "tt-board" && element.dataset.interactive === "true"
  );
  assert.ok(interactiveBoard);
  const targetCell = interactiveBoard.children[17 * 10 + 5];
  trigger(targetCell, "click");

  const submitButton = findFirst(
    runtime.document.body,
    (element) => element.tagName === "button" && element.textContent === "Submit Move"
  );
  assert.equal(submitButton?.disabled, false);
  trigger(submitButton, "click");

  assert.equal(runtime.sentCommands.length, 1);
  assert.equal(runtime.sentCommands[0]?.command, "GameRoomTeamTetrisUserMove");
  assert.equal(runtime.sentCommands[0]?.payload?.pieceId, "T");
  assert.equal(runtime.sentCommands[0]?.payload?.rotation, 1);
  assert.deepEqual(
    Array.from((runtime.sentCommands[0]?.payload?.rowShifts as number[]) ?? []),
    Array.from({ length: 17 }, () => 0)
  );
});
