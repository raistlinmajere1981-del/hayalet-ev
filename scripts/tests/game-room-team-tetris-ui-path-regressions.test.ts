import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { loadGameRoomHostModule } from "./helpers/game-room-host-module.ts";
import { loadWorkspaceScriptForVm } from "./helpers/room-workspace-script.ts";

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

function trigger(element: FakeElement | null | undefined, type: string): void {
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
    validateMove: (
      match: Record<string, unknown>,
      move: Record<string, unknown>
    ) => Record<string, unknown>;
    applyMove: (
      match: Record<string, unknown>,
      move: Record<string, unknown>
    ) => Record<string, unknown>;
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
    if ((match["currentTurn"] as Record<string, unknown>)["seatId"] === "user") {
      return seed;
    }
  }
  throw new Error("No Team Tetris seed found for a local-user opening turn");
}

function findSeedForSeat(engine: TeamTetrisEngine, targetSeatId: "user" | "us1"): string {
  for (let index = 0; index < 250; index += 1) {
    const seed = `ui-${targetSeatId}-seed-${index}`;
    const match = engine.createMatch({ seed, hiddenPairs: true });
    if ((match["currentTurn"] as Record<string, unknown>)["seatId"] === targetSeatId) {
      return seed;
    }
  }
  throw new Error(`No Team Tetris seed found for ${targetSeatId}`);
}

function findSeedForVisibleSeatWithPartner(
  engine: TeamTetrisEngine,
  targetSeatId: "user" | "us1",
  selectedPartnerSeatId: "ai1" | "ai2" | "us1"
): string {
  for (let index = 0; index < 250; index += 1) {
    const seed = `ui-${targetSeatId}-visible-${selectedPartnerSeatId}-${index}`;
    const match = engine.createMatch({
      seed,
      hiddenPairs: false,
      selectedPartnerSeatId,
    });
    const currentTurn = match["currentTurn"] as Record<string, unknown>;
    if (currentTurn["seatId"] === targetSeatId) {
      return seed;
    }
  }

  throw new Error(
    `No Team Tetris seed found for ${targetSeatId} with visible partner ${selectedPartnerSeatId}`
  );
}

function buildValidMoveForCurrentTurn(engine: TeamTetrisEngine, match: Record<string, unknown>) {
  const currentTurn = match["currentTurn"] as Record<string, unknown>;
  const legalRotations = Array.isArray(currentTurn["legalRotations"])
    ? (currentTurn["legalRotations"] as number[])
    : [0];

  for (const rotation of legalRotations) {
    for (let steps = 0; steps <= 19; steps += 1) {
      const move = {
        schemaVersion: 1,
        matchId: match["matchId"],
        turnIndex: currentTurn["turnIndex"],
        turnToken: currentTurn["turnToken"],
        pieceId: currentTurn["pieceId"],
        rotation,
        rowShifts: Array.from({ length: steps }, () => 0),
      };
      if (engine.validateMove(match, move)["success"] === true) {
        return move;
      }
    }
  }

  throw new Error("No valid Team Tetris move found for the current UI test turn");
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
      { id: "backgammon", name: "Tavla" },
      { id: "team-tetris", name: "Team Tetris" },
      { id: "fate-knots", name: "Fate Knots" },
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

function buildTeamTetrisState(
  engine: TeamTetrisEngine,
  options: {
    localSeatId?: "user" | "us1";
    seed?: string;
    hiddenPairs?: boolean;
    selectedPartnerSeatId?: "ai1" | "ai2" | "us1";
  } = {}
) {
  const localSeatId = options.localSeatId ?? "user";
  const hiddenPairs = options.hiddenPairs !== false;
  const seed =
    options.seed ??
    (localSeatId === "us1" ? findSeedForSeat(engine, "us1") : findSeedForUserTurn(engine));
  const match = engine.createMatch({
    seed,
    hiddenPairs,
    ...(options.selectedPartnerSeatId != null
      ? { selectedPartnerSeatId: options.selectedPartnerSeatId }
      : {}),
  });
  const currentTurn = match["currentTurn"] as Record<string, unknown>;
  const actingTeam = (match["teams"] as Record<string, Record<string, unknown>>)[String((currentTurn as Record<string, string>)["teamId"])] as Record<string, unknown>;
  currentTurn["pieceId"] = "T";
  currentTurn["legalRotations"] = [0, 1, 2, 3];
  currentTurn["turnToken"] = engine.buildTurnToken(
    String(match["matchId"]),
    Number(currentTurn["turnIndex"]),
    String(currentTurn["seatId"]),
    String((currentTurn as Record<string, string>)["teamId"]),
    "T",
    actingTeam["board"] as string[][]
  );

  const uv = engine.buildSeatView(match, localSeatId);
  const ownTeam = uv?.["ownTeam"] as {
    teamId?: string;
    boardRows?: string[][];
    boardBeforePartnerPieceRows?: string[][];
    partnerLastPiece?: unknown;
  } | undefined;
  const opponentTeam = uv?.["opponentTeam"] as {
    teamId?: string;
    boardRows?: string[][];
  } | undefined;
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
        matchId: match["matchId"],
        canStart: true,
        requiredSlots: {
          ai1: true,
          ai2: true,
          us1: true,
        },
        board: {
          width: 10,
          height: 20,
          seedLabel: String(match["matchId"]),
        },
        boards: [
          {
            teamId: ownTeam?.teamId ?? "team-a",
            visibility: "private",
            rows: ownTeam?.boardRows ?? [],
            boardBeforePartnerPieceRows: ownTeam?.boardBeforePartnerPieceRows ?? [],
            partnerLastPiece: ownTeam?.partnerLastPiece ?? null,
          },
          {
            teamId: opponentTeam?.teamId ?? "team-b",
            visibility: "public",
            rows: opponentTeam?.boardRows ?? [],
          },
        ],
        turnLoop: ["team-a-opener", "team-b-opener", "team-a-followup", "team-b-followup"],
        currentTurn,
        teams: uv?.["teams"] ?? null,
        userView: uv,
        status: "Your turn. Rotate the piece, draw the path, and submit the move.",
      },
    },
  };
}

