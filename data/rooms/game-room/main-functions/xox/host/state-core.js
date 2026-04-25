import { normalizeLocale, normalizeText } from "../../../shared/host/text.js";
export const MATCH_HISTORY_LIMIT = 20;
export const TERMINAL_RESULTS = /* @__PURE__ */ new Set(["user-win", "ai-win", "draw"]);
export const EMPTY_BOARD = ["", "", "", "", "", "", "", "", ""];
export const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
];
export const DEFAULT_TARGET = "ai1";
export const DEFAULT_STARTER = "user";
export const US1_SYNC_INTERVAL_MS = 5e3;
export const STATUS_COPY = {
  idle: {
    en: "Choose a ready opponent or accept an incoming XOX invite.",
    tr: "Hazir bir rakip sec veya gelen XOX davetlerinden birini kabul et."
  },
  invitePending: {
    en: "Invite sent to {opponent}. Waiting for a reply.",
    tr: "{opponent} tarafina davet gonderildi. Yanit bekleniyor."
  },
  userTurn: {
    en: "Your turn. Place your mark on an empty cell.",
    tr: "Sira sende. Bos bir hucreye isaretini yerlestir."
  },
  aiTurn: {
    en: "Waiting for {opponent} to answer with a move.",
    tr: "{opponent} hamlesini gonderene kadar bekleniyor."
  },
  userWin: {
    en: "You won the XOX match.",
    tr: "XOX macini sen kazandin."
  },
  aiWin: {
    en: "{opponent} won the XOX match.",
    tr: "{opponent} XOX macini kazandi."
  },
  draw: {
    en: "Draw. No cells remain open.",
    tr: "Berabere. Acik hucre kalmadi."
  },
  inviteRejected: {
    en: "{opponent} rejected the XOX invite.",
    tr: "{opponent} XOX davetini reddetti."
  },
  remoteReset: {
    en: "{opponent} ended the XOX match.",
    tr: "{opponent} XOX macini sonlandirdi."
  },
  blockedOpponent: {
    en: "{opponent} disconnected during the match. Reset to begin again.",
    tr: "{opponent} mac sirasinda baglantidan dustu. Yeniden baslamak icin sifirla."
  },
  blockedDispatch: {
    en: "The latest board update could not be delivered to {opponent}. Reset to try again.",
    tr: "Guncel tahta durumu {opponent} tarafina iletilemedi. Tekrar denemek icin sifirla."
  },
  blockedInvalidMove: {
    en: "{opponent} returned an invalid XOX move. Reset to start over.",
    tr: "{opponent} gecersiz bir XOX hamlesi dondu. Basa almak icin sifirla."
  }
};
export const COMMAND_COPY = {
  started: {
    en: "XOX match started.",
    tr: "XOX maci baslatildi."
  },
  inviteSent: {
    en: "XOX invite sent to the remote opponent.",
    tr: "Uzak rakibe XOX daveti gonderildi."
  },
  reset: {
    en: "XOX match reset.",
    tr: "XOX maci sifirlandi."
  },
  needReadyOpponent: {
    en: "The selected opponent is not ready.",
    tr: "Secilen rakip hazir degil."
  },
  pendingInviteExists: {
    en: "There is already a pending remote invite. Reset first if you want to start over.",
    tr: "Bekleyen bir uzak davet zaten var. Basa donmek icin once sifirla."
  },
  noActiveGame: {
    en: "There is no active XOX match.",
    tr: "Aktif bir XOX maci yok."
  },
  blockedGame: {
    en: "This match is blocked. Reset to start again.",
    tr: "Bu mac bloke oldu. Yeniden baslamak icin sifirla."
  },
  notUserTurn: {
    en: "It is not the user's turn.",
    tr: "Sira kullanicida degil."
  },
  invalidCell: {
    en: "Choose a valid board cell from 0 to 8.",
    tr: "0 ile 8 arasinda gecerli bir tahta hucresi sec."
  },
  cellFilled: {
    en: "That cell is already filled.",
    tr: "Bu hucre zaten dolu."
  },
  moveSent: {
    en: "Move applied and sent to the opponent.",
    tr: "Hamle uygulandi ve rakibe gonderildi."
  },
  aiTurnOnly: {
    en: "The room is not waiting for an opponent move.",
    tr: "Oda su an bir rakip hamlesi beklemiyor."
  },
  providerMismatch: {
    en: "The move came from a different opponent than the active match.",
    tr: "Hamle aktif mactakinden farkli bir rakipten geldi."
  },
  inviteMismatch: {
    en: "The invite does not match the active XOX match.",
    tr: "Davet bilgisi aktif XOX maci ile eslesmiyor."
  },
  aiInvalidMove: {
    en: "The opponent sent an invalid move.",
    tr: "Rakip gecersiz bir hamle gonderdi."
  },
  aiFilledCell: {
    en: "The opponent tried to play into a filled cell.",
    tr: "Rakip dolu bir hucreye oynamaya calisti."
  },
  dispatchFailed: {
    en: "The board update could not be sent to the opponent.",
    tr: "Tahta guncellemesi rakibe gonderilemedi."
  },
  inviteNotFound: {
    en: "The selected invite is no longer available.",
    tr: "Secilen davet artik kullanilabilir degil."
  },
  inviteAcceptFailed: {
    en: "The invite could not be accepted.",
    tr: "Davet kabul edilemedi."
  },
  inviteRejectFailed: {
    en: "The invite could not be rejected.",
    tr: "Davet reddedilemedi."
  },
  inviteAccepted: {
    en: "The invite was accepted and the match is ready.",
    tr: "Davet kabul edildi ve mac hazir."
  },
  inviteRejected: {
    en: "The invite was rejected.",
    tr: "Davet reddedildi."
  },
  staleRemoteMove: {
    en: "A stale remote move was ignored.",
    tr: "Gec kalan uzak hamle yoksayildi."
  },
  duplicateRemoteMove: {
    en: "A duplicate remote move was ignored.",
    tr: "Yinelenen uzak hamle yoksayildi."
  },
  resetRemoteFailed: {
    en: "Local reset applied, but the remote side could not be notified.",
    tr: "Yerel sifirlama uygulandi, ancak uzak tarafa bildirim gonderilemedi."
  },
  incomingInviteToast: {
    en: "{opponent} sent a new XOX invite.",
    tr: "{opponent} yeni bir XOX daveti gonderdi."
  }
};
export function sanitizeTarget(value) {
  if (value === "ai2" || value === "us1") {
    return value;
  }
  return DEFAULT_TARGET;
}
export function sanitizeStarter(value) {
  return value === "ai" ? "ai" : DEFAULT_STARTER;
}
export function cloneBoard(board) {
  return Array.isArray(board) ? board.slice(0, 9).map(function(value) {
    return typeof value === "string" ? value : "";
  }) : EMPTY_BOARD.slice();
}
export function normalizeBoard(board) {
  const next = cloneBoard(board);
  while (next.length < 9) {
    next.push("");
  }
  return next.map(function(value) {
    return value === "X" || value === "O" ? value : "";
  });
}
export function getSymbols(starter) {
  return sanitizeStarter(starter) === "ai" ? { userSymbol: "O", aiSymbol: "X" } : { userSymbol: "X", aiSymbol: "O" };
}
export function buildBoardAscii(board) {
  const rows = [];
  for (let row = 0; row < 3; row += 1) {
    const values = [];
    for (let column = 0; column < 3; column += 1) {
      const index = row * 3 + column;
      values.push(board[index] === "" ? String(index) : board[index]);
    }
    rows.push(values.join(" | "));
  }
  return rows.join("\n---------\n");
}
export function buildBoardStateHash(board) {
  return normalizeBoard(board).map(function(value) {
    return value === "" ? "." : value;
  }).join("");
}
export function getAvailableCells(board) {
  return board.reduce(function(available, value, index) {
    if (value === "") {
      available.push(index);
    }
    return available;
  }, []);
}
export function createInitialState(locale, target, starter) {
  const normalizedLocale = normalizeLocale(locale);
  const normalizedTarget = sanitizeTarget(target);
  const normalizedStarter = sanitizeStarter(starter);
  const symbols = getSymbols(normalizedStarter);
  return {
    locale: normalizedLocale,
    target: normalizedTarget,
    starter: normalizedStarter,
    board: EMPTY_BOARD.slice(),
    active: false,
    awaitingMoveFrom: null,
    result: "idle",
    winner: "",
    statusKey: "idle",
    protocolDelivered: false,
    blockedReason: "",
    userSymbol: symbols.userSymbol,
    aiSymbol: symbols.aiSymbol,
    protocolPreface: "",
    matchId: null,
    inviteId: null,
    turnIndex: 0,
    localSessionId: null,
    remoteUserId: null,
    opponentNickname: "",
    lastRemoteTransportMessageId: null,
    lastRemoteTurnIndex: null
  };
}
export function normalizeState(candidate, localeFallback) {
  const source = candidate && typeof candidate === "object" && Array.isArray(candidate) === false ? candidate : {};
  const state = createInitialState(
    source["locale"] || localeFallback,
    typeof source["target"] === "string" ? source["target"] : "",
    typeof source["starter"] === "string" ? source["starter"] : ""
  );
  state.board = normalizeBoard(source["board"]);
  state.active = source["active"] === true;
  state.awaitingMoveFrom = source["awaitingMoveFrom"] === "ai" || source["awaitingMoveFrom"] === "user" ? source["awaitingMoveFrom"] : null;
  state.result = typeof source["result"] === "string" && source["result"].trim() !== "" ? source["result"].trim() : "idle";
  state.winner = source["winner"] === "ai" || source["winner"] === "user" ? source["winner"] : "";
  state.statusKey = typeof source["statusKey"] === "string" && Object.prototype.hasOwnProperty.call(STATUS_COPY, source["statusKey"]) ? source["statusKey"] : "idle";
  state.protocolDelivered = source["protocolDelivered"] === true;
  state.blockedReason = typeof source["blockedReason"] === "string" && source["blockedReason"].trim() !== "" ? source["blockedReason"].trim() : "";
  state.protocolPreface = normalizeText(source["protocolPreface"]);
  state.matchId = normalizeText(source["matchId"]) || normalizeText(source["inviteId"]) || null;
  state.inviteId = normalizeText(source["inviteId"]) || null;
  state.turnIndex = typeof source["turnIndex"] === "number" && Number.isInteger(source["turnIndex"]) && source["turnIndex"] >= 0 ? source["turnIndex"] : 0;
  state.localSessionId = normalizeText(source["localSessionId"]) || null;
  state.remoteUserId = normalizeText(source["remoteUserId"]) || null;
  state.opponentNickname = normalizeText(source["opponentNickname"]);
  state.lastRemoteTransportMessageId = normalizeText(source["lastRemoteTransportMessageId"]) || null;
  state.lastRemoteTurnIndex = typeof source["lastRemoteTurnIndex"] === "number" && Number.isInteger(source["lastRemoteTurnIndex"]) && source["lastRemoteTurnIndex"] >= 0 ? source["lastRemoteTurnIndex"] : null;
  return state;
}
export function normalizeMatchHistoryEntry(candidate) {
  if (candidate === null || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }
  const source = candidate;
  const id = normalizeText(source["id"]);
  const result = source["result"];
  if (id === "" || result !== "user-win" && result !== "ai-win" && result !== "draw") {
    return null;
  }
  const finishedAt = typeof source["finishedAt"] === "number" && Number.isFinite(source["finishedAt"]) && source["finishedAt"] >= 0 ? Math.trunc(source["finishedAt"]) : 0;
  const userSymbol = source["userSymbol"] === "O" ? "O" : "X";
  const aiSymbol = source["aiSymbol"] === "X" ? "X" : "O";
  return {
    id,
    finishedAt,
    target: normalizeText(source["target"]) || "ai1",
    opponentNickname: normalizeText(source["opponentNickname"]) || "Rakip",
    opponentAvatar: normalizeText(source["opponentAvatar"]) || null,
    userNickname: normalizeText(source["userNickname"]) || "User",
    userSymbol,
    aiSymbol,
    result,
    starter: source["starter"] === "ai" ? "ai" : "user",
    board: normalizeBoard(source["board"])
  };
}
export function normalizeMatchHistory(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const entries = [];
  for (let index = 0; index < value.length; index += 1) {
    const entry = normalizeMatchHistoryEntry(value[index]);
    if (entry !== null) {
      entries.push(entry);
    }
  }
  if (entries.length > MATCH_HISTORY_LIMIT) {
    return entries.slice(0, MATCH_HISTORY_LIMIT);
  }
  return entries;
}
export function getOutcomeForBoard(board, state) {
  for (let index = 0; index < WIN_LINES.length; index += 1) {
    const line = WIN_LINES[index];
    if (!line) {
      continue;
    }
    const firstIndex = line[0];
    const secondIndex = line[1];
    const thirdIndex = line[2];
    if (firstIndex === void 0 || secondIndex === void 0 || thirdIndex === void 0) {
      continue;
    }
    const first = board[firstIndex];
    const second = board[secondIndex];
    const third = board[thirdIndex];
    if (first !== "" && first === second && second === third) {
      if (first === state.userSymbol) {
        return { finished: true, result: "user-win", winner: "user", statusKey: "userWin" };
      }
      return { finished: true, result: "ai-win", winner: "ai", statusKey: "aiWin" };
    }
  }
  if (board.every(function(value) {
    return value !== "";
  })) {
    return { finished: true, result: "draw", winner: "", statusKey: "draw" };
  }
  return { finished: false };
}