function buildTeamTetrisStateAfterVisiblePartnerMove(engine: TeamTetrisEngine) {
  const seed = findSeedForVisibleSeatWithPartner(engine, "us1", "us1");
  const openingMatch = engine.createMatch({
    seed,
    hiddenPairs: false,
    selectedPartnerSeatId: "us1",
  });
  const firstApplied = engine.applyMove(
    openingMatch,
    buildValidMoveForCurrentTurn(engine, openingMatch)
  );
  assert.equal(firstApplied["success"], true);

  const secondMatch = firstApplied["match"] as Record<string, unknown>;
  const secondApplied = engine.applyMove(
    secondMatch,
    buildValidMoveForCurrentTurn(engine, secondMatch)
  );
  assert.equal(secondApplied["success"], true);

  const match = secondApplied["match"] as Record<string, unknown>;
  const currentTurn = match["currentTurn"] as Record<string, unknown>;
  assert.equal(currentTurn["seatId"], "user");

  const uv2 = engine.buildSeatView(match, "user");
  const ownTeam2 = uv2?.["ownTeam"] as {
    teamId?: string;
    boardRows?: string[][];
    boardBeforePartnerPieceRows?: string[][];
    partnerLastPiece?: unknown;
  } | undefined;
  const opponentTeam2 = uv2?.["opponentTeam"] as {
    teamId?: string;
    boardRows?: string[][];
  } | undefined;
  return {
    type: "team-tetris-state",
    payload: {
      state: {
        roomId: "game-room",
        featureId: "team-tetris",
        schemaVersion: 1,
        active: true,
        result: "pending",
        hiddenPairs: false,
        revealPairsOnFinish: true,
        blockedReason: "",
        matchId: match["matchId"],
        canStart: true,
        requiredSlots: {
          ai1: true,
          ai2: true,
          us1: true,
        },
        board: {
          width: 10,
          height: 20,
          seedLabel: String(match["matchId"]),
        },
        boards: [
          {
            teamId: ownTeam2?.teamId ?? "team-a",
            visibility: "private",
            rows: ownTeam2?.boardRows ?? [],
            boardBeforePartnerPieceRows: ownTeam2?.boardBeforePartnerPieceRows ?? [],
            partnerLastPiece: ownTeam2?.partnerLastPiece ?? null,
          },
          {
            teamId: opponentTeam2?.teamId ?? "team-b",
            visibility: "public",
            rows: opponentTeam2?.boardRows ?? [],
          },
        ],
        turnLoop: ["team-a-opener", "team-b-opener", "team-a-followup", "team-b-followup"],
        currentTurn,
        teams: uv2?.["teams"] ?? null,
        userView: uv2,
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
    "rooms/game-room/ui/context-runtime.ts",
    "rooms/game-room/shared/ui/feature-contract.ts",
    "rooms/game-room/shared/ui/scroll-runtime.ts",
    "rooms/game-room/main-functions/backgammon/ui/state-runtime.ts",
    "rooms/game-room/main-functions/backgammon/ui/render-runtime.ts",
    "rooms/game-room/main-functions/backgammon/ui/module.ts",
    "rooms/game-room/main-functions/team-tetris/ui/draft-runtime.ts",
    "rooms/game-room/main-functions/team-tetris/ui/state-shape-runtime.ts",
    "rooms/game-room/main-functions/team-tetris/ui/state-view-runtime.ts",
    "rooms/game-room/main-functions/team-tetris/ui/state-runtime.ts",
    "rooms/game-room/main-functions/team-tetris/ui/module-card-runtime.ts",
    "rooms/game-room/main-functions/team-tetris/ui/module-shell-runtime.ts",
    "rooms/game-room/main-functions/team-tetris/ui/module.ts",
    "rooms/game-room/main-functions/fate-knots/ui/module.ts",
    "rooms/game-room/ui/game-room-ui-bootstrap.ts",
    "rooms/game-room/ui/game-room-ui-state-message-runtime.ts",
    "rooms/game-room/ui/game-room-ui-runtime.ts",
    "rooms/game-room/ui/index.ts",
  ].forEach((filePath) => {
    vm.runInNewContext(loadWorkspaceScriptForVm(filePath), context);
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
